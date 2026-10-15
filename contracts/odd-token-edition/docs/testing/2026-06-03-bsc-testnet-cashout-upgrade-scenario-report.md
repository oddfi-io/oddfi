# 2026-06-03 BSC Testnet Cash Out Upgrade Scenario Report

## 环境
- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- admin: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- ODDToken: `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0`
- StakingPool: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
- LiquidityPool: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
- BettingPool: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
- BettingSettlementModule: `0x120D754E3BD8aE9ba2fe27Fbd423f6B4C392f07d`

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
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,456,028` | `98,454,063` | `9.9905190711555412` | `9.9886125241555412` |
| `referrer` | `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322` | `1,151` | `681` | `0.077413569` | `0.077128309` |
| `alice` | `0x12BD5D79a1A6433A03c4f4e93870255d16572C72` | `9,349` | `9,239` | `0.074831483` | `0.074119579` |
| `bob` | `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d` | `4,307.72` | `4,169.264` | `0.053558941` | `0.052526302` |
| `carol` | `0x4A6d9c75867AAd27148a956c1c40dEAcf1447CF6` | `2,617.28` | `2,740.736` | `0.06` | `0.06` |
| `lpUser` | `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a` | `9,000` | `4,000` | `0.077493542` | `0.077227374` |
| `ODDToken` | `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `20,410` | `20,950` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `99,928` | `105,088` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `53,197` | `53,057` | `0` | `0` |

## 逐交易记录
### TX-01 `DEP_003_ALICE_TO_BOB`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `849bdfc1fce35258a6efcb3cddd4ff00a2e62f6fda7c37b162161f9b750bdad5`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `41472`
- tx_fee: `41472000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,028` | `98,456,028` | `0` | `9.9905190711555412` | `9.9905190711555412` | `0` |
| `referrer` | `1,151` | `1,151` | `0` | `0.077413569` | `0.077413569` | `0` |
| `alice` | `9,349` | `8,349` | `-1,000` | `0.074831483` | `0.074790011` | `-0.000041472` |
| `bob` | `4,307.72` | `5,307.72` | `1,000` | `0.053558941` | `0.053558941` | `0` |
| `carol` | `2,617.28` | `2,617.28` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `9,000` | `9,000` | `0` | `0.077493542` | `0.077493542` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,410` | `20,410` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `99,928` | `99,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,197` | `53,197` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `to`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `value`: `1000000000000000000000`

### TX-02 `DEP_003_BOB_TO_CAROL`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `99bbc1fe09b9e57186c41d95d185795e5a7fb48275ae9d68890471d81b460616`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `41472`
- tx_fee: `41472000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,028` | `98,456,028` | `0` | `9.9905190711555412` | `9.9905190711555412` | `0` |
| `referrer` | `1,151` | `1,151` | `0` | `0.077413569` | `0.077413569` | `0` |
| `alice` | `8,349` | `8,349` | `0` | `0.074790011` | `0.074790011` | `0` |
| `bob` | `5,307.72` | `5,184.264` | `-123.456` | `0.053558941` | `0.053517469` | `-0.000041472` |
| `carol` | `2,617.28` | `2,740.736` | `123.456` | `0.06` | `0.06` | `0` |
| `lpUser` | `9,000` | `9,000` | `0` | `0.077493542` | `0.077493542` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,410` | `20,410` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `99,928` | `99,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,197` | `53,197` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `to`: `0x4A6d9c75867AAd27148a956c1c40dEAcf1447CF6`
  - `value`: `123456000000000000000`

