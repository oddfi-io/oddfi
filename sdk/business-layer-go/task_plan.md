# 重构计划：contracts-business-layer

> **闪崩恢复入口**：闪崩重启后，先读本文件 → 再读 `progress.md` → 再读 `findings.md`，即可定位当前进度。

## 目标（用户原话归纳）

把本项目（`contracts-business-layer`）做一次大重构：

1. **依赖切换**：底层 SDK 从 `github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/...` 换成 `github.com/Crypto-Barrett/oddfi-ODD-SDK`（本地路径 `D:\everything_finance\oddfi-ODD-SDK`）。
2. **中间件保持**：继续使用 MySQL + Redis。
3. **对外接口形态（每个业务方法都有两种变体）**：
   - **A 形态（即返）**：调用 → 提交上链 → 返回 tx hash（不等回执）。
   - **B 形态（等回执）**：调用 → 提交上链 → 等待出块/回执 → 返回结果。
4. **对外分三个独立库**（用户 2026-05-14 决定）：
   - **`admin`** — admin 私钥的管理员写路径。
   - **`relay`** — 代付库（替代 eip7702 字眼）。用户传 ctx + 私钥 + 金额，由本层 relay 通道签名上链。
   - **`read`** — SDK 中所有读方法的转发/包装，**全部 41 个读方法在此**。
5. **典型用户故事**：
   > 外部传入 `ctx` + 用户 A 的私钥 + 金额，调用「下注」接口 → 本层内部完成签名/上链 → 返回 tx hash。

## 工作流约束

- 每个接口都要有：**入参签名 + 内部逻辑（含余额/限额/幂等等校验）**，都要写进 `findings.md` 的接口卡片。
- 用户参与决策环节（Phase 2 / Phase 3），不许擅自归类。

---

## 阶段表

| # | 阶段 | 状态 | 产出 |
|---|------|------|------|
| 1 | 枚举新 SDK `D:\everything_finance\oddfi-ODD-SDK` 对外接口全集 | **complete** | `findings.md` §1（14 写 + 14 calldata + 41 读 + 16 类型/错误） |
| 2 | 用户分类：每个接口标 `admin` / `代付` / `共用` / `不暴露`；并定代付库新名字 | **complete** | `findings.md §2`（分类 + 命名 + D1/D2 + 事件失效原则） |
| 3 | 逐接口设计：本层对外签名 + 内部校验逻辑（余额/限额/幂等/重试） + 事件失效映射清单 | **complete** | `findings.md` §3.1~§3.14（14 写卡片）+ §3.16（42 read DTO）+ §6 事件失效清单 |
| 4 | 设计统一双形态返回模式（hash-only vs wait-mined）与错误模型 | **complete** | `findings.md §4` |
| 5 | 输出落地实现计划（按 `superpowers:writing-plans` 写成可执行 plan） | **complete** | `docs/2026-05-14-refactor-plan.md` |
| 6 | 执行重构（按 plan 推进） | **complete** | 三库 + multicall + cache 骨架，全部 stub 已清零 |
| 7 | e2e 验证（沿用 flow1/flow2 思路改造） | **partial** | `scenario_e2e_test.go` 已写（含 5 步完整 + Step 5 待用户接 betID 持久化）|
| 8 | 写 README + 调用示例 | **complete** | `README.md` 重写 + `docs/usage-examples.md` 完成 |

> 当前阶段：**Phase 6（按 plan 执行重构）**——待用户确认 Task 0 几个待拍点后启动

---

## 决策记录（边走边填）

