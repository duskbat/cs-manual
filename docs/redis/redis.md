---
outline: [2, 3]
---

# Redis

## 基础数据结构

### string

动态字符串 SDS

#### SDS

为什么用 SDS, C 语言中的字符串标准形式以 NULL 作为结束符, 获取长度的函数 strlen 的时间复杂度是 O(n), 单线程的 redis 难以承受

```c
struct __attribute__ ((__packed__)) sdshdr8 {
    uint8_t len;
    uint8_t alloc;
    unsigned char flags;
    char buf[];
};
```

> 泛型可以在字符串较短的时候使用 byte 和 short

创建的时候 len == alloc, 通常不怎么使用 append 命令

预分配冗余空间以减少内存的频繁分配。  
扩容时, 小于 1M 直接加倍，超过 1M 加 1M，字符串最大 512M 字节。

> 注意, 分配的空间是分配给 SDS 的空间

#### 存储格式 emb 和 raw

-   encoding: embstr alloc 一次
-   encoding: raw alloc 两次

先说结论: <=44 字节 用 embstr, 超过 44 用 raw

对象头 RedisObject 大小为 16B, SDS 结构最小为 3B, SDS.content 以 \\0 结尾, alloc 分配内存通常 32B 或 64B.  
64-16-3-1 = 44

#### 命令

| command |                     |
| ------- | ------------------- |
| set     | key val             |
| get     | key                 |
| exists  | key                 |
| del     | key                 |
| mget    | key1 key2           |
| mset    | key1 val1 key2 val2 |
| expire  | key sec             |
| setex   | key sec val         |
| setnx   | key val             |
| incr    | key                 |
| incrby  | key num             |

> 可以批量操作减少网络开销  
> 可设置过期  
> 可以自增, 最大 signed long

### list

双向链表，插入删除操作快，索引定位 O(n)  
当列表弹出最后一个元素之后，该数据结构自动被删除，内存被回收。  
通常当作异步队列使用，将需要延后处理的任务结构体序列化成字符串塞进列表，另一个线程从这个列表中轮询进行处理。

结构 quicklist  
列表元素较少的时候使用连续的内存存储, 这个结构是 ziplist;  
数据量比较多的时候改成 quicklist, ziplist 加前后指针。

#### 命令

| command |                    |
| ------- | ------------------ |
| rpush   | key val1 val2 val3 |
| llen    | key                |
| lpop    | key                |
| rpop    | key                |
| lindex  | key idx            |
| lrange  | key l_idx r_idx    |
| ltrim   | key l_idx r_idx    |

> lindex、ltrim 是慢操作

### hash

底层用哈希表(数组加链表)实现.  
rehash 是渐进式的，会保留新旧两个 hash 结构，同时查询，然后在后续的定时任务以及 hash 的子指令中，渐渐将旧 hash 转到新 hash。

#### 命令

| command |                             |
| ------- | --------------------------- |
| hset    | key hkey hval               |
| hgetall | key                         |
| hlen    | key                         |
| hget    | key hkey                    |
| hmset   | key hkey1 hval1 hkey2 hval2 |
| hincrby | key hkey num                |

> 单个 key 同样可以自增

### set

一个所有 val==NULL 的特殊字典, 可用于去重

#### 命令

| command   |               |
| --------- | ------------- |
| sadd      | key val       |
| sadd      | key val1 val2 |
| smembers  | key           |
| sismember | key val       |
| scard     | key #size()   |
| spop      | key           |

### zset

value + score 跳表  
跳表 以一定概率(官方晋升率 25%)被选中成为上一层(最高 32 层)

> 最底层是双向链表, 上层都是单向链表?

zrank 通过 forward 指针中的跨度 span 累加计算得到

#### 命令

| command       |                                |
| ------------- | ------------------------------ |
| zadd          | key score val                  |
| zrange        | key l_idx r_idx                |
| zrevrange     | key l_idx r_idx                |
| zcard         | key                            |
| zscore        | key val                        |
| zrank         | key val                        |
| zrangebyscore | key l_score r_score            |
| zrangebyscore | key l_score r_score withscores |
| zrem          | key val                        |

### 容器型数据结构的通用规则

