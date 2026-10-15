# 前端对接清单 · DD-INVEST V3 预售页

> 后端服务本地联调入口；前端按本清单适配后直连本地 web-api 完成端到端验证。
> 后端最终代码合并到 main / dev 由人类总指挥按节奏执行，与本清单解耦。

---

## 1 本地服务总览

| 服务 | URL | 用途 | 前端是否需要 |
|---|---|---|---|
| **web-api** | `http://localhost:8082` | 用户端 HTTP 接口（预售 / 邀请 / 账户） | ✅ 主要对接目标 |
| **presale-worker** | 后台 binary，无 HTTP 端口 | 链上 USDT Transfer 监听 + Round status cron | ❌ 不直连，但需要它运行（保证 deposit 自动入账） |
| **admin-backend** | `http://localhost:8081` | 运营后台 17 接口（pause/resume/migrate-round 等） | ❌ 用户前端不调；如需配合可由运营前端调 |

所有 3 个服务**已在我本地启动**（前端联调期间持续运行）。前端开发完毕调用 `http://localhost:8082` 即可。

---

## 2 鉴权

### 2.1 JWT 获取（沿用现有 `/account/login_by_wallet`）

钱包登录流程不变，预售页前端期望先完成钱包登录拿到 access token：

```http
POST http://localhost:8082/account/login_by_wallet
Content-Type: application/json

{
  "signing_address": "0x9d9BcdfEe0Ca1701cBB161A583241eE8C4656490",
  "signature": "<签名值>",
  "chain": "BSC"
}
```

签名规则沿用现有项目约定（询问前端钱包组负责人或参考 `internal/handler/auth.go`）。

### 2.2 测试用户（已在 DB 准备）

| user_id | signing_address | 角色 |
|---|---|---|
| 1001 | `0x9d9BcdfEe0Ca1701cBB161A583241eE8C4656490` | 测试买方（已发 7 笔真链 tx 入账） |
| 1002 | `0x0000000000000000000000000000000000001002` | 测试 referrer A（user_id=1001 的邀请人） |

⚠️ **私钥仅本地 e2e 测试 EOA 持有**（见 `~/.ssh/PRESALE-E2E-WALLET.md`），前端联调使用模拟登录或与后端配合签发临时 token。

### 2.3 Header 携带

JWT 后续接口请求带 `Authorization: Bearer <token>`（项目现有约定）。Handler 从 `c.GetInt64("user_id")` 取用户 ID。

---

## 3 接口清单（8 个用户端接口）

### 3.1 预售接口（5 个）

| 接口 | Method + Path | 鉴权 | 用途 |
|---|---|---|---|
| 配置 | `GET /api/v1/presale/config` | ❌ 公开 | 首屏渲染轮次列表 + 金库地址 + TGE + 折扣 |
| 上报 tx | `POST /api/v1/presale/deposit/report-tx` | ✅ JWT | 用户钱包发完 USDT Transfer 后上报 txHash |
| 单笔查询 | `GET /api/v1/presale/deposit/:txHash` | ✅ JWT | 前端轮询 pending → confirmed 状态 |
| 入账历史 | `GET /api/v1/presale/deposit/list` | ✅ JWT | 用户中心入账记录分页 |
| 持仓 | `GET /api/v1/presale/position` | ✅ JWT | 用户中心 ODD 持仓聚合（不含今日单价） |

### 3.2 邀请接口（3 个）

| 接口 | Method + Path | 鉴权 | 用途 |
|---|---|---|---|
| 我的邀请信息 | `GET /api/v1/referral/me` | ✅ JWT | 我的邀请码 + 邀请人 + 累计奖励 ODD |
| 绑定邀请 | `POST /api/v1/referral/bind` | ✅ JWT | URL 自动绑 / 手动绑 |
| 我邀请的列表 | `GET /api/v1/referral/list` | ✅ JWT | 我邀请的用户 + 每人贡献 |

---

## 4 接口契约详情

> **完整契约源真值**：`docs/dd-invest/02-api-contract.md`（前端有疑问以此为准）
> 以下为速查 + curl 示例（本地已跑通的真实响应）

