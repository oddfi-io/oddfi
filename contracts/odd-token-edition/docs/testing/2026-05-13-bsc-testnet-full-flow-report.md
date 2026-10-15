# 2026-05-13 BSC Testnet Full Flow Report

> 历史记录说明：本报告来自 AH 扩盘口与 score-based 结算改造之前，交易日志中的 `SETTLE_MARKET`、`MarketSettled.winningOutcome` 等字段是当时旧 ABI / 旧事件口径。当前代码已经切换为 `settleMarketBetsByScore + finalizeMarketSettlement`，并使用 `MarketSettlementScoreBatchProcessed / MarketSettlementFinalized`；当前本地验收见 `2026-05-24-local-scenario-matrix-report.md`。

- RPC: BSC Testnet RPC from environment
- chainId: `97`
- matchId: `98aee1e3cc02d0aa80e1a6d4242303bcadb50c82ba05e965d24b15841427b646`
- marketId: `daab14e1918ea5958dba9c7ca9f10b5adac79dac73d0c68d312efb3a549b8185`
- betId: `0000000000000000000000000000000000000000000000000000000000000004`
- lpPositionId: `28`
- expectedGrossPayout: `200 ODD`
- expectedPayoutTax: `10 ODD`
- expectedNetPayout: `190 ODD`

## Checks
- [PASS] `OPEN_MARKET_status`: status=1, tx=0a488ea0dad238323a86a517d0f5c78b0960285db27b2352687278f7687157af
- [PASS] `DEPOSIT_MATCH_LP_status`: status=1, tx=9d9c9a798e8c9f7ee6a436653852126d2a410a304e0d224a578148c6aef18556
- [PASS] `PLACE_BET_status`: status=1, tx=aeb0a2543d853eeb5bf02317b738d606059a065cbb44f079085ba31e4de6dd6b
- [PASS] `SETTLE_MARKET_status`: status=1, tx=3be1c15effc34403af1f1bbc523e80024efcdea54437ecd897096c41ca03d559
- [PASS] `CLAIM_PAYOUT_status`: status=1, tx=37526e64508090156e9b3ac600ef4d536e8fe37181b3e6db4af136014e445ce5
- [PASS] `CLAIM_NET_DELTA`: expected 190000000000000000000, got 190000000000000000000
- [PASS] `CLAIM_PAYOUT_TX_SUCCESS`: 37526e64508090156e9b3ac600ef4d536e8fe37181b3e6db4af136014e445ce5
- [PASS] `REQUEST_UNBOND_MATCH_LP_status`: status=1, tx=8843c7f2ee6a859ccf9131c4e1ee314beee681f932da5f810cb87d498648ba53
- [PASS] `WITHDRAW_MATCH_LP_WAIT_10_MIN_RULE_CONFIRMED`: not mature after 10 minutes as expected by epoch rule: ('0xc71a025400000000000000000000000000000000000000000000000000000000000001260000000000000000000000000000000000000000000000000000000000000129', '0xc71a025400000000000000000000000000000000000000000000000000000000000001260000000000000000000000000000000000000000000000000000000000000129')
- [PASS] `USER_WITHDRAW_ODD_TO_SINK_status`: status=1, tx=05769bc7fd2e1147221866a42eaa870041c59dfce91e4d7beac2139382c7d855

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `97,944,842.779999999999999997` | `97,944,748.279999999999999997` | `15.4259792672947412` | `15.4251320612947412` |
| `bettor` | `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88` | `2,079` | `2,158` | `0.029222233` | `0.028493169` |
| `lpUser` | `0xFF2b0a90846D0a4AC591bBA7D74AcB9D9283c82F` | `2,000` | `1,000` | `0.02923644` | `0.028787584` |
| `sink` | `0x7fB27F30736511927C362A780468070B445d23e0` | `10` | `20` | `0.03` | `0.03` |
| `StakingPool` | `0x65fd4A2529010693BA474d1993631e305a42E061` | `14,404` | `14,408` | `0` | `0` |
| `LiquidityPool` | `0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f` | `52,857` | `53,835.023400000000000003` | `0` | `0` |
| `BettingPool` | `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F` | `78.023400000000000003` | `2` | `0` | `0` |

