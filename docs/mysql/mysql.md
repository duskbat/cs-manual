## MySQL

### SQL 调优

思路: 面向响应时间的优化, 首先要明确时间花在什么地方, 做剖析(profiling)

```sh
set profiling=1;
show profiles;
show profile cpu for query 1;

    +--------------------------------+----------+
    | Status                         | Duration |
    +--------------------------------+----------+
    | starting                       | 0.000053 |
    | Executing hook on transaction  | 0.000003 |
    | starting                       | 0.000006 |
    | checking permissions           | 0.000003 |
    | Opening tables                 | 0.000139 |
    | init                           | 0.000003 |
    | System lock                    | 0.000005 |
    | optimizing                     | 0.000003 |
    | statistics                     | 0.000008 |
    | preparing                      | 0.000011 |
    | executing                      | 0.000032 |
    | end                            | 0.000002 |
    | query end                      | 0.000002 |
    | waiting for handler commit     | 0.000005 |
    | closing tables                 | 0.000004 |
    | freeing items                  | 0.000027 |
    | cleaning up                    | 0.000010 |
    +--------------------------------+----------+
```

**服务器层结构**:

- **连接器**: 身份认证和权限相关。
- **查询缓存**: 8.0 版本后移除。
- **分析器**: SQL 语句会经过分析器，分析器说白了就是要先看你的 SQL 语句要干嘛，再检查你的 SQL 语句语法是否正确。
- **优化器**: 按照 MySQL 认为最优的方案去执行。
- **执行器**: 执行语句，然后从存储引擎返回数据。这里也有权限校验
- **插件式存储引擎**

**更新语句执行过程**:

1. 从磁盘文件中找到对应查询条件的整页数据，加载到 buffer pool
2. 将更新数据的旧值写入到 undo log 文件备份
3. 更新 buffer pool 内的数据，写 redo log buffer
4. 准备提交事务, 准备将 redo log 写入磁盘，redo log prepared
5. 执行器生成 binlog, 并准备将 binlog 写入磁盘
6. 执行器调用存储引擎接口，写入 commit 标记到 redo log 里，redo log commit，提交事务完成，buffer pool 随机写入磁盘。

> 二阶段提交: 先 redo log prepared, 然后记录 binlog, 最后 redo log commit

### 索引没有被使用

- 隐式类型转换
- 如果 where 条件中含有 or, 除非 or 条件中的所有列都是索引列，否则不走
- 对于多列索引，如果没有使用前导列
- 如果对索引字段使用函数算数运算或者其他表达式操作
- 数量少，觉得全表扫描比用索引快
- like 以%开头

### 隐式类型转换

- varchar 类型的会隐式转换为数值型
- 例如 varchar 类型的索引, 查询条件用 int 索引失效
- 隐式转换 varchar -> int 截取前 n 个数字形式的字符，如果 n=0，则转换为 0;

## InnoDB

### InnoDB 与 MyISAM 对比

几个方面:

- 事务
- 锁
- 异常恢复
- 索引实现(聚簇 非聚簇)
  索引文件与数据文件分离, 回表查数据文件.

### InnoDB 如何实现事务的 ACID

- 使用 undo log(回滚日志) 来保证事务的原子性。
- 使用 redo log(重做日志) 保证事务的持久性。
- InnoDB 通过 锁机制、MVCC 等手段来保证事务的隔离性（ 默认支持的隔离级别是 REPEATABLE-READ ）。
- 保证了事务的持久性、原子性、隔离性之后，一致性才能得到保障。

### InnoDB 行级锁的实现

- Record lock：单个行记录上的锁
- Gap lock：间隙锁，锁定一个范围，不包括记录本身
- Next-key lock：record+gap 锁定一个范围，包含记录本身

### MySQL 缓存问题

- MySQL 8.0 后移除;
- 可以手动开启;
- 可以设置大小(几十 MB 比较合适);
- 可以控制某个具体查询语句是否需要缓存;

## 索引

### 主键

InnoDB 中，没有显示的指定主键时，InnoDB 会自动先检查表中是否有唯一索引且 not null 的字段，如果有，则选择该字段为默认的主键，否则 InnoDB 将会自动创建一个 6Byte 的自增主键。

### 索引下推

