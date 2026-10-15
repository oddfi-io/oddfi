> ⚠️ **本文是 backend 副本(mirror)**
>
> - **真值源**:`/Users/hang/work/oddfi-backend/web-api/docs/dd-invest/OVERVIEW.md`
> - 本副本同步时间:2026-05-29
> - 本仓库放此文档仅为用户主站前端侧能就近查阅。**改动 / 引用前请去 backend 仓库拉最新版**(`git -C ~/work/oddfi-backend pull --ff-only`),避免按过时版本操作。
> - 拓扑变更(新增服务 / 改端口 / 改鉴权链路)统一在真值源里改,然后回扫三仓 mirror 同步。
> - 文内相对链接(`../adr/...` / `../../../oddfi-admin-frontend/...`)按 backend 仓目录结构写,在本副本里不会解析,请回真值源点。

---

# 认购模块服务拓扑（V3 实战版）

> **本文目的**：把"认购功能"涉及的 5 个服务 + 链上 + 飞书一张图讲明白 — 谁跑在哪、谁调谁、数据怎么流。
> **关联**：[00-architecture.md](00-architecture.md)（V2→V3 决策对账，本文是实操拓扑补充）
> **维护**：每次新增 / 删除组件、改端口、改鉴权链路时同步更新本文
> **真值源**：本文 + [02-api-contract.md](02-api-contract.md) + [03-admin-api-contract.md](03-admin-api-contract.md)

---

