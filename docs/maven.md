# Maven

## http block

Maven blocks external HTTP repositories by default since version 3.8.1

```xml
  <mirrors>
    <mirror>
      <id>maven-default-http-blocker</id>
      <!-- 必须 dont-match-anything-mate 不知道什么意思，官方文档里没有 -->
      <mirrorOf>external:dont-match-anything-mate:*</mirrorOf>
      <name>Pseudo repository to mirror external repositories initially using HTTP.</name>
      <url>http://0.0.0.0/</url>
      <blocked>false</blocked>
    </mirror>
  </mirrors>
```