### TX-03 `STAKE_REFERRER`
- sender: `referrer` / `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
- tx_hash: `41e521a050a3aefe62b1a58d8f4975f2f1cb54a414c039a1b892dd318a461ac5`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `222353`
- tx_fee: `222353000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,028` | `98,456,028` | `0` | `9.9905190711555412` | `9.9905190711555412` | `0` |
| `referrer` | `1,151` | `651` | `-500` | `0.077413569` | `0.077191216` | `-0.000222353` |
| `alice` | `8,349` | `8,349` | `0` | `0.074790011` | `0.074790011` | `0` |
| `bob` | `5,184.264` | `5,184.264` | `0` | `0.053517469` | `0.053517469` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `9,000` | `9,000` | `0` | `0.077493542` | `0.077493542` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,410` | `20,910` | `500` | `0` | `0` | `0` |
| `LiquidityPool` | `99,928` | `99,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,197` | `53,197` | `0` | `0` | `0` | `0` |

#### Event Logs
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeCreated`
  - `positionId`: `16`
  - `user`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `principal`: `500000000000000000000`
  - `planId`: `1`
  - `sourceType`: `0`
  - `weight`: `500000000000000000000`
  - `unlockAt`: `1780775261`
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `to`: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
  - `value`: `500000000000000000000`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeAccountingSnapshot`
  - `positionId`: `16`
  - `user`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `actionKind`: `0`
  - `activeStakeAfter`: `3500000000000000000000`
  - `totalWeightedSharesAfter`: `15500000000000000000000`
  - `accountedOddBalanceAfter`: `20910000000000000000000`
  - `accRewardPerShareAfter`: `122492307692307673`

### TX-04 `DEPOSIT_GLOBAL_LPUSER`
- sender: `lpUser` / `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
- tx_hash: `2c0056f4f5ed1a8d8978d97ae4b7a2e31e87dc881cc45e9bebc8c232fc536c99`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `266168`
- tx_fee: `266168000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,028` | `98,456,028` | `0` | `9.9905190711555412` | `9.9905190711555412` | `0` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `8,349` | `8,349` | `0` | `0.074790011` | `0.074790011` | `0` |
| `bob` | `5,184.264` | `5,184.264` | `0` | `0.053517469` | `0.053517469` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `9,000` | `4,000` | `-5,000` | `0.077493542` | `0.077227374` | `-0.000266168` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,910` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `99,928` | `104,928` | `5,000` | `0` | `0` | `0` |
| `BettingPool` | `53,197` | `53,197` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `5000000000000000000000`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityDeposited`
  - `positionId`: `31`
  - `poolId`: `0`
  - `user`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
  - `amount`: `5000000000000000000000`
  - `weight`: `5000000000000000000000`
  - `planId`: `1`
  - `unlockAt`: `1780768095`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'`
  - `poolId`: `0`
  - `positionId`: `31`
  - `actionKind`: `0`
  - `requestableLiquidityAfter`: `89980986741363211952000`
  - `totalActiveDepositedAfter`: `99000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `11000000000000000000000`
  - `poolTotalDepositedAfter`: `39000000000000000000000`
  - `poolTotalWeightAfter`: `39000000000000000000000`

### TX-05 `OPEN_MARKET_A`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `96336ae7796de1bbcd1257da17e26066abbd020861a22c9edd9e7cff158801c3`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `520187`
- tx_fee: `520187000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,028` | `98,456,028` | `0` | `9.9905190711555412` | `9.9899988841555412` | `-0.000520187` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `8,349` | `8,349` | `0` | `0.074790011` | `0.074790011` | `0` |
| `bob` | `5,184.264` | `5,184.264` | `0` | `0.053517469` | `0.053517469` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,910` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `104,928` | `104,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,197` | `53,197` | `0` | `0` | `0` | `0` |

