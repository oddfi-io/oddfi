# 运维文档

`magic-signer` 服务的编译、Docker 部署、配置说明。

---

## 1. 编译

**本地二进制：**
```bash
go build -o magic-signer ./cmd/server
```

**带版本注入（推荐生产）：**
```bash
go build -trimpath -ldflags "-s -w \
  -X main.gitSHA=$(git rev-parse HEAD) \
  -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -o magic-signer ./cmd/server
```

**Docker 镜像：**
```bash
docker build \
  --build-arg GIT_SHA=$(git rev-parse HEAD) \
  --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -t magic-signer:$(git rev-parse --short HEAD) .
```

镜像以非 root 用户运行，`EXPOSE 8443`。

**打 tag、推送、拉取（以 Docker Hub 账号 `knightjohn257` 为例）：**

```bash
# 1. 构建本地镜像（开发用 :dev 标签；生产可用上面那条带版本注入的构建）
docker build -t magic-signer:dev .

# 2. 打成 Docker Hub 仓库标签：<用户名>/<镜像名>:<标签>
docker tag magic-signer:dev knightjohn257/magic-signer:dev

# 3. 登录后推送（docker login 输入 Docker Hub 用户名 + 密码或 access token）
docker login
docker push knightjohn257/magic-signer:dev

# 4. 在部署机上拉取
docker pull knightjohn257/magic-signer:dev
```

> 把 `knightjohn257` 换成你自己的 Docker Hub 用户名。`:dev` 是开发标签；正式发布建议再打一个
> 带 git short-sha 的不可变标签，便于回滚和审计，不要只依赖会被覆盖的 `:dev` / `:latest`：
> ```bash
> docker tag magic-signer:dev knightjohn257/magic-signer:$(git rev-parse --short HEAD)
> docker push knightjohn257/magic-signer:$(git rev-parse --short HEAD)
> ```

---

## 2. Docker 部署

### 2.1 准备 `.env`

```bash
cp .env.example .env
# 编辑 .env，填好所有必填项（见第 3 节）
```

`.env` 不要进镜像、不要进 git。

> ⚠️ 本服务的 `.env` 是 **godotenv 格式**（含 `#` 注释、多行的 `OIDC_PRIVATE_KEY_PEM` 私钥），
> **不能用 `docker --env-file .env`**——Docker 的 env-file 解析器不识别注释行、也不支持多行值，
> 会报 `invalid env file ... contains whitespaces`。
> 正确做法是用 `-v` 把**宿主机的 `.env` 只读挂载**进容器，由程序内置的 `godotenv` 读取（容器工作目录是 `/`，挂到 `/.env`）。
> 这样 `.env` 始终留在宿主机、不进镜像。

### 2.2 启动

```bash
docker run -d --name magic-signer \
  --restart unless-stopped \
  -p 127.0.0.1:8443:8443 \
  -v "$(pwd)/.env:/.env:ro" \
  --read-only \
  --tmpfs /tmp \
  --log-opt max-size=100m \
  --log-opt max-file=3 \
  knightjohn257/magic-signer:dev
```

PowerShell（Windows）下挂载路径写法不同：`-v "${PWD}\.env:/.env:ro"`。

要点：
- `knightjohn257/magic-signer:dev`：用上一步推到 Docker Hub 的镜像（换成你的用户名 / 标签）
- `-v "$(pwd)/.env:/.env:ro"`：把**宿主机当前目录的 `.env` 只读挂进容器**，程序用 godotenv 读取；`.env` 不进镜像（详见 2.1 的说明）
- `-p 127.0.0.1:8443:8443`：只暴露到宿主 loopback，前面用反向代理或 service mesh 接入
- 如果一定要绑 `0.0.0.0`，必须在 `.env` 里同时设 `ALLOW_PUBLIC_LISTEN=1`，否则服务启动校验会拒绝
- `--log-opt max-size=100m --log-opt max-file=3`：容器日志按文件轮转（单文件上限 100m、保留 3 个，约 300m 封顶），防止请求日志把磁盘写满；按需调大
- `--read-only` + `--tmpfs /tmp`：根文件系统只读，没有持久化需求
- `--restart unless-stopped`：宿主重启时自动拉起

> 不建议对本服务用 `--network host`：那样 `-p` 的 loopback 限制会失效，容器直接按 `LISTEN_ADDR` 绑到宿主所有网卡（还会触发 `ALLOW_PUBLIC_LISTEN` 校验），与"内部专用、只绑 loopback"的定位冲突。

### 2.3 验证

```bash
# 启动日志（应能看到 "magic-signer starting" 和 "listening"）
docker logs --tail 30 magic-signer

# 健康检查
curl -sf http://127.0.0.1:8443/healthz

# 版本信息
curl -s http://127.0.0.1:8443/version
```

