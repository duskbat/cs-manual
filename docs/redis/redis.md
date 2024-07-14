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
-   重入可以用 `threadId()+":"+cnt`做 val

### 锁超时时间

如果锁不设定超时时间, 有可能锁永远不会释放, 死锁.  
超时时间的设置是个比较麻烦的问题, 设置短了容易出现超时造成并发问题, 长了要考虑主动解锁失败造成等待.  
Redisson 的 watch dog 是个不错的方案, 可以对锁进行续期.

#### watch dog

watch dog 会起一个定时任务(基于时间轮), 默认超时时间 30s, 每 10s 进行一次续期

### 主动释放时误解

如果一个并发过程执行得太久, 超时解锁了, 锁会被其他线程获取, 这时如果第一个线程执行完后解锁, 会误解  
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

## 持久化

## 集群

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

### Reactor 模式的事件处理模型

Reactor 模式的事件处理模型, 单线程循环事件和 IO 多路复用

#### 文件-事件处理器

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
