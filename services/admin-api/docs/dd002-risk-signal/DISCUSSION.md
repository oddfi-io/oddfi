# DD002 · 决策讨论记录（DISCUSSION）

> 记录方案从 v1 → v2 → 拍板的关键讨论与依据，回答"为什么这么定"。结论性内容以 [`DD.md`](./DD.md) 为准，本文件保留过程与论据。

## 时间线

| 日期 | 事件 |
|---|---|
| 2026-06-05 | 三路并行调研（C 端后端信号灯机制 / C 端前端接入 / admin 前后端现状）→ DD002 v1 |
| 2026-06-05 | team:2 review（critic=PRD/原型一致性 ∥ architect=代码可行性）→ 双双发现 Critical → v2 全量修订 |
| 2026-06-05 | D2/D4/D7 用户拍板（其余 D1/D3/D5/D6 按方案建议确认）→ 阶段 2 拆 task（T01-T08 + OPS-01a-d） |
| 2026-06-05 | 文档收敛入库：`.progress` 工作区 → `docs/dd002-risk-signal/`（harness 参照前端仓 DD-134 结构） |

## 核心争议与裁决

### ① 判级数据源：maxL vs adjMaxL（review C-PRD-1，v1 最大错误）

- **v1 错误**：把事件灯色判级挂在 `adjMaxL`（各玩法最坏方向求和）上。
- **证据**：原型 JS `sig = signalLight(maxL)`（html:4239），maxL=全场**单方向**最坏敞口；行内"总计最大敞口"卡才显示 adjMaxL（:4624）。合约阈值（8k/18k/28k）本身就是按单方向最坏亏损定义的（calc.go 同义）。
- **裁决**：**判级用 maxL，展示用 adjMaxL，两个量彻底分开**。用求和值套单方向阈值会系统性误报红灯。

### ② 审批队列口径：只收 red vs red+orange（D4）

- **PRD 自相矛盾**：原型 JS 队列只收 red（:4384）+ §5.5"仅 red 允许操作"；但接口文档 §9.2 查询带 red+orange、概述 :1497 写"red/orange 自动入审"、§9.1 样例 `event_count:2 ≠ red_count:1`。
- **拍板（用户确认）**：**只收 red**，`event_count = red_pending_count`。逻辑自洽：能入队的就是能审的。orange 列表可筛、不入队不计 badge。
- **保留风险**：若产品最终要 red+orange，需返工 counts 聚合 + 前端 badge 两处（已在 DD.md D4 标注）。建议上线前与 PM 留痕一次。

### ③ 红灯决策执行面：一期落库 vs 真执行（D2）

- **现实约束**：红灯停单是合约自治行为，链上**没有**"人工恢复开盘"通道；PRD 与原型也都没有给执行机制（原型只做了前端状态翻转 red→orange + 退队，html:4429）。
- **拍板（用户确认）**：**一期 = 决策落库 + 决策态盖过展示/队列**（effective_signal 降级、退队、消红点；红灯重升以 quote_version 锚点自动重新入队），不触链上。二期等合约/web-api pause/resume 能力再接真执行。
- **时效论证**：60s 聚合缓存 + 30s 前端轮询 = 红灯发现最坏 ~90s，可接受（停单本来就是合约即时行为，人工决策只是事后记录）；`signal=red` 查询绕缓存进一步压缩。

### ④ 敞口数据落库：spider 快照 vs web-api 现场聚合（D7，review C-Data-1）

- **发现**：判级公式需要的"每方向 totalStake"全系统未落库——快照表只有 odds JSON，spider 链读 `TotalStakedByOutcome` 用完即弃（onchain_market_svc.go:308-327）。v1"快照即调整历史、不需要新表"的判断对 exposure/lp_ratio 不成立。
- **拍板（用户确认）**：**spider 新增 `market_exposure_snapshot`**（OddsUpdated 时链读落库，与合约真值逐笔对齐，调整历史 exposure 列顺带解锁）。否决备选"web-api 从 onchain_tx_orders SUM"：口径漂移（部分成交/退款）+ 查询重。

### ⑤ 其余决策速记（D1/D3/D5/D6）

- **D1 阈值**：web-api yaml 配置，默认=合约常量；admin/前端零判级。⚠️ 原型 mock 阈值放大 10×（80k/180k/280k）仅为造数，勿照抄。
- **D3**：event = fixture；ID 全链路 `,string`（吸取 audit 500 教训）。
- **D5**：路由沿本仓 `/admin/...`，不用 PRD 的 `/api/v1` 前缀（独立 8081 服务）。
- **D6 字段分级**：第三方赔率可交付（`oddfi_odds` 表实际有数据，比 v1 估计乐观）；score / settle_pl / lp_pool_amount / yield_ratio / times.settle / 调整历史 lp_ratio 暂 null（契约保留，前端「—」），待 OPS-01d 点亮。

## review 处理记录

| review 发现 | 处理 |
|---|---|
| critic C-PRD-1 判级源错位 | DD.md §3.1 重写（maxL/adjMaxL 分离）✅ |
| critic H-PRD-1 D4 论据错误 | §2.1 冲突仲裁表 + D4 重写 ✅ |
| critic H-PRD-2 决策状态机缺失 | §3.3 补 effective_signal/pending_decision/重升重入队 ✅ |
| critic H-STYLE-1 四色撞色组纪律 | §3.4 风格边界节（语义色 token，AntD preset 色值）✅ |
| critic H-PRD-3 交互遗漏 ×5 | §3.4 checklist 补全（settled 卡替换/时间线 hover/绿黄落 all/橙含红/未开盘置灰）✅ |
| architect C-Data-1 totalStake 未落库 | D7 + OPS-01a ✅ |
| architect C-Data-2 lp_pool 未落库 | D6 降为暂 null + OPS-01d ✅ |
| architect C-Arch-1 HMAC 骨架未合并主干 | OPS-01b 单列 ✅ |
| architect H-FE-1/2 dataProvider 多值/分页 | 逗号单 key + PAGE_PARAM events 条目 ✅ |
| architect M-* / L-* 全部 | 分别并入对应 task 卡 ✅ |

完整报告见 [`reviews/`](./reviews/)。

## 遗留 open questions（不阻塞开发）

1. **LP 池粒度**：按赛事池还是全局池？决定 `yield_ratio` 口径，需产品/合约侧回答（OPS-01d P1 前置）。
2. **D4 与 PM 留痕**：队列只收 red 的口径建议上线前与 PM 同步一次（差异说明可按 weekly-sync 格式输出）。
3. **二期真执行**：合约 pause/resume market 能力排期未知，risk-decision 真执行依赖它。