1. create if not exists
2. drop if no elements

---

## 分布式锁

### 基本要求

一个分布式锁有一些基本要求, 如互斥性、性能、可重入等.

-   redis 的 setnx 是原子操作, redis 又是单线程的, 能满足互斥性
-   redis 很快(内存、高性能数据结构、I/O 模型), 性能无需多言
-   重入可以用 `{threadId}:{cnt}`做 val

### 锁超时时间

如果锁不设定超时时间, 有可能锁永远不会释放, 死锁.  
超时时间的设置是个比较麻烦的问题, 设置短了容易出现超时造成并发问题, 长了要考虑主动解锁失败造成等待.  
Redisson 的 watch dog 是个不错的方案, 可以对锁进行续期.

#### watch dog

watch dog 会起一个定时任务(基于时间轮), 默认超时时间 30s, 每 10s 进行一次续期

### 主动释放时误解

如果一个并发过程执行得太久, 超时解锁了, 锁会被其他线程获取; 这时如果第一个线程执行完后解锁, 会误解  
需要 lua 保证原子性

```lua
# delifequals
if redis.call("get",KEYS[1]) == ARGV[1] then
return redis.call("del",KEYS[1])
else
return 0
end
```

### 单点故障问题

当 master 节点加锁后挂掉且未同步到从节点, 相当于锁失效了. 为解决这个问题有了 RedLock  
RedLock, 半数以上节点加锁成功才认为成功

#### RedLock

Redlock 算法，加锁时向多个没有主从关系的 Redis 实例发送加锁, 过半成功则认为加锁成功，释放锁时向所有节点发送 del 指令。

RedLock 也会有问题, 在网络分区发生时, 可能出现脑裂, 同一把锁可能被同时获取(虽然概率很低)  
还可能有时钟漂移问题, 也会造成状态不一致, 通常需要同步时钟

在 Redisson 中, RedLock 已经被废弃了, 官方不认可也不推荐, 在分布式环境中既复杂也不能保证正确

替代方案:

-   可以用普通锁代替, 做好对账和补偿
-   用强一致的组件实现分布式锁, 如 Zookeeper, etcd, Consul

## 过期

通过过期字典(字典 key 指向具体的数据 key, val 是毫秒精度的时间戳 long long 类型的整数)保存数据过期时间. 定时遍历删除+惰性删除

-   定时扫描策略
    **每秒 10 次**过期扫描, 随机选 20 个, 如果过期比例超过 1/4, 重复; 为防止线程卡死，每次不超过 25ms
    这样会导致卡顿, 不要让大批 key 同时过期
-   惰性删除
    访问时检查

从库是被动删除, 执行从主库同步过来的 del 指令

## 布隆过滤器

用一个 BitMap, 使用 n 个不同的散列函数将 1 个元素映射到 n 个位点上  
一个元素如果判断结果为存在的时候元素不一定存在，但是判断结果为不存在的时候则一定不存在。  
可以添加元素，但不能删除元素  
在使用 bloom filter 时，绕不过的两点是预估数据量 n 以及期望的误判率 fpp;  
在实现 bloom filter 时，绕不过的两点就是 hash 函数的选取以及 bit 数组的大小。

| command    |                                      |
| ---------- | ------------------------------------ |
| bf.add     | key val                              |
| bf.exists  | key val                              |
| bf.reserve | key error_rate=0.01 initial_size=100 |

根据元素数量 n 和 误判率 f 可以得出 bits 长度 l 和 hash 函数个数 k

$k = 0.7 * \frac{l}{n}$

$f = 0.6185 ^ {\frac{l}{n}}$

-   空间比(l/n)=8，f≈2%
-   f=10% 空间比 ≈5
-   f=1% 空间比 ≈10
-   f=0.1% 空间比 ≈15

## HyperLogLog

## 限流

## GeoHash

## 通信协议

redis serialization protocol  
5 种最小单元类型，单元结束时加上 \r\n

