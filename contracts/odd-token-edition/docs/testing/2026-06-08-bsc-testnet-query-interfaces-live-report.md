# 2026-06-08 BSC Testnet Query Interfaces Live Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- startBlock: `112189515`
- endBlock: `112191269`
- BettingSettlementModule: `0xc1df22382Bae9Ec85A39503236a4151bB5B6c49E`
- BettingParlayModule: `0x4d8C65378764A790cdD7A40dd9f7BC3Fb12D2c51`
- BettingParlayLens: `0x54A40Ac7806904048Cf5F972C017aC2e33fDD15e`
- singleBetId: `00000000000000000000000000000000000000000000000000000000000002c2`
- cashoutBetId: `00000000000000000000000000000000000000000000000000000000000002c3`
- parlayId: `7fe21ba684f2c10f12c826cfbf68e61b6f84ab3d02663cbe5471390cdacbbd92`
- lpPositionId: `64`
- stakePositionId: `30`

## Checks
- [PASS] `BETTING_SETTLEMENT_MODULE_CONFIGURED`: 0xc1df22382Bae9Ec85A39503236a4151bB5B6c49E
- [PASS] `BETTING_PARLAY_MODULE_CONFIGURED`: 0x4d8C65378764A790cdD7A40dd9f7BC3Fb12D2c51
- [PASS] `STAKE_CREATE_status`: status=1, tx=ba3c73fa5c9f8869fbd1f41232ee85da9c9cd0853a9698588587b6989e0a0514
- [PASS] `STAKER_ACTIVE_AFTER_STAKE`: 30
- [PASS] `STAKE_EARLY_UNSTAKE_status`: status=1, tx=e47f89e2b38a053720eb6fddc43f6c41d6cb30ce583a2712e5ec360241ab6b31
- [PASS] `STAKER_INACTIVE_AFTER_EARLY_UNSTAKE`: 30
- [PASS] `OPEN_SINGLE_MARKET_status`: status=1, tx=f7b86934b088f0bdcc983f57df23df1635f31e23c0e3c40879b04e0363f3290a
- [PASS] `LP_DEPOSIT_MATCH_status`: status=1, tx=f5fb64b4124d9e625eeb904fddf923c89d6d9ea329492d5ab16fdf6b1f3f30b5
- [PASS] `PLACE_SINGLE_BET_status`: status=1, tx=715a1454290d1695f7d17ec5a6195fdba54cde595483a6e5df5230649d3388d1
- [PASS] `ESTIMATE_BET_VALUE_PENDING`: estimated=100000000000000000000, pnl=0
- [PASS] `ESTIMATE_BET_VALUE_WRONG_USER_ZERO`: estimated=0, pnl=0
- [PASS] `GET_CLAIM_STATUS_BEFORE_MATCH_END_REVERTS`: ContractCustomError
- [PASS] `OPEN_CASHOUT_MARKET_status`: status=1, tx=1efea84f020b653120d5a660d75c72b3a7c590703032c97b6350b942840f99a5
- [PASS] `PLACE_CASHOUT_BET_status`: status=1, tx=a8aa5093f0de059db57a6187d9c4841de945834c81862e7320938af2b18e7786
- [PASS] `CASH_OUT_status`: status=1, tx=2f47e9021729d9d795f4e0781091e1b13c78ea68fa54e134c89742d9c8a3220f
- [PASS] `CASHOUT_BET_STATE`: 5
- [PASS] `OPEN_PARLAY_MARKET_A_status`: status=1, tx=17d8b4d715742f79713d3b0ac9d98bf07fad1fc6c474c6fc920da9dee56a7a58
- [PASS] `OPEN_PARLAY_MARKET_B_status`: status=1, tx=0185b7cd4694d232501c3c9599ba08c7724067640dc404f642ea7bcd356822ee
- [PASS] `PLACE_PARLAY_status`: status=1, tx=489bb94ef2f7a30f8c1b0fb2b4983ea4fb5473cfd40a70ca602967985dbd8fe7
- [PASS] `ESTIMATE_PARLAY_VALUE_PENDING`: estimated=100000000000000000000, pnl=0
- [PASS] `ESTIMATE_PARLAY_VALUE_WRONG_USER_ZERO`: (0, 0, 0, 0, 0, 0, 0, 0, 0, False, False)
- [PASS] `GET_PARLAY_CLAIM_STATUS_BEFORE_MATCH_END_REVERTS`: ContractCustomError
- [PASS] `SINGLE_SETTLE_BETS_status`: status=1, tx=6482035190940daa378a3c3cb7f01fd9c7465956ef62325a600d7afb8412416c
- [PASS] `SINGLE_FINALIZE_status`: status=1, tx=ccf75841cebdc296b002fa999443cfd71da8ce7f1e6703f6087f4cc9a131eb7c
- [PASS] `GET_CLAIM_STATUS_WON_UNCLAIMED`: won=True, reward=190000000000000000000
- [PASS] `ESTIMATE_BET_VALUE_AFTER_SETTLE_REVERTS`: ContractCustomError
- [PASS] `CLAIM_SINGLE_PAYOUT_status`: status=1, tx=1f38de23d58e5f18509e46412c06efd0256afa65a4209e96d0962bf8aed80188
- [PASS] `GET_CLAIM_STATUS_AFTER_CLAIM_ZERO`: won=True, reward=0
- [PASS] `LP_REQUEST_UNBOND_MATCH_status`: status=1, tx=2edef17056d2e80867aa8d5581a238b7c36c698c5df6843e4fa81cc1d6c045f9
- [PASS] `LP_POSITION_UNBONDING`: 1
- [PASS] `PARLAY_A_SETTLE_BETS_status`: status=1, tx=704c579b83ad04775a255d5698401831220eccdb29cddb82ce9fcdfd97be9e6e
- [PASS] `PARLAY_A_FINALIZE_status`: status=1, tx=a0cceeb24986fb9043deffcce7fa65c97a3862c2051bc0555a4b39463c5f745e
- [PASS] `PARLAY_B_SETTLE_BETS_status`: status=1, tx=2d3429b605db6116ce5dbe04496210c0e2f1b87b621fc71d0ee1dd42c09a8f22
- [PASS] `PARLAY_B_FINALIZE_status`: status=1, tx=8190c084e1ce4cceef0b344b3a8d096f75a396d7d88ed1808250daf273881292
- [PASS] `ESTIMATE_PARLAY_VALUE_AFTER_LEGS_FINAL_BEFORE_SETTLE`: (0, 100000000000000000000, 40000, 400000000000000000000, 400000000000000000000, 300000000000000000000, 4000000000000000000, 2, 0, False, True)
- [PASS] `GET_PARLAY_CLAIM_STATUS_PENDING_ZERO`: won=False, reward=0
- [PASS] `SETTLE_PARLAY_status`: status=1, tx=aeb3386bf9671edc604331aad678df8f1d640d1e0246a4fe240050f5ee1222d6
- [PASS] `GET_PARLAY_CLAIM_STATUS_WON_UNCLAIMED`: won=True, reward=380000000000000000000
- [PASS] `ESTIMATE_PARLAY_VALUE_AFTER_SETTLE_REVERTS`: ContractCustomError
- [PASS] `CLAIM_PARLAY_PAYOUT_status`: status=1, tx=daf2acf63102caf8e49fc4eb2bad4f758171cd9961865cc16345d9c98a0afe50
- [PASS] `GET_PARLAY_CLAIM_STATUS_AFTER_CLAIM_ZERO`: won=True, reward=0

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,365,893.534883720930231999` | `98,365,909.534883720930231999` | `7.9271001223555412` | `7.9156602650555412` |
| `bettor` | `0xf947cE92b29AAd005fDF16948B3273Fb0A5Da96C` | `3,344` | `3,433` | `0.036146976` | `0.03549625` |
| `cashoutUser` | `0xB91C7B77514862e3C0F3116EC3949EdAb2bfbba5` | `2,794` | `2,773` | `0.035958282` | `0.035269782` |
| `parlayUser` | `0xcF7E784333d63D084C74577558e0563A831A2D0e` | `2,875` | `3,154` | `0.035712433` | `0.034761843` |
| `lpUser` | `0x79C8A5cDA3ec53D62a8f7452B2c7BCC482606A78` | `3,000` | `2,000` | `0.037373578` | `0.036908067` |
| `staker` | `0x0D76a8bF347c4F30D8478fa4925681d43cA42b9b` | `3,000` | `3,000` | `0.03767005` | `0.037344508` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `80,150.020000000000000001` | `79,852.020000000000000001` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `156,830.379463482746921` | `157,854.379463482746921` | `0` | `0` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `29,398.12` | `29,410.12` | `0` | `0` |

## Transactions
### TX-01 `STAKE_CREATE`
- sender: `staker` / `0x0D76a8bF347c4F30D8478fa4925681d43cA42b9b`
- tx_hash: `ba3c73fa5c9f8869fbd1f41232ee85da9c9cd0853a9698588587b6989e0a0514`
- status: `1`
- gas_used: `239419`
- tx_fee: `239419000000000` wei
- events: `StakingPool.StakeCreated, ODDToken.Transfer, StakingPool.StakeAccountingSnapshot`

### TX-02 `STAKE_EARLY_UNSTAKE`
- sender: `staker` / `0x0D76a8bF347c4F30D8478fa4925681d43cA42b9b`
- tx_hash: `e47f89e2b38a053720eb6fddc43f6c41d6cb30ce583a2712e5ec360241ab6b31`
- status: `1`
- gas_used: `86123`
- tx_fee: `86123000000000` wei
- events: `ODDToken.Transfer, StakingPool.StakeWithdrawn, StakingPool.StakeAccountingSnapshot`

### TX-03 `OPEN_SINGLE_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `f7b86934b088f0bdcc983f57df23df1635f31e23c0e3c40879b04e0363f3290a`
- status: `1`
- gas_used: `525091`
- tx_fee: `682618300000000` wei
- events: `LiquidityPool.MatchPoolOpened, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketOpened, BettingParlayModule.OddsUpdated`

