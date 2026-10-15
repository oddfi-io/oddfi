# contracts/abi

存放 **oddfi 合约编译产物的原始 ABI artifact**（`.abi.json` / `.bin`），作为 `abigen` 生成 Go 绑定的输入。

## 强制规则

- **禁止手工编辑** 任何 artifact 文件；只能由合约仓库的编译流程产出后整体替换。
- **每次更新 artifact 必须同步更新本 README 的 [来源清单](#来源清单)**：记录合约仓库、commit hash、solc 版本、编译命令、抓取日期；任一缺失即视为不完整，禁止合并。
- **artifact 与 Go 绑定一一对应**：放入 / 替换 artifact 后，必须在 `/internal/infrastructure/bindings/gen.go` 添加或更新对应 `go generate` 指令并重跑生成；CI 须校验 `git diff --exit-code` 防止生成产物与源不一致。
- **不得 import 此目录到 Go 代码**：仅作为生成工具的输入；运行时数据不得从此目录读取。
- **代理合约说明**：当前已接入合约均为 UUPS 可升级实现；ABI 对应实现合约（implementation），SDK 调用方必须使用代理合约（proxy）地址，且需关注实现升级（监听 `Upgraded(address)` 事件并在 release note 中通报兼容性影响）。

## 命名

按合约名取文件名，与 Solidity 中 `contract Foo {}` 一一对应；扩展名固定 `.abi.json`：

```
BettingPool.abi.json
BettingParlayLens.abi.json
BettingParlayModule.abi.json
BettingSettlementModule.abi.json
LiquidityPool.abi.json
ODDToken.abi.json
StakingPool.abi.json
```

如未来新增合约，沿用相同规则；同一合约升级版本仅替换文件，**不得**追加 `Foo_v2.abi.json` 等版本后缀（版本管理通过 git history + 来源清单的 commit 字段追溯）。

## 生成 Go 绑定

入口在 `/internal/infrastructure/bindings/gen.go`，例：

```go
//go:generate abigen --abi ../../../contracts/abi/BettingPool.abi.json --pkg bettingpool --type BettingPool --out bettingpool/bettingpool.go
//go:generate abigen --abi ../../../contracts/abi/BettingParlayLens.abi.json --pkg bettingparlaylens --type BettingParlayLens --out bettingparlaylens/bettingparlaylens.go
//go:generate abigen --abi ../../../contracts/abi/BettingParlayModule.abi.json --pkg bettingparlaymodule --type BettingParlayModule --out bettingparlaymodule/bettingparlaymodule.go
//go:generate abigen --abi ../../../contracts/abi/BettingSettlementModule.abi.json --pkg bettingsettlementmodule --type BettingSettlementModule --out bettingsettlementmodule/bettingsettlementmodule.go
//go:generate abigen --abi ../../../contracts/abi/LiquidityPool.abi.json --pkg liquiditypool --type LiquidityPool --out liquiditypool/liquiditypool.go
//go:generate abigen --abi ../../../contracts/abi/ODDToken.abi.json --pkg oddtoken --type ODDToken --out oddtoken/oddtoken.go
//go:generate abigen --abi ../../../contracts/abi/StakingPool.abi.json --pkg stakingpool --type StakingPool --out stakingpool/stakingpool.go
```

执行：

```bash
go generate ./internal/infrastructure/bindings/...
```

> abigen 版本须与 go-ethereum 主线版本一致；版本号在根 `Makefile` / CI 中显式钉死，禁止隐式继承本机环境。

## 当前合约清单

| 文件 | 合约 | 角色 / 类型 | 函数（view+pure / write） | 事件 | 自定义错误 | 升级模式 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `BettingPool.abi.json` | `BettingPool` | 博彩池：开 / 结 / 退市、下注、组合下注、派彩、推荐奖励 | 84 (48 / 36) | 33 | 24 | UUPS | AccessControl (`DEFAULT_ADMIN_ROLE`) |
| `BettingParlayLens.abi.json` | `BettingParlayLens` | 组合下注只读预览 / 估值辅助 lens | 2 (2 / 0) | 0 | 10 | none | none |
| `BettingParlayModule.abi.json` | `BettingParlayModule` | BettingPool 组合下注 delegatecall 模块 | 43 (37 / 6) | 32 | 25 | module | AccessControl (`DEFAULT_ADMIN_ROLE`) |
| `BettingSettlementModule.abi.json` | `BettingSettlementModule` | BettingPool 结算 / 派彩 / 退款 delegatecall 模块 | 47 (37 / 10) | 32 | 21 | module | AccessControl (`DEFAULT_ADMIN_ROLE`) |
| `LiquidityPool.abi.json` | `LiquidityPool` | 流动性池：全局 / 单赛事入池、解锁、亏损 / 抽水分配 | 50 (27 / 23) | 25 | 24 | UUPS | AccessControl (`DEFAULT_ADMIN_ROLE`) |
| `ODDToken.abi.json` | `ODDToken` | 平台代币（ERC-20 + 暂停 + 可升级） | 23 (13 / 10) | 10 | 19 | UUPS | AccessControl (`DEFAULT_ADMIN_ROLE`) |
| `StakingPool.abi.json` | `StakingPool` | 质押 / VIP 等级 / 奖励通知 / 提前解押 | 37 (21 / 16) | 18 | 21 | UUPS | AccessControl (`DEFAULT_ADMIN_ROLE`) |

依赖关系（来自 setter / getter）：

- `BettingPool` ↔ `LiquidityPool`：`LiquidityPool.setBettingPool(...)` / `BettingPool.setBettingDependencies(...)`
- `BettingPool` ↔ `StakingPool`：`StakingPool.setBettingPool(...)`
- `BettingPool` ↔ `Settlement` / `Parlay` / `Risk` 模块：`setSettlementModule`、`setParlayModule`、`setRiskConfig`（模块 ABI 生成 internal binding；SDK 暂不作为独立公共入口 wrap）

## 来源清单

> 每次更新 ABI 必须维护下表。下列条目从合约仓库一次性导入，**所有 TODO 字段必须在 `v0.1.0` 发布前由维护者补齐**，否则视为违反 `AGENTS.md` 第 3 节强制约束。

| 文件 | 合约仓库 | commit | solc | 编译命令 | 抓取日期 |
| --- | --- | --- | --- | --- | --- |
| `BettingPool.abi.json` | _TODO_ | _TODO_ | _TODO_ | _TODO_ | 2026-05-07 |
| `BettingParlayLens.abi.json` | _TODO_ | _TODO_ | _TODO_ | _TODO_ | 2026-06-07 |
| `BettingParlayModule.abi.json` | _TODO_ | _TODO_ | _TODO_ | _TODO_ | 2026-06-07 |
| `BettingSettlementModule.abi.json` | _TODO_ | _TODO_ | _TODO_ | _TODO_ | 2026-06-07 |
| `LiquidityPool.abi.json` | _TODO_ | _TODO_ | _TODO_ | _TODO_ | 2026-05-07 |
| `ODDToken.abi.json` | _TODO_ | _TODO_ | _TODO_ | _TODO_ | 2026-05-07 |
| `StakingPool.abi.json` | _TODO_ | _TODO_ | _TODO_ | _TODO_ | 2026-05-07 |

## 校验

每次替换 artifact 后必须本地至少跑一次：

```bash
# 1. 重新生成绑定
go generate ./internal/infrastructure/bindings/...

# 2. 类型 / lint / 测试
go vet ./...
golangci-lint run
go test -race -count=1 ./...

# 3. API diff（若涉及公开 API）
# gorelease / apidiff …
```

CI 必须包含上述步骤；任一失败即阻断合并。
