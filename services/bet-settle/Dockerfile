# 阶段 1: 编译
FROM golang:1.24-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git ca-certificates

ENV GOPROXY=https://goproxy.cn,direct

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# 静态编译 Go 二进制；服务只运行后台 worker，不暴露 HTTP API。
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o oddfi-bet-settle ./cmd/server

# 阶段 2: 运行
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /root/

ENV TZ=Asia/Shanghai

# 从编译阶段拷贝二进制文件和配置文件。
COPY --from=builder /build/oddfi-bet-settle .
COPY --from=builder /build/config ./config

# 启动命令：线上环境加载 config_prod.yaml；测试环境可改为对应 dev/selftest 配置。
ENTRYPOINT ["./oddfi-bet-settle", "-config", "config/config_prod.yaml"]
