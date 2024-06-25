# 3. Redis

## 数据结构

### 布隆过滤器

用一个 BitMap, 使用 n 个不同的散列函数将一个元素映射到 n 个位点上  
一个元素如果判断结果为存在的时候元素不一定存在，但是判断结果为不存在的时候则一定不存在。  
可以添加元素，但不能删除元素  
在使用 bloom filter 时，绕不过的两点是预估数据量 n 以及期望的误判率 fpp，  
在实现 bloom filter 时，绕不过的两点就是 hash 函数的选取以及 bit 数组的大小。

---

## 过期策略

通过过期字典(字典 key 指向具体的数据 key, val 是毫秒精度的时间戳 long long 类型的整数)保存数据过期时间. 定时遍历删除+惰性删除

-   定时扫描策略
    **每秒 10 次**过期扫描, 贪心策略:随机选 20 个, 如果过期比例超过 25%, 重复; 为防止线程卡死，每次不超过 25ms  
    这样会导致卡顿, 不要让大批 key 同时过期

-   惰性删除
    访问时检查

---

## 内存淘汰机制

**过期集**

1. volatile-lru（least recently used）：从已设置过期时间的数据集（server.db[i].expires）中挑选最早使用的数据淘汰
2. volatile-ttl：从已设置过期时间的数据集（server.db[i].expires）中挑选将要过期的数据淘汰
3. volatile-random：从已设置过期时间的数据集（server.db[i].expires）中任意选择数据淘汰

**全集** 4. allkeys-lru（least recently used）：当内存不足以容纳新写入数据时，在键空间中，移除最近最早使用的 key（这个是最常用的） 5. allkeys-random：从数据集（server.db[i].dict）中任意选择数据淘汰

**禁止** 6. no-eviction：禁止驱逐数据，也就是说当内存不足以容纳新写入数据时，新写入操作会报错。

**4.0 版本后增加以下两种**：

1. volatile-lfu（least frequently used）：从已设置过期时间的数据集(server.db[i].expires)中挑选最不经常使用的数据淘汰
2. allkeys-lfu（least frequently used）：当内存不足以容纳新写入数据时，在键空间中，移除最不经常使用的 key

---

## 持久化

通常是从节点进行持久化，从节点作为备份节点，没有客户端请求的压力

### 快照持久化（snapshotting，RDB）

默认方式, 通过创建快照,获取数据某个时间点的副本, 可以复制到从服务器或者留存到本地 //通过 COW 的方式
一段时间内超过一定数量的 key 发生变化，会创建快照
Redis.conf

```sh
save 900 1           #在900秒(15分钟)之后，如果至少有1个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
save 300 10          #在300秒(5分钟)之后，如果至少有10个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
save 60 10000        #在60秒(1分钟)之后，如果至少有10000个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
```

save: 主线程执行
bgsave: 子线程执行(default)

### 只追加文件（append-only file, AOF）

开启 AOF 后执行的每一条更改命令, redis 都会将该命令写入缓存,然后刷盘到 AOF 文件. AOF 文件和 RDB 文件位置相同, 都是通过 dir 参数设置的,
默认的文件名是 append only.aof

刷盘频率:

```sh
appendfsync everysec  #每秒执行一次fsync操作
appendfsync always    #每次有数据修改发生时都会写入AOF文件,这样会严重降低Redis的速度. 能保证完整性
appendfsync no        #让操作系统决定何时进行同步 交给内核
```

3. redis 4.0 开始支持 RDB 和 AOF 的混合持久化(默认关闭, 可通过配置项 aof-use-rdb-preamble 开启)

### AOF 重写

子进程分析内存生成新的 AOF 文件, 然后追加生成期间内产生的指令

---

## redis>

Redis 可以通过 **MULTI，EXEC，DISCARD** 和 **WATCH** 等命令来实现事务功能。
DISCARD 丢弃 MULTI 到 DISCARD 之间的所有指令, 必须在 EXEC 之前使用.
WATCH 必须先于 MULTI 使用. 乐观锁的方式, 盯住一些变量, 在执行的时候检查是否被修改, 如果被修改返回错误, 客户端处理(通常是重试)
redis 事务不支持 rollback, 所以不满足原子性.
可以理解为是多个命令顺序打包执行, 且执行过程不会被中断(即便前面执行失败也会继续执行后续指令).

---

## 业务场景

### 热 key

https://dongzl.github.io/2021/01/14/03-Redis-Hot-Key/index.html

#### 热 key 带来的问题

