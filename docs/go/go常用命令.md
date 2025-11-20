# go 常用命令

## go list

```sh
go list -m -json -mod=readonly all
```

-m: 列出模块而不是包

-json: 以 JSON 格式输出，便于程序解析

-mod=readonly: 只读模式，不更新 go.mod 文件

all: 包含所有依赖（直接和间接）
