# 2026-06-01 BSC Testnet Full Redeploy Scenario Report

## 环境
- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- admin: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- ODDToken: `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0`
- StakingPool: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
- LiquidityPool: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
- BettingPool: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
- BettingSettlementModule: `0x387980b9CCf2F7C82Bf1448705910060b37B825E`

## 参与账户
- `admin`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- `referrer`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
- `alice`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- `bob`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- `carol`: `0x4A6d9c75867AAd27148a956c1c40dEAcf1447CF6`
- `lpUser`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`

## 检查结果
- [PASS] `REF_002_auto_bind`: expected 0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322, got 0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322
- [PASS] `TAX_001_referrer_reward_after_bets`: expected 10 ODD, got 10000000000000000000
- [PASS] `CLAIM_gross_payout`: expected gross 2000000000000000000000, got 2000000000000000000000
- [PASS] `CLAIM_net_payout`: expected net 1900000000000000000000, got 1900000000000000000000
- [PASS] `REFERRAL_claim_zeroes_balance`: expected 0, got 0
- [PASS] `PUSH_market_bet_refunded_state`: expected Refunded(1), got 1

## 发现的问题
- 本轮执行未发现新的链上功能性失败。

## 全账户汇总快照（Suite Before / After）
| 账户 | 地址 | ODD Before | ODD After | BNB Before | BNB After |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `99,592,949` | `99,592,984` | `11.5404400999555412` | `11.5385965219555412` |
| `referrer` | `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322` | `2,091` | `1,621` | `0.077984089` | `0.077698829` |
| `alice` | `0x12BD5D79a1A6433A03c4f4e93870255d16572C72` | `9,569` | `9,459` | `0.076250388` | `0.075543363` |
| `bob` | `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d` | `4,584.632` | `4,446.176` | `0.055624245` | `0.054591568` |
| `carol` | `0x4A6d9c75867AAd27148a956c1c40dEAcf1447CF6` | `2,370.368` | `2,493.824` | `0.06` | `0.06` |
| `lpUser` | `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a` | `9,000` | `4,000` | `0.078025878` | `0.07775971` |
| `ODDToken` | `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `6,186` | `6,726` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `63,752` | `68,912` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `47,501` | `47,361` | `0` | `0` |

## 逐交易记录
### TX-01 `DEP_003_ALICE_TO_BOB`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `d4a7b7496616df2d3f7a12b4b8a0a4274b01d081d201973994eb48a4606b92a1`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `41472`
- tx_fee: `41472000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,949` | `99,592,949` | `0` | `11.5404400999555412` | `11.5404400999555412` | `0` |
| `referrer` | `2,091` | `2,091` | `0` | `0.077984089` | `0.077984089` | `0` |
| `alice` | `9,569` | `8,569` | `-1,000` | `0.076250388` | `0.076208916` | `-0.000041472` |
| `bob` | `4,584.632` | `5,584.632` | `1,000` | `0.055624245` | `0.055624245` | `0` |
| `carol` | `2,370.368` | `2,370.368` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `9,000` | `9,000` | `0` | `0.078025878` | `0.078025878` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,186` | `6,186` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `63,752` | `63,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,501` | `47,501` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `to`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `value`: `1000000000000000000000`

### TX-02 `DEP_003_BOB_TO_CAROL`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `85b1adb4194d45ad293fdfed0eb288658f93d5a39b675b9929f9630f5c2f57d4`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `41472`
- tx_fee: `41472000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,949` | `99,592,949` | `0` | `11.5404400999555412` | `11.5404400999555412` | `0` |
| `referrer` | `2,091` | `2,091` | `0` | `0.077984089` | `0.077984089` | `0` |
| `alice` | `8,569` | `8,569` | `0` | `0.076208916` | `0.076208916` | `0` |
| `bob` | `5,584.632` | `5,461.176` | `-123.456` | `0.055624245` | `0.055582773` | `-0.000041472` |
| `carol` | `2,370.368` | `2,493.824` | `123.456` | `0.06` | `0.06` | `0` |
| `lpUser` | `9,000` | `9,000` | `0` | `0.078025878` | `0.078025878` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,186` | `6,186` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `63,752` | `63,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,501` | `47,501` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `to`: `0x4A6d9c75867AAd27148a956c1c40dEAcf1447CF6`
  - `value`: `123456000000000000000`

