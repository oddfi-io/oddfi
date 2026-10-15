# Phase 5 · L3 跨服务 e2e 验证报告

> DD-INVEST V3 总指挥 Claude · 2026-05-25 完成
> 环境：BSC mainnet（真实链上）+ 本地 docker MySQL 8 + Redis 7
> 测试 EOA：`0x9d9BcdfEe0Ca1701cBB161A583241eE8C4656490`（一次性，私钥见 `~/.ssh/PRESALE-E2E-WALLET.md`）
> 测试金库：`0xf4b6036d2423B1254f273272929364A120a50c7C`

---

## 1 结果总览

| E2E | 场景 | 链上 tx | 不变量验证 | 结果 |
|---|---|---|---|---|
| 01 | 正常入账 | `0x141238c2...` (1 USDT) | INV-1 / INV-3 | ✅ PASS |
| 02 | 边界切轮 5min 容差 | `0x5c0b2262...` (0.01 USDT) | block_ts > end_ts 但 ≤ end_ts+5min → 归属本轮 | ✅ PASS |
| 03 | 邀请链 | `0xea0a41b4...` (0.01 USDT) | INV-6 bound_at < block_ts / INV-7 reward=0.001 ODD = 0.01×10% | ✅ PASS |
| 04 | 超额 overflow | `0x9b7631e3...` (0.02 USDT) | INV-1 保持（sold 未污染）+ anomaly + ops_event | ✅ PASS |
| 05 | 无主转账 unclaimed | `0x1a0a419d...` (0.01 USDT) | EOA 无 user → ops_event 落库 + deposit 不入 | ✅ PASS |
| 06 | 多金库 pool | `0x32c99d84...` (0.01 USDT) | EnsureAll 创 2 cursor + vault_address 字段快照 | ✅ PASS |
| 07a | paused 期间入账 | `0xa79c87be...` (0.01 USDT) | confirmed 入账 ✓ / **缺 `paused_arrival` 标记**（P1） | ⚠️ PARTIAL |
| 07b | resume 恢复正常 | `0x7913c96e...` (0.01 USDT) | active 后正常入账 | ✅ PASS |

**总计**：7 PASS + 1 PARTIAL，资金路径全部正确，仅 paused 信息流告警缺失。

---

## 2 P0 Bug（已修复）

`internal/repository/presale_holding.go` `UpsertInvest` / `UpsertReferral` + `internal/repository/presale_round.go` `IncrSoldAndRaised` 三处原始 SQL 硬编码表名：

```go
// ❌ 修复前：硬编码表名绕过 model.TableName() 路由
Exec(`UPDATE presale_round SET sold_odd = ... WHERE ...`)

// ✅ 修复后：fmt.Sprintf 注入 TableName 返回值
tbl := (model.PresaleRound{}).TableName() // dev→presale_round_dev, prod→presale_round
Exec(fmt.Sprintf(`UPDATE %s SET sold_odd = ... WHERE ...`, tbl))
```

**触发条件**：dev 环境下 (env=dev → 表名加 _dev 后缀)，confirm-deposit 大事务的 IncrSoldAndRaised 调用失败 → 整个事务回滚 → deposit 看似入库但实际 rollback。

**单测未抓**：所有单测用 mock GORM 或 fakeDriver，不实际执行 SQL 表名映射。**只有真 DB e2e 能暴露**。

**教训**：repository 层用原始 SQL（`Exec(``UPDATE table...``)`）时，**必须**通过 `model.X{}.TableName()` 动态获取表名；不能假设 ORM 会自动改写表名。

---

## 3 P1 缺陷（未阻塞，建议后续修）

### P1-1 · paused 状态轮次未标 anomaly_reason=paused_arrival

**现象**：E2E-07a 发现，paused 期间链上到账后 deposit.status=confirmed 但 `anomaly_reason=NULL`，ops_event 也无记录。

**期望**（按 `docs/dd-invest/01-data-model.md §3.2`）：
> `paused_arrival` | 到账时所属轮次处于 paused 状态（信息流，非阻塞，仍正常入账 + Lark 通知）

**影响**：资金正确入账（业务无误），但运营 Lark 无告警感知"暂停期间还有人付款"。

**修复建议**：`internal/chain/presale_listener.go` `processLog` 中找到 round 后判断 `round.Status == paused`，若是则在 deposit 落库时设 `anomaly_reason = AnomalyPausedArrival`（不改 status，保持 confirmed）+ 额外落一行 ops_event（event_type=paused_arrival，关联 deposit_id）。

### P1-2 · EnsureAll 创建新 vault cursor 时 last_block_number=0

**现象**：E2E-06 发现，env 加新 vault 后 worker 启动时为新 vault 创建 cursor，初始 last_block_number=0 → 从 BSC 高度 0 扫历史（~1 亿块），实际是无效扫描。