### 2.4 升级

```bash
# 拉新镜像
docker pull knightjohn257/magic-signer:dev

# 重建容器
docker stop magic-signer && docker rm magic-signer
docker run -d --name magic-signer \
  --restart unless-stopped \
  -p 127.0.0.1:8443:8443 \
  -v "$(pwd)/.env:/.env:ro" \
  --read-only --tmpfs /tmp \
  --log-opt max-size=100m \
  --log-opt max-file=3 \
  knightjohn257/magic-signer:dev
```

### 2.5 docker-compose（可选）

```yaml
# docker-compose.yml
services:
  magic-signer:
    image: knightjohn257/magic-signer:dev
    container_name: magic-signer
    restart: unless-stopped
    ports:
      - "127.0.0.1:8443:8443"
    # 用 volume 挂载宿主 .env（godotenv 读取），不要用 env_file（同样不支持多行私钥）
    volumes:
      - ./.env:/.env:ro
    read_only: true
    tmpfs:
      - /tmp
    logging:
      driver: json-file
      options:
        max-size: "100m"
        max-file: "3"
```

```bash
docker compose up -d
docker compose logs -f
```

---

## 3. `.env` 参数说明

配置全部走环境变量，由 `internal/config/config.go` 在启动时加载和校验；
任一必填缺失或格式错误，服务**拒绝启动**并打印 error 后退出。

### 3.1 必填参数（缺一不可）

#### `APP_ENV` — 部署环境
- 取值：`prod` 或 `test`，其他值拒绝启动
- 作用：
  1. **与 `MAGIC_API_KEY` 前缀做强一致校验**，防止生产用测试 key、或反之
     - `prod` ↔ `pk_live_*`
     - `test` ↔ `pk_test_*`
  2. **作为 JWT 缓存和地址缓存的命名空间前缀**（防 prod/test 数据串）
  3. 在所有结构化日志的 `env` 字段、`/version` 端点里露出

#### `MAGIC_API_KEY` — Magic API 密钥
- 取值：Magic Labs 控制台分配的 key
- 作用：放在请求 Magic TEE 的 `X-Magic-API-Key` 请求头里，识别你的 Magic 应用

#### `MAGIC_OIDC_PROVIDER_ID` — OIDC provider UUID
- 取值：在 Magic dashboard 里创建 OIDC provider 时拿到的 UUID
- 作用：放在请求 Magic 的 `X-OIDC-Provider-ID` 头里，告诉 Magic"用哪个 provider 验我签的 JWT"

#### `MAGIC_REFERRER` — Magic-Referrer 头
- 取值：你应用的域名，如 `https://www.oddfi.io`
- 作用：放在 `X-Magic-Referrer` 头里，需与 Magic dashboard 里配置的 Referrer 一致，
  否则 Magic 会拒掉请求

#### `OIDC_PRIVATE_KEY_PEM` — OIDC JWT 签名私钥
- 取值：RSA 私钥（PKCS8 或 PKCS1 PEM），**至少 2048 位**
- 作用：本服务用它给每个用户签一个 RS256 OIDC JWT，作为调 Magic TEE 的鉴权凭证；
  Magic 通过你公开发布的 JWKS（含对应公钥）来验签
- 注意：对应公钥必须已经发布到你的 JWKS endpoint，且 `kid` 与 `OIDC_KID` 一致

#### `OIDC_KID` — JWT header.kid
- 取值：JWKS 中某个 key 的 kid 字段（自己命名，建议含轮换标识，如 `uniq-prod-2026`）
- 作用：写入签出的 JWT 头部，Magic 用这个 kid 去你的 JWKS 里找公钥验签；
  本服务**不直接发布 JWKS**，需要你单独部署 JWKS endpoint

#### `OIDC_ISSUER` — JWT iss claim
- 取值：合法 `https://` URL，如 `https://www.oddfi.io/`
- 作用：写入签出的 JWT 的 `iss` claim，必须与 Magic dashboard 里注册的 issuer **完全一致**
  （包括末尾斜杠），否则 Magic 拒签

#### `OIDC_AUDIENCE` — JWT aud claim
- 取值：你的应用标识字符串，如 `oddfi-app`
- 作用：写入签出的 JWT 的 `aud` claim，需与 Magic 配置一致

#### `CALLER_TOKEN_<NAME>` — 调用方鉴权 token（**至少配一个**）
- 取值：原始 token 的 **sha256 hex（64 字符小写）**，**不是原始 token**
- 作用：定义一个有权调用本服务的内部 caller。`<NAME>` 自由命名，会被转成 caller 标识
  （`WEB_API` → `web-api`）出现在日志里。调用方在 HTTP 请求头里带
  `X-Service-Auth: Bearer <raw-token>`，本服务对原始 token 做 sha256 后查表
