# 02 · 用户接口契约（web-api · V3 · 模型 B）

> 用户域接口全部挂在 web-api（生产 api.oddfi.io / 开发 dev-api.oddfi.io）。
> 统一响应包装 `{ code, message, data }`，鉴权沿用现有 JWT，金额字段一律字符串。
> 错误码沿用现有 `internal/pkg/response/` 风格，新增段位 `40xxx`（业务）/ `50xxx`（系统）。
> 管理后台接口见 [03-admin-api-contract.md](03-admin-api-contract.md)。

## 1 接口清单

| 方法 | 路径 | 鉴权 | 模块 | Batch |
|---|---|---|---|---|
| GET | `/api/v1/presale/config` | 公开 | 配置 | B0 |
| POST | `/api/v1/presale/deposit/report-tx` | JWT | 入账 | B2 |
| GET | `/api/v1/presale/deposit/list` | JWT | 入账 | B2 |
| GET | `/api/v1/presale/deposit/:txHash` | JWT | 入账 | B2 |
| GET | `/api/v1/presale/position` | JWT | 持仓 | B2 |
| GET | `/api/v1/referral/me` | JWT | 邀请（站点级） | B1 |
| POST | `/api/v1/referral/bind` | JWT | 邀请（站点级） | B1 |
| GET | `/api/v1/referral/list` | JWT | 邀请（站点级） | B1 |

**已砍接口**（V2 → V3）：

- `POST /api/v1/presale/order/create` → 改为 `POST /api/v1/presale/deposit/report-tx`（事件驱动）
- `GET /api/v1/presale/order/:id` → 改为 `GET /api/v1/presale/deposit/:txHash`
- `GET /api/v1/presale/claim/nonce` / `POST /api/v1/presale/claim` / `GET /api/v1/presale/claim/list` → 整体砍（vesting/claim 本期不实现）
- `GET /api/v1/presale/tx/list` → 砍，合并到 `GET /deposit/list`
- 原 `/api/v1/presale/referral/*` → 迁移到 `/api/v1/referral/*`（去 presale 前缀，站点级）

## 2 错误码字典

| HTTP | code | 含义 |
|---|---|---|
| 400 | 40001 | `AMOUNT_TOO_SMALL` 低于全局 minSubscribeUsd（前端校验通过、Worker 兜底） |
| 400 | 40004 | `SELF_REFERRAL` 自邀绑定 |
| 400 | 40006 | `INVALID_TX` 上报的 txHash 无效（链上不存在 / 已 revert） |
| 400 | 40007 | `TX_NOT_TO_VAULT` 链上 tx 收款地址不在金库池 |
| 400 | 40008 | `TX_NOT_USDT` 链上 tx 不是 USDT 转账 |
| 404 | 40404 | `INVALID_CODE` 邀请码不存在 |
| 404 | 40405 | `TX_NOT_FOUND` deposit 记录不存在（前端轮询时） |
| 409 | 40901 | `ROUND_NOT_ACTIVE` 轮次未开放 / 已结束 / 已暂停（仅前端预校验告警） |
| 409 | 40902 | `WALLET_MISMATCH` 入参 EOA 与登录态不一致 |
| 409 | 40903 | `ALREADY_BOUND` 已绑过邀请 |
| 503 | 50301 | `LISTENER_LAG` 监听器延迟（仅监控用，前端不展示） |

**已砍错误码**（V2 → V3）：

- `40002 AMOUNT_EXCEED_ROUND` / `40003 AMOUNT_EXCEED_POOL`（超额到账走 anomaly 不返错）
- `40005 INVALID_SIGNATURE` / `40006 NONCE_USED` / `40007 CLAIM_AMOUNT_EXCEED`（claim 砍）
- `50302 HOT_WALLET_LOW`（热钱包砍）

## 3 接口详情

### 3.1 `GET /api/v1/presale/config` — 公开

返回轮次配置 + 金库地址 + 全局参数，给前端首屏渲染。

**响应 data**

