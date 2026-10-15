# Stage 1: Build
FROM golang:1.25-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy go mod files
COPY go.mod go.sum ./
ENV GOPROXY=https://goproxy.cn,direct
RUN go mod download

# Copy source code
COPY . .

# Build binaries with CGO disabled — 单镜像三 binary
# 由 docker run CMD 覆盖选择启动哪个进程：
#   web-api 容器:        默认 CMD ["./web-api"]
#   presale-worker 容器: docker run ... <image> ./presale-worker
#   一次性回填工具:      docker run --rm ... <image> ./inv6-backfill --dry-run（BUG-001）
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
        go build -ldflags="-w -s" -o web-api        ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
        go build -ldflags="-w -s" -o presale-worker ./cmd/presale-worker && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
        go build -ldflags="-w -s" -o inv6-backfill  ./cmd/inv6-backfill

# Stage 2: Run
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Copy binaries from builder — 三 binary 都进 /app/
COPY --from=builder /build/web-api        ./web-api
COPY --from=builder /build/presale-worker ./presale-worker
COPY --from=builder /build/inv6-backfill  ./inv6-backfill

# 配置文件不再 baked 进镜像 — Phase 3 重构（2026-05-26）
# 镜像保持无 secrets，container 启动时必须通过 docker run -v 挂载 host config：
#   docker run -v /etc/oddfi/config_prod.yaml:/app/config.yaml:ro ...
# 见 deploy/docker-build-and-push.sh 输出的部署命令
EXPOSE 80

# Run the application
CMD ["./web-api"]