在 InnoDB 引擎,ICP 只能用于二级索引，因为 ICP 是为了减少读整行导致的 O，表读聚簇索引的时候就已经 IO 了
假设你的表中有一个索引 idx(col1,col2)
你的查询是
select _ from table name wherecol1 like 'aaa%' and col2 = 1
这样二级索引 idx 中的列 col2 会在查询二级索引的时候使用到
假如你的查询是
select _ from table_namewhere col1 likeaaa%' and col3 = 1 这时候就不会索引下推，因为二级索引 idx 里面没有 col3
重点不是 server 下推到引擎, 重点是减少 IO

explain: Using index condition
指的是筛选下推到存储引擎层, 为了**减少 IO**
不在二级索引上的 where 条件不能下推, 因为读 innoDB 聚簇索引的时候就已经 IO 了

在最左匹配的索引上使用了%, 右边的条件失效;
没有索引下推的话需要读取数据到 Server 层然后再筛选;
有了索引下推之后, 存储引擎就能做出的筛选

### 覆盖索引

包含查询中所有字段的索引
不需要回表, 减少一次索引操作, 随机 I/O 比顺序 I/O 慢
explain, where 会显示 using index

## LOG

### redo log

InnoDB 存储引擎层面独有的

不得不说 buffer pool 的存在, 在事务中, 修改会在 buffer pool 中操作
在这过程中也会记录 redo log buffer, 然后刷盘到 redo log 文件中

#### redo log 刷盘时机

innodb_flush_log_at_trx_commit

- 0: 事务提交不刷到 page cache, 也没有其他操作, 全靠后台轮询刷盘
- 1: 默认, 每次事务提交都进行刷盘
- 2: 事务提交只把 log buffer 写入 page cache, 刷盘交给文件系统

InnoDB 后台线程轮询, 每秒都将 redo log buffer 中的内容写到 page cache, 然后调用 fsync 刷盘.
除轮询之外, redo log buffer 占用的空间达到 innodb_log_buffer_size 一半的时候，后台线程会主动刷盘。

#### 日志文件组

log file 不是一个文件, 是多个文件组成的环形数组, 可配置大小

- write pos 是当前记录的位置，往后推移
- checkpoint 是当前要擦除的位置，也是往后推移

redo log 写入, write pos 更新
加载文件组, checkpoint 更新

### bin log

bin log 属于 Server
binlog_format:

- statement
- row
- mixed

#### 写入机制

bin log 也有缓存区, 每个线程都分配了 binlog cache, 异步 fsync 刷盘

异步刷盘配置 sync_binlog:

- 0: 由系统判定
- 1: 每次都刷
- N: N 次提交事务才刷

#### 二阶段提交

binlog 在事务提交的时候才记录
redolog 会在事务过程中记录

由于两种 log 的逻辑不同,有可能出现数据不一致的情况
MySQL 的解决方案是二阶段提交:
redo log 先 prepare, binlog 写入, redo log 再提交
redo log commit 阶段出现异常也不会回滚事务

### undo log

通过 undo log 实现回滚, undo log 会先一步持久化

undo log 是个逻辑结构
redo log 表示数据页的变化, 数据页重从哪开始变成了啥 物理结构快照
bin log 有 3 种模式

## 事务

### 事务的 ACID

- 原子性(Atomicit): 事务是最小的执行单位，不允许分割。事务的原子性确保动作要么全部完成，要么完全不起作用；
- 一致性(Consistency): 执行事务前后，数据保持一致，例如转账业务中，无论事务是否成功，转账者和收款人的总额应该是不变的；
- 隔离性(Isolation): 并发访问数据库时，事务不被其他事务所干扰，各并发事务之间是独立的；
- 持久性(Durabilily): 一个事务被提交之后。它对数据库中数据的改变是持久的，即使数据库发生故障也不应该对其有任何影响。

### 事务隔离级别

```sql
SELECT @@transaction_isolation;
```

- READ UNCOMMITIED（读未提交）
  - 一个事务未提交时，对其他事务也是可见的
  - 脏读
- READ COMMITIED（读已提交）
  - 第一个事务中的两次读数据之间，由于第二个事务的提交导致第一个事务两次读取的数据可能不一样
  - 不可重复读
  - 大多数 DB 系统的默认隔离级别。
- REPEATABLE READ（可重复读）
  - 读事务开始时的数据
  - 幻读
  - 其他事务增删操作会产生幻行，InnoDB 和 XtraDB 通过多版本并发控制(MVCC)解决了幻读。
- SERIALIZABLE（串行化）
  - 事务串行，读取的每一行数据上都加锁，可能会造成大量的超时和锁争用问题，只有非常需要确保数据的一致性而且可以接受没有井发的情况下才考虑

