# 3. Redis

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

## 事务

Redis 可以通过 **MULTI，EXEC，DISCARD** 和 **WATCH** 等命令来实现事务功能。
DISCARD 丢弃 MULTI 到 DISCARD 之间的所有指令, 必须在 EXEC 之前使用.
WATCH 必须先于 MULTI 使用. 乐观锁的方式, 盯住一些变量, 在执行的时候检查是否被修改, 如果被修改返回错误, 客户端处理(通常是重试)
redis 事务不支持 rollback, 所以不满足原子性.
可以理解为是多个命令顺序打包执行, 且执行过程不会被中断(即便前面执行失败也会继续执行后续指令).

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
