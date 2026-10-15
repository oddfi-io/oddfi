# OddFi 合约场景覆盖清单

本清单是 skill 内置验收索引。当前优先用本地 Foundry 场景覆盖正反路径；公开 BSC Testnet 只适合在 ABI 已升级匹配后做 smoke。

## 1. 本地一键场景

```bash
npm run local:scenarios
```

覆盖命令：

```bash
forge test --match-path test/LocalScenarioMatrix.t.sol --offline -vv
forge test --match-path test/BatchMarketSettlement.t.sol --offline -vv
forge test --offline --no-match-path 'test/Fork*' -vv
```

## 2. 场景矩阵

| 场景 | 覆盖目标 | 本地覆盖 | Skill 入口 |
|---|---|---|---|
| DEP-001 | ODD 固定总量、初始余额、无额外 mint 入口 | `LocalScenarioMatrix` | `method.ts read ODDToken totalSupply '[]'` |
| DEP-002 | ERC20/BEP20 最小能力集 | `LocalScenarioMatrix` | `token.ts balance/allowance/approve/transfer` |
| DEP-003 | ODD 普通转账无税 | `LocalScenarioMatrix` | `token.ts transfer` |
| DEP-004 | 权限边界 | `LocalScenarioMatrix` | 非授权私钥调用 `method.ts write ...` |
| DEP-005 | pause 生效范围 | `LocalScenarioMatrix` | `method.ts write ODDToken pause/unpause` |
| REF-001 | 显式绑定推荐人 | `LocalScenarioMatrix` | `bet.ts bind <referrer>` |
| REF-002 | 首次下注自动绑定推荐人 | `LocalScenarioMatrix` | `bet.ts place ... <referrer>` |
| REF-003 | 二次绑定拒绝 | `LocalScenarioMatrix` | 重复 `bet.ts bind` |
| REF-004 | 自荐与零地址拒绝 | `LocalScenarioMatrix` | `bet.ts bind <self>` / 零地址 |
| REF-005 | 推荐资格与质押解耦 | `LocalScenarioMatrix` | 无质押 referrer 参与下注并 `claim-ref` |
| TAX-001 | 有推荐人的下注税分配 | `LocalScenarioMatrix` | `bet.ts place ... <referrer>` |
| TAX-002 | 无推荐人的下注税转平台 | `LocalScenarioMatrix` | `bet.ts place` + `query.ts pool` |
| TAX-003 | 派奖税快照 | `LocalScenarioMatrix` | `settle.ts score` + `bet.ts claim` |
| TAX-004 | ODD 推荐奖励领取 | `LocalScenarioMatrix` | `bet.ts claim-ref <amountODD>` |
| TAX-005 | USDT 推荐奖励领取 | `LocalScenarioMatrix` | `method.ts write BettingPool claimUSDTReferralRewards '[...]'` |
| BET-001 | 开盘、赔率、市场状态 | `LocalScenarioMatrix` | `market.ts id/open/status/odds` |
| BET-002 | previewSignal 报价 | `LocalScenarioMatrix` | `bet.ts preview` |
| BET-003 | placeBet 主路径 | `LocalScenarioMatrix` | `bet.ts approve` + `bet.ts place` |
| BET-004 | quote guard 防旧报价 | `LocalScenarioMatrix` | `preview` 后更新赔率再用旧 guard |
| BET-005 | 分批比分结算后中奖 claim | `LocalScenarioMatrix` + `BatchMarketSettlement` | `settle.ts score <marketId> <homeScore> <awayScore>` + `bet.ts claim` |
| BET-006 | 输单不可 claim | `LocalScenarioMatrix` | 输方 `bet.ts claim <betId>` |
| BET-007 | 重复 claim 拒绝 | `LocalScenarioMatrix` | 同一 `betId` 连续 `claim` |
| BET-008 | Refunded 终态与退款 | `LocalScenarioMatrix` | `settle.ts finalize <marketId> 1` + `settle.ts refund` |
| BET-009 | Cancelled 终态与退款 | `LocalScenarioMatrix` | `cancel.ts <marketId> 2 <betId...>` |
| STK-001..017 | 质押、奖励、VIP、暂停、提前/到期退出和失败路径 | `LocalScenarioMatrix` | `stake.ts` + `method.ts` |
| LP-001..024 | 全局/单场 LP、Margin/Loss、unbond/withdraw、权限和余额边界 | `LocalScenarioMatrix` | `lp.ts` + `query.ts pool` |
| WFL-001..018 | L1/L2/L3/L4 瀑布、taxBuffer、platformReserve、熔断 | `LocalScenarioMatrix` | `query.ts pool` + `method.ts read BettingPool <getter>` |
| SPC-001 | AH 13 条 line 白名单 | `LocalScenarioMatrix` + `BatchMarketSettlement` | `marketType=1,line=0..12` |
| SPC-002 | 非法 AH line 拒绝 | `LocalScenarioMatrix` | `market.ts open ... line=13` 预期 revert |
| SPC-002B | OU 11 条 line 白名单与非法 line 拒绝 | `BatchMarketSettlement` | `marketType=2,line=0..10` 可开盘，`line=11` 预期 revert |
| SPC-003 | 串关 ABI 已在 BSC Testnet 部署验证 | `ParlayModuleTest` + `bsc_testnet_parlay_report.py` | `method.ts list BettingPool` 可见 `placeParlay/settleParlay/claimParlayPayout`；链上 `parlayModule()` 为 `0x3CEBdFB4F753F448F5C2872321144878b29a69DD`，lens 为 `0x8DF283608C37c387513810CdF9E3de171B09F6fC` |
| SPC-004 | 1X2 / AH / OU 同场隔离与 AH/OU push | `LocalScenarioMatrix` + `BatchMarketSettlement` | `settle.ts score` |
| SEC-001..006 | 幂等、重放保护、配置边界、结算模式互斥 | `LocalScenarioMatrix` | `method.ts` + 对应快捷脚本 |

## 3. Score-based 特别覆盖

`BatchMarketSettlement` 覆盖：

- AH line `-0.25 / -0.5 / -0.75 / -1 / -1.25 / -1.5 / -1.75 / -2 / -3 / +0 / +0.25 / +0.5 / +0.75`
- OU line `0 / 0.5 / 1 / 1.5 / 1.75 / 2 / 2.25 / 2.5 / 2.75 / 3 / 3.5`
- AH 的 `outcome=0` 主队视角和 `outcome=1` 客队视角，OU 的 Over/Under 双方向
- full win / half win / push / half loss / loss
- zero-bet market finalize
- score mismatch / invalid score / duplicate betId / wrong market betId
- AH 与 OU score settlement fuzz

## 4. 链上 smoke

只有当目标链 ABI 已升级到当前 `assets/*.abi.json` 时运行：

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://bsc-testnet-dataseed.bnbchain.org
npm run scenario
```

该脚本覆盖：健康读取、ODD 转账无税、质押、全局 LP、开盘、preview、placeBet、等待到期、`settleMarketBetsByScore`、`finalizeMarketSettlement`、getBet ABI 布局校验、claimPayout。

## 5. 不适合公开 testnet 自动化的路径

- 多用户推荐链路：需要多私钥和预资金账户。
- 越权攻击路径：需要非授权私钥发起，预期为 revert。
- 到期解质押和 LP 提取：公开 testnet 不能快进时间。
- USDT 推荐奖励兑换：需要 router、USDT、后端签名和 deadline。
- UUPS 升级：需要新 implementation 和升级角色。