### 4.1 `GET /api/v1/presale/config` · 配置（公开高频）

**curl**：

```bash
curl -s http://localhost:8082/api/v1/presale/config | jq
```

**响应（本地真实数据）**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "vault": {
      "depositAddress": "0xf4b6036d2423b1254f273272929364a120a50c7c",
      "chain": "BSC",
      "chainId": 56,
      "asset": "USDT",
      "usdtAddress": "0x55d398326f99059fF775485246999027B3197955",
      "minSubscribeUsd": "0.005",
      "totalRaisedUsd": "1.05",
      "totalTargetUsd": "20000000",
      "tgeTs": 1781049600000,
      "tgeOpenPriceUsd": "0.1",
      "audit": "",
      "boundaryToleranceMin": 5
    },
    "rounds": [
      {
        "id": "seed",
        "name": "种子轮",
        "roundType": "private",
        "price": "1",
        "supply": "1000",
        "sold": "1.05",
        "raised": "1.05",
        "soldPercent": 0.105,
        "targetRaiseUsd": "1000",
        "tgeReleasePct": "10",
        "linearReleaseDays": 90,
        "referralRewardPct": "10",
        "tgeDiscountPct": "-900",
        "startTs": 1779692842379,
        "endTs": 1779784233000,
        "status": "active",
        "badge": null,
        "minPerOrderUsd": null,
        "maxPerWalletUsd": null
      },
      ...
    ]
  }
}
```

**前端要点**：
- 缓存 30s（后端已做 Redis 缓存，但前端再缓存一层避免高频刷新）
- 金额字段全部是 **string**（避免 JS Number 精度丢失），需要时用 `decimal.js`
- `tgeDiscountPct` = `(tge_open_price - round.price) / tge_open_price × 100`（已是衍生字段）
- `status` ∈ {`upcoming`, `active`, `paused`, `ended`}
- 时间戳 `startTs` / `endTs` / `tgeTs` 全部是**毫秒 Unix 时间戳**（int64）
- `soldPercent` 是 0~1 的小数（不是百分比）

### 4.2 `POST /api/v1/presale/deposit/report-tx` · 上报 tx

用户钱包发完 `USDT.transfer(vault, amount)` 后，前端把 txHash 上报：

**请求**：

```bash
curl -X POST http://localhost:8082/api/v1/presale/deposit/report-tx \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0x141238c2fd23779dba62f8a3f4672629e597bd4ad61fa0d9f999d838506e7fce",
    "expectedRoundId": "seed",
    "expectedAmountUsdt": "1"
  }'
```

**正常响应**（200）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "depositId": "1",
    "status": "pending",
    "roundId": "seed"
  }
}
```

**错误码**（HTTP 4xx）：

| HTTP | code | 含义 | 前端处理 |
|---|---|---|---|
| 400 | `40006` | `INVALID_TX` — receipt 不存在 / status=failed | 提示"交易失败，请检查 BSCScan" |
| 400 | `40007` | `TX_NOT_TO_VAULT` — 收款地址不在金库池 | 提示"请转账到正确金库地址" |
| 400 | `40008` | `TX_NOT_USDT` — 不是 USDT 转账 | 提示"请使用 BEP20 USDT" |
| 409 | `40902` | `WALLET_MISMATCH` — tx.from ≠ 登录态 EOA | 提示"必须用绑定钱包发起" |

**前端流程**：
1. 调 `POST /report-tx` 拿到 `depositId` + `status=pending`
2. 轮询 `GET /deposit/:txHash` 每 5s 查一次（最多 5min），直到 `status=confirmed` 或 `anomaly`
3. 监听器约 30~60s 后扫到 → 推进 confirmed

### 4.3 `GET /api/v1/presale/deposit/:txHash` · 单笔查询

**请求**：

```bash
curl -s http://localhost:8082/api/v1/presale/deposit/0x141238c2fd23779dba62f8a3f4672629e597bd4ad61fa0d9f999d838506e7fce \
  -H "Authorization: Bearer <token>"
```

