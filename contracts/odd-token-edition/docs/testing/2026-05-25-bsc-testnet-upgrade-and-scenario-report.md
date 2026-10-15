# 2026-05-25 BSC Testnet 原址升级与场景测试记录

**状态：** 通过  
**链：** BSC Testnet, chainId `97`  
**目标：** 保留现有 UUPS proxy 地址，只部署/升级 implementation、library 与 `BettingSettlementModule`，并跑通本地全量场景测试。

## 1. 执行结论

- 已清理 Foundry `out/`、`cache/` 后重新构建并部署；
- 未重新部署 `ODDToken / StakingPool / LiquidityPool / BettingPool` proxy；
- 四个 proxy 的 ERC1967 implementation slot 已升级到新 implementation；
- `BettingPool.settlementModule()` 已切换到新的 `BettingSettlementModule`；
- `BettingPool.setReferralSwapConfig(...)` 已配置为 Pancake V3 router 与 BSC USDT；
- 本次部署的 library、implementation 与 settlement module 均已通过 Etherscan API V2 `chainid=97` 验证；
- 部署后已跑通本地 fork-free、fork-only 与全量测试。

## 2. 当前 proxy 地址

| 合约 | Proxy |
|---|---|
| `ODDToken` | `0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C` |
| `StakingPool` | `0x65fd4A2529010693BA474d1993631e305a42E061` |
| `LiquidityPool` | `0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f` |
| `BettingPool` | `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F` |

## 3. 新 implementation 与 module

| 合约 | 新地址 | 上一个地址 |
|---|---|---|
| `ODDToken` implementation | `0x34de1Eee88D0AA158f407483750a7eE5a3ebB464` | `0xfaeFbF5261cedb41c418E403b0E95464d7CcCE67` |
| `StakingPool` implementation | `0xD02C8dDFF9262BFA96F89f28BF0B348CB7Ca0ECc` | `0x1482f33D101487fD3320165baa11ef0817c4c861` |
| `LiquidityPool` implementation | `0xb4Ba651231B38b12F1B47AB0d7e03545b89BAEd4` | `0xB92acb2CD02fF05cac90Cb24d7166e14AAcDE435` |
| `BettingPool` implementation | `0x99Fb47E5402de75B4a40028E69111a91D3B798F4` | `0xC582c2d494653436C8647BA7760dAd9B06585Ff6` |
| `BettingSettlementModule` | `0x61c94cC6927da260Bc398eDF5BE680e87dfab14a` | `0x742D8a6e7dD0bf97E57E57B37D288b4FfB1e8924` |

## 4. Library 地址

| Library | 地址 | 验证状态 |
|---|---|---|
| `BettingOddsLib` | `0xF1Bed90936260E4E7d760724cD9E03Ab4fF09089` | 已验证 |
| `BettingValidationLib` | `0x9300c4674961ab27abdAC981AB4B845a60008b54` | 已验证 |
| `BettingReferralLib` | `0x18E1345138741AEf685d4d973a9FBa2697BBDB47` | 已验证，复用 Foundry 确定性 library 地址 |

## 5. 关键交易

| 操作 | 交易 |
|---|---|
| 部署 `BettingOddsLib` | `0x1e63a24074637bee4b66017467c122dcd063de1e54d129a65254f4e9a7ef2557` |
| 部署 `BettingValidationLib` | `0xe62b1b6193b0da8a502bfd436382295498f31ba200dd62d322dc48fd15308cbe` |
| 部署 `ODDToken` implementation | `0x678c1c3b2c896e00279024f64ba11dab60a3210978f6d054842bf9721f21ee90` |
| 部署 `StakingPool` implementation | `0x17c1068f7f637f58068d12e3c82b47ff459e6b281a6fd8f0bb6844e4116916f8` |
| 部署 `LiquidityPool` implementation | `0x781500a92cc2026819bc5636cb7d07fc3a400e68c75d59c69f36364ba53b1f17` |
| 部署 `BettingPool` implementation | `0x573e288f323d279929e62ba241c727ed463ab3cb834d01524ea6fdd6c592a1e2` |
| 部署 `BettingSettlementModule` | `0x3fdb38c6d415f4d01e918e50db0dce90fc0423b61c8c1200ec2f0ea4679e3f2f` |
| 升级 `ODDToken` proxy | `0x7ed25ebb3778acaa7ce1a450a9943c53e850628096d70aef7d59fd09495b5558` |
| 升级 `StakingPool` proxy | `0x3a809e983ad1f558cc57a091b6c313fd06e480cef1d8ebc4488320aa2dd9b56b` |
| 升级 `LiquidityPool` proxy | `0x203ff184c6cec86eff745177666ad57ce09da9b6c5216cff16f96bd3b1e67baf` |
| 升级 `BettingPool` proxy | `0x4e35016ccf608c981eb0e6d9e9cab4494e0c2666e8eb718765ea070e8f4f7b96` |
| 设置 `BettingSettlementModule` | `0x682aadf953050ba6bfceb96814c37bc0a897d88d5f22067f4d90b600f53d2a64` |
| 设置推荐奖励 USDT 兑换配置 | `0x1f584dce85236b7c1e17281c20edd611568dd2900cc8b8f16db931f4a3e55a48` |

## 6. 本地场景测试

| 命令 | 结果 |
|---|---|
| `forge build --force --no-cache --skip test` | 通过 |
| `forge test --offline --no-match-path 'test/Fork*' -vv` | 26 passed, 0 failed |
| `MAINNET_FORK_RPC_URL=<BSC_MAINNET_RPC_URL> forge test --match-path 'test/Fork*' -vv` | 37 passed, 0 failed |
| `MAINNET_FORK_RPC_URL=<BSC_MAINNET_RPC_URL> forge test -vv` | 63 passed, 0 failed |

## 7. 备注

- 本次 Foundry 自动验证首次使用旧 BscScan V1 endpoint 时失败，原因是 BscScan 已要求统一使用 Etherscan API V2；随后使用 V2 endpoint 与 `chainid=97` 已完成验证；
- `docs/deployment/bsc-testnet-current.json` 是当前 BSC Testnet 地址、交易、验证与测试结果的机器可读记录；
- `PrecisionConstants.SECONDS_PER_DAY` 当前仍为测试网加速值 `3600`，锁仓 plan 数字在该测试网版本下按小时理解。
