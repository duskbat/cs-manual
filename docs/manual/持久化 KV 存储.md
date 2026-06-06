# 持久化 KV 存储

https://i.xiaojukeji.com/way/article/13945524?lang=zh-CN
https://cooper.didichuxing.com/docs2/document/2203147641529

## 业界调研

开源的 3 个：360 的 pika、腾讯的 tendis、Apache 的 kvrocks

|                       | 使用模式     | 架构             |
| --------------------- | ------------ | ---------------- |
| ABase（字节 KV）      | 大集群多租户 | 自研             |
| Tair（阿里 KV）       | 小集群       | 自研             |
| PegaDB（百度通用 KV） | 小集群       | kvrocks 二次开发 |
| mintKV（百度大搜）    | 大集群多租户 | 自研             |
| Celler（美团 KV）     | 小集群       | Tair 演进        |
| 网易 KV               | 小集群       | kvrocks 二次开发 |