**期望**（按 `batches/B0-foundation.md §6.2`）：
> "从 env PRESALE_VAULT_POOL 展开，每个金库地址一行，last_block_number 初始化为部署时区块高度"

**修复建议**：`internal/repository/presale_event_cursor.go` `EnsureAll` 接收当前 head block 参数，新建 cursor 时用 head 作为初始值（已有 cursor 不改）。

---

## 4 Phase 5 跨进程联调实际拓扑

```
本地 BSC mainnet 钱包                    Alchemy RPC
0x9d9BcdfEe0Ca1701cBB161A583241eE8C4656490
        │                                    ▲
        │ USDT.transfer(vault, amount)       │ eth_getLogs (USDT Transfer to vault)
        ▼                                    │
BSC mainnet ───────────────────────────► presale-worker (本地 Go 进程)
                                             │
                                             │ confirmBlocks=3 + 6s poll
                                             ▼
                                  内部 confirm-deposit 大事务
                                  ├─ INSERT presale_deposit_dev
                                  ├─ IncrSoldAndRaised
                                  ├─ UpsertInvest/UpsertReferral
                                  └─ DEL Redis cache
                                             ▼
                              本地 docker MySQL 8 (oddfi_dev)
                              本地 docker Redis 7
```

**未涉及**（本期 Phase 5 范围外）：
- admin-backend dev 进程联调（B3 已 in-process 单元 RBAC 测试覆盖；HTTP e2e 待后续）
- web-api HTTP server 接口 e2e（B1 / B2 用户接口 handler/service 已 httptest 覆盖；真启动 web-api server 验证待补）
- Lark webhook 真推送（cfg.Presale.LarkWebhookUrl 留空，noop alerter）

---

## 5 资产核算（演练成本）

| 项目 | 金额 |
|---|---|
| 起始 USDT 充值 | 10 USDT |
| 7 笔 e2e 上链转入金库 | 1.09 USDT（1 + 0.01×7 + 0.02 overflow） |
| 起始 BNB 充值 | 0.01 BNB |
| 7 笔 tx gas 消耗 | ~0.00008 BNB（每笔 ~80k gas × 50 gwei = ~4M gwei = 4e-6 BNB） |
| 测试 EOA 剩余 USDT | 8.91 USDT |
| 测试 EOA 剩余 BNB | 0.00992 BNB |
| 金库收到 USDT | 1.09 USDT |

剩余资产由人类自行决策回收（转回主钱包 / 留待下次测试）。

---

## 6 e2e 工具脚本（可复用）

| 文件 | 用途 |
|---|---|
| `scripts/e2e/setup.go` | AutoMigrate 全部 _dev 表 + seed 6 轮 + 测试 user 1001 + cursor 初始化 |
| `scripts/e2e/send_e2e01.go` | 通用发链上 USDT.transfer 工具（支持 AMOUNT_USDT 小数参数） |

每个脚本头部 `//go:build ignore` 标签，不进 `go build ./...`；通过 `go run scripts/e2e/setup.go` 直接执行。

复用方式（任何后续 e2e 演练）：

```bash
# 1. 启 docker（项目惯例）
docker compose up -d mysql redis  # 或现有 oddfi-dev-mysql/redis 容器

# 2. 改 config.yaml 指向本地 docker（注意 跑完后 git checkout 还原）

# 3. 跑 setup
PRESALE_BSC_RPC_URL=<alchemy_url> go run scripts/e2e/setup.go

# 4. 启 worker
PRESALE_BSC_RPC_URL=<alchemy_url> \
PRESALE_VAULT_POOL=<vault_addr> \
PRESALE_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955 \
PRESALE_CONFIRM_BLOCKS=3 \
PRESALE_POLL_INTERVAL_SEC=6 \
go run ./cmd/presale-worker &

# 5. 发 tx
TEST_PRESALE_EOA_PRIV_KEY=<priv_hex> \
PRESALE_BSC_RPC_URL=<alchemy_url> \
AMOUNT_USDT=0.01 \
go run scripts/e2e/send_e2e01.go

# 6. 等扫到 + 验证（参考本报告 §1 各 E2E 验证 SQL）
```

---

## 7 后续工作建议

- [ ] 修 P1-1 paused_arrival 标记（listener.processLog 加 round.Status 判断）
- [ ] 修 P1-2 EnsureAll 用 head block 作 cursor 初始值
- [ ] 补 dev MySQL 真 SQL 集成测试（go-sqlmock 已引入，可在 repo 层补 Test_IncrSoldAndRaised_RealMySQL 等抓表名 trap）
- [ ] admin-backend HTTP e2e（启 web-api + admin-backend + DB，curl 17 接口跑 RBAC 矩阵 + audit 落库）
- [ ] testnet 演练（按 `testing/regression-plan.md §Step 1`，env=dev + BSC testnet RPC + testnet USDT）
- [ ] staging 灰度（白名单 EOA + 真实 multisig 金库 + Lark webhook）
