.PHONY: run build test vet fmt fmt-check lint tidy clean jwt-secret setup-hooks help

# 默认端口（可在 config.yaml 覆盖）
PORT ?= 8081

# 本地运行
run:
	go run ./cmd/server

# 构建二进制
build:
	mkdir -p bin
	go build -o bin/admin-server ./cmd/server

# 跑测试
test:
	go test -race ./...

# 静态检查
vet:
	go vet ./...

# 格式化
fmt:
	gofmt -w .

# 检查格式（CI 用）
fmt-check:
	@test -z "$$(gofmt -l . | tee /dev/stderr)"

# 拉依赖
tidy:
	go mod tidy

# 清理
clean:
	rm -rf bin/

# 生成 48 字节 base64 的 JWT secret（≥ 32 字节强度要求）
# 用法：make jwt-secret > /dev/null && echo $ADMIN_JWT_SECRET 写到 .env 或 systemd unit
jwt-secret:
	@openssl rand -base64 48

# 启用 .githooks/* 守门钩子（commit-msg 校验 API surface 改动是否同步更新 docs/api.md）
# 一次性操作，clone 仓库后跑一次即可；CI 不需要
setup-hooks:
	git config core.hooksPath .githooks
	@echo "✓ git hooks 已指向 .githooks/（commit-msg 守门 docs/api.md 同步）"

# 帮助
help:
	@echo "make run         - 本地启动服务（:$(PORT)）"
	@echo "make build       - 构建二进制到 bin/admin-server"
	@echo "make test        - 跑单元测试"
	@echo "make vet         - 静态检查"
	@echo "make fmt         - 格式化"
	@echo "make fmt-check   - 检查格式（CI 用）"
	@echo "make tidy        - go mod tidy"
	@echo "make jwt-secret  - 生成 48 字节 base64 JWT secret"
	@echo "make setup-hooks - 启用 .githooks/ 守门（docs/api.md 同步检查）"
