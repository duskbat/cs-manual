# Redis

## 基础数据结构

### string

动态字符串 SDS

#### SDS

为什么用 SDS, C 语言中的字符串标准形式以 NULL 作为结束符, 获取长度的函数 strlen 的时间复杂度是 O(n), 单线程的 redis 难以承受

```c
struct SDS<T> {
    T capacity; // 容量
    T len;      // 长度
    byte flags; // 特殊标识
    byte[] content; // 数组内容
}
```

> 泛型可以在字符串较短的时候使用 byte 和 short

创建的时候 len == capacity, 通常不使用 append 命令

预分配冗余空间以减少内存的频繁分配。小于 1M 直接加倍，超过 1M 加 1M，字符串最大 512M 字节。

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