**响应**（已 confirmed）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "depositId": "1",
    "txHash": "0x141238c2fd...",
    "status": "confirmed",
    "anomalyReason": null,
    "roundId": "seed",
    "amountUsdt": "1.000000000000000000",
    "priceUsd": "1.000000000000000000",
    "sharesOdd": "1.000000000000000000",
    "referrerEoa": null,
    "referralRewardOdd": "0.000000000000000000",
    "blockNumber": 100313269,
    "blockTimestamp": 1779696539000,
    "source": "worker",
    "confirmedAt": 1779696547281,
    "createdAt": 1779696547281
  }
}
```

**status 枚举**：
- `pending` — 区块未达 confirmBlocks（继续轮询）
- `confirmed` — 入账完成（停止轮询，UI 显示成功）
- `anomaly` — 异常（提示用户联系客服 + 显示 `anomalyReason`）

**anomalyReason 枚举**（status=anomaly 时）：
- `overflow` — 到账金额超本轮剩余容量（运营预案处理）
- `from_mismatch` — tx.from 与登录态 EOA 不匹配
- `round_mismatch` — 期望轮次与实际归属轮次不符
- `late_arrival` — 区块时间超出所有轮次容差
- `paused_arrival` — 到账时轮次处于 paused 状态（**仍 confirmed 入账**，信息流标记，UI 可正常显示但提示"该轮次已暂停"）

### 4.4 `GET /api/v1/presale/deposit/list` · 入账历史

**请求**：

```bash
curl -s 'http://localhost:8082/api/v1/presale/deposit/list?status=confirmed&page=1&size=20' \
  -H "Authorization: Bearer <token>"
```

**响应**：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [<同 deposit:txHash 单条结构>, ...],
    "total": 7,
    "page": 1,
    "size": 20
  }
}
```

**Query 参数**：
- `status`（可选）：筛选 status，空字符串 = 全部
- `page` / `size`：分页，默认 page=1 size=20，size 上限 100

### 4.5 `GET /api/v1/presale/position` · 持仓聚合

**请求**：

```bash
curl -s http://localhost:8082/api/v1/presale/position \
  -H "Authorization: Bearer <token>"
```

**响应**：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "holdings": "1.050000000000000000",
    "holdingsBySource": {
      "invest": "1.050000000000000000",
      "referral": "0.000000000000000000"
    },
    "investedUsd": "1.050000000000000000",
    "lockedPriceAvg": "1.000000000000000000",
    "perRound": [
      {
        "roundId": "seed",
        "totalOdd": "1.050000000000000000",
        "investedUsd": "1.050000000000000000",
        "lockedPriceAvg": "1.000000000000000000",
        "referralOdd": "0.000000000000000000"
      }
    ]
  }
}
```

**前端要点**：
- 后端**不返**今日单价 / 今日价值（DD V3 砍掉）。前端调独立的"平台币汇率服务"（与后端无关）自算 USD 价值
- `lockedPriceAvg` = 跨轮加权平均成本价 = `Σ(round_total × round_avg) / Σ(round_total)`（只 source=invest 行参与）
- `holdingsBySource.referral` 是邀请奖励累计 ODD（被邀请人买入触发的返佣）

### 4.6 `GET /api/v1/referral/me` · 我的邀请信息

```bash
curl -s http://localhost:8082/api/v1/referral/me -H "Authorization: Bearer <token>"
```

**响应**：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "myCode": "0xABCD23",
    "shareLink": "https://oddfi.io/invest?ref=0xABCD23",
    "referrer": {
      "userId": "1002",
      "eoa": "0x0000000000000000000000000000000000001002",
      "code": "0xABCD23",
      "boundAt": 1779696440000
    },
    "stats": {
      "totalReferred": 0,
      "totalRewardOdd": "0"
    }
  }
}
```

**前端要点**：
- 用户首次登录后会**自动生成** `myCode`（middleware hook，异步，无需前端额外触发）
- `referrer` 为 null 表示当前用户**未绑定上级邀请人**
- `shareLink` 由后端拼装好（前端可重写自己的域名）

### 4.7 `POST /api/v1/referral/bind` · 绑定邀请