| 类型       | 形式       | 样例                               |
| ---------- | ---------- | ---------------------------------- |
| 单行字符串 | 以 + 开头  | +hello world\r\n                   |
| 多行字符串 | 以 $ 开头  | $11\r\nhello world\r\n             |
| 整数       | 以 : 开头  | :1024\r\n                          |
| 错误消息   | 以 - 开头  | -WRONGTYPE Operation against a key |
| 数组       | 以 \* 开头 | \*3\r\n:1\r\n:2\r\n:3\r\n          |
| NULL       | 多行字符串 | $-1\r\n                            |
| 空串       | 多行字符串 | $0\r\n\r\n                         |

## 内存淘汰

**过期集**

1. volatile-lru（least recently used）：从已设置过期时间的数据集（server.db[i].expires）中挑选最早使用的数据淘汰
2. volatile-ttl：从已设置过期时间的数据集（server.db[i].expires）中挑选将要过期的数据淘汰
3. volatile-random：从已设置过期时间的数据集（server.db[i].expires）中任意选择数据淘汰

**全集**

4. allkeys-lru（least recently used）：当内存不足以容纳新写入数据时，在键空间中，移除最近最早使用的 key（这个是最常用的）
5. allkeys-random：从数据集（server.db[i].dict）中任意选择数据淘汰

**禁止**

6. no-eviction：禁止驱逐数据，也就是说当内存不足以容纳新写入数据时，新写入操作会报错。

**4.0 版本后增加以下两种 lfu**

1. volatile-lfu（least frequently used）：从已设置过期时间的数据集(server.db[i].expires)中挑选最不经常使用的数据淘汰
2. allkeys-lfu（least frequently used）：当内存不足以容纳新写入数据时，在键空间中，移除最不经常使用的 key

**LRU 实现**
真实的 lru 消耗空间比较大
Redis 里面的 lru 是近似 lru, 每个 key 上加一个时间戳, 当空间不足时, 随机选 5(可配置) 个, 淘汰掉最旧的, 直到空间可用
Redis 3.0 还增加了淘汰池, 新采样出来的加入池子, 再找出最早的

## 持久化

通常从节点进行持久化，从节点作为备份节点，没有客户端请求的压力

### 快照持久化(snapshotting,RDB)

默认方式, 通过创建快照, 获取数据某个时间点的副本, 可以复制到从服务器或者留存到本地(通过 COW 的方式)  
一段时间内超过一定数量的 key 发生变化, 就会创建快照

单线程进行 文件 IO 不能多路复用, 还要不阻塞; 这怎么办呢?  
使用了操作系统的 多进程 COW:  
调用 glibc 的函数 fork 出一个子进程, 持久化交给子进程处理  
并发问题使用 OS 的 COW 机制进行数据段中页面的分离, 数据段由很多操作系统的页面(4K 大小)组合而成, 当父进程修改一个页面的时候, 会复制一个副本然后对这个副本进行修改;  
而 fork 出来的子进程对冷数据快照进行持久化.

> COW: 如果有多个调用者同时请求相同资源（如内存或磁盘上的数据存储），他们会共同获取相同的指针指向相同的资源，直到某个调用者试图修改资源的内容时，系统才会真正复制一份专用副本（private copy）给该调用者，而其他调用者所见到的最初的资源仍然保持不变。

redis.conf

```ssh-config
save 900 1           #在900秒(15分钟)之后，如果至少有1个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
save 300 10          #在300秒(5分钟)之后，如果至少有10个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
save 60 10000        #在60秒(1分钟)之后，如果至少有10000个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
```

save: 主线程执行  
bgsave: fork 子线程执行(default)

### 只追加文件(append-only file,AOF)

开启 AOF 后执行的每一条更改命令, redis 都会将该命令写入缓冲区, 然后刷盘到 AOF 文件.

> AOF 文件和 RDB 文件位置相同, 都是通过 dir 参数设置的, 默认的文件名是 "appendonly.aof"

刷盘频率:

```ssh-config
appendfsync everysec  #每秒执行一次fsync操作 默认
appendfsync always    #每次有数据修改发生时都会写入AOF文件,这样会严重降低Redis的速度. 能保证完整性
appendfsync no        #让操作系统决定何时进行同步 交给内核
```

#### AOF 重写