#### Event Logs
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MatchPoolOpened`
  - `matchId`: `b'\xf1\x14\xfc\xd9\xdb\x87\x03\x8c\x02\x8b\r2;\x87\x07\xf2g\xf4@\xf4&\xad\x81\x06\xae]d\x97\x8em\xd5\x1e'`
  - `poolId`: `109044478563369518632220406228553792157082235709613751216933062256953547150622`
  - `matchEndTime`: `1780718373`
  - `depositCloseAt`: `1780718313`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\xf1\x14\xfc\xd9\xdb\x87\x03\x8c\x02\x8b\r2;\x87\x07\xf2g\xf4@\xf4&\xad\x81\x06\xae]d\x97\x8em\xd5\x1e'`
  - `poolId`: `109044478563369518632220406228553792157082235709613751216933062256953547150622`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `89980986741363211952000`
  - `totalActiveDepositedAfter`: `99000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `11000000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketOpened`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
  - `matchId`: `b'\xf1\x14\xfc\xd9\xdb\x87\x03\x8c\x02\x8b\r2;\x87\x07\xf2g\xf4@\xf4&\xad\x81\x06\xae]d\x97\x8em\xd5\x1e'`
  - `marketType`: `0`
  - `line`: `0`
  - `matchStartTime`: `1780718313`
  - `lockAt`: `1780718373`
  - `quoteVersion`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
  - `updatedAt`: `1780717730`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-06 `OPEN_MARKET_B_PUSH`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `6cafdbe3ae7669f24ccb3e0b385469f1f30e3047647704b4ce8a1561f5c3f282`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `470740`
- tx_fee: `470740000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,028` | `98,456,028` | `0` | `9.9899988841555412` | `9.9895281441555412` | `-0.00047074` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `8,349` | `8,349` | `0` | `0.074790011` | `0.074790011` | `0` |
| `bob` | `5,184.264` | `5,184.264` | `0` | `0.053517469` | `0.053517469` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,910` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `104,928` | `104,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,197` | `53,197` | `0` | `0` | `0` | `0` |

#### Event Logs
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MatchPoolOpened`
  - `matchId`: `b'l\x06l\xd4"\xe3eW\xfdvAo\xc3\x08\xd7\x15\xbaa\x0cNF\x85\xaf\x87\x15\x9d\xdem*\xf8\xe4\xe1'`
  - `poolId`: `48861139837169750220545301022631937939570884532291474847705890714733847831777`
  - `matchEndTime`: `1780718373`
  - `depositCloseAt`: `1780718313`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'l\x06l\xd4"\xe3eW\xfdvAo\xc3\x08\xd7\x15\xbaa\x0cNF\x85\xaf\x87\x15\x9d\xdem*\xf8\xe4\xe1'`
  - `poolId`: `48861139837169750220545301022631937939570884532291474847705890714733847831777`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `89980986741363211952000`
  - `totalActiveDepositedAfter`: `99000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `11000000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketOpened`
  - `marketId`: `b'r3\xdb\x96\xbd\xa7\xf1\x1e~0BXb\x1e\x1br&J\x1br\xa6\x14\xcb\xbdN\xafR\x0cx\x9fT\x1d'`
  - `matchId`: `b'l\x06l\xd4"\xe3eW\xfdvAo\xc3\x08\xd7\x15\xbaa\x0cNF\x85\xaf\x87\x15\x9d\xdem*\xf8\xe4\xe1'`
  - `marketType`: `1`
  - `line`: `1`
  - `matchStartTime`: `1780718313`
  - `lockAt`: `1780718373`
  - `quoteVersion`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'r3\xdb\x96\xbd\xa7\xf1\x1e~0BXb\x1e\x1br&J\x1br\xa6\x14\xcb\xbdN\xafR\x0cx\x9fT\x1d'`
  - `updatedAt`: `1780717770`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-07 `PLACE_BET_A_ALICE_WITH_REFERRER`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `53f67187c892ba6168a8d4dad9206d025e203678ca643fdb48a5bd8d9b1fcb4d`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `506710`
