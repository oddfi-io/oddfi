# ========== 构建阶段 ==========
FROM golang:1.24-alpine AS builder
# 安装构建依赖
RUN apk add --no-cache gcc musl-dev
WORKDIR /build
# 复制 go mod 文件
COPY go.mod go.sum ./
ENV GOPROXY=https://goproxy.cn,direct
RUN go mod download
# 复制源代码
COPY . .
# 交叉编译为 Linux amd64
ENV CGO_ENABLED=1
ENV GOOS=linux
ENV GOARCH=amd64
RUN go build -ldflags="-w -s" -o chain_consumer ./cmd/main.go
# ========== 运行阶段 ==========
FROM alpine:latest
# 安装运行时依赖
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
# 创建 config 目录
RUN mkdir -p /app/configs
# 从构建阶段复制二进制文件
COPY --from=builder /build/chain_consumer .
# 复制配置文件（如果需要）
COPY configs/config-prod.yaml /app/configs/config-prod.yaml
# 设置环境变量
ENV ENV=prod

# 启动命令
CMD ["./chain_consumer"]