### TX-03 `STAKE_REFERRER`
- sender: `referrer` / `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
- tx_hash: `ca59c7441ffcbed18a08671e10cd08736c416ab390619ad95264e10b19135aff`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `222353`
- tx_fee: `222353000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,949` | `99,592,949` | `0` | `11.5404400999555412` | `11.5404400999555412` | `0` |
| `referrer` | `2,091` | `1,591` | `-500` | `0.077984089` | `0.077761736` | `-0.000222353` |
| `alice` | `8,569` | `8,569` | `0` | `0.076208916` | `0.076208916` | `0` |
| `bob` | `5,461.176` | `5,461.176` | `0` | `0.055582773` | `0.055582773` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `9,000` | `9,000` | `0` | `0.078025878` | `0.078025878` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,186` | `6,686` | `500` | `0` | `0` | `0` |
| `LiquidityPool` | `63,752` | `63,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,501` | `47,501` | `0` | `0` | `0` | `0` |

#### Event Logs
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeCreated`
  - `positionId`: `10`
  - `user`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `principal`: `500000000000000000000`
  - `planId`: `1`
  - `sourceType`: `0`
  - `weight`: `500000000000000000000`
  - `unlockAt`: `1780461367`
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `to`: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
  - `value`: `500000000000000000000`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeAccountingSnapshot`
  - `positionId`: `10`
  - `user`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `actionKind`: `0`
  - `activeStakeAfter`: `2500000000000000000000`
  - `totalWeightedSharesAfter`: `6500000000000000000000`
  - `accountedOddBalanceAfter`: `6686000000000000000000`
  - `accRewardPerShareAfter`: `92888888888888888`

