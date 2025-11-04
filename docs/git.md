# Git

## 常用命令

### commit

```sh
# 修改作者
git commit --amend --reset-author --no-edit
```

### 疑难杂症

#### push 大文件失败

```sh
# 增大缓冲区
git config http.postBuffer 524288000
```