### TX-04 `LP_DEPOSIT_MATCH`
- sender: `lpUser` / `0x79C8A5cDA3ec53D62a8f7452B2c7BCC482606A78`
- tx_hash: `f5fb64b4124d9e625eeb904fddf923c89d6d9ea329492d5ab16fdf6b1f3f30b5`
- status: `1`
- gas_used: `263724`
- tx_fee: `263724000000000` wei
- events: `ODDToken.Transfer, LiquidityPool.LiquidityDeposited, LiquidityPool.LiquidityAccountingSnapshot`

### TX-05 `PLACE_SINGLE_BET`
- sender: `bettor` / `0xf947cE92b29AAd005fDF16948B3273Fb0A5Da96C`
- tx_hash: `715a1454290d1695f7d17ec5a6195fdba54cde595483a6e5df5230649d3388d1`
- status: `1`
- gas_used: `493782`
- tx_fee: `493782000000000` wei
- events: `ODDToken.Transfer, ODDToken.Transfer, BettingParlayModule.BetPlaced, BettingParlayModule.OddsUpdated`

### TX-06 `OPEN_CASHOUT_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `1efea84f020b653120d5a660d75c72b3a7c590703032c97b6350b942840f99a5`
- status: `1`
- gas_used: `525091`
- tx_fee: `525091000000000` wei
- events: `LiquidityPool.MatchPoolOpened, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketOpened, BettingParlayModule.OddsUpdated`