- 生成与下发：见 **第 4 节「调用方 token 的生成与下发」**（含 bash / PowerShell 两种生成方式）

### 3.2 可选参数（带默认值）

#### `LISTEN_ADDR` — 监听地址
- 默认：`:8443`
- 作用：HTTP 服务的 bind 地址。绑公网（`0.0.0.0:*` / `[::]:*`）会被校验拒绝，
  除非同时设 `ALLOW_PUBLIC_LISTEN=1`

#### `ALLOW_PUBLIC_LISTEN` — 允许绑公网接口
- 默认：空（拒绝公网绑定）
- 作用：设为 `1` 才允许 `LISTEN_ADDR` 绑 `0.0.0.0` 或 `::`。容器内通常需要设置（容器里 0.0.0.0 是常态），
  防御误绑直接暴露的场景

#### `MAGIC_CHAIN` — 链标识
- 默认：`ETH`
- 作用：放在 `X-Magic-Chain` 头里

#### `MAGIC_ENDPOINT` — Magic TEE Express 地址
- 默认：`https://tee.express.magiclabs.com`
- 作用：所有上游调用打到这个 base URL，一般不动；集成测试时会覆盖成 httptest server

#### `MAGIC_TIMEOUT` — 调 Magic 的 HTTP 超时
- 默认：`5s`，Go duration 格式
- 作用：单次 HTTP 请求超时，超过则视为失败可能触发重试

#### `MAGIC_MAX_RETRIES` — 调 Magic 的最大重试次数
- 默认：`3`，范围 `[0, 10]`
- 作用：对 5xx / 429 / 网络错误自动重试。**4xx（非 429）不重试**，直接返错给调用方

#### `MAGIC_RETRY_BASE_DELAY` — 重试初始退避
- 默认：`200ms`
- 作用：第 N 次重试等待 `base × 2^(N-1) ± 25% 抖动`，避免雪崩

#### `JWT_LIFETIME` — OIDC JWT 有效期
- 默认：`30m`，必须 `≥ 1m`
- 作用：本服务签出的 OIDC JWT 的 `exp - iat`。一个 JWT 在到期前会被缓存复用，到期后重签

#### `JWT_REFRESH_SAFETY` — JWT 提前刷新窗口
- 默认：`1m`，必须 `< JWT_LIFETIME`
- 作用：JWT 到期前 `safety` 这段时间内，下次 `Get` 不走缓存而是重新 mint，
  避免把"快过期"的 JWT 发给 Magic 引发"刚验完就过期"的边缘情况

#### `ADDR_CACHE_TTL` — 用户地址缓存 TTL
- 默认：`24h`
- 作用：`user_id → EOA 地址` 的进程内 LRU 缓存的过期时间。Magic 的地址对
  `(env, user_id)` 是确定性的，缓存只是省一次 Magic 调用

#### `ADDR_CACHE_MAX` — 地址缓存最大条目数
- 默认：`100000`，必须 `> 0`
- 作用：LRU 容量上限。满了驱逐最久未访问的条目

#### `HEALTH_CHECK_INTERVAL` — 后台探活周期
- 默认：`30s`
- 作用：后台 goroutine 每隔这段时间对 Magic upstream 做一次轻量探测，
  让 `/healthz` 能反映"Magic 是否可达"。设 `0` 关闭后台探活（`/healthz` 只反映自身状态）

#### `LOG_LEVEL` — 日志级别
- 默认：`info`
- 作用：结构化 JSON 日志的最低级别

#### `CALLER_OPS_<NAME>` — 限定 caller 可调的 op
- 默认：空（不限制，全允许）
- 取值：csv，如 `address,sign`
- 作用：与 `CALLER_TOKEN_<NAME>` 配对。如 `CALLER_OPS_ADMIN_SVC=address`
  表示 `admin-svc` 这个 caller 只能调 wallet address，调签名会返回 403 `OP_NOT_ALLOWED`

---

## 4. 调用方 token 的生成与下发

### 4.1 概念：一个 service，多个 client

`magic-signer` 是**一个**被调用的 service；调用它的程序（web-api、admin-svc、batch-job…）
是**多个** client。每个 client 各持有**一个自己专属的 token**，互不共用。

```
   client: test-web-api ──token A──▶ ┌──────────────────────────────────────┐
   client: admin-svc    ──token B──▶ │   magic-signer (service)             │
   client: batch-job    ──token C──▶ │   .env 里一行 CALLER_TOKEN_* 对应一个 │
                                     │   client，谁的 token 命中就知道是谁  │
                                     └──────────────────────────────────────┘
```