```json
{
  "vault": {
    "depositAddress": "0xINV...A2F1",
    "chain": "BSC",
    "chainId": 56,
    "asset": "USDT",
    "usdtAddress": "0x55d398326f99059fF775485246999027B3197955",
    "minSubscribeUsd": "1000",
    "totalRaisedUsd": "8420000",
    "totalTargetUsd": "20000000",
    "tgeTs": 1749571200000,
    "tgeOpenPriceUsd": "0.1",
    "audit": "CertiK",
    "boundaryToleranceMin": 5
  },
  "rounds": [
    {
      "id": "seed",
      "name": "种子轮",
      "roundType": "private",
      "price": "0.03",
      "supply": "10000000",
      "sold": "3450000",
      "raised": "103500",
      "targetRaiseUsd": "300000",
      "soldPercent": 34.5,
      "minPerOrderUsd": null,
      "maxPerWalletUsd": null,
      "tgeReleasePct": 10,
      "linearReleaseDays": 90,
      "referralRewardPct": "10.0000",
      "tgeDiscountPct": "70.00",
      "startTs": 1747843200000,
      "endTs": 1749571200000,
      "status": "active",
      "badge": "hot"
    }
  ],
  "serverTs": 1747900000000
}
```

**字段说明**：

- `vault.depositAddress`：当前金库地址（前端付款用），与 env / `presale_config.vault_address` 同步
- `vault.tgeOpenPriceUsd`：PRD 设定的 TGE 开盘基准价，**不是市价**（市价由独立平台币汇率服务提供）
- `vault.boundaryToleranceMin`：后端边界容差（前端可读取后展示"轮次切换 X 分钟内仍按上一轮算"）
- `rounds[].tgeDiscountPct`：**衍生字段**，后端计算 `(tge_open_price - round.price) / tge_open_price × 100`
- `rounds[].minPerOrderUsd / maxPerWalletUsd`：本期初始 NULL（无限制），后续运营可配
- `rounds[].status`：`upcoming / active / paused / ended`

**缓存策略**：Redis 30s，前端短缓存 5s。监听器入账后失效轮次缓存。

---

### 3.2 `POST /api/v1/presale/deposit/report-tx` — JWT

前端钱包发完 USDT Transfer 后**主动上报** txHash，与后端 Worker 监听双轨会师。

**请求**

```json
{
  "txHash": "0xabc...",
  "expectedRoundId": "seed",
  "expectedAmountUsdt": "1000"
}
```

**字段说明**：

- `txHash`：必填，链上 USDT Transfer tx
- `expectedRoundId`：可选，前端用户点击付款时所属轮次。后端会与实际所属轮次比对，不一致进 anomaly
- `expectedAmountUsdt`：可选，前端用户输入金额。与实际 to 账金额偏差大于 5% 时进 anomaly

**响应 data**

```json
{
  "depositId": "172638919xxxx",
  "txHash": "0xabc...",
  "status": "pending"
}
```

**后端动作**：

1. 调 BSC RPC `eth_getTransactionReceipt(txHash)` 拿 receipt
2. 校验：
   - receipt 存在且 `status=success`（否则 `40006 INVALID_TX`）
   - 至少有 1 个 `Transfer` log 来自 USDT 合约（`40008 TX_NOT_USDT`）
   - 该 log 的 `to` ∈ 当前金库地址池（`40007 TX_NOT_TO_VAULT`）
   - `tx.from` = 登录态 EOA（`40902 WALLET_MISMATCH`）
3. 校验已存在的 `presale_deposit` 是否有相同 `(tx_hash, log_index)` → 已存在直接返回该 `depositId`（幂等）
4. 按 `block.timestamp` + 5min 容差找所属轮次
5. 反查 `user_referral_bind`（`bound_at < block.timestamp` 才有效）
6. INSERT `presale_deposit(status=pending)`，`source=frontend`
7. 后续区块确认达标后（worker 异步），状态推进 `pending → confirmed` + upsert `presale_holding`
8. 异常项（超容量 / 期望不符 / 非 USDT / 容差超时）落 `anomaly` + `presale_ops_event` + Lark 通知

