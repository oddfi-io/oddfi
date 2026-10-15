# oddfi-agent-backend 多阶段构建
# 阶段 1：编译（Go 1.26，静态二进制；modernc.org/sqlite 是纯 Go，无需 cgo）
# GOOS/GOARCH 由 buildx --platform 注入，不在 ENV 里写死 — 便于未来加 arm64
FROM golang:1.26-alpine AS builder
WORKDIR /app
ENV GOPROXY=https://goproxy.cn,direct \
    CGO_ENABLED=0

# git 给 go mod 用（当前依赖纯 Go 不需要，但加上防未来引入私有/git 协议依赖时爆）
RUN apk --no-cache add git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -ldflags="-w -s" -trimpath -buildvcs=false -o oddfi-agent-backend .

# 阶段 2：运行（alpine 极简 + 时区 + 证书 + wget 用于 HEALTHCHECK）
FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata && \
    addgroup -S app && adduser -S -G app -u 1000 app
WORKDIR /app
COPY --from=builder /app/oddfi-agent-backend ./

# /data 用于挂载 SQLite 持久化（DB_PATH=/data/cards.db）
# uid 1000 与宿主预创建数据目录 owner（chown 1000:1000）严格一致
RUN mkdir -p /data && chown -R app:app /app /data
USER app
EXPOSE 8090

# host network 模式下 EXPOSE 仅文档作用；HEALTHCHECK 让 docker ps 直接看 healthy
# alpine 自带 BusyBox wget；--start-period 给冷启动 + 可能的 schema migrate 留余量
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/healthz >/dev/null || exit 1

ENTRYPOINT ["./oddfi-agent-backend"]