bgrewriteaof 指令, 开辟一个子进程, 对内存遍历, 转换成操作指令, 序列化到一个新的 AOF 文件中, 序列化完毕后再将操作期间发生的增量 AOF 日志追加到文件中, 最后做文件替换  
大于上次重写的文件大小百分比, 则会触发, 为避免频繁触发, 可以限制最小大小  
glibc 的 fsync 函数可以强制刷盘  
刷盘周期可以配置, 1s / 让 OS 决定 / 每个指令都刷

### 混合持久化

redis 4.0 开始支持 RDB 和 AOF 的混合持久化 (配置项 `aof-use-rdb-preamble yes`), 7.0 之前都写在 aof 文件中, 7.0 之后多文件

### 写时复制

7.0 之后增加了增量文件策略  
先 fork 一个子进程, 子进程在临时文件中写新的 AOF  
父进程会打开一个新的增量 AOF 文件来继续写入更新 (7.0 之前是写入缓冲区)  
子进程完成后, 父进程收到信号, 将增量文件和新文件合并, 且持久化 (7.0 之前是将缓冲区内容写入新文件)

## 事务

Redis 可以通过 **MULTI，EXEC，DISCARD** 和 **WATCH** 等命令来实现事务功能。  
DISCARD 丢弃 MULTI 到 DISCARD 之间的所有指令, 必须在 EXEC 之前使用.  
WATCH 必须先于 MULTI 使用. 乐观锁的方式, 盯住一些变量, 在执行的时候检查是否被修改, 如果被修改返回错误, 客户端处理(通常是重试)  
`WATCH -> MULTI -> ...-> EXEC/DISCARD`

redis 事务不支持 rollback, 所以不满足原子性.  
可以理解为是多个命令顺序打包执行, 且执行过程不会被中断(即便前面执行失败也会继续执行后续指令).

## 单线程/多线程

### 单线程

单线程设计足以满足性能要求

### 多线程

4.0 版本在**异步删除大对象**加入了多线程
6.0 为了提高**网络 IO 读写性能**(性能瓶颈在内存和网络,而不是 CPU,这是不使用多线程的主要原因)

修改配置文件 redis.conf

```ssh-config
io-threads-do-reads yes
io-threads 4 #官网建议4核的机器建议设置为2或3个线程，8核的建议设置为6个线程
```

## 分布式

### 从扩展性谈起

#### AKF

扩展问题，可以分为三个维度扩展:

-   X:主从, 多节点
-   Y:业务, 技术服务维度拆分, 分库
-   Z:数据维度分片

Redis 在水平扩展只有主备, 没有读写分离;  
但是在数据分片方面做了一些工作, 比如 Codis(虽然是第三方的)和集群

### 主从

CAP 中 Redis 满足 AP

#### 增量同步

主节点写入内存 buffer(环状数组)中, 从节点同步

#### 快照同步

如果分区时间太久, buffer 开始覆盖了, 就需要快照同步  
快照同步时会 bgsave 生成主节点的快照, 同步到从节点后全量加载, 然后再进行增量同步  
如果 buffer 太小或者同步时间过长, 就无法进行增量复制, 又会触发快照同步, 有可能死循环;  
buffer 务必大一点;

#### 无盘复制

主节点直接通过 socket 发送内存数据(不落盘)给从节点, 从节点落盘后一次性加载

#### Wait 指令

```sh
# 等待 t 毫秒, 同步到至少 N 个从节点
wait N t
```

### 哨兵

哨兵集群，客户端先访问哨兵，哨兵给出主节点地址；节点不可用则由哨兵选出下一个主节点  
主从复制是异步复制，如何处理主从同步延迟?  
至少有 x 个从节点 y 秒内有心跳，否则认为主节点不可用

```sh
# 至少由一个从节点正常复制, 否则停止对外写服务
min-slaves-to-write 1
# 如果 10s 没有反馈, 说明从节点不正常
min-slaves-max-lag 10
```

### Codis

Codis 是无状态的代理中间层, 做命令的转发和分片定位

#### 分片

Codis 会划分 1024 个槽, key 经过 crc32 hash 运算后对 1024 取模, 映射到对应的槽; 槽位数可配置

槽位会映射到 redis 节点, Codis 引入了 zk 去同步映射关系

#### 扩容