### TX-07 `PLACE_CASHOUT_BET`
- sender: `cashoutUser` / `0xB91C7B77514862e3C0F3116EC3949EdAb2bfbba5`
- tx_hash: `a8aa5093f0de059db57a6187d9c4841de945834c81862e7320938af2b18e7786`
- status: `1`
- gas_used: `493782`
- tx_fee: `493782000000000` wei
- events: `ODDToken.Transfer, ODDToken.Transfer, BettingParlayModule.BetPlaced, BettingParlayModule.OddsUpdated`

### TX-08 `CASH_OUT`
- sender: `cashoutUser` / `0xB91C7B77514862e3C0F3116EC3949EdAb2bfbba5`
- tx_hash: `2f47e9021729d9d795f4e0781091e1b13c78ea68fa54e134c89742d9c8a3220f`
- status: `1`
- gas_used: `194718`
- tx_fee: `194718000000000` wei
- events: `BettingParlayModule.BetCashedOut, BettingParlayModule.OddsUpdated, BettingParlayModule.PlatformReserveUpdated, ODDToken.Transfer`

### TX-09 `OPEN_PARLAY_MARKET_A`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `17d8b4d715742f79713d3b0ac9d98bf07fad1fc6c474c6fc920da9dee56a7a58`
- status: `1`
- gas_used: `525091`
- tx_fee: `525091000000000` wei
- events: `LiquidityPool.MatchPoolOpened, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketOpened, BettingParlayModule.OddsUpdated`

### TX-10 `OPEN_PARLAY_MARKET_B`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `0185b7cd4694d232501c3c9599ba08c7724067640dc404f642ea7bcd356822ee`
- status: `1`
- gas_used: `525091`
- tx_fee: `525091000000000` wei
- events: `LiquidityPool.MatchPoolOpened, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketOpened, BettingParlayModule.OddsUpdated`

### TX-11 `PLACE_PARLAY`
- sender: `parlayUser` / `0xcF7E784333d63D084C74577558e0563A831A2D0e`
- tx_hash: `489bb94ef2f7a30f8c1b0fb2b4983ea4fb5473cfd40a70ca602967985dbd8fe7`
- status: `1`
- gas_used: `802682`
- tx_fee: `802682000000000` wei
- events: `ODDToken.Transfer, BettingParlayModule.ParlayLegExposureReserved, BettingParlayModule.OddsUpdated, BettingParlayModule.ParlayLegExposureReserved, BettingParlayModule.OddsUpdated, ODDToken.Transfer, BettingParlayModule.ParlayPlaced`

### TX-12 `SINGLE_SETTLE_BETS`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `6482035190940daa378a3c3cb7f01fd9c7465956ef62325a600d7afb8412416c`
- status: `1`
- gas_used: `271760`
- tx_fee: `271760000000000` wei
- events: `BettingParlayModule.MarketSettlementScoreBatchProcessed`

