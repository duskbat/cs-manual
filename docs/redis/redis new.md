# Redis

## 基础数据结构

### string

动态字符串，预分配冗余空间以减少内存的频繁分配。小于 1M 直接加倍，超过 1M 加 1M，字符串最大 512M。

> SDS(simple dynamic string) API 是安全的，不会造成缓冲区溢出。

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

所有 val==NULL, 可用于去重

| command   |               |
| --------- | ------------- |
| sadd      | key val       |
| sadd      | key val1 val2 |
| smembers  | key           |
| sismember | key val       |
| scard     | key #size()   |
| spop      | key           |

### zset

value+score 也是用 Hash 结构存储的

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

---
