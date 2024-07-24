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
| command | | |
| ------- | ------------------------------ | ----------------------------------------------------------------------- |
| scan | 0 match key_prefix* count 1000 | 0=cursor 光标 <br> key_prefix*=pattern <br> 1000=字典槽数量,不是返回条数 |

所有的 key 都放在一个大 HashMap 里面

scan 顺序:
高位进位加法，如, 原始顺序：0->1
这样 rehash 扩容后，元素是相邻的，00->10->01->11
scan 顺序和扩容配合

---

## 线程 IO 模型

select 系列的事件轮询 + 非阻塞 IO

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

## 持久化

**快照**
二进制序列化形式
单线程进行 文件 IO 不能多路复用, 还要不阻塞; 这怎么办呢?
使用了操作系统的 多进程 COW:
调用 glibc 的函数 fork 出一个子进程, 持久化交给子进程处理
并发问题使用 OS 的 COW 机制进行数据段中页面的分离, 数据段由很多操作系统的页面(4K 大小)组合而成, 当父进程修改一个页面的时候, 会复制一个副本然后对这个副本进行修改;
而 fork 出来的子进程对冷数据快照进行持久化.

### copy-on-write(COW)

如果有多个调用者同时请求相同资源（如内存或磁盘上的数据存储），他们会共同获取相同的指针指向相同的资源，直到某个调用者试图修改资源的内容时，系统才会真正复制一份专用副本（private copy）给该调用者，而其他调用者所见到的最初的资源仍然保持不变。

**AOF**
客户端指令会先存到日志, 然后再执行
**优化: AOF 重写**
bgrewriteaof 指令, 开辟一个子进程, 对内存遍历, 转换成操作指令, 序列化到一个新的 AOF 文件中, 序列化完毕后再将操作期间发生的增量 AOF 日志追加到文件中

glibc 的 fsync 函数可以强制刷盘
刷盘周期可以配置, 1s / 让 OS 决定 / 每个指令都刷

**运维**
同步操作通常比较耗费资源, 所以通常使用从节点进行持久化, 这时就要考虑网络分区的问题, 如果网络分区发生了, 主节点又挂了, 那数据有丢失风险; 最好冗余一个从节点

Redis 4.0 混合持久化

## 管道

redis 的管道(Pipline)是客户端提供的

管道本质上是改变指令的读写顺序, 提升并行度, 减少网络开销

> 读写之前都有 buffer, OS 将 buffer 中的数据发送/读取

## 事务

watch -> muti -> exec/discard
watch 算是一种乐观锁

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

## 主从同步

**指令同步 + 快照同步**

**指令同步**
同步 buffer 中的指令, 并告诉主库同步到哪里了; 如果网络分区发生, 主库的环状 buffer 有可能被覆盖, 这时就要用快照同步;

**快照同步**
主库进行一次 bgsave, 全部持久化, 然后将文件发送给从库, 加载完后再进行增量同步;
如果 buffer 太小或者同步时间过长, 就无法进行增量复制, 又会触发快照同步, 有可能死循环;
buffer 务必大一点;

**无盘同步**
有盘同步太慢了, 而且会阻塞 fsync, Redis 2.8.18 开始有了无盘同步, 通过 socket 将序列化内容发给从库

**wait 指令**

-   wait N t
    等待 wait 指令之前的所有写操作同步到 N 个节点, 最多等待 t 秒; t=0 是永远等待;

---

## Sentinel

哨兵集群, 自动切换主从
哨兵集群由 3-5 个节点组成

客户端从哨兵获取主节点

配置:

```sh
# 至少由一个从节点正常复制, 否则停止对外写服务
min-slaves-to-write 1
# 如果 10s 没有反馈, 说明从节点不正常
min-slaves-max-lag 10
```

## Codis

以后再说

## Cluster

Redis 集群至少分为 3 个节点, 所有数据划分为 16384 个槽位, 槽位信息会存在每个节点中, 但是每个节点只负责一部分槽位
客户端连接集群的时候也会得到槽位配置信息, 可以根据槽位定位到目标节点

配置信息会持久化到配置文件, 配置文件要确保可写

**槽定位算法**
key 会使用 crc32 算法进行 hash, 得到一个整数值, 然后对 16384 MOD 确定槽位

key 还可以挂一个 tag, 来使用 tag 的槽位

如果客户端访问到了错误的节点, 会返回一个 "-MOVED slot_id ip" 形式的结果, 告诉客户端访问错误

**迁移**

redis-trib 可以手动调整槽位, 迁移的单位是槽
这个槽在原节点的状态为 migrating, 在目标节点的状态为 importing, 是中间态

-   迁移过程:
    从源节点获取 key => 存到目标节点 => 从源节点删除

-   请求流量在迁移过程中的变化:
    客户端请求源节点 => 源节点返回/返回重定向-ASK => asking 指令请求目标节点 => 重新请求目标节点
    因为在迁移过程中目标节点是不认的, 会返回-MOVED, 这样会造成死循环, asking 指令就是命令目标节点处理

**网络抖动**
cluster-node-timeout 主从切换的 timeout 阈值

**节点下线**
在去中心化的 Redis Cluster 中, 一个节点认为某个节点失联, 不能说明它失联, 集群会有协商的过程, 只有大多数节点认为某个节点失联, 集群才会进行主从切换

节点采用 Gossip 协议广播自己的状态和自己对集群状态的认知, 如果一个节点发现某一个节点失联(PFail), 会将这条信息向整个集群广播; 如果一个节点收到某个节点失联的通知超过半数, 就会标记该节点已经下线(Fail), 然后通知整个集群宣布该节点下线, 并立即进行主从切换

**感知集群变更**
如果目标节点挂掉, 客户端会 ConnectionError 并随机挑选一个节点重试, 会收到 -moded, 随即更新客户端配置
如果当前节点被移出了集群, 客户端会收到 ClusterDown, 这时客户端会关闭所有连接, 清空槽位映射表; 下一条指令过来时, 会重新尝试初始化集群信息

---

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

## LRU

**过期集**

-   volatile-lru（least recently used）
    从已设置过期时间的数据集（server.db[i].expires）中挑选最早访问的数据淘汰
-   volatile-ttl
    从已设置过期时间的数据集（server.db[i].expires）中挑选将要过期的数据淘汰
-   volatile-random
    从已设置过期时间的数据集（server.db[i].expires）中任意选择数据淘汰

**全集**

-   allkeys-lru（least recently used）
    当内存不足以容纳新写入数据时，在键空间中，移除最早访问的 key（这个是最常用的）
-   allkeys-random
    从数据集（server.db[i].dict）中任意选择数据淘汰

**禁止**

-   noeviction
    禁止驱逐数据，也就是说当内存不足以容纳新写入数据时，新写入操作会报错, 只能 get 和 del。

**4.0 版本后增加以下两种**：

1. volatile-lfu（least frequently used）：从已设置过期时间的数据集(server.db[i].expires)中挑选最不经常使用的数据淘汰
2. allkeys-lfu（least frequently used）：当内存不足以容纳新写入数据时，在键空间中，移除最不经常使用的 key

**LRU 实现**
真实的 lru 消耗空间比较大
Redis 里面的 lru 是近似 lru, 每个 key 上加一个时间戳, 当空间不足时, 随机选 5(可配置) 个, 淘汰掉最旧的, 直到空间可用
Redis 3.0 还增加了淘汰池, 新采样出来的加入池子, 再找出最早的

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