Redis 节点扩容后, 需要修改槽位到节点的映射, 并迁移槽位中的 key;  
Codis 增加了 SLOTSSCAN 指令, 可以扫描槽位中所有的 key; 在迁移过程中, 如果有读取的命令, 会先将该 key 迁到新槽

### Redis Cluster

Redis 的亲儿子, Cluster 一共有 N 个节点, 最多 1000 个

#### 分片

将所有 key 分成了 16384 个槽, 每个节点负责一部分槽, 槽位配置信息每个节点都有, 不依赖 zk, 而且客户端也能获取到槽位配置

key 经过 crc16 hash 运算后对 16384 取模, 映射到对应的槽

> 跟 Codis 不同的地方, Codis 槽位配置(zk 管理)是槽到节点的关系, cluster 槽位配置(去中心化)是 key 到槽的关系

key 还可以挂 tag, 转到 tag 所在的槽

如果 client 向错误的节点发送了指令, 会返回 `-MOVED slot_id ip` 跳转指令, 让客户端更新槽位配置;

#### 迁移

提供了工具 redis-trib 去迁移, 迁移单位是槽, 先将两个槽设置为不同的过渡态(原节点的状态为 migrating, 在目标节点的状态为 importing), 然后扫描槽, 逐个 key 迁移  
原节点作为客户端, 序列化后发送到目标节点, 目标节点返回 OK 后, 原节点删除 key

迁移过程中的查询如何处理?

-   首先查原节点, 原节点查不到返回重定向
-   重定向到目标节点, 先 asking
-   asking 后再重新执行指令

> 因为在迁移过程中目标节点是不认的, 会返回-MOVED, 这样会造成死循环, asking 指令就是命令目标节点处理

#### 节点下线

在去中心化的 Redis Cluster 中, 一个节点认为某个节点失联, 不能说明它失联, 集群会有协商的过程, 只有大多数节点认为某个节点失联, 集群才会进行主从切换

节点采用 Gossip 协议广播自己的状态和自己对集群状态的认知, 如果一个节点发现某一个节点失联(PFail), 会将这条信息向整个集群广播; 如果一个节点收到某个节点失联的通知超过半数, 就会标记该节点已经下线(Fail), 然后通知整个集群宣布该节点下线, 并立即进行主从切换

#### 感知集群变更

如果目标节点挂掉, 客户端会 ConnectionError 并随机挑选一个节点重试, 会收到 -moded, 随即更新客户端配置
如果当前节点被移出了集群, 客户端会收到 ClusterDown, 这时客户端会关闭所有连接, 清空槽位映射表; 下一条指令过来时, 会重新尝试初始化集群信息

## I/O 模型

## Redis Client

-   Jedis
    简单的客户端
-   Redisson
    做了很多易用的封装, 如重入锁
-   Lettuce

## 业务场景

### 击穿 穿透 雪崩

-   击穿: 当某一热 key 过期, 导致 DB 过载
    -   续期
    -   加锁从 DB 读取到缓存
-   穿透: DB 里面没有, 缓存没用
    -   缓存空值
    -   bloom filter
-   雪崩: 缓存大批量过期或缓存宕机
    -   过期时间随机化
    -   集群避免单点故障
    -   限流

### 热 key

https://dongzl.github.io/2021/01/14/03-Redis-Hot-Key/index.html

#### 热 key 带来的问题

流量集中，达到单实例处理上限(IO/CPU/网络)  
其他 key 受影响  
落在某一个单实例，无法通过扩容解决  
redis 不可用导致缓存击穿，DB 也会被打爆

#### 多热算热

单 key 7k QPS

#### 如何发现

要识别热 key, 首先可以预估, 同时也要实时收集

怎样实时收集呢?

-   客户端收集
    对客户端（如 Jedis、Redisson）进行封装，在发送请求前进行收集，同时定时把收集到的数据上报到统一的服务进行聚合计算。
-   代理层收集
    在 proxy 层做这部分操作
-   redis 命令
    -   `redis-cli --hotkeys`
    -   `redis-cli monitor`
-   Redis 节点抓包
    监听端口, 按 RESP 协议解析数据进行分析

#### 解决方案

