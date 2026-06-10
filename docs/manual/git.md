# Git

## 配置

```sh
# 中文乱码
git config --global core.quotepath false
```

## 常用命令

### commit

```sh
# 修改作者
git commit --amend --reset-author --no-edit
```

### checkout

```sh
# checkout tag
git checkout tags/tag-oe-978-20240806140326394 -b tg
```

### 疑难杂症

#### push 大文件失败

```sh
# 增大缓冲区
git config http.postBuffer 524288000
```

#### 区分大小写

```sh
git config core.ignorecase false
```