| 时间 | 决策 | 理由 |
|------|------|------|
| 2026-05-14 | 启用文件规划系统 | 用户窗口易闪崩，需可恢复状态 |
| 2026-05-14 | SDK 路径锁定 `D:\everything_finance\oddfi-ODD-SDK`，模块名 `github.com/Crypto-Barrett/oddfi-ODD-SDK` | 用户指定 |
| 2026-05-14 | **代付库新名字 = `relay`** | 用户拍板，避开 eip7702 字眼 |
| 2026-05-14 | **对外拆三库：`admin` / `relay` / `read`** | 用户拍板，三库各自独立暴露 |
| 2026-05-14 | **`read` 库 = SDK 全部 41 个读方法**（直接转发/包装） | 用户拍板 |
| 2026-05-14 | 14 个写方法的 admin↔relay 切分 → 仍待用户最终勾选 | 我已给建议，待最终确认 |
| 2026-05-14 | **Q1: `AddPlatformReserve` 走 admin 库**（不藏，对外暴露） | 用户拍板 |
| 2026-05-14 | **Q2: `Transfer`/`Approve` 仅 relay；admin 不保留** | 用户拍板 |
| 2026-05-14 | **D1: read 库返回包装一层 DTO**，不透传 SDK 原生类型 | 用户拍板 |
| 2026-05-14 | **D2: 方案 Y** — 缓存 B(赛事 4)+C(全局配置 22)+D(池子聚合 6)=32 个；A(用户态 6)+E(动态/自增 3)+F(`AccountedBalance`)=10 个不缓存 | 用户拍板 |
| 2026-05-14 | **`AccountedBalance` 剔出 D 类→F 类不缓存** — 业务约束只在下注路径调用，频次低，缓存意义小 | 用户拍板 |
| 2026-05-14 | D 类剩 6 个全部纯事件失效（不需要 TTL 降级） | 因剔出 `AccountedBalance` 后事件量可控 |
| 2026-05-14 | **Allowance 不在下注路径查** | 用户：每次转账都提前授权，业务上层保证 allowance 充足 |
| 2026-05-14 | **`AccountedBalance` 业务用途 = 查余额是否足够下注**（Q3=c） | 用户拍板，下注路径需读一次 |
| 2026-05-14 | **下注路径引入 multicall3 批量化读**（Q4=a） | 用户拍板，最大化减少 RPC 调用次数 |
| 2026-05-14 | **S1: admin.AddPlatformReserve 保留 Allowance 预校验** | 我替用户选；multicall 已在调用，多塞一项零成本，错误更友好 |
| 2026-05-14 | **S2: admin.SettleMarket 绕过 B 缓存直查链** | 用户确认；settle 太敏感 |
| 2026-05-14 | **S3: relay.Unstake/RequestUnbond 不预校验 owner，靠合约 revert** | 用户同意；省 RPC |
| 2026-05-14 | **S4: relay.Approve Value==0 合法**（撤销授权用例） | 用户 OK |
| 2026-05-14 | **S5: relay.DepositMatch 的 `PayoutLiquidityWindow` 走 multicall**（与 BalanceOf 合并 1 次 RPC） | 用户拍板 |
| 2026-05-14 | **N1: 赔率字段在 DTO 内自动除 1e4**（DTO 拿到 1.5 而非 15000） | 用户拍板 |
| 2026-05-14 | **N2: read 包扁平命名，加合约前缀**（`BettingPoolPaused()` / `LiquidityPoolPaused()`）— 不按子句柄拆 | 用户拍板 |
| 2026-05-14 | **M2: A 形态默认名，B 形态加 `WithReceipt` 后缀**（`PlaceBet` / `PlaceBetWithReceipt`） | 用户拍板 |
| 2026-05-14 | 老代码 `Submit*` / `SubmitAndWait` 风格**废弃** | 老代码单 Service 聚合需前缀消歧；新设计已 admin/relay/read 库分层 |
| 2026-05-14 | **E1: 错误大类用朴素命名** — `BusinessError` / `RetryableError` / `FatalError` / `InternalError` | 用户拍板 |
| 2026-05-14 | **E2: 错误码按业务能力域加前缀** — `ErrBet*` / `ErrMarket*` / `ErrPosition*` / `ErrPool*` / `ErrToken*` / `ErrStake*` / `ErrInfra*` / `ErrAdmin*` / `ErrInternal*` | 用户拍板 |
| 2026-05-14 | **E3: revert selector 映射表 MVP 手写 ~10 条 + 兜底 `ErrChainTxReverted`** | 用户拍板 |
| 2026-05-14 | **重构范围: 架构保留，其他重写** | 用户拍板；保留 `action/`(chain_actions)+`coretypes/`+`watcher/`+`migrations/`，重写 `writes/`/`sponsored/`/`internal/eip7702/`/`methods.go`/`service*.go`/e2e |
| 2026-05-14 | **Plan 文件位置 = `docs/2026-05-14-refactor-plan.md`** | 用户拍板，放 docs 根目录而非 docs/superpowers/plans/ |
| 2026-05-14 | **C1: SDK 用本地路径** — `go.mod` 用 `replace github.com/Crypto-Barrett/oddfi-ODD-SDK => D:/everything_finance/oddfi-ODD-SDK` | 用户拍板，本地开发期；后续上线再改成 git tag |
| 2026-05-14 | **C2: multicall3 用第三方包，越简单越好** | 候选：`github.com/0xsequence/go-sequence/multicall3` 或 `github.com/onflow/flow-go-sdk/.../multicall`；最终选最小依赖的；执行时定 |
| 2026-05-14 | **C2 复述：用户明确指定 `0xsequence/go-sequence/multicall3`** | 用户消息（Phase 6 执行期补充） |
| 2026-05-14 | **C2 工程暂态**：保留手写 wrapper，未切到 0xsequence | 子包确切路径多个候选；当前手写版与 0xsequence 同 ABI；切换工作 = 1 个文件替换 + go mod tidy，已加切换指南到 `multicall/multicall3.go` 头注释 |
| 2026-05-14 | **C3: `internal/eip7702/` 物理搬迁到 `relay/internal/sponsored/`**，逻辑保留改名 | 用户授权由我定；relay 内核就是 EIP-7702 模式（A 签 + B 付 gas），但包/类型名不含 eip7702 字眼 |
| 2026-05-14 | **relay 上链路径明确**：`A 私钥签授权/意图 → B 付 gas → 提交` | 用户原话："传入 ctx + A 私钥，达成 A 签名触发 C 合约，B 帮 A 付 gas，然后发送上链" |
| 2026-05-14 | **C4: 可以重构 multisig 等保留模块的调用点** | 用户授权 |
| 2026-05-14 | **C5: 执行模式 = b（一气呵成跑完整批，结束后整批审阅）** | 用户选 b；无 checkpoint |
| 2026-05-14 | **不提交代码、不写 commit**；工作树状态由用户审阅时手动处理 | 用户明确 |
| 2026-05-14 | **激进删除：multisig 子系统全部删** | 新 SDK 无 `sdk/multisig` 子包，子系统在新 SDK 下无法工作；用户原话"老的没用的方法直接去掉" |
| 2026-05-14 | 重构完成后追加：写 README + 调用示例（给后端同学引用包看） | 用户明确 |
| 2026-05-14 | **事件失效启用** — 不能只靠 TTL 兜底（不然 admin 改值后要重启服务） | 用户拍板 |
| 2026-05-14 | **事件失效用 HTTP poll**（无 ws 端点）—— 复用老项目 `watcher/` 模式（`FilterLogs` + ticker） | 用户确认无 ws，老项目本就 HTTP-only |

---

## 遇到的错误

| 错误 | 阶段 | 解决 |
|------|------|------|
| — | — | — |

---

## 安全提示（来自 planning skill）

- `task_plan.md` 会被 hook 每次工具调用前重读 → 不要把外部网页/SDK 源码片段写进这里，只写「目标/阶段/决策」。
- 外部内容（SDK 接口定义、签名、源码摘录）只写到 `findings.md`。