### InnoDB 怎么解决幻读问题

- 一致性锁定读
  基于锁的并发控制, 读取的时候加临键锁(next-key).
  ```sql
  -- X 锁
  select ... for update;
  DELETE\UPDATE\INSERT INTO\REPLACE INTO;
  -- S 锁
  SELECT ... LOCK IN SHARE MODE;
  ```
- 一致性非锁定读
  MVCC

### MVCC

InnoDB MVCC 的实现是通过保存数据在某个时间点的快照来实现的。

> 依赖于 DB_TRX_ID, Read View, undo log
> InnoDB 内部, 每行都有三个内部字段:
>
> - 6-byte DB_TRX_ID: 事务 id; (delete 视作 update, row header 里面有删除标记)
> - 7-byte DB-ROLL_PTR: 滚动指针(roll pointer), 指向 undo log
> - 6-byte DB_ROW_ID: 只出现在自动生成聚簇索引的场景, 行 ID

> 虽然 row 的回滚指针指向 undo log, 但是 undo log 不是物理日志, 它是个逻辑日志, 它会指向事务影响的行产生的变化

不管事务需要执行多长时间，它看到的数据是一致的；根据事务的开始时间不同，不同事务在同一时刻看到的数据可能是不一样的。  
只在读已提交和可重复读下工作  
**InnoDB**:

- 行记录版本号：每个行记录保存两个版本号(创建、删除)
- 事务版本号：每开始一个新的事务，版本号自增。事务开始时刻自增的版本号作为事务的版本号。
- 在可重复读的隔离级别下：

  - select (核心：事务开启的时刻，记录是最新存在的)

    - 只查找版本**早于或等于**当前事务版本的数据行，确保事务读取的行早于事务或事务本身插入或修改的。
    - 行的过期版本要么未定义，要么**大于**当前事务版本号，确保事务读取到的行，在事务开始之时未过期。
    - 只有条件 1、2 同时满足的记录，才能返回作为查询结果.

  - insert

    - 新增时保存当前系统版本号作为新增版本号。

  - delete
    - 删除时保存系统当前版本号作为删除版本号。
  - update
    - 插入一条新纪录，当前系统版本号作为新增版本号，同时保存当前系统版本号作为原记录的删除版本号。

- 个人理解: 在并发条件下, 比如事务 A(版本 1) 事务 B(版本 2):
  - (B 的增删操作影响不到 A) B 删除，A 也能读到, 但不能读 B 的新增, B 更新, A 读到原纪录.
  - (A 的增删操作会影响 B) B 能读 A 的新增, A 和自己的删除就读不到了, A 更新, B 读到新记录.

#### read view

是事务在某个或者某些时刻产生的, 表明这一刻事务之间的状态
rc rr 不同

重点是 活跃 id 列表

- 当前事务 id
- 活跃 id 中大于当前事务 id 的 m_low_limit_id
- 小于活跃 id 的 m_up_limit_id: 相当于最小的活跃 id
- **活跃 id 列表**

### MVCC 幻读的情况

绝大多数场景下是不会的, 只有带写操作的情况会出现:

- 事务 A 开始, select;
- 事务 B 开始, insert, 加 X 锁, commit;
- 事务 A update, 加锁, 将 B 的提交修改;
- 事务 A select, 多了一行.

### MySQL 索引两种主要的数据结构

- 哈希索引
  最大的缺点是不支持**顺序和范围**查询
- BTree
  都是使用的 B+Tree
  - MyISAM
    叶节点的 data 域存放的是数据文件的地址; 非聚簇索引
  - InnoDB
    主键索引本身包含了全部数据，其他的辅助索引的叶节点存储的是主键; 聚簇索引
- 全文索引
- 空间数据索引

### 索引为什么快

MySQL 基本存储结构 (InnoDB 引擎)
将数据划分为若干个磁盘页，以页作为磁盘和内存之间交互的基本单位，InnoDB 中页的大小一般为 16 KB。通常情况下，一次最少从磁盘中读取 16KB 的内容到内存中，一次最少把内存中的 16KB 内容刷新到磁盘中。

- 各个数据页之间可以组成一个双向链表（就是 B+树的各个页之间都按照索引值顺序用双向链表连接起来）
- 每个数据页都会为存储在它里边的记录生成一个页目录，该目录是用数组进行管理，在通过主键查找某条记录的时候可以在页目录中使用二分法快速定位到对应的槽，然后**再遍历该槽**对应分组中的记录即可快速找到指定的记录

