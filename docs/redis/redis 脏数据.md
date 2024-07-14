## 3. Redis

### 分布式缓存技术选型

Redis Memcached  
| 缓存 | 数据类型 | 持久化 | 集群 | 过期策略 |
| --------- | -------- | ------ | ---------- | ----------------- |
| redis | 5 种 | 支持 | 原生支持 | 惰性删除+定期删除 |
| memcached | 1 种 | 不支持 | 原生不支持 | 惰性删除 |

### 文件-事件处理器

Redis 基于 Reactor 模式开发了自己的网络事件处理器：这个处理器被称为文件事件处理器（file event handler）。
redis 采用 epoll 来实现 I/O 多路复用（linux 本身的内核技术），将连接信息和事件放到队列中，依次放到文件事件分派器，事件分派器将事件发送给事件处理器
文件事件处理器使用 I/O 多路复用（multiplexing）程序来同时监听多个套接字(Socket)，并根据套接字目前执行的任务来为套接字关联不同的事件处理器。

当被监听的套接字准备好执行连接应答（accept）、读取（read）、写入（write）、关 闭（close）等操作时，与操作相对应的文件事件就会产生，这时文件事件分派器就会调用套接字之前关联好的事件处理器来处理这些事件。

虽然文件事件处理器以单线程方式运行，但通过使用 I/O 多路复用程序来监听多个套接字，文件事件处理器既实现了高性能的网络通信模型，又可以很好地与 Redis 服务器中其他同样以单线程方式运行的模块进行对接，这保持了 Redis 内部单线程设计的简单性。

### 单线程

例如在秒杀场景, 落在 DB 层一定是串行的, 而 redis 单线程的设计恰如其分
4.0 版本在**异步删除大对象**加入了多线程
6.0 为了提高**网络 IO 读写性能**(性能瓶颈在内存和网络,而不是 CPU,这是不使用多线程的主要原因)

### 内存淘汰机制

1. volatile-lru（least recently used）：从已设置过期时间的数据集（server.db[i].expires）中挑选最少使用的数据淘汰
2. volatile-ttl：从已设置过期时间的数据集（server.db[i].expires）中挑选将要过期的数据淘汰
3. volatile-random：从已设置过期时间的数据集（server.db[i].expires）中任意选择数据淘汰
4. allkeys-lru（least recently used）：当内存不足以容纳新写入数据时，在键空间中，移除最近最少使用的 key（这个是最常用的）
5. allkeys-random：从数据集（server.db[i].dict）中任意选择数据淘汰
6. no-eviction：禁止驱逐数据，也就是说当内存不足以容纳新写入数据时，新写入操作会报错。

**4.0 版本后增加以下两种**：

1. volatile-lfu（least frequently used）：从已设置过期时间的数据集(server.db[i].expires)中挑选最不经常使用的数据淘汰
2. allkeys-lfu（least frequently used）：当内存不足以容纳新写入数据时，在键空间中，移除最不经常使用的 key

### 持久化

通常是从节点进行持久化，从节点作为备份节点，没有客户端请求的压力

1. 快照持久化（snapshotting，RDB）
   默认方式, 通过创建快照,获取数据某个时间点的副本, 可以复制到从服务器或者留存到本地 //通过 COW 的方式
   一段时间内超过一定数量的 key 发生变化，会创建快照
   Redis.conf
    ```
    save 900 1           #在900秒(15分钟)之后，如果至少有1个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
    save 300 10          #在300秒(5分钟)之后，如果至少有10个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
    save 60 10000        #在60秒(1分钟)之后，如果至少有10000个key发生变化，Redis就会自动触发BGSAVE命令创建快照。
    ```
2. 只追加文件（append-only file, AOF）
   开启 AOF 后执行的每一条更改命令, redis 都会将该命令写入硬盘里的 AOF 文件. AOF 文件和 RDB 文件位置相同, 都是通过 dir 参数设置的, 默认的文件名是 append only.aof
   **fsync**: 控制刷写硬盘
   appendfsync everysec #每秒执行一次 fsync 操作
   appendfsync always #每次有数据修改发生时都会写入 AOF 文件,这样会严重降低 Redis 的速度. 能保证完整性
   appendfsync no #让操作系统决定何时进行同步 交给内核
3. redis 4.0 开始支持 RDB 和 AOF 的混合持久化(默认关闭, 可通过配置项 aof-use-rdb-preamble 开启)

### redis 序列化反序列化

org.springframework.data.redis.serializer.RedisSerializer
对于 json 而言, jackson 是官方实现 fastjson 也有相应实现

### redis 事务

Redis 可以通过 **MULTI，EXEC，DISCARD** 和 **WATCH** 等命令来实现事务功能。
DISCARD 丢弃 MULTI 到 DISCARD 之间的所有指令, 必须在 EXEC 之前使用.
WATCH 必须先于 MULTI 使用. 乐观锁的方式, 盯住一些变量, 在执行的时候检查是否被修改, 如果被修改返回错误, 客户端处理(通常是重试)
redis 事务不支持 rollback, 所以不满足原子性.
可以理解为是多个命令顺序打包执行, 且执行过程不会被中断(即便前面执行失败也会继续执行后续指令).

### 分布式解决方案

CAP 中 AP 满足

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

如果有多个调用者同时请求相同资源（如内存或磁盘上的数据存储），他们会共同获取相同的指针指向相同的资源，直到某个调用者试图修改资源的内容时，系统才会真正复制一份专用副本（private copy）给该调用者，而其他调用者所见到的最初的资源仍然保持不变。

### BIO NIO 问题

> socket -> bind -> listen

**历史时期 BIO**:
因为 client 通过 TCP 连接 kernel(内核), 每个连接就是一个文件描述符(如 fd8), 导致线程从 kernel 读取 fd8 的时候产生阻塞, 必须通过另外的线程等待连接. 线程的开销大
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
