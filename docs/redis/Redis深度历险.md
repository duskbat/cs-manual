# Redis 深度历险

## 延时队列

**消息队列**  
简单版消息队列队列，消费者**定时**轮询

-   **空轮询问题**
    使用阻塞读 blpop/brpop

**延时队列**  
zset: score 是时间戳;  
可以多线程争抢以避免单线程 break 掉任务;

## 位图

| command  |                                |                                  |
| -------- | ------------------------------ | -------------------------------- |
| setbit   | key pos bit                    |                                  |
| getbit   | key pos                        |                                  |
| bitpos   | key 1 i_pos r_pos              | 字节索引 不是 bit 索引           |
| bitcount | key i_pos r_pos                | 字节索引 不是 bit 索引           |
| bitfield | key get u4 0                   | i=sined u=unsined 4=len 0=offset |
| bitfield | key set i4 0 num               |                                  |
| bitfield | key overflow {strategy} incrby | 指定范围的位自增                 |

len 最大长度 64 位，无符号数 u 只能获取到 63 位，因为 redis 协议里面 integer 是有符号的，不能传递 64 位无符号值

incrby 会溢出，溢出策略可以选择

-   sat
    保持最大值
-   fail
    不执行
-   wrap
    溢出截断

## HyperLogLog

使用场景：统计 UV

> pf 是人名缩写

| command |           |
| ------- | --------- |
| pfadd   | key val   |
| pfcount | key       |
| pfmerge | key1 key2 |

数据量比较多的情况下，HyperLogLog 每个 key 要占用 12k 字节的空间

> $2^{14}$个桶，每个桶 6 bits, 共 $2^{14} * 6 ÷ 8 = 12k (byte)$

## 简单限流

可以用 zset 维护 range, val score 都用毫秒时间戳

> 限流数较大的情况下空间占用高

## 漏斗限流

Redis-Cell 漏斗算法
灌水前触发漏水, 根据上次的时间戳和流速, 计算得到腾出的空间
关键参数:

-   漏斗容量
-   漏水速度
-   剩余空间
-   上次漏水时间

| command     |                |                                                                  |
| ----------- | -------------- | ---------------------------------------------------------------- |
| cl.throttle | key 15 30 60 1 | 15=漏斗初始容量 </br> 30 60=30 次/60s </br> 1=quota 一次操作几个 |

| res |                        |
| --- | ---------------------- |
| 0   | 0 允许 1 拒绝          |
| 15  | 容量                   |
| 14  | 剩余空间 quota         |
| -1  | 重试时间 s             |
| 2   | 多少秒之后，漏斗为空 s |

## GeoHash

场景：附近的人
二位坐标压缩成一维度，把平面分割成小块，并使用 bit 编码(二分 二叉查找树)；
经纬度交替排列，然后使用 Base32 编码
最后用 zset 排序

> 存储空间占用是比较大的

命令很多, 以后再说

## Scan

代替 keys

| command |                                 |                                                                           |
| ------- | ------------------------------- | ------------------------------------------------------------------------- |
| scan    | 0 match key_prefix\* count 1000 | 0=cursor 光标 <br> key_prefix\*=pattern <br> 1000=字典槽数量,不是返回条数 |

所有的 key 都放在一个大 HashMap 里面

scan 顺序:
高位进位加法，如, 原始顺序：0->1
这样 rehash 扩容后，元素是相邻的，00->10->01->11
scan 顺序和扩容配合

---

## 管道

redis 的管道(Pipline)是客户端提供的

管道本质上是改变指令的读写顺序, 提升并行度, 减少网络开销

> 读写之前都有 buffer, OS 将 buffer 中的数据发送/读取

## PubSub

消息多播, 不过应该被 5.0 的 stream 替代了
最大的问题在于: 消费者断连 重启后丢消息

## 小对象压缩

支持 32 位编译, 能节省指针大小
一些结构在数据量少的情况下是 ziplist

**内存回收**
操作系统按页回收;
会重用未回收的空闲内存;

**内存分配**
直接使用第三方内存分配库;

-   jemalloc(FaceBook)
-   tcmalloc(Google)

info memory 指令可以看用的啥

## Stream

xadd
Stream 有一个消息链表, 所有加入的消息都串起来, 每个消息都有一个唯一 id 和对应的内容
每个 Stream 可以挂多个消费组 Group, 每个 Group 都有一个游标 last_delivered_id, Group 需要指令 xgroup create 创建, 并且指定一个消息的 id
每个消费者组可以挂多个消费者, 竞争消费. 消费者内有一个 PEL, 保存被客户端读取但没有 ack 的消息 id, 防止消息丢失

## Info 指令

-   Server: 服务器环境
-   Clients: 客户端信息
-   Memory: 内存统计
-   Persistence: 持久化信息
-   Stats: 统计数据
-   Replication: 主从复制信息
-   CPU
-   Cluster:集群
-   KeySpace: 统计数量

```sh
#查看哪些key比较频繁
redis-cli monitor
# 查看缓冲区
redis-cli info replication | grep backlog
# 查看半同步复制失败次数
redis-cli info stats | grep sync
```

## 惰性删除

Redis 4.0, 大 key UNLINK
unlink 后, 主线程会将对象的引用从 HashMap 移除, 封装成内存回收任务, 扔进一个线程安全的队列, 后台线程从中取出任务并执行

**AOF sync 异步**
刷盘动作也是一个任务队列

**其他异步删除行为**

```sh
# key 过期
lazyfree-lazy-expire key
# LRU 淘汰
lazyfree-lazy-eviction
# rename
lazyfree-lazy-server-del rename
# 从库接收完rdb后立即flush
slave-lazy-flush
```

## 保护 Redis

**指令安全**
配置文件

```sh
# 重命名指令
rename-command keys abckeysabc
```

**端口安全**

```sh
# 绑定服务器的ip 而不是客户端的ip
bind 10.100.20.13
# 要求密码
requirepass yoursecurepasswordhereplease
```

## Redis 安全通信

官方推荐 SSL 代理软件 spiped
以后再说