**请求**：

```bash
curl -X POST http://localhost:8082/api/v1/referral/bind \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "0xABCD23",
    "source": "link"
  }'
```

**source 枚举**：`link`（URL 自动绑）/ `manual`（手动输入）

**错误码**：

| HTTP | code | 含义 | 前端处理 |
|---|---|---|---|
| 400 | `40004` | `SELF_REFERRAL` — 用自己的邀请码 | 提示"不能邀请自己" |
| 404 | `40404` | `INVALID_CODE` — 邀请码不存在 | 提示"邀请码无效" |
| 409 | `40903` | `ALREADY_BOUND` — 已绑过其他邀请人 | URL 自动绑场景**静默忽略**（前端不弹错） |

**前端流程**：
1. 页面加载读 `localStorage.referral_code`（如有）
2. 如果未绑（`GET /me` 返 `referrer=null`），调 `POST /bind` 自动绑
3. 失败 `40903` 静默；成功后清 localStorage
4. **大小写不区分**（后端 service 层 `strings.ToUpper` 归一化，前端传啥都行）

### 4.8 `GET /api/v1/referral/list` · 我邀请的列表

```bash
curl -s 'http://localhost:8082/api/v1/referral/list?business=presale&page=1&size=20' \
  -H "Authorization: Bearer <token>"
```

