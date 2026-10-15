# EcosystemRewards.ClaimCalldata — sponsored referral payout adaptation

Date: 2026-06-22
Status: implemented

## 背景

后端 DD-148「返佣 ODD 链上发放」需要代「邀请人 EOA」调用
`EcosystemRewards.claim(uint256 claimId)`。该 EOA 是 EIP-7702 托管账户、无 BNB，
必须走 **sponsored 7702 execute**（relay 持有 sponsor key 付 gas，用户对 inner call
做 SignDigest 签名）。承载 sponsored 提交的 relay 原语位于上层仓库
`contracts-business-layer`（后端的直接依赖，`relay.Client` + `internal/eip7702`），
**不在本仓 `oddfi-ODD-SDK`**。

后端 SDK-SPEC 原文：
`/Users/hang/work/oddfi-backend/.claude/worktrees/dd-148/web-api/docs/dd-148-referral-payout-onchain/SDK-SPEC-ecosystemrewards-claim.md`

## 范围

本仓 `oddfi-ODD-SDK`（ABI 绑定层，被 `contracts-business-layer` 间接依赖）只负责
暴露 relay 7702 inner call 所需的 **raw calldata 原语**：

- 公开 API 新增 `pkg/oddfi.EcosystemRewards.ClaimCalldata(claimID *big.Int) ([]byte, error)`。
- 基础设施新增 `internal/infrastructure/contracts.EcosystemRewardsAdapter.ClaimCalldata`。

不在本仓范围（属于 `contracts-business-layer`，SDK-SPEC 的 #2/#3）：
`RelayConfig.EcosystemRewards`、`business.RelayClients` 装配、
`relay.Client.ClaimEcosystemReward(ctx, req)`。本仓按 AGENTS.md §4.4 设计**不托管私钥、
不广播交易**，relay 提交不可能也不应落在此层。

`createClaimable` 同样不进 SDK：发放方持 `REWARD_DISTRIBUTOR_ROLE`、普通 EOA 自付 gas，
后端用 go-ethereum 裸签直发。

## 合约事实（BSC mainnet，已部署，勿改）

- 代理地址：`0x71f0C250e8f9cE43626822dE118bC07FBb72CDA4`
- `function claim(uint256 claimId) external nonReentrant whenNotPaused`，要求
  `msg.sender == claimable.user`，否则 revert `ClaimableNotOwner`；已领/取消 → `ClaimableAlreadyClosed`。
- 选择器：`keccak256("claim(uint256)")[:4]`。

## API 变更面

新增公开导出符号（仅追加，不破坏向后兼容；`v0.x` 期间，非 BREAKING）：

```go
// ClaimCalldata returns ABI-encoded calldata for EcosystemRewards.claim; does not
// sign, broadcast, or query RPC. Usable as the data field of an EIP-7702 inner call.
// A nil claimID returns a *UserError carrying ErrNilBigIntParam.
func (p *EcosystemRewards) ClaimCalldata(claimID *big.Int) ([]byte, error)
```

实现完全对齐既有 `TierSale.BuyCalldata` 先例：
- 复用 abigen 的 `EcosystemRewardsMetaData` ABI（同一份元数据同时支撑
  `bind.TransactOpts` 写方法与 calldata 方法，杜绝 selector drift）。
- nil 接收者 → `*ConfigError` + `ErrMissingEcosystemRewards`。
- nil `claimID` → `*UserError` + `ErrNilBigIntParam`。
- adapter `abi.Pack` 失败 → `*UserError`（防御性，正常类型路径不可达）。
- 只读 client（无 transactor）可用。

## 测试计划

- 单测 `pkg/oddfi/ecosystemrewards_calldata_test.go`：
  - selector 正确性（与 `keccak256("claim(uint256)")[:4]` 比对）。
  - nil 接收者 → `ConfigError`/`ErrMissingEcosystemRewards`。
  - nil `claimID` → `UserError`/`ErrNilBigIntParam`。
  - 编码确定性（同输入两次字节相同）。
- `ExampleEcosystemRewards_ClaimCalldata`（CI 编译运行）。
- 已本地验证：`go build ./...`、`go vet`、`go test -race -count=1 ./pkg/oddfi/ ./internal/infrastructure/contracts/` 全绿。
- `golangci-lint` / `govulncheck` 本地未安装，交由 CI 执行。

## 迁移指引

纯新增方法，无迁移负担。`contracts-business-layer` 的 relay 客户端可
`import "github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"` 并调用
`client.EcosystemRewards().ClaimCalldata(claimID)` 取得 inner call 的 `data` 字段，
再封进 sponsored 7702 execute。

## 回滚方案

删除新增的 `ClaimCalldata`（adapter + facade）、对应测试、Example、CHANGELOG 条目即可，
不影响其他符号；ABI 元数据为既有共享变量，无需回退。