### TX-04 `DEPOSIT_GLOBAL_LPUSER`
- sender: `lpUser` / `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
- tx_hash: `637a0aa0fff6da90307f59701bffbd0d271837c714721011af76ad0cd69e85e6`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `266168`
- tx_fee: `266168000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,949` | `99,592,949` | `0` | `11.5404400999555412` | `11.5404400999555412` | `0` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `8,569` | `8,569` | `0` | `0.076208916` | `0.076208916` | `0` |
| `bob` | `5,461.176` | `5,461.176` | `0` | `0.055582773` | `0.055582773` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `9,000` | `4,000` | `-5,000` | `0.078025878` | `0.07775971` | `-0.000266168` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,686` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `63,752` | `68,752` | `5,000` | `0` | `0` | `0` |
| `BettingPool` | `47,501` | `47,501` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `5000000000000000000000`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityDeposited`
  - `positionId`: `20`
  - `poolId`: `0`
  - `user`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
  - `amount`: `5000000000000000000000`
  - `weight`: `5000000000000000000000`
  - `planId`: `1`
  - `unlockAt`: `1780454203`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'`
  - `poolId`: `0`
  - `positionId`: `20`
  - `actionKind`: `0`
  - `requestableLiquidityAfter`: `62242228571428571429000`
  - `totalActiveDepositedAfter`: `66000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `4550000000000000000000`
  - `poolTotalDepositedAfter`: `26000000000000000000000`
  - `poolTotalWeightAfter`: `26000000000000000000000`

### TX-05 `OPEN_MARKET_A`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `957519c2a9133eb30874e90b11427018bb6eefd189e8189db743b9e5fee660f2`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `520211`
- tx_fee: `520211000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,949` | `99,592,949` | `0` | `11.5404400999555412` | `11.5399198889555412` | `-0.000520211` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `8,569` | `8,569` | `0` | `0.076208916` | `0.076208916` | `0` |
| `bob` | `5,461.176` | `5,461.176` | `0` | `0.055582773` | `0.055582773` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,686` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,752` | `68,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,501` | `47,501` | `0` | `0` | `0` | `0` |

#### Event Logs
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MatchPoolOpened`
  - `matchId`: `b'\x06\x13;o\xe4\xa5\xbf\x99\xd9\xee\xe8\x86\x0c\x08]\xef\x90\xb1G\x8c\xda\xe7(\xb9\xd9\x130\x1a\xad\xfb\t\xd6'`
  - `poolId`: `2747857405398315783813768156430679918574456307731647312829075116534928181718`
  - `matchEndTime`: `1780404479`
  - `depositCloseAt`: `1780404419`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x06\x13;o\xe4\xa5\xbf\x99\xd9\xee\xe8\x86\x0c\x08]\xef\x90\xb1G\x8c\xda\xe7(\xb9\xd9\x130\x1a\xad\xfb\t\xd6'`
  - `poolId`: `2747857405398315783813768156430679918574456307731647312829075116534928181718`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `62242228571428571429000`
  - `totalActiveDepositedAfter`: `66000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `4550000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketOpened`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `matchId`: `b'\x06\x13;o\xe4\xa5\xbf\x99\xd9\xee\xe8\x86\x0c\x08]\xef\x90\xb1G\x8c\xda\xe7(\xb9\xd9\x130\x1a\xad\xfb\t\xd6'`
  - `marketType`: `0`
  - `line`: `0`
  - `matchStartTime`: `1780404419`
  - `lockAt`: `1780404479`
  - `quoteVersion`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `updatedAt`: `1780403837`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-06 `OPEN_MARKET_B_PUSH`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `eea49fc7dd0a0c12c0adc00a427bc43996ab95c9b0f25f8571428a28695c52f6`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `470764`
- tx_fee: `470764000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,949` | `99,592,949` | `0` | `11.5399198889555412` | `11.5394491249555412` | `-0.000470764` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `8,569` | `8,569` | `0` | `0.076208916` | `0.076208916` | `0` |
| `bob` | `5,461.176` | `5,461.176` | `0` | `0.055582773` | `0.055582773` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,686` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,752` | `68,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,501` | `47,501` | `0` | `0` | `0` | `0` |

#### Event Logs
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MatchPoolOpened`
  - `matchId`: `b"\xf7\xbcM\n.$Z\x1b'3\xa2\xc0\xb3\r\xde\xf8\x86J{\xc2V\xb7?\xbfIh\xd6\xa1\x9b\x8f\xdaR"`
  - `poolId`: `112053972557172623479727232467099502975433520510127259280138016886511738280530`
  - `matchEndTime`: `1780404479`
  - `depositCloseAt`: `1780404419`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b"\xf7\xbcM\n.$Z\x1b'3\xa2\xc0\xb3\r\xde\xf8\x86J{\xc2V\xb7?\xbfIh\xd6\xa1\x9b\x8f\xdaR"`
  - `poolId`: `112053972557172623479727232467099502975433520510127259280138016886511738280530`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `62242228571428571429000`
  - `totalActiveDepositedAfter`: `66000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `4550000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketOpened`
  - `marketId`: `b'\xb4V\x10+EN\xa3f\x0f\xd3\xe5C\x05\xac\xda\xb5\x14\xc3\xa7\xae\x90R<\x848\xbfAa\xc06M\x94'`
  - `matchId`: `b"\xf7\xbcM\n.$Z\x1b'3\xa2\xc0\xb3\r\xde\xf8\x86J{\xc2V\xb7?\xbfIh\xd6\xa1\x9b\x8f\xdaR"`
  - `marketType`: `1`
  - `line`: `1`
  - `matchStartTime`: `1780404419`
  - `lockAt`: `1780404479`
  - `quoteVersion`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'\xb4V\x10+EN\xa3f\x0f\xd3\xe5C\x05\xac\xda\xb5\x14\xc3\xa7\xae\x90R<\x848\xbfAa\xc06M\x94'`
  - `updatedAt`: `1780403876`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-07 `PLACE_BET_A_ALICE_WITH_REFERRER`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `f5d104b2658d22a7cf34fb9bbd37bf9e2e723fdd2ba2d710eb7002e2191bfcf5`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `506728`
- tx_fee: `506728000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,949` | `99,592,949` | `0` | `11.5394491249555412` | `11.5394491249555412` | `0` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `8,569` | `7,559` | `-1,010` | `0.076208916` | `0.075702188` | `-0.000506728` |
| `bob` | `5,461.176` | `5,461.176` | `0` | `0.055582773` | `0.055582773` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,686` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,752` | `68,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,501` | `48,511` | `1,010` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `to`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `1010000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `ReferralRewardAccumulated`
  - `referrer`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `from`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `amount`: `10000000000000000000`
  - `kind`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xeb'`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `requestedAmount`: `1000000000000000000000`
  - `acceptedAmount`: `1000000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `updatedAt`: `1780403837`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-08 `PLACE_BET_A_BOB_NO_REFERRER`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `98a1501a36bc1f5563615b84411b960020d633b6bc1309604e37a98ac351b15f`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `514781`
- tx_fee: `514781000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,949` | `99,592,959` | `10` | `11.5394491249555412` | `11.5394491249555412` | `0` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `7,559` | `7,559` | `0` | `0.075702188` | `0.075702188` | `0` |
| `bob` | `5,461.176` | `4,451.176` | `-1,010` | `0.055582773` | `0.055067992` | `-0.000514781` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,686` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,752` | `68,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `48,511` | `49,511` | `1,000` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `to`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `1010000000000000000000`
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `10000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xec'`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `requestedAmount`: `1000000000000000000000`
  - `acceptedAmount`: `1000000000000000000000`
  - `lockedOdds`: `30000`
  - `quoteVersion`: `3`
  - `outcome`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `updatedAt`: `1780403837`
  - `quoteVersion`: `3`
  - `signal`: `0`

### TX-09 `PLACE_BET_B_BOB_PUSH_MARKET`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `74cbabe8d6e1da6b8edfab2f0417379793af20e3cfb04ae89a32ce6367b79b5f`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `476424`
- tx_fee: `476424000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,959` | `99,592,964` | `5` | `11.5394491249555412` | `11.5394491249555412` | `0` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `7,559` | `7,559` | `0` | `0.075702188` | `0.075702188` | `0` |
| `bob` | `4,451.176` | `3,946.176` | `-505` | `0.055067992` | `0.054591568` | `-0.000476424` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,686` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,752` | `68,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `49,511` | `50,011` | `500` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `to`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `505000000000000000000`
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `5000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xed'`
  - `marketId`: `b'\xb4V\x10+EN\xa3f\x0f\xd3\xe5C\x05\xac\xda\xb5\x14\xc3\xa7\xae\x90R<\x848\xbfAa\xc06M\x94'`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `requestedAmount`: `500000000000000000000`
  - `acceptedAmount`: `500000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'\xb4V\x10+EN\xa3f\x0f\xd3\xe5C\x05\xac\xda\xb5\x14\xc3\xa7\xae\x90R<\x848\xbfAa\xc06M\x94'`
  - `updatedAt`: `1780403876`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-10 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `e471e4cc4cfc90787508c42bdeac51871120a0365c235304a55b39241113660f`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `316351`
- tx_fee: `316351000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,964` | `99,592,964` | `0` | `11.5394491249555412` | `11.5391327739555412` | `-0.000316351` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `7,559` | `7,559` | `0` | `0.075702188` | `0.075702188` | `0` |
| `bob` | `3,946.176` | `3,946.176` | `0` | `0.054591568` | `0.054591568` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,686` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,752` | `68,752` | `0` | `0` | `0` | `0` |
| `BettingPool` | `50,011` | `50,011` | `0` | `0` | `0` | `0` |

#### Event Logs
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `2`
  - `totalBetCount`: `2`

### TX-11 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `dd63b8e2f0736b2aec35ce57053e58b52c77d6a9d5d2831a987c649a76a77b74`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `236415`
- tx_fee: `236415000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,964` | `99,592,964` | `0` | `11.5391327739555412` | `11.5388963589555412` | `-0.000236415` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `7,559` | `7,559` | `0` | `0.075702188` | `0.075702188` | `0` |
| `bob` | `3,946.176` | `3,946.176` | `0` | `0.054591568` | `0.054591568` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,686` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,752` | `68,912` | `160` | `0` | `0` | `0` |
| `BettingPool` | `50,011` | `49,851` | `-160` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `160000000000000000000`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MarginDistributed`
  - `matchId`: `b'\x06\x13;o\xe4\xa5\xbf\x99\xd9\xee\xe8\x86\x0c\x08]\xef\x90\xb1G\x8c\xda\xe7(\xb9\xd9\x130\x1a\xad\xfb\t\xd6'`
  - `lpMarginShare`: `160000000000000000000`
  - `globalShare`: `160000000000000000000`
  - `matchShare`: `0`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x06\x13;o\xe4\xa5\xbf\x99\xd9\xee\xe8\x86\x0c\x08]\xef\x90\xb1G\x8c\xda\xe7(\xb9\xd9\x130\x1a\xad\xfb\t\xd6'`
  - `poolId`: `2747857405398315783813768156430679918574456307731647312829075116534928181718`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `62402228571428571429000`
  - `totalActiveDepositedAfter`: `66000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `4550000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `PlatformReserveUpdated`
  - `delta`: `40000000000000000000`
  - `newBalance`: `30186000000000000000000`
  - `reason`: `4`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `PayoutLiquidityReserved`
  - `matchId`: `b'\x06\x13;o\xe4\xa5\xbf\x99\xd9\xee\xe8\x86\x0c\x08]\xef\x90\xb1G\x8c\xda\xe7(\xb9\xd9\x130\x1a\xad\xfb\t\xd6'`
  - `reservedAmount`: `1000000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1780404544`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LossDistributed`
  - `matchId`: `b'\x06\x13;o\xe4\xa5\xbf\x99\xd9\xee\xe8\x86\x0c\x08]\xef\x90\xb1G\x8c\xda\xe7(\xb9\xd9\x130\x1a\xad\xfb\t\xd6'`
  - `lpLossBooked`: `1000000000000000000000`
  - `globalLossShare`: `1000000000000000000000`
  - `matchLossShare`: `0`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x06\x13;o\xe4\xa5\xbf\x99\xd9\xee\xe8\x86\x0c\x08]\xef\x90\xb1G\x8c\xda\xe7(\xb9\xd9\x130\x1a\xad\xfb\t\xd6'`
  - `poolId`: `2747857405398315783813768156430679918574456307731647312829075116534928181718`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `61402228571428571429000`
  - `totalActiveDepositedAfter`: `66000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `5550000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementFinalized`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `2000000000000000000000`
  - `lpMarginShare`: `160000000000000000000`
  - `platformMarginShare`: `40000000000000000000`
  - `quoteVersion`: `4`

### TX-12 `CLAIM_PAYOUT_ALICE`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `2001de85a9b614a9bb6d044f264f3afeece4a9b214026019ee4067b8ce11bda5`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `158825`
- tx_fee: `158825000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,964` | `99,592,984` | `20` | `11.5388963589555412` | `11.5388963589555412` | `0` |
| `referrer` | `1,591` | `1,591` | `0` | `0.077761736` | `0.077761736` | `0` |
| `alice` | `7,559` | `9,459` | `1,900` | `0.075702188` | `0.075543363` | `-0.000158825` |
| `bob` | `3,946.176` | `3,946.176` | `0` | `0.054591568` | `0.054591568` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,686` | `6,726` | `40` | `0` | `0` | `0` |
| `LiquidityPool` | `68,912` | `68,912` | `0` | `0` | `0` | `0` |
| `BettingPool` | `49,851` | `47,891` | `-1,960` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
  - `value`: `40000000000000000000`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `RewardNotified`
  - `caller`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `amount`: `40000000000000000000`
  - `newAccRewardPerShare`: `99042735042735041`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `6500000000000000000000`
  - `accountedOddBalanceAfter`: `6726000000000000000000`
  - `accRewardPerShareAfter`: `99042735042735041`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `LpLossOffsetApplied`
  - `amount`: `20000000000000000000`
  - `remainingOffset`: `5437000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `ReferralRewardAccumulated`
  - `referrer`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `from`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `amount`: `20000000000000000000`
  - `kind`: `1`
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `20000000000000000000`
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `value`: `1900000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `BetClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xeb'`
  - `marketId`: `b'e\x90B\x10:?\xe0gJrl\xf1\xf0\x8f\x1f\xf9\x13\x94\xd6p,q\xd2\x7f\xda\xad\xe1\xce\xfb"\xd0\x85'`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `payout`: `1900000000000000000000`
  - `executor`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xeb'`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `grossPayout`: `2000000000000000000000`
  - `taxAmount`: `100000000000000000000`
  - `netPayout`: `1900000000000000000000`

### TX-13 `CLAIM_REFERRAL_REWARD_REFERRER`
- sender: `referrer` / `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
- tx_hash: `d758b81fb37c1af3c9ae53c2202e9932f8181c964fc5c5817efe1f114d6257e1`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `62907`
- tx_fee: `62907000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,984` | `99,592,984` | `0` | `11.5388963589555412` | `11.5388963589555412` | `0` |
| `referrer` | `1,591` | `1,621` | `30` | `0.077761736` | `0.077698829` | `-0.000062907` |
| `alice` | `9,459` | `9,459` | `0` | `0.075543363` | `0.075543363` | `0` |
| `bob` | `3,946.176` | `3,946.176` | `0` | `0.054591568` | `0.054591568` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,726` | `6,726` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,912` | `68,912` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,891` | `47,861` | `-30` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `value`: `30000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `ReferralClaimed`
  - `referrer`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `oddAmount`: `30000000000000000000`

### TX-14 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `f1002538fff9791c577cf304a27e4364f3b194a79777a431a926eeb25d19cf1c`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `218648`
- tx_fee: `218648000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,984` | `99,592,984` | `0` | `11.5388963589555412` | `11.5386777109555412` | `-0.000218648` |
| `referrer` | `1,621` | `1,621` | `0` | `0.077698829` | `0.077698829` | `0` |
| `alice` | `9,459` | `9,459` | `0` | `0.075543363` | `0.075543363` | `0` |
| `bob` | `3,946.176` | `4,446.176` | `500` | `0.054591568` | `0.054591568` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,726` | `6,726` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,912` | `68,912` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,861` | `47,361` | `-500` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `value`: `500000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `BetRefunded`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xed'`
  - `marketId`: `b'\xb4V\x10+EN\xa3f\x0f\xd3\xe5C\x05\xac\xda\xb5\x14\xc3\xa7\xae\x90R<\x848\xbfAa\xc06M\x94'`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `refundAmount`: `500000000000000000000`
  - `reason`: `2`
  - `quoteVersion`: `2`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'\xb4V\x10+EN\xa3f\x0f\xd3\xe5C\x05\xac\xda\xb5\x14\xc3\xa7\xae\x90R<\x848\xbfAa\xc06M\x94'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-15 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `e9f1bdde091cbae6d4fbf7ab17353ce81e968ed8c0e9e9f5c26e7318d0c84eb6`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `81189`
- tx_fee: `81189000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,592,984` | `99,592,984` | `0` | `11.5386777109555412` | `11.5385965219555412` | `-0.000081189` |
| `referrer` | `1,621` | `1,621` | `0` | `0.077698829` | `0.077698829` | `0` |
| `alice` | `9,459` | `9,459` | `0` | `0.075543363` | `0.075543363` | `0` |
| `bob` | `4,446.176` | `4,446.176` | `0` | `0.054591568` | `0.054591568` | `0` |
| `carol` | `2,493.824` | `2,493.824` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.07775971` | `0.07775971` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `6,726` | `6,726` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `68,912` | `68,912` | `0` | `0` | `0` | `0` |
| `BettingPool` | `47,361` | `47,361` | `0` | `0` | `0` | `0` |

#### Event Logs
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementFinalized`
  - `marketId`: `b'\xb4V\x10+EN\xa3f\x0f\xd3\xe5C\x05\xac\xda\xb5\x14\xc3\xa7\xae\x90R<\x848\xbfAa\xc06M\x94'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `0`
  - `lpMarginShare`: `0`
  - `platformMarginShare`: `0`
  - `quoteVersion`: `3`
