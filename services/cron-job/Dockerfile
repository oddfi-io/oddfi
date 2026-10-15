ARG BUILD_ENV=prod

# Multi-stage build
FROM golang:1.24-alpine AS builder

ARG BUILD_ENV

# 安装依赖
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# 复制go.mod和go.sum
ENV GOPROXY=https://goproxy.cn,direct
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd

# 运行阶段 - 使用轻量级镜像
FROM alpine:latest
ARG BUILD_ENV
# 安装时区数据
RUN apk --no-cache add tzdata

# 设置时区和环境
ENV TZ=Asia/Shanghai
ENV ENV=${BUILD_ENV}

# 创建非root用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /home/appuser

# 从builder阶段复制二进制文件
COPY --from=builder --chown=appuser:appgroup /app/main .

# 复制对应环境的配置文件
COPY --chown=appuser:appgroup internal/config/config_${BUILD_ENV}.yaml /home/appuser/internal/config/config_${BUILD_ENV}.yaml

# 切换到非root用户
USER appuser

# 暴露端口
EXPOSE 8080

# 启动命令
CMD ["./main"]
