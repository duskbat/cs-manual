# JVM 调优

## JVM 参数

### 堆内存相关

- 指定堆内存大小:
  ```sh
  -Xms2G -Xmx5G
  ```
- 指定新生代(young generation)大小:
  ```sh
  -XX:NewSize=256m
  -XX:MaxNewSize=1024m
  ```
  或者这样: (NewSize 和 MaxNewSize 设为一致)
  ```sh
  -Xmn1024m
  ```
- 设定新生代和老年代的比值: (1:1)

  ```sh
  -XX:NewRatio=1
  ```

- 指定永久代大小:
  ```sh
  -XX:PremSize=N
  -XX:MaxPremSize=N
  ```
- 指定元空间大小:
  ```sh
  -XX:MetaspaceSize=N
  -XX:MaxMetaspaceSize=N
  ```

### GC 相关

- 指定使用哪一款收集器:

  ```sh
  -XX:+UseSerialGC
  -XX:+UseParallelGC
  -XX:+UseParNewGC
  -XX:UseG1GC
  ```

- 记录 GC 活动
  ```sh
  -XX:+UseGCLogFileRotation
  -XX:NumberOfGCLogFiles=<number of log files>
  -XX:GCLogFileSize=<file size>[unit]
  -Xloggc:/path/to/gc.log
  ```

---

## 工具

**命令行**

- jps: java 进程的本地 vmid 和启动类 (shell
  \- l 主类的全类名
  \- v 启动时参数
  \- m main()的参数

- jstat: 监控运行状态的命令行工具 (shell
  \- class vmid: ClassLoader 信息
  \- compiler vmid: JIT 编译信息
  \- gc vmid: GC 相关的堆信息
  \- gccapacity vmid: 各个代的容量及使用情况
  \- gcnew vmid: 新生代
  \- gcnewcapcacity vmid: 新生代大小与使用情况
  \- gcold vmid: 老年代和永久代, jdk1.8 永久代无了
  \- gcoldcapacity vmid: 老年代的大小
  \- gcpermcapacity vmid: 永久代大小, jdk1.8 无了
  \- gcutil vmid: 垃圾收集信息

- jinfo: 虚拟机参数, 能看能改 (shell
  \- vmid: 全部系统属性和 VM 参数
  \- flag {name} vmid: 显示具体参数

- jmap: 生成堆转储快照 (文件
  如果不使用 jmap, 可以通过命令`-XX:+HeapDumpOnOutOfMemoryError`在 OOM 的时候自动生成 dump 文件
  \- dump

- jhat: 分析 heapdump 文件 (浏览器

- jstack: 线程快照 (shell

**图形化**

- Jconsole

- Visual VM: 很牛逼的

**启动**

```sh
java -Dloader.path=\libs -Dfile.encoding=utf-8 -jar mes-app-1.0.2.jar
```
