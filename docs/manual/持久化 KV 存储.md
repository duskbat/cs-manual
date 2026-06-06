# 持久化 KV 存储

https://i.xiaojukeji.com/way/article/13945524?lang=zh-CN
https://cooper.didichuxing.com/docs2/document/2203147641529

## 业界调研

开源的3个：360的pika、腾讯的tendis、Apache的kvrocks

|                      | 使用模式     | 架构            |
| -------------------- | ------------ | --------------- |
| ABase（字节KV）      | 大集群多租户 | 自研            |
| Tair（阿里KV）       | 小集群       | 自研            |
| PegaDB（百度通用KV） | 小集群       | kvrocks二次开发 |
| mintKV（百度大搜）   | 大集群多租户 | 自研            |
| Celler（美团KV）     | 小集群       | Tair演进        |
| 网易KV               | 小集群       | kvrocks二次开发 |