- tx_fee: `506710000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,028` | `98,456,028` | `0` | `9.9895281441555412` | `9.9895281441555412` | `0` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `8,349` | `7,339` | `-1,010` | `0.074790011` | `0.074283301` | `-0.00050671` |
| `bob` | `5,184.264` | `5,184.264` | `0` | `0.053517469` | `0.053517469` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,910` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `104,928` | `104,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,197` | `54,207` | `1,010` | `0` | `0` | `0` |

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
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x9a'`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `requestedAmount`: `1000000000000000000000`
  - `acceptedAmount`: `1000000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
  - `updatedAt`: `1780717730`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-08 `PLACE_BET_A_BOB_NO_REFERRER`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `6c762678445fbe654703c06d9aef8a155591179b8d8aa26f7367dcab1b01925d`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `514762`
- tx_fee: `514762000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,028` | `98,456,038` | `10` | `9.9895281441555412` | `9.9895281441555412` | `0` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `7,339` | `7,339` | `0` | `0.074283301` | `0.074283301` | `0` |
| `bob` | `5,184.264` | `4,174.264` | `-1,010` | `0.053517469` | `0.053002707` | `-0.000514762` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,910` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `104,928` | `104,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `54,207` | `55,207` | `1,000` | `0` | `0` | `0` |

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
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x9b'`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `requestedAmount`: `1000000000000000000000`
  - `acceptedAmount`: `1000000000000000000000`
  - `lockedOdds`: `30000`
  - `quoteVersion`: `3`
  - `outcome`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
  - `updatedAt`: `1780717730`
  - `quoteVersion`: `3`
  - `signal`: `0`

### TX-09 `PLACE_BET_B_BOB_PUSH_MARKET`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `70293bea98f7069576a2496d3e65a51875966c3da8827de513bac5b85e86fd40`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `476405`
- tx_fee: `476405000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,038` | `98,456,043` | `5` | `9.9895281441555412` | `9.9895281441555412` | `0` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `7,339` | `7,339` | `0` | `0.074283301` | `0.074283301` | `0` |
| `bob` | `4,174.264` | `3,669.264` | `-505` | `0.053002707` | `0.052526302` | `-0.000476405` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,910` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `104,928` | `104,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `55,207` | `55,707` | `500` | `0` | `0` | `0` |

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
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x9c'`
  - `marketId`: `b'r3\xdb\x96\xbd\xa7\xf1\x1e~0BXb\x1e\x1br&J\x1br\xa6\x14\xcb\xbdN\xafR\x0cx\x9fT\x1d'`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `requestedAmount`: `500000000000000000000`
  - `acceptedAmount`: `500000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'r3\xdb\x96\xbd\xa7\xf1\x1e~0BXb\x1e\x1br&J\x1br\xa6\x14\xcb\xbdN\xafR\x0cx\x9fT\x1d'`
  - `updatedAt`: `1780717770`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-10 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `d8a0bdce4fc88515ab194f527a7565cb9ca9ff618388d0f643aab5171f6c8753`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `316327`