## Transactions
### TX-01 `OPEN_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `0a488ea0dad238323a86a517d0f5c78b0960285db27b2352687278f7687157af`
- status: `1`
- gas_used: `444174`
- effective_gas_price: `1000000000` wei
- tx_fee: `444174000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000444174` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `MatchPoolOpened`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `matchEndTime`: `1778653358`
  - `depositCloseAt`: `1778653178`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `51263329739887251509000`
  - `totalActiveDepositedAfter`: `51833000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `600000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` `MarketOpened`
  - `marketId`: `b'\xda\xab\x14\xe1\x91\x8e\xa5\x95\x8d\xba\x9c|\xa9\xf1\x0bZ\xda\xc7\x9d\xacs\xd0\xc6\x8d1.\xfb:T\x9b\x81\x85'`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `marketType`: `1`
  - `line`: `0`
  - `matchStartTime`: `1778653178`
  - `lockAt`: `1778652878`
  - `quoteVersion`: `1`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\xda\xab\x14\xe1\x91\x8e\xa5\x95\x8d\xba\x9c|\xa9\xf1\x0bZ\xda\xc7\x9d\xacs\xd0\xc6\x8d1.\xfb:T\x9b\x81\x85'`
  - `updatedAt`: `1778652769`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-02 `DEPOSIT_MATCH_LP`
- sender: `lpUser` / `0xFF2b0a90846D0a4AC591bBA7D74AcB9D9283c82F`
- tx_hash: `9d9c9a798e8c9f7ee6a436653852126d2a410a304e0d224a578148c6aef18556`
- status: `1`
- gas_used: `263548`
- effective_gas_price: `1000000000` wei
- tx_fee: `263548000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `-1,000` | `-0.000263548` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `1,000` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0xFF2b0a90846D0a4AC591bBA7D74AcB9D9283c82F`
  - `to`: `0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f`
  - `value`: `1000000000000000000000`
- `LiquidityPool` `LiquidityDeposited`
  - `positionId`: `28`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `user`: `0xFF2b0a90846D0a4AC591bBA7D74AcB9D9283c82F`
  - `amount`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
  - `planId`: `0`
  - `unlockAt`: `1778653358`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `positionId`: `28`
  - `actionKind`: `1`
  - `requestableLiquidityAfter`: `52263329739887251509000`
  - `totalActiveDepositedAfter`: `52833000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `600000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`

### TX-03 `PLACE_BET`
- sender: `bettor` / `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
- tx_hash: `aeb0a2543d853eeb5bf02317b738d606059a065cbb44f079085ba31e4de6dd6b`
- status: `1`
- gas_used: `462893`
- effective_gas_price: `1000000000` wei
- tx_fee: `462893000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `1` | `0` |
| `bettor` | `-101` | `-0.000462893` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `100` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
  - `to`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `value`: `101000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `1000000000000000000`
- `BettingPool` `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x04'`
  - `marketId`: `b'\xda\xab\x14\xe1\x91\x8e\xa5\x95\x8d\xba\x9c|\xa9\xf1\x0bZ\xda\xc7\x9d\xacs\xd0\xc6\x8d1.\xfb:T\x9b\x81\x85'`
  - `user`: `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
  - `requestedAmount`: `100000000000000000000`
  - `acceptedAmount`: `100000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\xda\xab\x14\xe1\x91\x8e\xa5\x95\x8d\xba\x9c|\xa9\xf1\x0bZ\xda\xc7\x9d\xacs\xd0\xc6\x8d1.\xfb:T\x9b\x81\x85'`
  - `updatedAt`: `1778652769`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-04 `SETTLE_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `3be1c15effc34403af1f1bbc523e80024efcdea54437ecd897096c41ca03d559`
- status: `1`
- gas_used: `351355`
- effective_gas_price: `1000000000` wei
- tx_fee: `351355000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000351355` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `8` | `0` |
| `BettingPool` | `-8` | `0` |

Events:
- `LiquidityPool` `MatchPoolDepositClosed`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `reason`: `0`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `positionId`: `0`
  - `actionKind`: `3`
  - `requestableLiquidityAfter`: `52263329739887251509000`
  - `totalActiveDepositedAfter`: `52833000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `600000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `to`: `0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f`
  - `value`: `8000000000000000000`
- `LiquidityPool` `MarginDistributed`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `lpMarginShare`: `8000000000000000000`
  - `globalShare`: `7736260838031187155`
  - `matchShare`: `263739161968812845`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `52271329739887251509000`
  - `totalActiveDepositedAfter`: `52833000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `600000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `LiquidityPool` `PayoutLiquidityReserved`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `reservedAmount`: `200000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1778653376`
- `LiquidityPool` `LossDistributed`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `lpLossBooked`: `200000000000000000000`
  - `globalLossShare`: `193406520950779678897`
  - `matchLossShare`: `6593479049220321103`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `52071329739887251509000`
  - `totalActiveDepositedAfter`: `52833000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `800000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `MarketSettled`
  - `marketId`: `b'\xda\xab\x14\xe1\x91\x8e\xa5\x95\x8d\xba\x9c|\xa9\xf1\x0bZ\xda\xc7\x9d\xacs\xd0\xc6\x8d1.\xfb:T\x9b\x81\x85'`
  - `resultKind`: `0`
  - `winningOutcome`: `0`
  - `grossPayout`: `200000000000000000000`
  - `lpMarginShare`: `8000000000000000000`
  - `platformMarginShare`: `2000000000000000000`
  - `quoteVersion`: `4`

### TX-05 `CLAIM_PAYOUT`
- sender: `bettor` / `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
- tx_hash: `37526e64508090156e9b3ac600ef4d536e8fe37181b3e6db4af136014e445ce5`
- status: `1`
- gas_used: `224711`
- effective_gas_price: `1000000000` wei
- tx_fee: `224711000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `4` | `0` |
| `bettor` | `190` | `-0.000224711` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `4` | `0` |
| `LiquidityPool` | `-29.976599999999999997` | `0` |
| `BettingPool` | `-168.023400000000000003` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f`
  - `to`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `value`: `29976599999999999997`
