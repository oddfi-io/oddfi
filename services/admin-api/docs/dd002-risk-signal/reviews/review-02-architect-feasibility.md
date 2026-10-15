# Review ② · 代码可行性 / 架构（architect）

> 日期：2026-06-05 ｜ 被审对象：DD002 v1 ｜ 基于三仓真实代码核查 ｜ 处理状态：**全部发现已并入 DD.md v2 与 task/OPS 文件**
> 一句话裁决：admin-backend proxy 切片可照方案做；但在 web-api 落库"每方向 exposure + 赛事 LP 底池"之前，v1 §3.1 的方向级判级与 yield 是空中楼阁。

## Critical

**C-Data-1 · 判级公式所需"每方向 totalStake"全系统未落库**
`market_odds_snapshot` 只有 base/quoted odds JSON + signal，无任何 stake 列（model + consumer 写入路径核实）；链上 `TotalStakedByOutcome` 在 spider 中用完即弃（`onchain_market_svc.go:308-327`）；全 C 端 DB grep `total_staked/staked_by_outcome/exposure_json` 零命中。唯一可得路径 `onchain_tx_orders` SUM 聚合，但口径漂移（部分成交/退款/结算）+ 重查询。
→ 处理：D7 拍板方案 a —— spider 新增 `market_exposure_snapshot`（OPS-01a，含 DDL）。

**C-Data-2 · lp_pool_amount（按赛事 LP 底池）无持久化来源**
web-api grep `lp_pool/pool_amount/pool_balance` 零命中；`liquidity.go` 仅池↔赛事映射 + 用户个人持仓。`yield_ratio` 不可得。
→ 处理：D6 降为暂 null + OPS-01d P1（先回答 LP 池粒度口径问题）。

**C-Arch-1 · 依赖的 presale internal HMAC 模式未在 web-api 主干**
`service_auth.go` 只存在于未合并 worktree `web-api/.claude/worktrees/presale-impl/`；主干 `internal/middleware/` 无此文件，router 无 `/internal/admin/*` 注册。admin-backend 的 HMAC client（`webapi.go:237-243`，实现完整）当前对端不存在。OPS-01 比 v1 估计大。
→ 处理：拆 OPS-01b（骨架核实/合并）前置于 OPS-01c。

## High

- **H-Data-3**：`score` 字段 C 端不存在（FixtureDB 无比分列，全 model grep 零命中）→ 暂 null 入 D6。
- **H-Data-4**："快照即调整历史"仅对 seq/time/odds/source 成立；exposure/lp_ratio 快照无列 → 随 C-Data-1/2 落库后才有，落库前 null。
- **H-FE-1**：dataProvider `searchParams.set` 覆盖语义，不支持重复 query key → 多值 signal 改**逗号分隔单 key**，admin-backend RawQuery 透传（presale_audit.go 同款），web-api 按逗号 split。
- **H-FE-2 / H-Arch-2**：events 分页参数缺省会落到 `page/size` → `PAGE_PARAM` 显式加 `events: page/page_size`，契约定死。

## Medium

- **M-Perf-1**：risk/list 多表聚合偏重；60s 缓存 + 30s 轮询 = 红灯发现最坏 ~90s → 可接受（合约自治停单），`signal=red` 绕缓存。
- **M-Arch-3**：`admin_risk_decisions` 表归 web-api 库，migration 需列入 OPS-01c（唯一约束支撑 RISK_DECISION_CONFLICT）。
- **M-RBAC-1**：internal 端点信任 admin-backend 已做 RBAC（仅验 HMAC + JWT 透传取 operator），纵深取舍需写明 → §3.1 已注。
- **M-Arch-4**：counts 上游挂掉的降级语义未定 → badge 保持上次值不弹错（T08）。

## Low / 正面验证

- **L-Doc-1**：契约示例 ID 一律字符串（`,string` 一致性，audit 500 教训）✅ 已改。
- **L-FE-3**：Refine 5 `refetchInterval` 轮询假设成立（`audit/list.tsx:31` 实战）。
- **正面**：proxy 模式/HMAC client/幂等 key 流转/RoleRequired 语义（super_admin 不自动通行）/限流桶建法/`{list,total}` 拆包/rbac.ts 单一真值源——v1 描述与三仓现行代码全部吻合。

## 数据可得性总表（v1 §3.1 逐字段核查结论）

| 输入 | 状态 | 备注 |
|---|---|---|
| 阈值 / Li 公式 | ✅ | calc.go:10-37 |
| 每方向 totalStake | ❌ 未落库 | → OPS-01a |
| currentOdds | ✅ | 快照 quoted_odds_json |
| otherStake | ⚠️ 推导 | 随 totalStake |
| lp_pool_amount | ❌ 未落库 | → OPS-01d P1 |
| fixture 状态 | ✅ | StateID → opened 映射 |
| 时间四点 | ⚠️ 部分 | settle 无独立列 |
| score | ❌ | 暂 null |
| settle_pl | ❌ | 仅单注级，暂 null |
| 第三方赔率+来源 | ✅ **可得** | oddfi_odds 表（比 v1 估计乐观） |
| market/direction count | ✅ | onchain_markets count |
| 调整历史 seq/time/odds/source | ✅ | 快照衍生 |
| 调整历史 exposure/lp_ratio | ❌ | 随 OPS-01a/01d |

14 项输入：7 可得 / 2 推导 / 5 不可得——其中 totalStake 与 lp_pool 是判级主链路输入，必须先落库。