流量集中，达到服务器处理上限
IO 打满，其他 key 受影响
落在某一个单实例，无法通过扩容解决
redis 不可用导致缓存击穿，DB 也会被打爆

#### 如何发现

客户端侧，服务器节点侧，redis 命令

-   业务经验预估
-   客户端收集验证
    对客户端工具（SDK，如 Jedis、Redisson）进行封装，在发送请求前进行收集，同时定时把收集到的数据上报到统一的服务进行聚合计算。
-   代理层收集
    跟上面的客户端收集类似
-   redis 命令
    -   hotkeys
    -   monitor
-   节点抓包

#### 解决方案

水平扩容，增加实例副本数量
二级缓存，本地缓存
热 key 备份

---

### 大 key

-   string 大小超过 10kb
-   val 元素超过 5k 个

#### 发现

-   redis-cli --bigkeys 参数
-   分析 RDB 文件

#### 删除

version > 4.0, UNLINK 命令异步删除

---

### 缓存穿透

缓存中和 DB 中都没有

### 缓存击穿

缓存中没有(因为过期等原因), 没有起到缓存的效果, 全打到 DB 上了;  
可以在缓存之后加一层布隆过滤器;

### 缓存雪崩

缓存在同一时间大面积失效, 失去缓存效果.
**针对 redis 服务不可用的情况**:
用 redis 集群, 避免单机宕机导致整个缓存服务不可用;
熔断限流, 避免同时处理大量请求;
**针对热点缓存失效的情况**:
设置缓存失效时间添加随机值;

---

### 缓存与 DB 一致性

3 个核心问题:

-   缓存更新还是淘汰

    -   更新操作在业务逻辑复杂的时候开销大，淘汰的代价只是一次 miss;
    -   首先改 db 和淘汰缓存不是原子的，那么就有先后，考虑到先更新 db 后淘汰缓存出现失败的情况，那么一定要先淘汰缓存；
    -   再考虑到更改 db 过程中有可能读到缓存中，那就可以采用延时双删，异步双删; 如果要求对业务没有侵入性, 就读 binlog;

-   先操作谁

    -   谁操作失败造成的代价小, 就先操作谁; 所以先删除缓存

-   架构优化方案
    -   数据服务化, 与业务解耦

---

### 分布式锁使用场景

进程之间保证有序性，分布式服务下需要顺序执行

### 分布式锁

使用 setnx(set if not exists) 指令，处理完成后 del。但是如果出现异常会出现死锁，那么需要加 expire,
但是 expire 不是原子指令。2.8 版本官方加了 set 指令的扩展参数。

#### 超时问题

分布式锁不能解决超时问题。一个更安全的方案是给 set 指令的 value 参数加一个随机数，释放锁的时候先匹配随机数，然后删除释放锁。但是匹配 value 和删除操作不是原子操作。可以用 lua 脚本处理。

#### 可重入性

使用 threadLocal 存储当前持有锁的计数。

#### 哨兵集群中，主节点挂掉，锁失效问题

Redlock 算法，加锁时向过半的节点发送指令，过半的节点成功则认为加锁成功，释放锁的时候向所有节点发送 del 指令。
使用时需要做很多的额外细节处理，运维，出错重试，时钟漂移等，不建议使用

---

## 杂七杂八

### 常用缓存对比

Redis Memcached

| 缓存      | 数据类型 | 持久化 | 集群       | 过期策略          |
| --------- | -------- | ------ | ---------- | ----------------- |
| redis     | 5 种     | 支持   | 原生支持   | 惰性删除+定期删除 |
| memcached | 1 种     | 不支持 | 原生不支持 | 惰性删除          |

-   redis 支持的数据类型更丰富
-   redis 支持数据持久化, 可以保存在硬盘, 重启的时候能再次加载
-   memcached 没有原生的集群模式, redis 原生支持集群
-   memcached 过期只用惰性删除, redis 支持惰性删除和定期删除

### Redis 为啥快

-   内存
-   数据结构
-   Reactor 模式的事件处理模型, 单线程循环事件和 IO 多路复用

### 文件-事件处理器

Redis 基于 Reactor 模式开发了自己的网络事件处理器：这个处理器被称为文件事件处理器（file event handler）。
redis 采用 epoll 来实现 I/O 多路复用（linux 本身的内核技术），将连接信息和事件放到队列中，依次放到 EventDispatcher，EventDispatcher 将事件发送给 EventProcesser
文件事件处理器使用 I/O 多路复用（multiplexing）同时监听多个套接字(Socket)，并根据套接字目前执行的任务来为套接字关联不同的事件处理器。