-   水平扩容，增加实例副本数量, 将读请求分摊到不同的副本节点
-   多级缓存, 如 CDN; 本地缓存, 如 Ehcache、Guava
-   热 key 备份

### 大 key

#### 大 key 带来的问题

-   影响性能
-   占用内存
-   影响备份/恢复
-   过期耗时久

#### 多大算大

-   string 大小超过 10KB, 阿里云定义 5MB (大)
-   val 元素超过 5k 个(多)

#### 发现

-   redis-cli --bigkeys 参数
-   分析 RDB 文件

#### 解决方案

-   删除
    version > 4.0, UNLINK 命令异步删除
-   合理过期
-   拆分
-   单独存放

### DB 与缓存的一致性

#### 为什么会出现

更新数据库和缓存不是原子操作, 先读后写和先写后读都会有问题, 另外, 读 DB 更新也会有问题

#### 解决方案

常见解决方案有 3 种

-   先更新数据库再删除缓存
-   延迟双删
-   旁路更新, 基于 binlog 更新缓存

#### 分析

2 个核心问题:

-   更新还是删除

    -   更新操作开销大，淘汰的代价只是一次 miss;
        避免 miss 导致热 key 问题, 可以加锁更新缓存
    -   删除可以完全避免写写并发

-   先操作谁

    -   先删除缓存会放大读写并发问题, 删除后被读请求写脏导致不一致
    -   先写数据库存在删除缓存失败的情况
    -   可以采用延迟双删

#### 缓存更新三种设计模式

旁路缓存，读写穿透，异步缓存写入

1. Cache Aside Pattern（旁路缓存）

    - 读时更新
    - 先更新 DB, 然后删除 cache

2. Read/Write Through Pattern（读写穿透）
   将操作交由缓存层处理

3. Write Behind Caching Pattern（异步缓存写入）
   跟读写穿透类似, 不同点是异步批量更新 DB. 类似于操作系统刷写磁盘操作

## Redis 为什么快

### 基于内存

-   内存 ns 级别;
-   硬盘 寻址时间 ms 级别;