### TX-13 `SINGLE_FINALIZE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `ccf75841cebdc296b002fa999443cfd71da8ce7f1e6703f6087f4cc9a131eb7c`
- status: `1`
- gas_used: `318760`
- tx_fee: `318760000000000` wei
- events: `ODDToken.Transfer, LiquidityPool.MarginDistributed, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.PlatformReserveUpdated, LiquidityPool.PayoutLiquidityReserved, LiquidityPool.PayoutReserveOutstanding, LiquidityPool.LossDistributed, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketFinalResultRecorded, BettingParlayModule.MarketSettlementFinalized`

### TX-14 `CLAIM_SINGLE_PAYOUT`
- sender: `bettor` / `0xf947cE92b29AAd005fDF16948B3273Fb0A5Da96C`
- tx_hash: `1f38de23d58e5f18509e46412c06efd0256afa65a4209e96d0962bf8aed80188`
- status: `1`
- gas_used: `156944`
- tx_fee: `156944000000000` wei
- events: `ODDToken.Transfer, StakingPool.RewardNotified, StakingPool.StakeAccountingSnapshot, BettingParlayModule.LpLossOffsetApplied, ODDToken.Transfer, ODDToken.Transfer, BettingParlayModule.BetClaimed, BettingParlayModule.PayoutClaimed`

### TX-15 `LP_REQUEST_UNBOND_MATCH`
- sender: `lpUser` / `0x79C8A5cDA3ec53D62a8f7452B2c7BCC482606A78`
- tx_hash: `2edef17056d2e80867aa8d5581a238b7c36c698c5df6843e4fa81cc1d6c045f9`
- status: `1`
- gas_used: `201787`
- tx_fee: `201787000000000` wei
- events: `LiquidityPool.UnbondRequested, LiquidityPool.LiquidityPositionStateChanged, LiquidityPool.LiquidityAccountingSnapshot`

### TX-16 `PARLAY_A_SETTLE_BETS`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `704c579b83ad04775a255d5698401831220eccdb29cddb82ce9fcdfd97be9e6e`
- status: `1`
- gas_used: `137159`
- tx_fee: `137159000000000` wei
- events: `BettingParlayModule.MarketSettlementScoreBatchProcessed`

### TX-17 `PARLAY_A_FINALIZE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `a0cceeb24986fb9043deffcce7fa65c97a3862c2051bc0555a4b39463c5f745e`
- status: `1`
- gas_used: `111331`
- tx_fee: `111331000000000` wei
- events: `BettingParlayModule.MarketFinalResultRecorded, BettingParlayModule.MarketSettlementFinalized`

### TX-18 `PARLAY_B_SETTLE_BETS`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `2d3429b605db6116ce5dbe04496210c0e2f1b87b621fc71d0ee1dd42c09a8f22`
- status: `1`
- gas_used: `137147`
- tx_fee: `137147000000000` wei
- events: `BettingParlayModule.MarketSettlementScoreBatchProcessed`

### TX-19 `PARLAY_B_FINALIZE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `8190c084e1ce4cceef0b344b3a8d096f75a396d7d88ed1808250daf273881292`
- status: `1`
- gas_used: `111331`
- tx_fee: `111331000000000` wei
- events: `BettingParlayModule.MarketFinalResultRecorded, BettingParlayModule.MarketSettlementFinalized`

### TX-20 `SETTLE_PARLAY`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `aeb3386bf9671edc604331aad678df8f1d640d1e0246a4fe240050f5ee1222d6`
- status: `1`
- gas_used: `471166`
- tx_fee: `471166000000000` wei
- events: `BettingParlayModule.OddsUpdated, BettingParlayModule.OddsUpdated, ODDToken.Transfer, LiquidityPool.GlobalMarginDistributed, LiquidityPool.MarginDistributed, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.PlatformReserveUpdated, LiquidityPool.PayoutLiquidityReserved, LiquidityPool.PayoutReserveOutstanding, LiquidityPool.GlobalLossDistributed, LiquidityPool.LossDistributed, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.ParlaySettled`

### TX-21 `CLAIM_PARLAY_PAYOUT`
- sender: `parlayUser` / `0xcF7E784333d63D084C74577558e0563A831A2D0e`
- tx_hash: `daf2acf63102caf8e49fc4eb2bad4f758171cd9961865cc16345d9c98a0afe50`
- status: `1`
- gas_used: `147908`
- tx_fee: `147908000000000` wei
- events: `ODDToken.Transfer, StakingPool.RewardNotified, StakingPool.StakeAccountingSnapshot, BettingParlayModule.LpLossOffsetApplied, ODDToken.Transfer, ODDToken.Transfer, BettingParlayModule.ParlayPayoutClaimed`
