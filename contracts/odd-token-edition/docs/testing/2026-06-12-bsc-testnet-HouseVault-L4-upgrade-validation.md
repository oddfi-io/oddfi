# 2026-06-12 BSC Testnet HouseVault L4 升级验收报告

## 1. 结论

- 结论：通过。
- 网络：BNB Smart Chain Testnet，chainId `97`。
- 范围：保持 `HouseVault / BettingPool` proxy 不变，升级 implementation，发布 `HouseVault.fundBettingPlatformReserve` 并允许 `ODDToken.fixedSources().houseVault` 调用 `BettingPool.addPlatformReserve`。
- 核心验证：真实链上 tx `0x8c1c1d50283772c1d42d5b3de7291fd2f1822da23b1469047bba680faa0a21f3` 已确认 `platformReserve / accountedBalance / BettingPool ODD balance` 同步增加 `1 ODD`，且 HouseVault 对 BettingPool allowance 归零。
- 追加验证：真实链上 tx `0x48f6f0314aeb3460b42448f1f983806291bd298ffd6859f4e531d5a3f7952ebf` 已完成 HouseVault 向 BettingPool L4 `platformReserve` 注资 `10,000,000 ODD`，链上余额与账本同步增加，allowance 归零。

## 2. 发布记录

| 项 | 地址 / 交易 |
|---|---|
| `HouseVault` proxy | `0x41e87F99f1a3dBDb09A337AEf4C4841d90b5d280` |
| `HouseVault` implementation before | `0x1D659e3fa19c2d77dA22BCbccB409179AE86F936` |
| `HouseVault` implementation after | `0x7e12549BC39B25B1Df4034abEDB9a0109E700128` |
| `HouseVault` implementation deploy tx | `0x1660a90066d182dfdf889a032fc2ee1de59b57ed7f6373480e06e7e3e0be504d` |
| `HouseVault` upgrade tx | `0x1f09745b8058c3c6c683ce0108b487d3e68303ce9b0ef4fb3a4a64e7451b08ec` |
| `BettingPool` proxy | `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3` |
| `BettingPool` implementation before | `0x7769b3C7D2C53B3e31B33c280F77a7Fb3D85f01D` |
| `BettingPool` implementation after | `0x3a4845AAdDf529dd3Ee8F073EA7dE9e565df56DA` |
| `BettingPool` implementation deploy tx | `0x21d42994afa16e7409ed5f1a106562db4883bacfc64c867aee85600d6d8e5777` |
| `BettingPool` upgrade tx | `0x67e4949ff03aa47baa61f5d2cea0bc5dcb5f426af27e5a0127ea8077f5300ddf` |
| L4 注资 tx | `0x8c1c1d50283772c1d42d5b3de7291fd2f1822da23b1469047bba680faa0a21f3` |

## 3. L4 账本验证

| 检查项 | Before | After |
|---|---:|---:|
| 注资金额 | - | `1000000000000000000` |
| `BettingPool.platformReserve()` | `1000014000000000000000000` | `1000015000000000000000000` |
| `BettingPool.accountedBalance()` | `999600000000000000000000` | `999601000000000000000000` |
| `ODD.balanceOf(BettingPool)` | `999600000000000000000000` | `999601000000000000000000` |
| `ODD.allowance(HouseVault, BettingPool)` | `0` | `0` |

### 3.1 10M Top-up 验证

| 检查项 | Before | After |
|---|---:|---:|
| 注资金额 | - | `10000000000000000000000000` |
| `ODD.balanceOf(HouseVault)` | `24999999000000000000000000` | `14999999000000000000000000` |
| `BettingPool.platformReserve()` | `1000021000000000000000000` | `11000021000000000000000000` |
| `BettingPool.accountedBalance()` | `999442400000000000000000` | `10999442400000000000000000` |
| `ODD.balanceOf(BettingPool)` | `999442400000000000000000` | `10999442400000000000000000` |
| `ODD.allowance(HouseVault, BettingPool)` | - | `0` |

交易信息：

- tx：`0x48f6f0314aeb3460b42448f1f983806291bd298ffd6859f4e531d5a3f7952ebf`
- block：`112899980`
- gasUsed：`129794`

## 4. 源码验证