**响应**：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "userId": "1001",
        "eoa": "0x9d9bcdfee0ca1701cbb161a583241ee8c4656490",
        "boundAt": 1779696440000,
        "totalRewardOdd": "0.001000000000000000",
        "deposits": [
          {
            "txHash": "0xea0a41b49a...",
            "roundId": "seed",
            "amountUsdt": "0.01",
            "sharesOdd": "0.01",
            "rewardOdd": "0.001",
            "blockTimestamp": 1779696440000
          }
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

**Query 参数**：
- `business` （可选）：本期固定值 `presale`（其他业务暂未接入）
- `page` / `size`：分页

---

## 5 钱包交互流程（前端核心 UX）

```
用户点"认购 X USDT"
    │
    ├─ 前端校验（min 0.005 / 容量充足 / 未结束 / 距 end_ts ≥ 2min）
    │
    ▼
唤起 MetaMask
    │
    ├─ 用户在钱包内确认 USDT.transfer(vault, amount)
    │     vault = config.vault.depositAddress
    │     amount = USDT 数量 × 10^18 （BEP20 是 18 decimals，不是 6）
    │
    ▼
拿到 txHash
    │
    ├─ POST /deposit/report-tx { txHash, expectedRoundId, expectedAmountUsdt }
    │     → depositId, status=pending
    │
    ▼
轮询 GET /deposit/:txHash 每 5s（最多 5min）
    │
    ├─ status=pending → 显示"等待区块确认..."
    ├─ status=confirmed → 显示"认购成功 +X ODD"，跳转持仓页
    └─ status=anomaly → 显示"出现异常，请联系客服"
                      + 根据 anomalyReason 显示具体提示
```

**重要前置校验**（前端必须做）：
- 余额（USDT + BNB gas）充足
- amount ≥ `config.vault.minSubscribeUsd`（当前 0.005 USDT）
- 距 `round.endTs` ≥ 2 分钟（避免边界切轮）
- `round.status === "active"`（paused/ended 禁止下单）

---

## 6 测试数据（DB 已有）

| 维度 | 值 |
|---|---|
| 测试买方 EOA | `0x9d9BcdfEe0Ca1701cBB161A583241eE8C4656490`（user_id=1001） |
| 测试 referrer | `0x0000000000000000000000000000000000001002`（user_id=1002，code=`0xABCD23`） |
| 已绑邀请关系 | user 1001 → referrer 1002 |
| 已入账 deposit | 5 笔 confirmed + 1 笔 overflow anomaly（共 7 笔真链 tx） |
| 测试金库 | `0xf4b6036d2423b1254f273272929364a120a50c7c` |
| BSC RPC | Alchemy mainnet（worker 后台扫块中） |

---

## 7 联调注意事项

### 7.1 真链 vs Mock
本地 worker **连真实 BSC mainnet**。前端测试发链上 tx 会**真扣钱**（gas 费 + USDT 入金库）。建议前端：
- 联调用**已有的测试数据**调接口验证 UI 渲染（不发真 tx）
- 真链 tx 验证由后端总指挥配合人类发（已发 7 笔覆盖 7 个 E2E 场景）

### 7.2 CORS
当前 web-api 用项目默认 CORS（`internal/middleware/cors.go`），如前端从 `http://localhost:3000` / `:5173` / `:5174` 调遇 CORS 拒绝，告诉我加 origin 白名单。

### 7.3 admin-backend 跨域
admin-backend 已配置允许 `http://localhost:5173 / :3000 / :8080`。如需调整告诉我。

### 7.4 数据库直查
前端开发遇问题时后端可帮忙查 `oddfi_dev` 库的 `_dev` 表（user_dev / presale_deposit_dev / presale_holding_dev / presale_round_dev 等）。

### 7.5 Worker 监听器停 / 重启
worker 出问题 / cursor 卡住时，告诉我手动重启。重启不会丢数据（cursor 持久化，重放靠 uk 幂等）。

---

## 8 前端需要适配的工作清单

按优先级排：

### P0（必做）
- [ ] **预售页主流程**：调用 §4.1 config + §4.2 report-tx + §4.3 单笔轮询 实现完整认购流
- [ ] **持仓页**：调用 §4.5 position 显示 ODD 持仓 + 加权成本价
- [ ] **入账历史**：调用 §4.4 list 分页展示
- [ ] **邀请链接**：URL `?ref=0xXXXXXX` 自动调 §4.7 bind（已绑静默）
- [ ] **我的邀请**：§4.6 me 显示 myCode + 邀请人 + 累计奖励
- [ ] **错误码 UI 映射**：8 个错误码各自的 toast / dialog 文案
- [ ] **金额精度**：所有金额用字符串接收 + decimal.js 计算（禁止 Number）
- [ ] **钱包交互**：MetaMask 发 USDT.transfer 用 18 decimals（不是 6）

### P1（建议）
- [ ] **2min 边界禁下单**：距 `round.endTs - 2min` 内 disable 认购按钮
- [ ] **paused_arrival 提示**：deposit 已 confirmed 但 anomalyReason=paused_arrival 时 UI 弱化提示"该轮次暂停期间入账"
- [ ] **持仓 USD 价值**：调独立平台币汇率服务自算（与后端无关）
- [ ] **邀请列表**：§4.8 list 展示我邀请的每个用户 + 各自贡献

### P2（可选）
- [ ] **入账成功后异步**：后端 confirmed 后立刻 DEL config 缓存，前端如有 30s 配置缓存可手动刷新
- [ ] **多金库切换前兼容**：vault 切换时前端无需改代码（取 config.vault.depositAddress 是真值）

---

## 9 后端配合（前端有需求随时找）

| 你需要 | 我可以做 |
|---|---|
| 加 CORS origin | 改 `cors.go` 加白名单 + 重启 web-api |
| 加测试用户 | DB INSERT user_dev + 给 user_id |
| 改测试数据（轮次时间 / 价格 / pause / unpause） | 直接改 `presale_round_dev` + Redis DEL cache |
| 给我新的 EOA + 私钥 | 用 `crypto.GenerateKey()` 生成 + 充 USDT/BNB 由人类操作 |
| 接口字段不符预期 | 改 service / handler + 重启 web-api |
| 整理新错误码 | 加常量 + 改 handler 错误分支 |

---

## 10 联调结束后流程（人类总指挥操作）

前端联调通过后：
1. 后端这边 cherry-pick / squash merge 到 dev 和 main（你审 commit 列表后授权）
2. 前端这边合自己分支
3. testnet 服务器（部署 dev 分支）自动拉取最新代码
4. 前端在 testnet 域名做最终联调
5. prod 灰度白名单（先内部 10 人 → 100 人 → 全开）

---

**对接清单完。前端 agent 可基于本文件直接开始适配，遇问题留言后端总指挥（我）。**