**幂等保证**：同一 `(tx_hash, log_index)` 由前端 + Worker 两路同时上报时，靠 `uk_(tx_hash, log_index)` 数据库锁保证只入账一次。

---

### 3.3 `GET /api/v1/presale/deposit/:txHash` — JWT

前端轮询用，查单笔入账记录状态。

**响应 data**

```json
{
  "depositId": "172638919xxxx",
  "txHash": "0xabc...",
  "userId": "12345",
  "eoaAddress": "0x...",
  "vaultAddress": "0xINV...A2F1",
  "roundId": "seed",
  "amountUsdt": "1000",
  "priceUsd": "0.03",
  "sharesOdd": "33333.333333",
  "referrerEoa": "0xREF...",
  "referralRewardOdd": "3333.333333",
  "referralRewardPct": "10.0000",
  "status": "confirmed",
  "anomalyReason": null,
  "blockNumber": 39581234,
  "blockTimestamp": 1747900000000,
  "confirmedAt": 1747900100000
}
```

前端轮询：`status=pending` 时 3s/次，进 `confirmed/anomaly` 后停止。

**错误**：`40405 TX_NOT_FOUND`（用户上报后但 Worker 还没确认 / 上报失败）

---

### 3.4 `GET /api/v1/presale/deposit/list` — JWT

用户查自己所有入账历史（替代原 `/tx/list`）。

**query**：`page` / `size`（默认 1 / 20，size 上限 100）/ `status`（可选筛选）

**响应 data**

```json
{
  "list": [
    {
      "depositId": "...",
      "txHash": "0x...",
      "roundId": "seed",
      "amountUsdt": "1000",
      "sharesOdd": "33333.33",
      "status": "confirmed",
      "blockTimestamp": 1747900000000
    }
  ],
  "total": 5
}
```

---

### 3.5 `GET /api/v1/presale/position` — JWT

聚合返用户预售持仓。

**query**：`wallet`（可选，缺省取登录态 EOA）

**响应 data**

```json
{
  "holdings": "33333.33",
  "holdingsBySource": { "invest": "30000", "referral": "3333.33" },
  "investedUsd": "1000",
  "lockedPriceAvg": "0.03333",
  "perRound": [
    {
      "roundId": "seed",
      "totalOdd": "30000",
      "investedUsd": "900",
      "lockedPriceAvg": "0.03",
      "referralOdd": "3333.33"
    }
  ]
}
```

**字段说明**：

- `holdings`：用户所有轮次 ODD 总和（认购 + 邀请奖励）
- `holdingsBySource`：按来源拆分
- `investedUsd`：累计投入 USDT
- `lockedPriceAvg`：加权平均成本价（仅 invest 源参与计算，referral 不算）
- `perRound[]`：按轮次明细

**已砍字段**（V2 → V3，由独立平台币汇率服务前端拼数据）：

- `todayPriceUsd`、`todayValueUsd`、`valueGainPct` —— 预售后端不管 ODD 价格
- `released`、`claimed`、`claimable`、`vesting`、`vestingStartTs`、`vestingEndTs`、`upcoming` —— vesting/claim 整段砍

**计算口径**（service 实现）：

```
holdings           = Σ holding.total_odd (跨 round 跨 source)
holdingsBySource   = Σ holding.total_odd group by source
investedUsd        = Σ holding.invested_usd (source=invest)
lockedPriceAvg     = Σ(holding.total_odd × holding.locked_price_avg, source=invest) / Σ(holding.total_odd, source=invest)
```

---

### 3.6 `GET /api/v1/referral/me` — JWT（站点级）

**响应 data**

```json
{
  "myCode": "0xH7K9X2",
  "shareLink": "https://app.oddfi.com/invest?ref=0xH7K9X2",
  "referrer": {
    "eoa": "0xREF...",
    "code": "0xR7K8N3",
    "boundAt": 1747900000000
  },
  "stats": {
    "invitedCount": 12,
    "totalRewardOdd": "3200"
  }
}
```

**字段说明**：

