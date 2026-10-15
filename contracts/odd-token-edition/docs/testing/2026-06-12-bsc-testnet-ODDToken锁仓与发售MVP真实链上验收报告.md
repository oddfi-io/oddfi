# 2026-06-12 BSC Testnet ODDToken 锁仓与发售 MVP 真实链上验收报告

## 1. 执行结论

- 网络：BNB Smart Chain Testnet，chainId `97`
- 执行口径：真实链上交易；本报告不使用 fork 模拟或本地模拟作为验收依据。
- 部署结论：ODDToken 锁仓与发售 MVP 已全量新部署，初始部署合约均已通过 BscScan Testnet 源码验证。
- 验收结论：发售、DEX V3 建池、LP NFT 锁定、三类来源质押、普通下注、推荐 ODD/USDT、Cash Out、串关、结算、claim、流动性添加和 requestUnbond 均已在真实链上跑通。

剩余等待项不是功能失败：

- 成熟质押正常提现需等 stake `unlockAt` 到期后再执行；
- LP position `2` 已进入 `Unbonding`，`previewWithdraw=1000 ODD`、`netPnL=0`，最终 `withdraw` 需等 unbond epoch 到期。

## 2. 当前地址

| 合约 | 地址 |
|---|---|
| `ODDToken` proxy | `0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0` |
| `StakingPool` proxy | `0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F` |
| `LiquidityPool` proxy | `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50` |
| `BettingPool` proxy | `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3` |
| `TierSale` proxy | `0xBe938fB7AF656B111a123B749bB724d8351497C7` |
| `HouseVault` proxy | `0x41e87F99f1a3dBDb09A337AEf4C4841d90b5d280` |
| `DexLaunchController` proxy | `0x070f72Fda6eAa8335162A5A5629Fb12f9f8b6d54` |
| `DexLpLocker` proxy | `0xC30d6407df0E7291dbE8A58A2c44808C92AFD3a9` |
| `EcosystemRewards` proxy | `0x6c5352D01160E50C50b66dD61BD3d48Ff6B4E2ac` |
| `BettingReferralModule` current | `0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B` |
| `BettingReferralLib` current | `0x41492e7D1fFa49bF0C9cf2eED8A1D134c0E6c44e` |

## 3. 实链修复记录

实链执行 `claimUSDTReferralRewards` 时发现 Pancake V3 SwapRouter on BSC Testnet 使用的 `exactInputSingle` 参数包含 `deadline` 字段，旧接口 selector 不匹配。

已完成修复：

- `IPancakeV3SwapRouterLike.ExactInputSingleParams` 增加 `deadline`；
- `BettingReferralLib.executeUsdtSwap` 传入 `deadline: block.timestamp`；
- 重新部署并验证 `BettingReferralLib` 与 `BettingReferralModule`；
- 通过 `BettingPool.setReferralModule` 切换到新模块，tx `0xdc14f4237c160638f0d5b34c059774631dfadd0951064e7fdb9e21c8dd431535`。

## 4. 场景验收