当被监听的套接字准备好执行连接应答（accept）、读取（read）、写入（write）、关
闭（close）等操作时，与操作相对应的文件事件就会产生，这时文件事件分派器就会调用套接字之前关联好的事件处理器来处理这些事件。

虽然文件事件处理器以单线程方式运行，但通过使用 I/O 多路复用程序来监听多个套接字，文件事件处理器既实现了高性能的网络通信模型，又可以很好地与
Redis 服务器中其他同样以单线程方式运行的模块进行对接，这保持了 Redis 内部单线程设计的简单性。

### 单线程

例如在秒杀场景, 落在 DB 层一定是串行的, 而 redis 单线程的设计恰如其分
4.0 版本在**异步删除大对象**加入了多线程
6.0 为了提高**网络 IO 读写性能**(性能瓶颈在内存和网络,而不是 CPU,这是不使用多线程的主要原因)

### 多线程

修改 redis 配置文件 redis.conf

```sh
io-threads-do-reads yes
io-threads 4 #官网建议4核的机器建议设置为2或3个线程，8核的建议设置为6个线程
```

## 分布式解决方案

#### 主从同步

增量同步 + 快照同步
主备同步
启动初始化
rewrite

#### 哨兵

哨兵集群，客户端先访问哨兵，哨兵给出节点地址；节点不可用则由哨兵选出下一个主节点
主从复制是异步复制，那么主节点故障时可能会丢失消息；解决方案是必须至少有 x 个从节点 y 秒内有心跳，否则不可用

#### 压力过大

分片集群 代理集群

#### AKF

扩展问题，可以分为三个维度扩展
X:主主 主从 主备
Y:业务、技术服务维度拆分
Z:数据维度拆分
分片怎么做: redis 做自有的治理, 请求到 redis 上之后 redis 通过算法决定哪个槽位处理

### copy-on-write(COW)

如果有多个调用者同时请求相同资源（如内存或磁盘上的数据存储），他们会共同获取相同的指针指向相同的资源，直到某个调用者试图修改资源的内容时，系统才会真正复制一份专用副本（private
copy）给该调用者，而其他调用者所见到的最初的资源仍然保持不变。

### BIO NIO 问题

> socket -> bind -> listen

**历史时期 BIO**:
因为 client 通过 TCP 连接 kernel(内核), 每个连接就是一个文件描述符(如 fd8), 导致线程从 kernel 读取 fd8 的时候产生阻塞,
必须通过另外的线程等待连接. 线程的开销大
**历史时期 NIO**:
通过循环读取 fd, 系统调用会有用户态到内核态切换的过程, client 多的时候循环次数多, 时间开销大
**历史时期多路复用**:
内核改变, 调用 select(), 内核去遍历. 但是每次调用 select 会传递所有的文件描述符, 并且每次遍历所有的文件描述符
**epoll**:
I/O event notification facility
epoll*create, epoll_ctl, epoll*

### 硬盘吞吐

可达百兆/G
内存 ns 级别 硬盘 寻址时间 ms 级别
总线标准通常两种(消费级): SATA PCIe
SSD 的规格协议通常两种(消费级): AHCI NVMe (与上文对应

## 场景

### 排行榜

```sh
ZRANGE key 0 -1 #从小到大排序
ZREVRANGE #从大到小排序
ZREVRANK key element #特定元素排名
ZSCORE key element #特定元素分数
```

### 抽奖

SET

```sh
SPOP key count #随机移除并获取指定集合中一个或多个元素，适合不允许重复中奖的场景
SRANDMEMBER key count #随机获取指定集合中指定数量的元素，适合允许重复中奖的场景
```

### 活跃用户统计

SETBIT
使用日期作为 key, 用户 ID 为 offset, 如果当日活跃过就设置为 1

初始化:

```sh
> SETBIT 20210308 1 1
(integer) 0
> SETBIT 20210308 2 1
(integer) 0
> SETBIT 20210309 1 1
(integer) 0
```

统计 20210308~20210309 每天都活跃的用户数:

```sh
> BITOP AND dest1 20210308 20210309
(integer) 1
> BITCOUNT dest1
(integer) 1
```

统计 20210308~20210309 活跃过的用户数:

```sh
> BITOP OR dest2 20210308 20210309
(integer) 1
> BITCOUNT dest2
(integer) 2
```

### 统计 UV

PV: page visit
UV: unique visit
HyperLogLog

```sh
redis> PFADD hll a b c d e f g
(integer) 1
redis> PFCOUNT hll
(integer) 7
redis> PFADD hll a
(integer) 0
redis> PFCOUNT hll
(integer) 7
```