- `LiquidityPool` `PayoutLiquidityTransferred`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `amount`: `29976599999999999997`
  - `newPaidOutAmount`: `29976599999999999997`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `positionId`: `0`
  - `actionKind`: `8`
  - `requestableLiquidityAfter`: `52071329739887251509000`
  - `totalActiveDepositedAfter`: `52833000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `770023400000000000003`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `to`: `0x65fd4A2529010693BA474d1993631e305a42E061`
  - `value`: `4000000000000000000`
- `StakingPool` `RewardNotified`
  - `caller`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `amount`: `4000000000000000000`
  - `newAccRewardPerShare`: `487804878048780`
- `StakingPool` `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `16400000000000000000000`
  - `accountedOddBalanceAfter`: `14408000000000000000000`
  - `accRewardPerShareAfter`: `487804878048780`
- `BettingPool` `LpDeficitRepaid`
  - `amount`: `2000000000000000000`
  - `remainingDeficit`: `796000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `4000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F`
  - `to`: `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
  - `value`: `190000000000000000000`
- `BettingPool` `BetClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x04'`
  - `marketId`: `b'\xda\xab\x14\xe1\x91\x8e\xa5\x95\x8d\xba\x9c|\xa9\xf1\x0bZ\xda\xc7\x9d\xacs\xd0\xc6\x8d1.\xfb:T\x9b\x81\x85'`
  - `user`: `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
  - `payout`: `190000000000000000000`
  - `executor`: `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
- `BettingPool` `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x04'`
  - `user`: `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
  - `grossPayout`: `200000000000000000000`
  - `taxAmount`: `10000000000000000000`
  - `netPayout`: `190000000000000000000`

### TX-06 `REQUEST_UNBOND_MATCH_LP`
- sender: `lpUser` / `0xFF2b0a90846D0a4AC591bBA7D74AcB9D9283c82F`
- tx_hash: `8843c7f2ee6a859ccf9131c4e1ee314beee681f932da5f810cb87d498648ba53`
- status: `1`
- gas_used: `185308`
- effective_gas_price: `1000000000` wei
- tx_fee: `185308000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.000185308` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `UnbondRequested`
  - `positionId`: `28`
  - `user`: `0xFF2b0a90846D0a4AC591bBA7D74AcB9D9283c82F`
  - `unbondingEpoch`: `294`
  - `frozenRewardPerWeight`: `263739161968812`
  - `frozenLossPerPrincipal`: `6593479049220321`
- `LiquidityPool` `LiquidityPositionStateChanged`
  - `positionId`: `28`
  - `user`: `0xFF2b0a90846D0a4AC591bBA7D74AcB9D9283c82F`
  - `previousState`: `0`
  - `newState`: `1`
  - `principal`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b"\x98\xae\xe1\xe3\xcc\x02\xd0\xaa\x80\xe1\xa6\xd4$#\x03\xbc\xad\xb5\x0c\x82\xba\x05\xe9e\xd2K\x15\x84\x14'\xb6F"`
  - `poolId`: `69060543408248716792185163902883546497638291467355492093914411792387682055750`
  - `positionId`: `28`
  - `actionKind`: `6`
  - `requestableLiquidityAfter`: `51077659479774503018000`
  - `totalActiveDepositedAfter`: `51833000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `770023400000000000003`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`

### TX-07 `USER_WITHDRAW_ODD_TO_SINK`
- sender: `bettor` / `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
- tx_hash: `05769bc7fd2e1147221866a42eaa870041c59dfce91e4d7beac2139382c7d855`
- status: `1`
- gas_used: `41460`
- effective_gas_price: `1000000000` wei
- tx_fee: `41460000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `-10` | `-0.00004146` |
| `lpUser` | `0` | `0` |
| `sink` | `10` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x79061bb0Db8B5F69164970e81AD87Fb4FACd7D88`
  - `to`: `0x7fB27F30736511927C362A780468070B445d23e0`
  - `value`: `10000000000000000000`