总线标准通常两种(消费级): SATA PCIe  
SSD 的规格协议通常两种(消费级): AHCI NVMe (与上文对应

### 单线程

没有上下文切换  
4.0 版本在**异步删除大对象**加入了多线程  
6.0 为了提高**网络 IO 读写性能**(性能瓶颈在内存和网络,而不是 CPU,这是不使用多线程的主要原因)

### 高效的数据结构

### 事件轮询 + 非阻塞 IO

Reactor 模式的事件处理模型, 单线程循环事件和 IO 多路复用

#### 文件-事件处理器

再精炼些

-   **非阻塞 IO**
    socket 对象上提供的选项，Non_Blocking

-   **事件轮询**
    操作系统提供给用户程序的 API select, 输入是读写描述符列表(每个客户端 socket 都有对应的读写描述符) 轮询获取事件进行处理

    > 现在操作系统改用 epoll 了

-   **指令队列**
    每个客户端 socket 都关联一个指令队列

-   **响应队列**
    每个客户端 socket 都关联一个响应队列，如果队列为空，不输入客户端描述符 write_fds，防止线程空转

-   **定时任务**
    维护最小堆，堆顶是最快要执行的任务，从此刻到堆顶任务执行的时间内，没有其他任务要处理

Redis 基于 Reactor 模式开发了自己的网络事件处理器：这个处理器被称为文件事件处理器（file event handler）。

Redis 采用 epoll 来实现 I/O 多路复用，同时监听多个 Socket, 当被监听的 Socket 准备好执行连接应答（accept）、读取（read）、写入（write）、关闭（close）等操作时, 就会产生与操作相对应的文件事件.  
连接信息和事件会进到队列，依次放入 EventDispatcher，这时 EventDispatcher 就会调用 Socket 关联的 EventProcesser 来处理这些事件。

虽然文件事件处理器以单线程方式运行，但通过使用 I/O 多路复用程序来监听多个 Socket，文件事件处理器既实现了高性能的网络通信模型，又可以很好地与 Redis 服务器中其他同样以单线程方式运行的模块进行对接，保持了 Redis 内部单线程设计的简单性。

#### I/O 模型历史演进

从 Socket 谈起, Socket 是网络通信的常用方式. 创建 Socket 时, 可以指定网络层用 IPv4 还是 IPv6, 传输层用 TCP 还是 UDP;

`socket() -> bind() -> listen() -> accept()`  
创建 Socket -> 绑定自己的 IP 和端口 -> 监听 -> 阻塞等待连接

**历史时期 多线程模型**:  
服务器的主进程负责监听客户的连接，一旦与客户端连接完成，accept() 函数就会返回一个「已连接 Socket」，这时就通过 fork() 函数创建一个子进程，实际上就把父进程所有相关的东西都复制一份，包括文件描述符、内存地址空间、程序计数器、执行的代码等。  
进化: 使用线程, 当服务器与客户端 TCP 完成连接后，通过 pthread_create() 函数创建线程，然后将「已连接 Socket」的文件描述符传递给线程函数，接着在线程里和客户端进行通信，从而达到并发处理的目的。

**历史时期 多路复用**:  
select 实现多路复用的方式是，将已连接的 Socket 都放到一个文件描述符集合，然后调用 select() 函数将文件描述符集合拷贝到内核里，让内核来检查是否有网络事件产生. 检查的方式很粗暴，就是通过遍历文件描述符集合的方式.  
当检查到有事件产生后，将此 Socket 标记为可读或可写，接着再把整个文件描述符集合拷贝回用户态里，然后用户态还需要再通过遍历的方法找到可读或可写的 Socket，然后再对其处理。

poll 的优化点在于用动态数组存放文件描述符集合, 区别不大

**epoll**:  
先用 epoll_create 创建一个 epoll 对象 epfd，再通过 epoll_ctl 将需要监视的 socket 添加到 epfd 中，最后调用 epoll_wait 等待数据。

```c
int s = socket(AF_INET, SOCK_STREAM, 0);
bind(s, ...);
listen(s, ...)

int epfd = epoll_create(...);
epoll_ctl(epfd, ...); //将所有需要监听的socket添加到epfd中

while(1) {
    int n = epoll_wait(...);
    for(接收到数据的socket){
        //处理
    }
}
```

1. epoll 在内核里使用「红黑树」来关注进程所有待检测的 Socket，通过对这棵黑红树的管理，不需要像 select/poll 在每次操作时都传入整个 Socket 集合，减少了内核和用户空间大量的数据拷贝和内存分配。
2. epoll 使用事件驱动的机制，内核里维护了一个「链表」来记录就绪事件，只将有事件发生的 Socket 集合传递给应用程序，不需要像 select/poll 那样轮询扫描整个集合（包含有和无事件的 Socket），大大提高了检测的效率。

参考:

-   https://www.xiaolincoding.com/os/8_network_system/selete_poll_epoll.html#%E6%9C%80%E5%9F%BA%E6%9C%AC%E7%9A%84-socket-%E6%A8%A1%E5%9E%8B
-   https://nullwy.me/2023/07/io-multiplexing-network-server/

## 缓存选型

Redis Memcached

| 缓存      | 数据类型 | 持久化 | 集群       | 过期策略          |
| --------- | -------- | ------ | ---------- | ----------------- |
| redis     | 5 种     | 支持   | 原生支持   | 惰性删除+定期删除 |
| memcached | 1 种     | 不支持 | 原生不支持 | 惰性删除          |

-   redis 支持的数据类型更丰富
-   redis 支持数据持久化, 可以保存在硬盘, 重启的时候能再次加载
-   memcached 没有原生的集群模式, redis 原生支持集群
-   memcached 过期只用惰性删除, redis 支持惰性删除和定期删除

## 场景

### 排行榜

```sh
# 从小到大排序
ZRANGE key 0 -1

# 从大到小排序
ZREVRANGE

# 特定元素排名
ZREVRANK key element

# 特定元素分数
ZSCORE key element
```

### 抽奖

SET

```sh
# 随机移除并获取指定集合中一个或多个元素，适合不允许重复中奖的场景
SPOP key count

# 随机获取指定集合中指定数量的元素，适合允许重复中奖的场景
SRANDMEMBER key count
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