## 1 一张图概览

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                              用户域 (public)                                    ║
║  ┌──────────────┐                                ┌──────────────────────┐      ║
║  │ 用户浏览器    │  HTTPS                         │  BSC mainnet         │      ║
║  │ (MetaMask)   │ ─────────┐         钱包签名     │  (Alchemy RPC)       │      ║
║  └──────────────┘          │       USDT.transfer │  USDT 合约           │      ║
║         │                  ▼     ─────────────► │  0x55d3...7955       │      ║
║         │   ┌──────────────────────┐             └──────────────────────┘      ║
║         └──►│ oddfi-frontend       │                       │                   ║
║             │ (Next.js, oddfi.io)  │                       │ ERC20 Transfer    ║
║             │ SSR + API Route 代理  │                       │ event             ║
║             └──────────┬───────────┘                       │                   ║
║                        │ HTTPS https://api.oddfi.io        │                   ║
║                        │ (BACKEND_URL env)                 │                   ║
║                        ▼                                   │                   ║
║  ╔═════════════════════════════════════════════════════════╪═════════════╗    ║
║  ║ oddfi-backend EC2 (<SERVER_IP>)                      │             ║    ║
║  ║                                                          │             ║    ║
║  ║   ┌──────────────────────────────────────────────────┐  │             ║    ║
║  ║   │ nginx (TLS 终结, listen :443)                    │  │             ║    ║
║  ║   │ Let's Encrypt 证书 api.oddfi.io / admin-api...   │  │             ║    ║
║  ║   └─────────────┬────────────────────────────────────┘  │             ║    ║
║  ║                 │ http://127.0.0.1:80                   │             ║    ║
║  ║                 ▼                                       ▼             ║    ║
║  ║   ┌──────────────────────────┐    ┌──────────────────────────┐       ║    ║
║  ║   │ web-api 容器             │    │ presale-worker 容器       │       ║    ║
║  ║   │ host network :80, :8081  │    │ host network (无 HTTP)    │       ║    ║
║  ║   │                          │    │                           │       ║    ║
║  ║   │ Gin HTTP server          │    │ ① USDT Transfer 监听      │       ║    ║
║  ║   │ ┌─────────────────────┐  │    │ ② Round status cron       │       ║    ║
║  ║   │ │/api/v1/presale/*    │  │    │ ③ confirm_blocks 等待     │       ║    ║
║  ║   │ │/api/v1/referral/*   │  │    │ ④ Redis leader lock       │       ║    ║
║  ║   │ │/account/*           │  │    │                           │       ║    ║
║  ║   │ │/internal/admin/...  │  │    └──────────┬────────────────┘       ║    ║
║  ║   │ └─────────────────────┘  │               │                        ║    ║
║  ║   └────────────┬─────────────┘               │                        ║    ║
║  ║                │                              │                        ║    ║
║  ║                └──────────────┬───────────────┘                        ║    ║
║  ║                               │                                        ║    ║
║  ╚═══════════════════════════════│════════════════════════════════════════╝    ║
║                                  │                                              ║
║                                  ▼                                              ║
║                       ┌──────────────────────┐                                  ║
║                       │ AWS RDS MySQL 8.4    │                                  ║
║                       │ project_oddfi 库     │                                  ║
║                       │ 8 张 presale_* 表    │                                  ║
║                       └──────────────────────┘                                  ║
║                                  ▲                                              ║
║                                  │ 共享 DB                                       ║
║                                  │ (admin 走 web-api internal endpoint           ║
║                                  │  反代，不直连，DD-003 §2.1 决策)               ║
╠══════════════════════════════════│══════════════════════════════════════════════╣
║                              运营域 (private)                                   ║
║                                  │                                              ║
║  ┌──────────────┐  Lark OAuth    │                                              ║
║  │ 运营浏览器    │  JWT 8h        │                                              ║
║  │ (chrome)     │                │                                              ║
║  └──────┬───────┘                │                                              ║
║         │ HTTPS                  │                                              ║
║         ▼                        │                                              ║
║  ┌──────────────────────┐        │                                              ║
║  │ oddfi-admin-frontend │        │                                              ║
║  │ (Next.js admin SPA)  │        │                                              ║
║  └──────────┬───────────┘        │                                              ║
║             │ HTTPS https://admin.oddfi.io                                      ║
║             │ /admin/presale/* + Bearer JWT                                     ║
║             ▼                                                                   ║
║  ╔═══════════════════════════════════════════════════════════╗                  ║
║  ║ oddfi-admin EC2 (独立)                                    ║                  ║
║  ║   ┌─────────────────────────────────────────────────┐    ║                  ║
║  ║   │ oddfi-admin-backend (Go)                        │    ║                  ║
║  ║   │ Lark OAuth + JWT 鉴权 + RBAC                    │    ║                  ║
║  ║   │ /admin/presale/* → 转发 web-api internal        │    ║                  ║
║  ║   │ HMAC-SHA256 服务间签名                          │    ║                  ║
║  ║   └─────────────┬───────────────────────────────────┘    ║                  ║
║  ╚═════════════════│═══════════════════════════════════════════╝                ║
║                    │ HTTPS https://api.oddfi.io/internal/admin/presale/*        ║
║                    │ Headers:                                                   ║
║                    │   X-Service-Sig: HMAC(secret, ts:path?query:idem:bodyHash) ║
║                    │   X-Timestamp / X-Idempotency-Key                          ║
║                    │                                                            ║
║                    └────────────┐                                               ║
╠═════════════════════════════════│═══════════════════════════════════════════════╣
║                              外部依赖                                           ║
║                                 │                                               ║
║                                 ▼ 反代回 web-api                                ║
║  ┌──────────────────────────────────────────────────┐                          ║
║  │ AWS Redis (共享)                                 │                           ║
║  │   - presale:worker:leader 锁 (TTL=10s)           │                           ║
║  │   - JWT idempotency cache                        │                           ║
║  │   - session blacklist                            │                           ║
║  └──────────────────────────────────────────────────┘                          ║
║                                                                                 ║
║  ┌──────────────────────────────────────────────────┐                          ║
║  │ Lark Webhook (open.larksuite.com)                │                           ║
║  │   - deposit_confirmed 卡片                       │                           ║
║  │   - overflow / unclaimed / paused_arrival 告警    │                          ║
║  │   - admin 操作通知                                │                          ║
║  └──────────────────────────────────────────────────┘                          ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2 角色清单 + 责任

| 角色                     | 仓库                             | 跑在哪                   | 一句话职责                                                                |
| ------------------------ | -------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| **oddfi-frontend**       | `oddfi-frontend`                 | Vercel / Next.js         | 用户主站；钱包登录 + 唤起 USDT transfer + 调 `/api/v1/presale/*` 显示数据 |
| **web-api**              | `oddfi-backend/web-api`          | oddfi-backend EC2 (容器) | 用户域 HTTP 接口 + report-tx 校验 + 持仓聚合                              |
| **presale-worker**       | `oddfi-backend/web-api` 同代码库 | oddfi-backend EC2 (容器) | 链上 USDT Transfer 监听 + confirm + DB INSERT/UPDATE + 触发 Lark 推送     |
| **oddfi-admin-frontend** | `oddfi-admin-frontend`           | 内部 / 单独域名          | 运营后台 SPA；Lark 登录 + 调 admin-backend `/admin/presale/*`             |
| **oddfi-admin-backend**  | `oddfi-admin-backend`            | oddfi-admin EC2          | 运营域 HTTP 接口 + Lark OAuth + RBAC + HMAC 转发到 web-api internal       |
| **BSC mainnet**          | —                                | 链上                     | USDT 合约 `0x55d3...7955` 上的 Transfer event 真值源                      |
| **Lark Webhook**         | —                                | 飞书 / Lark 云           | 接收 webhook POST 推卡片到运营群                                          |
| **AWS RDS MySQL**        | —                                | AWS managed              | 全部业务表真值（web-api 直写，admin 走 HMAC 反代）                        |
| **AWS Redis**            | —                                | AWS managed              | worker leader 锁 + JWT idem cache + session blacklist                     |

---

## 3 主机 / 容器 / 端口拓扑

### 3.1 oddfi-backend EC2 (<SERVER_IP>)

| 监听端口       | 进程                         | 用途                                                                                                                              |
| -------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 0.0.0.0:443    | nginx                        | 公网 TLS（api.oddfi.io + admin-api.oddfi.io vhost）                                                                               |
| 0.0.0.0:80     | web-api 容器（host network） | ← `nginx :443` 反代到这里；目前**也接受公网明文 HTTP**（[ENH-004 DRAFT](../design/ENH-004-https-only-port-refactor.md) 计划改造） |
| 127.0.0.1:8081 | web-api 容器                 | internal health + `/internal/admin/presale/*`（HMAC 鉴权）                                                                        |
| 0.0.0.0:22     | sshd                         | 维护                                                                                                                              |

容器：

| 容器名           | 镜像                                        | CMD                | 关键 env                                                                  |
| ---------------- | ------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| `web-api`        | `hankdong/account-web-api:prod_issue005_v4` | 默认 (`./web-api`) | `PRESALE_VAULT_POOL` / `PRESALE_BSC_RPC_URL` / `PRESALE_LARK_WEBHOOK_URL` |
| `presale-worker` | 同镜像                                      | `./presale-worker` | 同 env（**必须和 web-api 一致**）                                         |

⚠️ **双容器 env 必须保持一致**（2026-05-28 实战教训：漏改 web-api 的 `PRESALE_VAULT_POOL` 会导致 report-tx 40007）。Runbook [reset-and-vault-switch §6](ops/reset-and-vault-switch-runbook.md) 已强制写双容器流程。

### 3.2 oddfi-admin EC2

| 监听端口           | 进程      | 用途                                  |
| ------------------ | --------- | ------------------------------------- |
| admin-backend HTTP | Go binary | 运营请求入口；Lark OAuth + JWT + RBAC |

admin-backend 本身代码与 oddfi-admin-backend repo 一致。

### 3.3 外部依赖

| 依赖              | 地址                                                        | 谁用                                         |
| ----------------- | ----------------------------------------------------------- | -------------------------------------------- |
| AWS RDS MySQL 8.4 | `<RDS_HOST>` | web-api 直连 / admin 走 web-api internal     |
| AWS Redis         | (同 region)                                                 | web-api + worker 共享                        |
| Alchemy BSC RPC   | `https://bnb-mainnet.g.alchemy.com/v2/<key>`                | worker 监听 + web-api report-tx receipt 查询 |
| Lark Webhook      | `https://open.larksuite.com/open-apis/bot/v2/hook/<token>`  | web-api + worker（DB lazy fetch）            |

---

## 4 6 大交互流程

### 4.1 用户认购 happy path（含双轨入账）

```
用户                  oddfi-frontend           web-api                BSC mainnet           presale-worker        DB                Lark
 │                         │                       │                        │                      │                   │                   │
 │  1. 打开首屏             │                       │                        │                      │                   │                   │
 │ ────────────────────►   │                       │                        │                      │                   │                   │
 │                         │  2. GET /api/v1/presale/config (公开)            │                      │                   │                   │
 │                         │ ─────────────────────►│                        │                      │                   │                   │
 │                         │                       │  SELECT presale_config │                      │                   │                   │
 │                         │                       │ ──────────────────────►│ ◄─────────────────── DB                  │                   │
 │                         │                       │     vault_address      │                      │                   │                   │
 │                         │ ◄─────────────────────│                        │                      │                   │                   │
 │  3. 钱包登录             │                       │                        │                      │                   │                   │
 │ ────────────────────►   │                       │                        │                      │                   │                   │
 │                         │  POST /account/login_by_wallet (签名)            │                      │                   │                   │
 │                         │ ─────────────────────►│ ◄── JWT 24h ──         │                      │                   │                   │
 │                         │                       │                        │                      │                   │                   │
 │  4. 点"认购" → 钱包确认  │                       │                        │                      │                   │                   │
 │                         │                       │                        │                      │                   │                   │
 │           USDT.transfer(vault, amount) ─────────────────────────────────►│                      │                   │                   │
 │                                                                          │                      │                   │                   │
 │                                                              5. tx 上链  │                      │                   │                   │
 │                                                              ───────────►│                      │                   │                   │
 │                                                                          │                      │                   │                   │
 │                                       (双轨开始)                          │                      │                   │                   │
 │                                                                          │                      │                   │                   │
 │  6a. 前端拿 txHash                                                       │                      │                   │                   │
 │                         │                       │                        │                      │                   │                   │
 │                         │  POST /api/v1/presale/deposit/report-tx        │                      │                   │                   │
 │                         │ ─────────────────────►│                        │                      │                   │                   │
 │                         │                       │  eth_getTransactionReceipt(txHash) ──────────►│                      │                   │
 │                         │                       │ ◄── receipt + logs ────│                      │                   │                   │
 │                         │                       │  parseUsdtTransferLog: to == cfg.VaultPool? ─►│                      │                   │
 │                         │                       │  INSERT presale_deposit (pending) ────────────────────────────────►│                   │
 │                         │ ◄── 200 + pending ────│                        │                      │                   │                   │
 │                         │                       │                        │                      │                   │                   │
 │  6b. 同时 worker 扫块                                                     │  poll every 6s       │                   │                   │
 │                                                                          │ ◄────────────────────│                      │                   │
 │                                                                          │  eth_getLogs(USDT.Transfer, to=vault)      │                   │
 │                                                                          │ ────────────────────►│                      │                   │
 │                                                                          │  Transfer event log  │                      │                   │
 │                                                                          │                      │  CreateOrGet ─────►│                   │
 │                                                                          │                      │  (前端已 pending → 返已有 row)            │
 │                                                                          │                      │                   │                   │
 │  7. 等 confirm_blocks = 3                                                │                      │  isHeadBlock >=    │                   │
 │                                                                          │                      │  log.blockNum+3?   │                   │
 │                                                                          │                      │  → 是              │                   │
 │                                                                          │                      │                   │                   │
 │                                                                          │  ConfirmDeposit (UPDATE status=confirmed) ►│                   │
 │                                                                          │                      │  IncrSoldAndRaised │                   │
 │                                                                          │                      │  UpsertHolding     │                   │
 │                                                                          │                      │  (返佣 if ReferrerUserID) ──────────────►│                   │
 │                                                                          │                      │                   │                   │
 │                                                                          │                      │  NotifyDepositConfirmed                │
 │                                                                          │                      │ ────────────────────────────────────────►│
 │                                                                          │                      │  🎉 deposit_confirmed 卡片              │
 │                                                                          │                      │                   │                   │
 │  8. 前端轮询 /presale/deposit/:txHash                                    │                      │                   │                   │
 │                         │  GET → status=confirmed                       │                      │                   │                   │
 │                         │ ◄─────────────────────│                        │                      │                   │                   │
 │  9. UI 更新"已到账"      │                       │                        │                      │                   │                   │
```

**关键说明**：

- **6a 和 6b 并行发生**，互相不知道。`(tx_hash, log_index)` 唯一索引 + `CreateOrGet` 幂等保证不会双入账。
- 如果 6a 失败（report-tx 40007 等）→ 6b 仍然兜底 INSERT（source=worker, status=confirmed）。
- 如果 6b 慢（RPC 卡）→ 6a 把 pending 写进 DB，前端能看到"等待确认"中间态。
- 唯一不能容忍的：6a 和 6b 都失败 → 资金到了但 DB 没记录。监控 `presale_event_cursor` lag + Alchemy RPC 健康。

### 4.2 运营改 round 配置（举 pause 为例）

```
运营           admin-frontend          admin-backend                 web-api                    DB
 │                  │                       │                          │                          │
 │  1. Lark OAuth   │                       │                          │                          │
 │ ───────────────►│                        │                          │                          │
 │                  │  GET /auth/lark/callback (code)                  │                          │
 │                  │ ──────────────────────►│                          │                          │
 │                  │ ◄── JWT 8h ────────────│                          │                          │
 │                  │                        │                          │                          │
 │  2. 点 "pause strategic round"             │                          │                          │
 │                  │  POST /admin/presale/rounds/strategic/pause      │                          │
 │                  │  Authorization: Bearer <JWT>                     │                          │
 │                  │  X-Idempotency-Key: <uuid>                       │                          │
 │                  │  Body: {"note": "..."}                            │                          │
 │                  │ ──────────────────────►│                          │                          │
 │                  │                        │  JWT 校验 + RBAC 校验    │                          │
 │                  │                        │  (super_admin OK)        │                          │
 │                  │                        │                          │                          │
 │                  │                        │  计算 HMAC-SHA256:        │                          │
 │                  │                        │  payload = ts:path?query:idem:hex(sha256(body))      │
 │                  │                        │  sig = hex(HMAC(secret, payload))                     │
 │                  │                        │                          │                          │
 │                  │                        │  POST https://api.oddfi.io/internal/admin/presale/rounds/strategic/pause
 │                  │                        │    X-Service-Sig: <sig>  │                          │
 │                  │                        │    X-Timestamp: <ts>     │                          │
 │                  │                        │    X-Idempotency-Key: <idem>                          │
 │                  │                        │ ────────────────────────►│                          │
 │                  │                        │                          │  ServiceAuth middleware: │
 │                  │                        │                          │  - ts 60s 窗口            │
 │                  │                        │                          │  - 重算 HMAC 比对         │
 │                  │                        │                          │  - idem-key 已用过？      │
 │                  │                        │                          │                          │
 │                  │                        │                          │  PresaleAdmin middleware:│
 │                  │                        │                          │  - 共享 db.Begin() tx    │
 │                  │                        │                          │  - 写 presale_admin_audit│
 │                  │                        │                          │  - 写 admin_idempotency  │
 │                  │                        │                          │                          │
 │                  │                        │                          │  handler.pause:          │
 │                  │                        │                          │  SELECT FOR UPDATE round │
 │                  │                        │                          │  validTransitions check  │
 │                  │                        │                          │  UPDATE status=paused ──►│
 │                  │                        │                          │  COMMIT (3 写一起)       │
 │                  │                        │                          │                          │
 │                  │                        │ ◄── 200 + new state ─────│                          │
 │                  │ ◄── 200 + new state ───│                          │                          │
 │  3. UI 显示已暂停                          │                          │                          │
 │  4. (异步) Lark 推送"round.pause 操作通知" 卡片                                                  │
```

**关键说明**：

- admin-backend 是**薄壳**：不读 DB，所有业务真值走 HMAC 反代到 web-api。这是 DD-003 决策（避免双写）。
- HMAC payload **含 query string**（[ISSUE-004 修复](../../../oddfi-admin-frontend/.progress/stash/ISSUE-004-webapi-sig-fix-spec.md)）：分页 / 过滤参数都参与签名完整性。
- audit + idempotency + 业务 UPDATE 在**同一事务**里写（DD-003 §4.2.4 / [ADR-0003](adr/ADR-0003-tx-in-context-dual-pattern.md)），失败一起 rollback。

### 4.3 邀请绑定 + 自动绑邀

```
用户 A 分享邀请链接 oddfi.io/?ref=ABC123 → 用户 B 点击
                              │
                              ▼
oddfi-frontend localStorage 暂存 referralCode=ABC123
                              │
                              ▼  钱包登录后
POST /api/v1/referral/bind {referralCode: "ABC123"}
                              │
                              ▼  web-api referralService:
                              │  - SELECT user_referral_code WHERE code=ABC123 → user_a_id
                              │  - INSERT user_referral_bind (user_b_id, referrer=user_a_id, bound_at=NOW)
                              │  - 返回 200
                              ▼
后续 user_b 的 deposit confirmed 时，
ConfirmDeposit 会查 user_referral_bind 找推荐人 → 计算返佣 ODD → UpsertReferral holding
```

**INV-6 防欺诈**：`bind.BoundAt + 5000ms < deposit.BlockTs` 才发返佣 — 防"先买后绑骗推荐人"。已有 BUG-001 跨时钟域容差 + [TODO-009](../../../.progress/todo/TODO-009-inv6-block-number-watermark.md) 长期改 block_number 方案。

### 4.4 异常处理（overflow / unclaimed / paused_arrival）

worker 扫到 USDT Transfer 后，分支处理：

| 场景               | 触发条件                                         | 后端动作                                                                                                   | Lark 推送                |
| ------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| **正常入账**       | 找到 active round + 未超额 + EOA 已注册          | INSERT deposit + UPDATE round sold/raised + UpsertHolding                                                  | `deposit_confirmed` 卡片 |
| **overflow**       | round 剩余 supply < tx 金额                      | 入 `presale_ops_event` + 不入账 + admin 走 anomaly resolve（convert_to_deposit / partial_credit / reject） | `overflow` 告警          |
| **unclaimed**      | EOA 未在系统注册（没人 login_by_wallet 过）      | 入 `presale_ops_event` + 不入账 + admin 后续手动 link 用户                                                 | `unclaimed` 告警         |
| **paused_arrival** | 到账时 round=paused（先 pause 后用户慢吞吞付款） | INSERT deposit + IncrSold + UpsertHolding（**入账继续**） + 入 ops_event                                   | `paused_arrival` 信息    |

`presale_admin_anomaly` API 让运营审异常事件并触发处理（migrate-round / reject 等），所有动作都进 `presale_admin_audit`。

### 4.5 双轨兜底实战案例（2026-05-28 金库切换）

切换时漏改 web-api 容器的 `PRESALE_VAULT_POOL`：

```
用户发 USDT to 0x75eC...F579 (新金库) ──►  BSC 链上
                                              │
                  ┌───────────────────────────┴───────────────────────────┐
                  │                                                       │
                  ▼ 6a. report-tx                                         ▼ 6b. worker
                  web-api 比对                                            worker 已切到新金库
                  s.cfg.VaultPool = 0xf4b6...c7C (旧) ❌                   监听 0x75eC...F579 ✅
                  返回 40007 TX_NOT_TO_VAULT                              扫到 Transfer event
                  前端弹窗失败 UX                                          INSERT confirmed
                                                                          ✅ 资金入账
```

**资金没丢**（worker 路径兜底），但前端 UX 差。这就是双轨设计的健壮性 — 一边坏了另一边接。修复后两条路径同时正常。

### 4.6 config 改 vault_address 涉及哪些组件

```
admin operator
    │ admin SPA UI 提交
    ▼
admin-frontend PATCH /admin/presale/config
    │ JWT
    ▼
admin-backend
    │ HMAC sign + 反代
    ▼
web-api /internal/admin/presale/config (PATCH)
    │ audit + idempotency + UPDATE presale_config
    ▼
DB presale_config.vault_address 改了
    │
    ├──► /api/v1/presale/config（公开接口）立刻返新地址 ✅
    │
    └──► 但 web-api 和 worker 容器内的 cfg.VaultPool **不会自动刷新**（只在容器启动时 load env）
         │
         ▼
         运营/AI 必须**重启两个容器并把 PRESALE_VAULT_POOL env 改成新地址**
         否则：
         - web-api report-tx 仍校验旧地址 → 40007
         - worker 仍监听旧金库 → 新地址 transfer 扫不到 → 数据不入
         详见 [reset-and-vault-switch-runbook.md §6](ops/reset-and-vault-switch-runbook.md)
```

---

## 5 鉴权链路 (3 套)

| #   | 链路            | 算法                                                                                  | 用在哪                                                                          | 失败码                    |
| --- | --------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| 1   | **用户 JWT**    | HS256，secret 在 web-api env                                                          | `/api/v1/presale/deposit/*` / `/api/v1/referral/*` / `/api/v1/presale/position` | 401                       |
| 2   | **运营 JWT**    | HS256，secret 在 admin-backend env（与 admin SPA 共享）                               | admin SPA → admin-backend `/admin/*`                                            | 401                       |
| 3   | **服务间 HMAC** | HMAC-SHA256，secret 在 web-api + admin-backend 双侧 systemd env，支持多 secret 重叠期 | admin-backend → web-api `/internal/admin/*`                                     | 401 `SERVICE_SIG_INVALID` |

**HMAC payload 构造**（[ISSUE-004 修复后](../../../oddfi-admin-frontend/.progress/stash/ISSUE-004-webapi-sig-fix-spec.md)）：

```
path_with_query = URL.Path + ("?" + URL.RawQuery if RawQuery else "")
payload         = tsMs + ":" + path_with_query + ":" + idempotency_key + ":" + hex(sha256(body))
sig             = hex(HMAC-SHA256(secret, payload))
```

防御：

- ts 60s 窗口防 replay
- idem_key 参与签名 → 跨 key replay 立刻失败
- body hash 参与签名 → 改 body 失败
- query 参与签名 → 改 query 失败
- 多 secret 重叠期 → 不停机轮换

---

## 6 数据库表归属（谁写 / 谁读）

8 张 presale*\* 表 + 2 张 user_referral*\* 表，**写权限单一来源**：

| 表                     | 主写方                                                                              | 读                                   |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| `presale_round`        | web-api admin handler（pause/resume/migrate-round 等） + worker cron（status 推进） | 全部服务                             |
| `presale_deposit`      | worker（INSERT/UPDATE 大事务）+ web-api report-tx（INSERT pending）                 | admin handler 查询                   |
| `presale_config`       | web-api admin handler（PATCH config）                                               | 全部服务（含 worker 启动 EnsureAll） |
| `presale_holding`      | worker（ConfirmDeposit 大事务） + web-api admin handler（migrate-round 调整）       | 用户 `/position`                     |
| `presale_event_cursor` | worker（每 6s UPDATE last_block_number）                                            | worker 自己                          |
| `presale_ops_event`    | worker（异常自动落） + admin handler（resolve 时 UPDATE）                           | admin SPA                            |
| `presale_admin_audit`  | web-api PresaleAudit middleware（事务内插）                                         | admin SPA / 合规审计                 |
| `admin_idempotency`    | web-api Idempotency middleware（事务内插）                                          | middleware 自己                      |
| `user_referral_code`   | web-api referralService（首次 GetMe 时 CSPRNG 生成）                                | referralService                      |
| `user_referral_bind`   | web-api referralService（用户 POST /bind）                                          | ConfirmDeposit 查推荐人              |

⚠️ **admin-backend 不直接读写任何 presale\_\* 表**（DD-003 §2.1 决策 / [ADR-0001](adr/ADR-0001-admin-rpc-not-shared-db.md)），所有 admin 业务请求都走 HMAC 反代到 web-api internal endpoint。

---

## 7 Lark 推送类型 + 触发点

[详细模板见 lark-notify-templates.md](lark-notify-templates.md)。

| EventType                                                       | 触发点                        | 谁触发                                                                                            | 模板颜色     |
| --------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------ |
| `deposit_confirmed`                                             | deposit pending → confirmed   | worker `processLog` step 7 + web-api `ConfirmDeposit` step 7（同一函数 `NotifyDepositConfirmed`） | 🟢 green     |
| `overflow`                                                      | round 售罄但仍有 tx 到金库    | worker → recordAnomaly                                                                            | 🟠 orange    |
| `unclaimed`                                                     | EOA 未注册 → tx 无主          | worker → recordAnomaly                                                                            | 🔵 blue      |
| `paused_arrival`                                                | tx 到账时 round=paused        | worker → recordAnomaly                                                                            | 🔵 blue      |
| `round_pause` / `round_resume` / `round_close` / `round_reopen` | admin handler 改 round status | web-api 直接发                                                                                    | 模板对应颜色 |
| `config_update`                                                 | admin PATCH /config           | web-api 直接发                                                                                    | 🔵 blue      |
| `migrate_round_done`                                            | admin migrate-round 完成      | web-api 直接发                                                                                    | 🟠 orange    |

**webhook URL** 来源（DB lazy fetch + cache 30s，TODO-016 修复后）：

```
LarkWebhookService 启动:
  1. 读 cfg.Presale.LarkWebhookUrl (env) → fallback URL
  2. 每 30s 起 background goroutine 查 DB presale_config.lark_webhook_url
  3. DB 值非空覆盖 fallback，admin 改 webhook 后 30s 内生效
```

---

## 8 容器 / 服务依赖图（依赖链）

```
oddfi-frontend
   │ 启动需要：
   ├─ web-api (HTTP) 可达
   └─ (无其他直接依赖)

oddfi-admin-frontend
   │ 启动需要：
   ├─ admin-backend (HTTPS) 可达
   └─ Lark App ID/Secret OAuth 凭据

admin-backend
   │ 启动需要：
   ├─ MySQL (admin DB)
   ├─ Lark App credentials
   ├─ JWT_SECRET (env)
   ├─ SERVICE_TOKEN (HMAC secret，与 web-api 共享)
   └─ INTERNAL_URL 指向 https://api.oddfi.io

web-api
   │ 启动需要：
   ├─ MySQL (project_oddfi DB)
   ├─ Redis
   ├─ JWT_SECRET
   ├─ ADMIN_API.SERVICE_TOKENS (HMAC，与 admin-backend 共享)
   ├─ PRESALE_VAULT_POOL (env)
   ├─ PRESALE_BSC_RPC_URL (env)
   └─ PRESALE_LARK_WEBHOOK_URL (env，可选 fallback)

presale-worker
   │ 启动需要：
   ├─ MySQL (同 web-api)
   ├─ Redis (leader 锁)
   ├─ BSC RPC (Alchemy)
   ├─ PRESALE_VAULT_POOL (env，必须和 web-api 一致)
   └─ PRESALE_LARK_WEBHOOK_URL (env，可选 fallback)
```

启动顺序（cold start，灾难恢复时用）：

```
RDS / Redis ready (AWS managed)
  ↓
web-api 容器（先起，触发 GORM AutoMigrate 等）
  ↓
presale-worker 容器（依赖 web-api 不是必须的，但用同一镜像）
  ↓
nginx reload（容器都健康后才能接公网流量）
  ↓
admin-backend（依赖 web-api internal endpoint 可达）
  ↓
admin-frontend（Vercel 上自动 ready）
```

---

## 9 关联

- [00-architecture.md](00-architecture.md) — V2→V3 决策对账
- [01-data-model.md](01-data-model.md) — 8 张 presale\_\* 表 schema
- [02-api-contract.md](02-api-contract.md) — 用户端接口契约
- [03-admin-api-contract.md](03-admin-api-contract.md) — admin 17 接口契约
- [frontend-integration.md](frontend-integration.md) — 前端对接清单
- [lark-notify-templates.md](lark-notify-templates.md) — 7 种 Lark 卡片模板
- [DD-003-admin-rpc-rework.md](DD-003-admin-rpc-rework.md) — admin-backend 薄壳化决策
- [ops/reset-and-vault-switch-runbook.md](ops/reset-and-vault-switch-runbook.md) — 金库切换 SOP
- [adr/ADR-0001](adr/ADR-0001-admin-rpc-not-shared-db.md) — admin 不共享 DB 直连
- [adr/ADR-0004](adr/ADR-0004-prod-architecture-snapshot.md) — prod 架构 ground truth 快照