- `myCode`：当前用户的邀请码，首次登录时已经 INSERT IGNORE 生成
- `shareLink`：完整邀请链接，前端"复制 / 分享"按钮直接用
- `referrer`：用户绑过的邀请人（NULL = 未绑）
- `stats.totalRewardOdd`：累计邀请奖励 ODD（**不返 USD**，前端按独立平台币汇率服务自算）

---

### 3.7 `POST /api/v1/referral/bind` — JWT（站点级）

绑定邀请关系。一旦绑定不可撤销 / 不可改。

**请求**

```json
{
  "code": "0xH7K9X2",
  "source": "link",
  "business": "presale"
}
```

- `code`：邀请码（输入时 case-insensitive，后端归一为大写比对）
- `source ∈ {link, manual}`：仅埋点用（前端 URL 自动绑用 `link`，手动框用 `manual`）
- `business`：当前业务（本期固定 `presale`，后续业务接入时塞自己的）

**响应 data**

```json
{
  "referrerEoa": "0xREF...",
  "referrerCode": "0xH7K9X2",
  "boundAt": 1747900000000
}
```

**幂等**：`INSERT ... ON DUPLICATE KEY UPDATE user_id=user_id`；已绑则返 `40903 ALREADY_BOUND`，前端**静默**（自动绑场景下不打扰用户）。

**校验**：

- 邀请码存在性（`40404 INVALID_CODE`）
- 自邀阻断（`40004 SELF_REFERRAL`）：`user_referral_code.user_id` ≠ 当前登录 user_id

---

### 3.8 `GET /api/v1/referral/list` — JWT（站点级）

我邀请的用户列表 + 每人的入账明细。

**query**：`page` / `size` / `business`（可选筛选）

**响应 data**

```json
{
  "list": [
    {
      "userId": "23456",
      "eoa": "0x...",
      "code": "0xK8N3M2",
      "joinedAt": 1747900000000,
      "totalRewardOdd": "500",
      "deposits": [
        {
          "depositId": "...",
          "txHash": "0x...",
          "roundId": "seed",
          "investedUsd": "100",
          "rewardOdd": "333.33",
          "referralRewardPct": "10.0000",
          "ts": 1747900000000
        }
      ]
    }
  ],
  "total": 12
}
```

**逐笔独立展示**：每笔 `deposits[].rewardOdd` 都按当时的 `referralRewardPct` 计算（运营改了某轮 reward_pct 不影响历史记录，前端按笔展示不合并）。

---

## 4 全局字段约定

| 字段 | 类型 | 说明 |
|---|---|---|
| 所有金额 | string | `decimal.Decimal.String()`，保留原精度 |
| 所有时间 | int64 ms | Unix epoch millisecond |
| 钱包地址 | string | 一律小写 0x... 42 字符 |
| txHash | string | 一律小写 0x... 66 字符 |
| 邀请码 | string | 一律 8 字符（`0x` + 6 位大写 `[2-9A-HJ-NP-Z]`） |
| depositId | string | 自增 ID 转字符串 |

## 5 鉴权 / 限流

- JWT 校验沿用 `middleware.AuthMiddleware`
- 限流（nginx 层 + service 兜底）：
  - `POST /deposit/report-tx`：10 req / min / user
  - `POST /referral/bind`：5 req / min / user
  - `GET /position`：60 req / min / user
  - `GET /deposit/:txHash`：120 req / min / user（前端轮询）
  - `GET /config`：CDN 缓存为主，30 req / min / IP 兜底

## 6 前端边界校验（与后端配合）

**前端在调 `POST /deposit/report-tx` 之前**必须本地校验：

1. 当前轮次 `status == active`
2. 用户输入金额 ≥ `vault.minSubscribeUsd`
3. 用户输入金额 ≤ 本轮剩余容量（`round.supply - round.sold`）
4. 用户输入金额 ≤ `round.maxPerOrderUsd`（如有配置）
5. 当前时间距 `round.endTs` ≥ **2 分钟**（避免边界切轮）
6. 邀请码已绑定 / URL 带 `ref` 参数已自动绑定

后端 5min 容差只在 `report-tx` 时兜底用，不暴露给前端做交互决策。