要新增一个能调用本服务的 client，就生成一对 token、在服务端加一行 `CALLER_TOKEN_<NAME>`、
把原始 token 发给该 client。client 数量不限（至少要有 1 个）。

### 4.2 token 的两种形态

同一个 token 有两种形态，分别放在两端，**千万别放反**：

| 形态 | 放在哪 | 谁持有 | 说明 |
| ---- | ------ | ------ | ---- |
| **原始 token（raw）** | client 的配置 `AuthToken`，请求头 `X-Service-Auth: Bearer <raw>` | 调用方 | 32 字节随机数的 hex（64 字符） |
| **sha256 hex** | 服务端 `CALLER_TOKEN_<NAME>` 环境变量 | 被调用方 | 原始 token 的 sha256（64 字符小写 hex） |

服务端**只存 sha256，不存原始 token**：收到请求后对原始 token 算 sha256，再查表匹配。
即使服务端配置泄露也无法反推出可用的原始 token（哈希不可逆）。

### 4.3 生成一对 token

> ⚠️ raw token 是机密。用安全渠道（密码管理器 / Secret 系统）发给调用方，不要进 git、不要进日志。

**bash / Linux / macOS：**
```bash
RAW=$(openssl rand -hex 32)
echo "raw    (发给 client，填它的 AuthToken):  $RAW"
echo "sha256 (写服务端 .env 的 CALLER_TOKEN_*): $(printf %s "$RAW" | sha256sum | cut -d' ' -f1)"
```

**PowerShell（Windows）：**
```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$RAW = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::ASCII.GetBytes($RAW))
$HEX  = ($hash  | ForEach-Object { $_.ToString('x2') }) -join ''
Write-Host "raw    (发给 client，填它的 AuthToken):  $RAW"
Write-Host "sha256 (写服务端 .env 的 CALLER_TOKEN_*): $HEX"
```

两端算法一致：raw token 就是那串 64 字符 hex，sha256 是对该 hex **字符串的 ASCII 字节**求哈希。
（对应代码 `internal/config/config.go` 的 `AuthTable.Lookup`：`sha256.Sum256([]byte(rawToken))`。）

### 4.4 下发：两端各放一处

以新增 client `test-web-api` 为例。

**① 服务端（magic-signer）`.env`** —— 写 sha256：
```bash
CALLER_TOKEN_TEST_WEB_API=<上一步算出的 sha256 hex>
# 可选：限制它只能调某些 op（不写=全部允许），见 3.2 节 CALLER_OPS
# CALLER_OPS_TEST_WEB_API=address,sign
```
改完需重启服务使配置生效。

**② 调用方（test-web-api 程序）** —— 用 raw token 初始化 SDK：
```go
cli, _ := magicclient.New(magicclient.Config{
    BaseURL:   "https://magic-signer.svc.cluster.local",
    AuthToken: os.Getenv("MAGIC_SIGNER_TOKEN"), // ← 这里放 raw token，不是 sha256
})
```
生产中 raw token 应从该 client 自己的 Secret/环境变量读取，不要硬编码。

### 4.5 client 身份（caller 名字）从哪来

身份不来自 token 内容，而来自服务端**变量名的后缀**。映射规则（`config.go` 的 `loadAuthTableFromEnv`）：
转小写 + 下划线转横线。

```
CALLER_TOKEN_TEST_WEB_API   →  caller = "test-web-api"
CALLER_TOKEN_ADMIN_SVC      →  caller = "admin-svc"
```

请求命中后，这个名字会出现在每条请求日志的 `caller` 字段里（见 `internal/handler/logging.go`）：
```json
{"msg":"http_request","caller":"test-web-api","caller_ip":"10.0.3.12","path":"/v1/wallet/address","status":200}
```

### 4.6 注意事项

- **一个 client 一个 token**：不同程序不要共用同一 token，否则 sha256 相同、命中同一行，日志里区分不出谁是谁。
- **轮换**：生成新一对 → 在 `.env` 里把对应 `CALLER_TOKEN_<NAME>` 换成新 sha256 → 把新 raw token 发给该 client → 重启。需要平滑切换时可临时并存新旧两行（不同 `<NAME>`）再下线旧的。
- **格式校验**：`CALLER_TOKEN_*` 的值必须是 64 字符合法 hex，否则服务启动即报错；且至少要配一个。

---

## 相关文件

- `.env.example` — 配置模板
- `internal/config/config.go` — 配置加载真实代码（冲突以代码为准）
- `DESIGN.md` — 架构与 API spec
