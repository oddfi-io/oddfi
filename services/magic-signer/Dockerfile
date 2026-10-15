# syntax=docker/dockerfile:1.6

FROM golang:1.22-alpine AS build

WORKDIR /src

# Cache modules first for faster rebuilds.
# 经国内 Go module 代理拉取（proxy.golang.org 国内不可直连）。
ENV GOPROXY=https://goproxy.cn,direct
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG GIT_SHA=dev
ARG BUILD_TIME=unknown

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath \
      -ldflags "-s -w \
        -X main.gitSHA=${GIT_SHA} \
        -X main.buildTime=${BUILD_TIME} \
        -X github.com/Crypto-Barrett/oddfi-magic-client/client.Version=${GIT_SHA}" \
      -o /out/magic-signer \
      ./cmd/server

# ─── Runtime stage ────────────────────────────────────────────────────────
# 运行基座用 Docker Hub 的 alpine（gcr.io distroless 国内镜像源不稳定，Docker Hub 实测可达）。
# 二进制是 CGO_ENABLED=0 静态编译，alpine 可直接运行。
FROM alpine:3.20

# 非 root 用户（uid 与 distroless 的 nonroot 对齐）+ 从 build 阶段拷 CA 证书
# （服务要 HTTPS 调 Magic，必须有证书；不在运行阶段额外联网装包，保证国内可构建）。
RUN adduser -D -u 65532 nonroot
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/magic-signer /usr/local/bin/magic-signer

USER nonroot:nonroot
EXPOSE 8443

# 运行环境标识（可被部署时的环境变量覆盖）。
ENV APP_ENV=test

ENTRYPOINT ["/usr/local/bin/magic-signer"]