| 场景 | 结果 | 关键链上证据 |
|---|---|---|
| Token 初始化与固定来源 | 通过 | `initialSupplyAllocated=true`，`fixedSourcesConfigured=true`，`Staking/Liquidity/Betting` 白名单均为 `true` |
| TierSale 购买与 launch approve | 通过 | `totalSold=1000 ODD`，`forceFinalized=true`，`launchApproval.approved=true` |
| Pancake V3 建池与 LP 锁定 | 通过 | pool `0x7c6b58a4FF7D3E4cFF3F7C61C6F3DbDdB748bF36`，LP tokenId `35590`，locker unlockAt `1812776838` |
| Sale source 质押 | 通过 | staking position `1` 创建并 earlyUnstake，position `active=false` |
| Reward source 质押 | 通过 | staking position `2` 创建并 earlyUnstake，position `active=false` |
| Manual transferable source 质押 | 通过 | staking position `3` 创建并 earlyUnstake，position `active=false` |
| Global LP 添加 | 通过 | liquidity position `1` active，principal `1000 ODD` |
| Match LP 添加与解绑请求 | 通过 | deposit tx `0x357dadd470f8e741bf0190288ad5036a69ec2a80d972d3aed2da22c86420209e`，requestUnbond tx `0xda2be70e4c664402db333eb8e1b903b51ea36c209604ec23de950cb0785d2fa8` |
| 普通下注 | 通过 | placeBet tx `0x4aa069c4acd9de78a74696e8a0ed5cb232563535cfeafd01529c7329f23e77e6`，betId `0x0000000000000000000000000000000000000000000000000000000000000001` |
| 普通下注 USDT 推荐领奖 | 通过 | claim tx `0x95883add5c99cba880318a10cfff1e89b6799a5596a114d0ec64edda4f246a1f`，referrer USDT 收到 `9965059852796835` wei |
| 普通下注结算与 claim | 通过 | settle tx `0x04256572e0fb4500aaf6ef4a9d690034048e2940bac566c6a9b40bd6e84bb791`，finalize tx `0xcc4d16dc5487ffd63fa04fc93e4b0b4b1232021b6f89ae6edd2178e790d5d2b7`，claim tx `0xb48d22013bcacbe23d08dec7494feccc0f6c523afeababd739be1de9a5c43d4c` |
| Cash Out | 通过 | placeBet tx `0xd231a11c0ba191b3887b19c75893a4607032019ddaaaa2f30f6a76729408c936`，cashOut tx `0xbe32adf5b28d96057433e907d9f62d6aed919ca72400e2c55ca016d3b5525cfb` |
| ODD 推荐领奖 | 通过 | cashout 后 claim tx `0xe060317aab606cca4efc07b4771a8200e199d76dd4b99986c7508fc1fdd77041`；串关后剩余奖励 claim tx `0x78e6f223a8d5d93465eb0a46c7a0774806bc70dae23170a55978d56b7f76a2d3` |
| 串关下注、结算与 claim | 通过 | place tx `0x8933fd4c4ca2b39b9c24f4d64906e976d33c5babef2eb682a6396a9aa425927a`，settle tx `0xf77037e1b58ccbcacb58c398e2fd6afff421efa56197ddeadab88d115eef6ecf`，claim tx `0x7da8a4ba731e84c4be4065c2c8e973c576f73fb127bf8f3c1564fbca0f9cd47b` |

说明：人工补充领取串关推荐奖励时，曾按旧无参口径误发一次 `claimReferralRewards()` 交易，链上 receipt 为失败且无日志；随后使用当前 ABI `claimReferralRewards(uint256)` 按 `2e18` 精确领取成功。最终链上 `referrerRewardsOdd=0`、`referralClaimNonces=3`。

## 5. 最终状态抽样

- `BettingPool.referralModule()` = `0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B`
- `BettingPool.nextBetNonce()` = `3`
- `BettingPool.nextParlayNonce()` = `2`
- 普通注单 `getClaimStatus(bettor, betId)` = `true, 0`
- 串关注单 `getParlayClaimStatus(parlayUser, parlayId)` = `true, 0`
- `LiquidityPool.getPositionState(2)` = `1`，即 `Unbonding`
- `LiquidityPool.previewWithdraw(2)` = `1000000000000000000000, 0, 1`
- referrer ODD balance = `3 ODD`，USDT balance 增加 `9965059852796835` wei

## 6. 文档与工具同步

- `docs/development/api.md` 已同步当前 BSC Testnet 地址与 referral module 修复说明；
- `docs/deployment/bsc-testnet-current.json` 已重写为当前部署快照；
- `skills/assets/*.abi.json` 已从当前 Foundry artifacts 重新导出；
- `skills/script/config.ts` 与 `skills/references/contracts.json` 已同步当前地址；
- 本报告不记录任何私钥或 RPC secret。