- tx_fee: `316327000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,043` | `98,456,043` | `0` | `9.9895281441555412` | `9.9892118171555412` | `-0.000316327` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `7,339` | `7,339` | `0` | `0.074283301` | `0.074283301` | `0` |
| `bob` | `3,669.264` | `3,669.264` | `0` | `0.052526302` | `0.052526302` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,910` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `104,928` | `104,928` | `0` | `0` | `0` | `0` |
| `BettingPool` | `55,707` | `55,707` | `0` | `0` | `0` | `0` |

#### Event Logs
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `2`
  - `totalBetCount`: `2`

### TX-11 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `ed869f3c545bfb768104bdabb388f8f0e27670bfbe4d1683683c275b8e79e073`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `238671`
- tx_fee: `238671000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,456,043` | `98,454,043` | `-2,000` | `9.9892118171555412` | `9.9889145741555412` | `-0.000297243` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `7,339` | `7,339` | `0` | `0.074283301` | `0.074283301` | `0` |
| `bob` | `3,669.264` | `3,669.264` | `0` | `0.052526302` | `0.052526302` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,910` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `104,928` | `105,088` | `160` | `0` | `0` | `0` |
| `BettingPool` | `55,707` | `55,547` | `-160` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `160000000000000000000`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MarginDistributed`
  - `matchId`: `b'\xf1\x14\xfc\xd9\xdb\x87\x03\x8c\x02\x8b\r2;\x87\x07\xf2g\xf4@\xf4&\xad\x81\x06\xae]d\x97\x8em\xd5\x1e'`
  - `lpMarginShare`: `160000000000000000000`
  - `globalShare`: `160000000000000000000`
  - `matchShare`: `0`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\xf1\x14\xfc\xd9\xdb\x87\x03\x8c\x02\x8b\r2;\x87\x07\xf2g\xf4@\xf4&\xad\x81\x06\xae]d\x97\x8em\xd5\x1e'`
  - `poolId`: `109044478563369518632220406228553792157082235709613751216933062256953547150622`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `90140986741363211952000`
  - `totalActiveDepositedAfter`: `99000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `11000000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `PlatformReserveUpdated`
  - `delta`: `40000000000000000000`
  - `newBalance`: `30540000000000000000000`
  - `reason`: `4`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `PayoutLiquidityReserved`
  - `matchId`: `b'\xf1\x14\xfc\xd9\xdb\x87\x03\x8c\x02\x8b\r2;\x87\x07\xf2g\xf4@\xf4&\xad\x81\x06\xae]d\x97\x8em\xd5\x1e'`
  - `reservedAmount`: `1000000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1780718431`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LossDistributed`
  - `matchId`: `b'\xf1\x14\xfc\xd9\xdb\x87\x03\x8c\x02\x8b\r2;\x87\x07\xf2g\xf4@\xf4&\xad\x81\x06\xae]d\x97\x8em\xd5\x1e'`
  - `lpLossBooked`: `1000000000000000000000`
  - `globalLossShare`: `1000000000000000000000`
  - `matchLossShare`: `0`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\xf1\x14\xfc\xd9\xdb\x87\x03\x8c\x02\x8b\r2;\x87\x07\xf2g\xf4@\xf4&\xad\x81\x06\xae]d\x97\x8em\xd5\x1e'`
  - `poolId`: `109044478563369518632220406228553792157082235709613751216933062256953547150622`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `89140986741363211952000`
  - `totalActiveDepositedAfter`: `99000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `12000000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementFinalized`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
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
- tx_hash: `97b3a16700abb470406b3185a578b2e1a91f3be9a1bddba830888fcef038f56d`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `163722`
- tx_fee: `163722000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,454,043` | `98,454,063` | `20` | `9.9889145741555412` | `9.9889145741555412` | `0` |
| `referrer` | `651` | `651` | `0` | `0.077191216` | `0.077191216` | `0` |
| `alice` | `7,339` | `9,239` | `1,900` | `0.074283301` | `0.074119579` | `-0.000163722` |
| `bob` | `3,669.264` | `3,669.264` | `0` | `0.052526302` | `0.052526302` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,910` | `20,950` | `40` | `0` | `0` | `0` |
| `LiquidityPool` | `105,088` | `105,088` | `0` | `0` | `0` | `0` |
| `BettingPool` | `55,547` | `53,587` | `-1,960` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
  - `value`: `40000000000000000000`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `RewardNotified`
  - `caller`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `amount`: `40000000000000000000`
  - `newAccRewardPerShare`: `125072952853597995`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `15500000000000000000000`
  - `accountedOddBalanceAfter`: `20950000000000000000000`
  - `accRewardPerShareAfter`: `125072952853597995`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `LpLossOffsetApplied`
  - `amount`: `20000000000000000000`
  - `remainingOffset`: `11775000000000000000000`
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
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x9a'`
  - `marketId`: `b'\xf1K;U\xb1\x88v3\xed\xba\x9c\n\xa0\x1c\xae\x99\xa6D\xfc\xe4\xd4\x15wFD\xc6a@u\xe11\xc3'`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `payout`: `1900000000000000000000`
  - `executor`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x9a'`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `grossPayout`: `2000000000000000000000`
  - `taxAmount`: `100000000000000000000`
  - `netPayout`: `1900000000000000000000`

