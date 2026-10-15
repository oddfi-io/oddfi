# 阶段 1: 编译
FROM golang:1.24-alpine AS builder
WORKDIR /app

# 配置代理加速（国内服务器必备）
ENV GOPROXY=https://goproxy.cn,direct
COPY go.mod go.sum ./
RUN go mod download
COPY . .

# 静态编译 Go 二进制
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o web-api main.go

# 阶段 2: 运行
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/
# 从编译阶段拷贝二进制文件和配置文件
COPY --from=builder /app/web-api .
COPY --from=builder /app/config ./config

# 启动命令  测试环境 加载 config_dev.yaml 线上环境加载 config_prod.yaml
ENTRYPOINT ["./web-api", "-config", "config/config_prod.yaml"]