无索引条件下 O(n)复杂度，索引重新组织了逻辑顺序, 使查找数据页的时候复杂度变成 O(logN)

### B 树和 B+树的区别

**B**:

- 所有节点不仅存放 key,也存放 data
- 所有的叶节点都是独立的 (没有链表)
- 检索过程都是类似二叉搜索树, 有时候不到叶子节点就找到了

**B+**:

- 只有叶子节点存放 key 和 data, 其他只存放 key
- 叶子节点有一条引用链(双向)指向相邻的叶节点
- 任何查找都是从根到页, 页之间顺序检索很明显

树高，减少 IO 次数；
叶子节点有双向的指针，方便范围查询

### binlog

binlog 记录了执行更改(只要执行就会记录，并不是非要实际更改)的所有操作

- 恢复
- 复制
- 审计：核验是否有注入攻击

事务未提交的日志会记录到缓存，**提交时将缓存写入**日志文件。
sync_binlog 每多少次事务将缓存写入，1 是即时写，但是会有性能影响。
binlog_format: STATEMENT / ROW / MIXED
STATEMENT 不支持并发操作 还有时间函数问题
ROW 支持并发操作 但是空间占用较大, 二进制易读性比较差

### 跳表与 B+树

MySQL 的性能瓶颈通常在 IO 上，B+树叶子节点磁盘页的设计是为了最大限度地降低磁盘 IO
Redis 内存读写，使用了跳表

### Datetime 和 Timestamp

Datetime

- 8 字节
- 无时区

Timestamp 有些问题，通常用 bigint

- 4 字节
- 有时区
- 存储到 s, 毫秒可用 MariaDB, 或额外用字段存

### 读写分离

主要是为了将对数据库的读写操作分散到不同的数据库节点上, 小幅提升写性能，大幅提升读性能。
实现:

- 部署多台数据库，选择一种的一台作为主数据库，其他的一台或者多台作为从数据库。
- 保证主数据库和从数据库之间的数据是实时同步的，这个过程也就是我们常说的主从复制。
- 系统将写请求交给主数据库处理，读请求交给从数据库处理。

**主从同步过程**

```sh
主库写binlog -> 从库请求更新binlog -> 主库发送 -> 从库接收 -> 写到relay log -> 执行
```

- 主库将数据库中数据的变化写入到 binlog
- 从库连接主库
- 从库会创建一个 I/O 线程向主库请求更新的 binlog
- 主库会创建一个 binlog dump 线程来发送 binlog ，从库中的 I/O 线程负责接收
- 从库的 I/O 线程将接收的 binlog 写入到 relay log 中。
- 从库的 SQL 线程读取 relay log 同步数据本地（也就是再执行一遍 SQL ）。

**主从同步延迟解决**:

- 把从路由到主库
- 延迟读取时间

### 分库分表

- 单表数据大
- 数据库太大
- 应用并发太大

**解决方案**:
Apache ShardingSphere

### explain

```sh
+----+-------------+---------+------------+-------+---------------+---------+---------+-------+------+----------+-------+
| id | select_type | table   | partitions | type  | possible_keys | key     | key_len | ref   | rows | filtered | Extra |
+----+-------------+---------+------------+-------+---------------+---------+---------+-------+------+----------+-------+
|  1 | SIMPLE      | seckill | NULL       | const | PRIMARY       | PRIMARY | 8       | const |    1 |   100.00 | NULL  |
+----+-------------+---------+------------+-------+---------------+---------+---------+-------+------+----------+-------+

  id //越大优先级越高
  select_type
  table
  partitions  //分区
  type
  possible_keys key key_len  //精度越高len越大
  ref
  rows
  filtered  // 是一个百分比的值，rows * filtered/100 可以估算出将要和前一个表进行连接的行数
  Extra
```

**select_type**:

- SIMPLE 简单的 select 查询，查询中不包含子查询或者 UNION
- PRIMARY 查询中若包含任何复杂的子部分，最外层查询则被标记为 PRIMARY
- SUBQUERY 在 SELECT 或 WHERE 列表中包含了子查询
- DERIVED 在 FROM 列表中包含的子查询被标记为 DERIVED（衍生），MySQL 会递归执行这些子查询，把结果放在临时表中
- UNION 若第二个 SELECT 出现在 UNION 之后，则被标记为 UNION; 若 UNION 包含在 FROM 子句的子查询中，外层 SELECT 将被标记为：DERIVED
- UNION RESULT 从 UNION 表获取结果的 SELECT