- `HouseVault` implementation `0x7e12549BC39B25B1Df4034abEDB9a0109E700128`：BscScan Testnet verified。
- `BettingPool` implementation `0x3a4845AAdDf529dd3Ee8F073EA7dE9e565df56DA`：BscScan Testnet verified。
- 首次 `forge script --verify` 使用旧 BscScan V1 endpoint 被拒绝；随后使用 Etherscan API V2 `chainid=97` 成功验证。
- V2 `getsourcecode` 复查：`HouseVault` 返回 `ContractName=HouseVault` 且 `SourceCode/ABI` 非空；`BettingPool` 返回 `ContractName=BettingPool` 且 `SourceCode/ABI` 非空。

## 5. 验收命令

| 命令 / 脚本 | 结果 |
|---|---|
| `forge build --skip test` | 通过，仅有既有 lint warning |
| `forge test --match-path test/OddMvpSupportContracts.t.sol --match-test testHouseVaultFundsBettingPlatformReserveAsL4 -vv` | 1/1 通过 |
| `forge test --no-match-path 'test/ForkMainnet*' -vv` | 97/97 通过 |
| `RPC_URL=<redacted> npm --prefix skills run healthcheck` | 通过，链上 implementation slot 含 `HOUSE_VAULT` 均匹配 |
| `npm --prefix skills run typecheck` | 通过 |
| `jq empty skills/assets/*.abi.json docs/deployment/bsc-testnet-current.json skills/references/contracts.json` | 通过 |
| `forge fmt --check` | 通过 |
| `git diff --check` | 通过 |

## 6. 真实链上回归

### 6.1 Upgrade + L4

`script/BscTestnetHouseVaultL4Upgrade.s.sol:BscTestnetHouseVaultL4Upgrade`：

- 部署并升级 `HouseVault / BettingPool` implementation。
- 调用 `HouseVault.fundBettingPlatformReserve(BettingPool, 1 ODD)`。
- 脚本内断言 implementation slot、`platformReserve`、`accountedBalance`、BettingPool 余额和 allowance 均满足预期。

### 6.2 Forge Smoke

`script/BscTestnetSmoke.s.sol:BscTestnetSmoke` 真实链上通过：

- stake position：`4`
- LP position：`3`
- marketId：`0x442a8db212dc7ae4f5e856b97d384dfbc9fba96e1b1402821cadbb163ab8e150`
- betId：`0x0000000000000000000000000000000000000000000000000000000000000003`
- 覆盖：ODD approve、Staking stake、Liquidity depositGlobal、Betting openMarket、Betting placeBet。

### 6.3 TypeScript Scenario

`npm --prefix skills run scenario` 真实链上最终通过：

| 动作 | 交易 |
|---|---|
| 普通转账 | `0x4f79d962118f167e49c557c252b9a08169800e82d4150f572d12a3754cbdfd11` |
| stake | `0x9b99c6bb12bb5218a956d0c0b2ba7dfd40b32b019e04b28495cfc8c89e8f1162` |
| depositGlobal | `0x31e6a228acf32fd2935d6b640c5f0c7cd77fe28f859dc565954b69bd42d70e3a` |
| openMarket | `0x4d09dc5f5615c16eb8120af2171eb8cd6f19919fcbb990181e6df0c251de763c` |
| placeBet | `0x8f5359751962ecda33d7e4b05575eab01da02edecffc7bfbf1d6a47af606fba9` |
| settleMarketBetsByScore | `0x55ce0490e79b24c4305def978ba5e434ab481ef767bffacfedf2177b3f2e6675` |
| finalizeMarketSettlement | `0xc3ca0ceba47d95f7a1db8f2c490bd0f8f06453236888fb6710780b89f5eab141` |
| claimPayout | `0x12029b805d46ede608a22b7058f2fa017a4c6a3304c7acc6f6a2cf741e4f00a6` |

场景覆盖：普通 ODD 转账无税、质押、Global LP 入金、开盘、下注、比分结算、finalize、胜单 claim。

## 7. 备注

- `script/BscTestnetScenarios.s.sol` 多账户批量 broadcast 遇到 Foundry nonce 缓存问题，链上确认未产生业务状态变化；本次回归改用逐笔发送的 `skills/script/scenario-smoke.ts` 完成。
- `skills/script/scenario-smoke.ts` 的末尾汇总原先读取旧 ABI getter `getPoolStatus / getUserPositionCount`，本次已改为可选读取；业务交易路径在修复前后均已链上成功。
- 本文不记录私钥、RPC token 或验证 key。
