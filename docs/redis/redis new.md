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

## 布隆过滤器

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