### TX-13 `CLAIM_REFERRAL_REWARD_REFERRER`
- sender: `referrer` / `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
- tx_hash: `2fc33290df64bbdd436f21c772f8a7a04863b32cd6444073e3715780733bd803`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `62907`
- tx_fee: `62907000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,454,063` | `98,454,063` | `0` | `9.9889145741555412` | `9.9889145741555412` | `0` |
| `referrer` | `651` | `681` | `30` | `0.077191216` | `0.077128309` | `-0.000062907` |
| `alice` | `9,239` | `9,239` | `0` | `0.074119579` | `0.074119579` | `0` |
| `bob` | `3,669.264` | `3,669.264` | `0` | `0.052526302` | `0.052526302` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,950` | `20,950` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `105,088` | `105,088` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,587` | `53,557` | `-30` | `0` | `0` | `0` |

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
- tx_hash: `3a7f838e1e4ec473e1e0b1739902c53a449e1435335097d24639e9773ed15eca`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `218636`
- tx_fee: `218636000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,454,063` | `98,454,063` | `0` | `9.9889145741555412` | `9.9886959381555412` | `-0.000218636` |
| `referrer` | `681` | `681` | `0` | `0.077128309` | `0.077128309` | `0` |
| `alice` | `9,239` | `9,239` | `0` | `0.074119579` | `0.074119579` | `0` |
| `bob` | `3,669.264` | `4,169.264` | `500` | `0.052526302` | `0.052526302` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,950` | `20,950` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `105,088` | `105,088` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,557` | `53,057` | `-500` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `value`: `500000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `BetRefunded`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x9c'`
  - `marketId`: `b'r3\xdb\x96\xbd\xa7\xf1\x1e~0BXb\x1e\x1br&J\x1br\xa6\x14\xcb\xbdN\xafR\x0cx\x9fT\x1d'`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `refundAmount`: `500000000000000000000`
  - `reason`: `2`
  - `quoteVersion`: `2`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'r3\xdb\x96\xbd\xa7\xf1\x1e~0BXb\x1e\x1br&J\x1br\xa6\x14\xcb\xbdN\xafR\x0cx\x9fT\x1d'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-15 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `b9dc5f9c5765adf8fcad9e4aa5dbf1b0dab6df58858b6dbc3da66f36e7f2dc8f`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `83414`
- tx_fee: `83414000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `98,454,063` | `98,454,063` | `0` | `9.9886959381555412` | `9.9886125241555412` | `-0.000083414` |
| `referrer` | `681` | `681` | `0` | `0.077128309` | `0.077128309` | `0` |
| `alice` | `9,239` | `9,239` | `0` | `0.074119579` | `0.074119579` | `0` |
| `bob` | `4,169.264` | `4,169.264` | `0` | `0.052526302` | `0.052526302` | `0` |
| `carol` | `2,740.736` | `2,740.736` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `4,000` | `4,000` | `0` | `0.077227374` | `0.077227374` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `20,950` | `20,950` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `105,088` | `105,088` | `0` | `0` | `0` | `0` |
| `BettingPool` | `53,057` | `53,057` | `0` | `0` | `0` | `0` |

#### Event Logs
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementFinalized`
  - `marketId`: `b'r3\xdb\x96\xbd\xa7\xf1\x1e~0BXb\x1e\x1br&J\x1br\xa6\x14\xcb\xbdN\xafR\x0cx\x9fT\x1d'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `0`
  - `lpMarginShare`: `0`
  - `platformMarginShare`: `0`
  - `quoteVersion`: `3`