**type**

> system > const > eq_ref > ref > range > index > all  
> 一般来说，得保证查询至少达到 range 级别，最好能达到 ref。

- system 表只有一行记录（等于系统表），这是 const 类型的特列，平时不会出现
- const 表示通过索引一次就找到了
- eq_ref 唯一性索引扫描，对于每个索引键，表中只有一条记录与之匹配
- ref 非唯一性索引扫描，返回匹配某个单独值的所有行
- range 只检索给定范围的行，使用一个索引来选择行
- index 索引树扫描, 只遍历索引树
- ALL 拉跨

**ref**

- 哪些列或常量被用于查找索引列上的值,比如 id=1,那么 ref:const; 显示索引的哪一列被使用了.

**rows**

- 大致估算出, 找到所需的记录需要读取的行数

**Extra**

- Backward index scan: 优化器能在 InnoDB 上用降序索引
- Using filesort: 使用了外部索引文件排序, 没有按照表内的索引顺序
- Using temporary: 使用了用临时表保存中间结果，MySQL 在对查询结果排序时使用临时表。

  > 常见于 order by 和 group by

- Using where: 表示在 Server 进行了过滤, where 条件中有非索引字段
- Using index: 表示使用了覆盖索引
- Using where;Using index: 查询字段在索引里, where 条件没有覆盖
- Using index condition: 索引下推
- Using join buffer: 表明使用了连接缓存. 比如说在查询的时候，多表 join 的次数非常多，那么将配置文件中的缓冲区的 join buffer 调大一些。

### 分库分表分区

- 分区，通常指的是分区表的概念
  就是把一张表的数据分成 N 个区块，在逻辑上看最终只是一张表，但底层是由 N 个物理区块组成的
- 分表
  将一张表行级拆分成多张实体表
- 分库(tms_1,2,3,4,5)
  单台 DB 性能不够。
  垂直拆分，按业务拆分，跨数据库事务问题
  水平拆分，按一些规则做一些路由 (如 cityId)

### Union Union All

Union 排序且去重
Union all 不排序不去重

### 交集差集并集

```sql
DROP TABLE IF EXISTS t1 ;
CREATE TABLE t1 (name VARCHAR(30) , age int) ENGINE=innodb;
insert into t1 VALUES ('张三',33);
insert into t1 VALUES ('李四',44);
insert into t1 VALUES ('王五',55);
insert into t1 VALUES ('孙六',66);

DROP TABLE IF EXISTS t2 ;
CREATE TABLE t2 (name VARCHAR(30) , age int) ENGINE=innodb;
insert into t2 VALUES ('张三',33);
insert into t2 VALUES ('李四',44);
insert into t2 VALUES ('秦七',77);


-- 并集
select * from t1
UNION
select * from t2

-- 交集
#方式一
select * from t1 where  EXISTS (
	select * from t2 where t1.name= t2.name and t1.age= t2.age
);

#方式二 (不推荐)
select * from t1 where (t1.name ,t1.age) in (
	select * from t2
)

#方式三 从全集(包括重复)中找到只出现2次的
select * from (
	select * from t1
union all
	select * from t2
) t1 GROUP BY name,age HAVING COUNT(*)=2

-- 差集
-- 方式1
select * from t1 where not EXISTS (
select * from t2 where t1.name = t2.name and t1.age = t2.age
)

-- 方式2 从全集(包括重复)中找到只出现一次的
select * from (
	select * from t1
union all
	select * from t2
) t1 GROUP BY name,age HAVING COUNT(*)=1

-- 方式3
select * from t1
where (name,age)
not in ( select * from t2)

-- 方式4 子集情况
select t1.* from t1
LEFT JOIN t2
on t1.name = t2.name
and t1.age = t2.age
where t2.name is null
```

### 锁

行锁、表锁、一致性读（还有线程 latch）
行锁：共享锁 排他锁
表锁：意向共享锁 意向排他锁 共享锁 排他锁
一致性读：当前读 MVCC 和快照读 LBCC

---

### IP 存储

MySQL 提供了两个方法来处理 ip 地址

INET_ATON() : 把 ip 转为无符号整型 (4-8 位)
INET_NTOA() : 把整型的 ip 转为地址

### join

join_buffer_size 关联缓存, 关联表越多缓存越大, 开销越大

### 修改表结构

pt-online-schema-change, 表名替换, 有触发器可以同步在操作期间产生的记录
