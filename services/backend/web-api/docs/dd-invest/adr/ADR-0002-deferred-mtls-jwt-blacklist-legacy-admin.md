# ADR-0002: TGE 前不上 mTLS / 黑名单跨服务 / 不修 legacy admin/order

**状态**：Accepted（已知 debt）
**日期**：2026-05-26
**关联**：[ADR-0001](ADR-0001-admin-rpc-not-shared-db.md) · [DD-003 v3](../DD-003-admin-rpc-rework.md) · critic v2/v3 review

## 背景

DD-003 v3 落地了 admin → web-api RPC 方案，但在三轮 critic review 中识别出 3 项**有意识地延后**的安全 debt。本 ADR 显式登记这些 debt，避免 TGE+30 天评估期被遗忘。

## 三项已知 debt

### Debt-1: 不上 mTLS / service mesh

**当前方案**：admin → web-api 用 HMAC-signed bearer（`X-Service-Sig` + `X-Timestamp`，60s 窗口 + idempotency_key 参与签名）

**理论上更好的方案**：mTLS（每端持证书，TLS 握手即双向鉴权）+ service mesh（Envoy / Linkerd 自动注入）

**TGE 前不做的理由**：
1. 团队没人运维过 self-signed CA / cert renewal
2. TGE 距今 15 天，引入 CA + 2 张 cert + Nginx mTLS 配置 ≥ 一天工时
3. HMAC bearer 已能解决 token 静态泄漏风险（短窗口 + 多 secret 重叠期）

**TGE+30 天评估触发条件**：
- 团队 ≥ 2 人能运维 CA
- 或被合规要求强制（如新交所/SFC 要求 service-to-service mTLS）
- 或 admin QPS > 50（service mesh 成本回收）

### Debt-2: JWT 黑名单跨服务不可见

**当前方案**：admin-backend logout 把 jti 写自己 Redis 黑名单。web-api 不连 admin 的 Redis，**不查黑名单**。

**风险**：admin SPA 用户登出后，泄漏的 JWT 在 token TTL 内对 web-api internal endpoint 仍有效。

**短期缓解（必须 TGE 前做）**：
- **admin JWT TTL 缩到 ≤ 2h**（admin-backend config.yaml `jwt.ttl: 2h`，从默认 24h 改）
- audit 表保留 `jti` + `service_secret_id` 字段便于事后追踪

**理论上更好的方案**：
- **(a)** admin-backend 暴露 `GET /internal/jwt-blacklist?jti=` 给 web-api 查（重新引入反向依赖但只读 + fail-open）
- **(b)** web-api 直连 admin Redis 做黑名单查询（运维多挂一条 ELB / 内网通道）
- **(c)** 改 JWT 为 stateless + 强 TTL（接受窗口期风险）

**TGE+30 天补 (a)**：admin-backend 新增只读 `/internal/jwt-blacklist/:jti` endpoint；web-api admin_jwt middleware 加 5min 本地 LRU cache 调用查询；fail-open（admin 不可达时不拒绝 web-api 请求）。

### Debt-3: legacy `/admin/order/*` 路由无鉴权

**当前问题**：web-api 现有 3 个公网无鉴权 endpoint：
- `GET /admin/order/pending_orders`
- `POST /admin/order/approve_order`
- `POST /admin/order/order_info`

这与 DD-003 「新 `/internal/admin/*` 严格 service-token + JWT」形成对比，是 history-leftover 漏洞。

**TGE 前不修的理由**：
- 与 DD-003 RPC 重做范围无关
- 修这些需要：调查这些 endpoint 谁在用 + 加 auth + 前端协调

**TGE+14 天硬 deadline 修复**：
- 调研 `/admin/order/*` 实际调用方
- 加 `middleware.AdminAuth` + 仅放行 `super_admin / finance` 角色
- 或迁移到 `/internal/admin/order/*`（与新约定一致）
- 创建 BUG-NNN 跟踪

## 决策

接受 Debt-1/2/3 至 TGE。设硬 deadline：

| Debt | 短期缓解（TGE 前） | 长期修复 deadline |
|---|---|---|
| 1 mTLS | 用 HMAC bearer + 多 secret 重叠 | TGE+30 天评估 |
| 2 JWT 黑名单 | TTL 缩至 2h | TGE+30 天补 (a) |
| 3 legacy admin/order | 无（保持现状） | **TGE+14 天硬修** |

## 后果

### 正面
- TGE 前可上线
- debt 显性化，运维不会"忘记修"
- 短期缓解到位（TTL 2h / HMAC 60s）已大幅压缩攻击窗口

### 负面
- 接受 2h 窗口内 admin JWT 泄漏对 web-api 仍有效
- legacy admin/order 14 天内仍是漏洞（需团队意识到不被外部利用）

## 监控

- audit 表 `jti` 字段查询面板：异常多次同 jti 调用 → 告警
- admin 操作时序 vs JWT exp 时序对比：admin logout 后 2h 内有 web-api internal 调用且 operator_id 匹配 → 告警
- `/admin/order/*` 访问日志：从 access log grep + 异常 IP 告警
