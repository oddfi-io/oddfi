# 2026-06-01 BSC Testnet Full Redeploy Scenario Report

## 环境
- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- admin: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- ODDToken: `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0`
- StakingPool: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
- LiquidityPool: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
- BettingPool: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
- BettingSettlementModule: `0x560cfD66DB1F0aF7f903d76Cb52bC8e49352028d`

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
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `99,971,000` | `99,947,035` | `14.6521292044555412` | `14.6498405024555412` |
| `referrer` | `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322` | `0` | `1,530` | `0.059141878` | `0.058808262` |
| `alice` | `0x12BD5D79a1A6433A03c4f4e93870255d16572C72` | `0` | `4,890` | `0.059047053` | `0.058194814` |
| `bob` | `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d` | `0` | `4,861.544` | `0.058812504` | `0.057692847` |
| `carol` | `0x4A6d9c75867AAd27148a956c1c40dEAcf1447CF6` | `0` | `2,123.456` | `0.06` | `0.06` |
| `lpUser` | `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a` | `0` | `5,000` | `0.05913315` | `0.058855626` |
| `ODDToken` | `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `500` | `1,040` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `1,000` | `6,160` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `5,101` | `4,961` | `0` | `0` |

## 逐交易记录
### TX-01 `SEED_ODD_referrer`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `4a169ce8573e33ac904745cc54e1209b42dc3d433b85b25707166844ac5407d3`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `58572`
- tx_fee: `58572000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,971,000` | `99,969,000` | `-2,000` | `14.6521292044555412` | `14.6520706324555412` | `-0.000058572` |
| `referrer` | `0` | `2,000` | `2,000` | `0.059141878` | `0.059141878` | `0` |
| `alice` | `0` | `0` | `0` | `0.059047053` | `0.059047053` | `0` |
| `bob` | `0` | `0` | `0` | `0.058812504` | `0.058812504` | `0` |
| `carol` | `0` | `0` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `0` | `0` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `value`: `2000000000000000000000`

### TX-02 `SEED_ODD_alice`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `c68a3444a852dcf02e912b4e90f06ae6ff14105e9e8d6c12b456eb796f112c74`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `58584`
- tx_fee: `58584000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,969,000` | `99,964,000` | `-5,000` | `14.6520706324555412` | `14.6520120484555412` | `-0.000058584` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059141878` | `0.059141878` | `0` |
| `alice` | `0` | `5,000` | `5,000` | `0.059047053` | `0.059047053` | `0` |
| `bob` | `0` | `0` | `0` | `0.058812504` | `0.058812504` | `0` |
| `carol` | `0` | `0` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `0` | `0` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `value`: `5000000000000000000000`

### TX-03 `SEED_ODD_bob`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `7bce7939b46429761fb4393635c85f7e66d6598dd185af0ef4b5a5ec4189897c`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `58584`
- tx_fee: `58584000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,964,000` | `99,959,000` | `-5,000` | `14.6520120484555412` | `14.6519534644555412` | `-0.000058584` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059141878` | `0.059141878` | `0` |
| `alice` | `5,000` | `5,000` | `0` | `0.059047053` | `0.059047053` | `0` |
| `bob` | `0` | `5,000` | `5,000` | `0.058812504` | `0.058812504` | `0` |
| `carol` | `0` | `0` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `0` | `0` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `value`: `5000000000000000000000`

### TX-04 `SEED_ODD_carol`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `f2c1bc5810ac3e0e2b23507972ee17413a6ca3fad3ae693f9c92be0075d6ec8c`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `58572`
- tx_fee: `58572000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,959,000` | `99,957,000` | `-2,000` | `14.6519534644555412` | `14.6518948924555412` | `-0.000058572` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059141878` | `0.059141878` | `0` |
| `alice` | `5,000` | `5,000` | `0` | `0.059047053` | `0.059047053` | `0` |
| `bob` | `5,000` | `5,000` | `0` | `0.058812504` | `0.058812504` | `0` |
| `carol` | `0` | `2,000` | `2,000` | `0.06` | `0.06` | `0` |
| `lpUser` | `0` | `0` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0x4A6d9c75867AAd27148a956c1c40dEAcf1447CF6`
  - `value`: `2000000000000000000000`

### TX-05 `SEED_ODD_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `1ee20eaf4c4ee505dae08e2e155bb474117daf28cc6fe373a981e0367ba2174d`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `58584`
- tx_fee: `58584000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,957,000` | `99,947,000` | `-10,000` | `14.6518948924555412` | `14.6518363084555412` | `-0.000058584` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059141878` | `0.059141878` | `0` |
| `alice` | `5,000` | `5,000` | `0` | `0.059047053` | `0.059047053` | `0` |
| `bob` | `5,000` | `5,000` | `0` | `0.058812504` | `0.058812504` | `0` |
| `carol` | `2,000` | `2,000` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `0` | `10,000` | `10,000` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
  - `value`: `10000000000000000000000`

### TX-06 `DEP_003_ALICE_TO_BOB`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `4e23565f7e3971032eefc9af37fdfcaeeb7b2b4503c3cf5ae4e6d01acd50d032`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `41472`
- tx_fee: `41472000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6518363084555412` | `0` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059141878` | `0.059141878` | `0` |
| `alice` | `5,000` | `4,000` | `-1,000` | `0.059047053` | `0.059005581` | `-0.000041472` |
| `bob` | `5,000` | `6,000` | `1,000` | `0.058812504` | `0.058812504` | `0` |
| `carol` | `2,000` | `2,000` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `10,000` | `10,000` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `to`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `value`: `1000000000000000000000`

### TX-07 `DEP_003_BOB_TO_CAROL`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `a53f9d730d9f7a4ac05da625f0b3a8a5ae58e5fa1c639d3e84800c5fba1b883b`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `41472`
- tx_fee: `41472000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6518363084555412` | `0` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059141878` | `0.059141878` | `0` |
| `alice` | `4,000` | `4,000` | `0` | `0.059005581` | `0.059005581` | `0` |
| `bob` | `6,000` | `5,876.544` | `-123.456` | `0.058812504` | `0.058771032` | `-0.000041472` |
| `carol` | `2,000` | `2,123.456` | `123.456` | `0.06` | `0.06` | `0` |
| `lpUser` | `10,000` | `10,000` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `to`: `0x4A6d9c75867AAd27148a956c1c40dEAcf1447CF6`
  - `value`: `123456000000000000000`

### TX-08 `APPROVE_REFERRER_STAKING`
- sender: `referrer` / `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
- tx_hash: `82dfc0f6e9204346ca685c4723c56428850c2cf863061edf16ac04084ed8f657`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `51156`
- tx_fee: `51156000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6518363084555412` | `0` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059141878` | `0.059090722` | `-0.000051156` |
| `alice` | `4,000` | `4,000` | `0` | `0.059005581` | `0.059005581` | `0` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058771032` | `0.058771032` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `10,000` | `10,000` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Approval`
  - `owner`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `spender`: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-09 `APPROVE_ALICE_BETTING`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `763329f55b4883a0d7ec5e64c9246d7f6e090e7ed04aa62dc998b3297e4b6292`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `51156`
- tx_fee: `51156000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6518363084555412` | `0` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059090722` | `0.059090722` | `0` |
| `alice` | `4,000` | `4,000` | `0` | `0.059005581` | `0.058954425` | `-0.000051156` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058771032` | `0.058771032` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `10,000` | `10,000` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Approval`
  - `owner`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `spender`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-10 `APPROVE_BOB_BETTING`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `45ad5f3eb6b3fd7bd26e14e595225137d3ca64e345aac60bd0737ee4322f3068`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `51156`
- tx_fee: `51156000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6518363084555412` | `0` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059090722` | `0.059090722` | `0` |
| `alice` | `4,000` | `4,000` | `0` | `0.058954425` | `0.058954425` | `0` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058771032` | `0.058719876` | `-0.000051156` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `10,000` | `10,000` | `0` | `0.05913315` | `0.05913315` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Approval`
  - `owner`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `spender`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-11 `APPROVE_LPUSER_LIQUIDITY`
- sender: `lpUser` / `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
- tx_hash: `eccd661718ee15791dbd9e47b8678ce928b11d5ef9b1b0eaa98c002502be6ea8`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `51156`
- tx_fee: `51156000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6518363084555412` | `0` |
| `referrer` | `2,000` | `2,000` | `0` | `0.059090722` | `0.059090722` | `0` |
| `alice` | `4,000` | `4,000` | `0` | `0.058954425` | `0.058954425` | `0` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058719876` | `0.058719876` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `10,000` | `10,000` | `0` | `0.05913315` | `0.059081994` | `-0.000051156` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `500` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Approval`
  - `owner`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
  - `spender`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-12 `STAKE_REFERRER`
- sender: `referrer` / `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
- tx_hash: `49439798a89e0357130e1a5a4d3547c2a2bc8e7da762dadb4d4efe58fd2ef5a0`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `219553`
- tx_fee: `219553000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6518363084555412` | `0` |
| `referrer` | `2,000` | `1,500` | `-500` | `0.059090722` | `0.058871169` | `-0.000219553` |
| `alice` | `4,000` | `4,000` | `0` | `0.058954425` | `0.058954425` | `0` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058719876` | `0.058719876` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `10,000` | `10,000` | `0` | `0.059081994` | `0.059081994` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `500` | `1,000` | `500` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeCreated`
  - `positionId`: `2`
  - `user`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `principal`: `500000000000000000000`
  - `planId`: `1`
  - `sourceType`: `0`
  - `weight`: `500000000000000000000`
  - `unlockAt`: `1780375364`
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `to`: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
  - `value`: `500000000000000000000`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeAccountingSnapshot`
  - `positionId`: `2`
  - `user`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `actionKind`: `0`
  - `activeStakeAfter`: `500000000000000000000`
  - `totalWeightedSharesAfter`: `1000000000000000000000`
  - `accountedOddBalanceAfter`: `1000000000000000000000`
  - `accRewardPerShareAfter`: `0`

### TX-13 `DEPOSIT_GLOBAL_LPUSER`
- sender: `lpUser` / `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
- tx_hash: `f7e9cba109663128fcbd2d19983ed3b1181d1adaf405324058240471bef72c28`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `226368`
- tx_fee: `226368000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6518363084555412` | `0` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `4,000` | `4,000` | `0` | `0.058954425` | `0.058954425` | `0` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058719876` | `0.058719876` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `10,000` | `5,000` | `-5,000` | `0.059081994` | `0.058855626` | `-0.000226368` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `1,000` | `6,000` | `5,000` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `5000000000000000000000`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityDeposited`
  - `positionId`: `2`
  - `poolId`: `0`
  - `user`: `0xc2b812a095Ef72dD0bE25414F660d2fb97b4641a`
  - `amount`: `5000000000000000000000`
  - `weight`: `5000000000000000000000`
  - `planId`: `1`
  - `unlockAt`: `1780368198`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'`
  - `poolId`: `0`
  - `positionId`: `2`
  - `actionKind`: `0`
  - `requestableLiquidityAfter`: `6000000000000000000000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `0`
  - `poolTotalDepositedAfter`: `6000000000000000000000`
  - `poolTotalWeightAfter`: `6000000000000000000000`

### TX-14 `OPEN_MARKET_A`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `eb3307fe2f6652c72199f8403a850db934881f7f81336d7afbcffdfcf0420918`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `520851`
- tx_fee: `520851000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6518363084555412` | `14.6513154574555412` | `-0.000520851` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `4,000` | `4,000` | `0` | `0.058954425` | `0.058954425` | `0` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058719876` | `0.058719876` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,000` | `6,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MatchPoolOpened`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `poolId`: `55240671663647684997179221645628843086221021716988317649097002616338751909930`
  - `matchEndTime`: `1780318474`
  - `depositCloseAt`: `1780318414`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `poolId`: `55240671663647684997179221645628843086221021716988317649097002616338751909930`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `6000000000000000000000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `0`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketOpened`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `marketType`: `0`
  - `line`: `0`
  - `matchStartTime`: `1780318414`
  - `lockAt`: `1780318114`
  - `quoteVersion`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `updatedAt`: `1780317831`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-15 `OPEN_MARKET_B_PUSH`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `67c2509415eb7b0855b4967c1cdc498329b4635f1cda9d77d1f3a146b48cc50b`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `471404`
- tx_fee: `471404000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6513154574555412` | `14.6508440534555412` | `-0.000471404` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `4,000` | `4,000` | `0` | `0.058954425` | `0.058954425` | `0` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058719876` | `0.058719876` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,000` | `6,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `5,101` | `0` | `0` | `0` | `0` |

#### Event Logs
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MatchPoolOpened`
  - `matchId`: `b'3\xce\xeb\xe0\xf1\x1f\xbc\xb0\xcfm\xe6\xc8\xdc\xfaY\xcb6\xe0\xc7\x06\x88\xa8]\x83\x02&\r\xcb\xedg<e'`
  - `poolId`: `23433553747903800369816951791142429211683790876538375368704868796267548327013`
  - `matchEndTime`: `1780318474`
  - `depositCloseAt`: `1780318414`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'3\xce\xeb\xe0\xf1\x1f\xbc\xb0\xcfm\xe6\xc8\xdc\xfaY\xcb6\xe0\xc7\x06\x88\xa8]\x83\x02&\r\xcb\xedg<e'`
  - `poolId`: `23433553747903800369816951791142429211683790876538375368704868796267548327013`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `6000000000000000000000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `0`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketOpened`
  - `marketId`: `b'\xd4\xe9\x8b\x1b\xf00\x95\xd2\xb6\x89b&J\xf7\xcf\x0c\xabK\x13>%V\x90\x10\xfa\r\xa1\xc7\xfa\x1c\x91\xb2'`
  - `matchId`: `b'3\xce\xeb\xe0\xf1\x1f\xbc\xb0\xcfm\xe6\xc8\xdc\xfaY\xcb6\xe0\xc7\x06\x88\xa8]\x83\x02&\r\xcb\xedg<e'`
  - `marketType`: `1`
  - `line`: `1`
  - `matchStartTime`: `1780318414`
  - `lockAt`: `1780318114`
  - `quoteVersion`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'\xd4\xe9\x8b\x1b\xf00\x95\xd2\xb6\x89b&J\xf7\xcf\x0c\xabK\x13>%V\x90\x10\xfa\r\xa1\xc7\xfa\x1c\x91\xb2'`
  - `updatedAt`: `1780317866`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-16 `PLACE_BET_A_ALICE_WITH_REFERRER`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `9cec7f609e613e2e6123827f0124d6ee3fa4fd59e16fa5a6f5106297a0a30b90`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `583708`
- tx_fee: `583708000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,000` | `0` | `14.6508440534555412` | `14.6508440534555412` | `0` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `4,000` | `2,990` | `-1,010` | `0.058954425` | `0.058370717` | `-0.000583708` |
| `bob` | `5,876.544` | `5,876.544` | `0` | `0.058719876` | `0.058719876` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,000` | `6,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,101` | `6,111` | `1,010` | `0` | `0` | `0` |

#### Event Logs
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `ReferrerBound`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `referrer`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
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
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02'`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `requestedAmount`: `1000000000000000000000`
  - `acceptedAmount`: `1000000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `updatedAt`: `1780317831`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-17 `PLACE_BET_A_BOB_NO_REFERRER`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `b65485bd5eb2b42c43ef25134494132a0b092088409ea63dcc40ae982a9b2d88`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `549793`
- tx_fee: `549793000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,000` | `99,947,010` | `10` | `14.6508440534555412` | `14.6508440534555412` | `0` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `2,990` | `2,990` | `0` | `0.058370717` | `0.058370717` | `0` |
| `bob` | `5,876.544` | `4,866.544` | `-1,010` | `0.058719876` | `0.058170083` | `-0.000549793` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,000` | `6,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `6,111` | `7,111` | `1,000` | `0` | `0` | `0` |

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
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x03'`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `requestedAmount`: `1000000000000000000000`
  - `acceptedAmount`: `1000000000000000000000`
  - `lockedOdds`: `30000`
  - `quoteVersion`: `3`
  - `outcome`: `1`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `updatedAt`: `1780317831`
  - `quoteVersion`: `3`
  - `signal`: `0`

### TX-18 `PLACE_BET_B_BOB_PUSH_MARKET`
- sender: `bob` / `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
- tx_hash: `6b809c69ba7cd184ecf46fc9e9a550dcadc246da51566e06b657f68f5a56ceb0`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `477236`
- tx_fee: `477236000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,010` | `99,947,015` | `5` | `14.6508440534555412` | `14.6508440534555412` | `0` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `2,990` | `2,990` | `0` | `0.058370717` | `0.058370717` | `0` |
| `bob` | `4,866.544` | `4,361.544` | `-505` | `0.058170083` | `0.057692847` | `-0.000477236` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,000` | `6,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `7,111` | `7,611` | `500` | `0` | `0` | `0` |

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
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x04'`
  - `marketId`: `b'\xd4\xe9\x8b\x1b\xf00\x95\xd2\xb6\x89b&J\xf7\xcf\x0c\xabK\x13>%V\x90\x10\xfa\r\xa1\xc7\xfa\x1c\x91\xb2'`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `requestedAmount`: `500000000000000000000`
  - `acceptedAmount`: `500000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `OddsUpdated`
  - `marketId`: `b'\xd4\xe9\x8b\x1b\xf00\x95\xd2\xb6\x89b&J\xf7\xcf\x0c\xabK\x13>%V\x90\x10\xfa\r\xa1\xc7\xfa\x1c\x91\xb2'`
  - `updatedAt`: `1780317866`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-19 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `c264778ee75d3b5392ef437dc77fd461b2dcbbdeeca0af30593f0660780c6472`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `355772`
- tx_fee: `355772000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,015` | `99,947,015` | `0` | `14.6508440534555412` | `14.6504882814555412` | `-0.000355772` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `2,990` | `2,990` | `0` | `0.058370717` | `0.058370717` | `0` |
| `bob` | `4,361.544` | `4,361.544` | `0` | `0.057692847` | `0.057692847` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,000` | `6,000` | `0` | `0` | `0` | `0` |
| `BettingPool` | `7,611` | `7,611` | `0` | `0` | `0` | `0` |

#### Event Logs
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MatchPoolDepositClosed`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `poolId`: `55240671663647684997179221645628843086221021716988317649097002616338751909930`
  - `reason`: `0`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `poolId`: `55240671663647684997179221645628843086221021716988317649097002616338751909930`
  - `positionId`: `0`
  - `actionKind`: `3`
  - `requestableLiquidityAfter`: `6000000000000000000000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `0`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `2`
  - `totalBetCount`: `2`

### TX-20 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `52866bb1b026246e52ed2f933e0ec3d00891daab054daac65dea87f43cf1a2cb`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `305264`
- tx_fee: `305264000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,015` | `99,947,015` | `0` | `14.6504882814555412` | `14.6501830174555412` | `-0.000305264` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `2,990` | `2,990` | `0` | `0.058370717` | `0.058370717` | `0` |
| `bob` | `4,361.544` | `4,361.544` | `0` | `0.057692847` | `0.057692847` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,000` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,000` | `6,160` | `160` | `0` | `0` | `0` |
| `BettingPool` | `7,611` | `7,451` | `-160` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `160000000000000000000`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MarginDistributed`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `lpMarginShare`: `160000000000000000000`
  - `globalShare`: `160000000000000000000`
  - `matchShare`: `0`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `poolId`: `55240671663647684997179221645628843086221021716988317649097002616338751909930`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `6160000000000000000000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `0`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `PlatformReserveUpdated`
  - `delta`: `40000000000000000000`
  - `newBalance`: `5040000000000000000000`
  - `reason`: `4`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `PayoutLiquidityReserved`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `reservedAmount`: `1000000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1780318532`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LossDistributed`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `lpLossBooked`: `1000000000000000000000`
  - `globalLossShare`: `1000000000000000000000`
  - `matchLossShare`: `0`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b"z!\x1c\xb7\x07p\xb3\x8e\xef\x08\x07\x08y\xca'gb\x850M\xa0\x98Ct}\xb3L\\cop*"`
  - `poolId`: `55240671663647684997179221645628843086221021716988317649097002616338751909930`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `5160000000000000000000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1000000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementFinalized`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `2000000000000000000000`
  - `lpMarginShare`: `160000000000000000000`
  - `platformMarginShare`: `40000000000000000000`
  - `quoteVersion`: `5`

### TX-21 `CLAIM_PAYOUT_ALICE`
- sender: `alice` / `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- tx_hash: `821238c19f894eb07f68e2ced49cf67291584b607320741a6e97426928f851d8`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `175903`
- tx_fee: `175903000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,015` | `99,947,035` | `20` | `14.6501830174555412` | `14.6501830174555412` | `0` |
| `referrer` | `1,500` | `1,500` | `0` | `0.058871169` | `0.058871169` | `0` |
| `alice` | `2,990` | `4,890` | `1,900` | `0.058370717` | `0.058194814` | `-0.000175903` |
| `bob` | `4,361.544` | `4,361.544` | `0` | `0.057692847` | `0.057692847` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,000` | `1,040` | `40` | `0` | `0` | `0` |
| `LiquidityPool` | `6,160` | `6,160` | `0` | `0` | `0` | `0` |
| `BettingPool` | `7,451` | `5,491` | `-1,960` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
  - `value`: `40000000000000000000`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `RewardNotified`
  - `caller`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `amount`: `40000000000000000000`
  - `newAccRewardPerShare`: `40000000000000000`
- `StakingPool` @ `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` -> `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `1000000000000000000000`
  - `accountedOddBalanceAfter`: `1040000000000000000000`
  - `accRewardPerShareAfter`: `40000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `LpLossOffsetApplied`
  - `amount`: `20000000000000000000`
  - `remainingOffset`: `980000000000000000000`
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
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02'`
  - `marketId`: `b"80g{l\xbd\xef]\x9f\xc3'\xd3\xb9jm\xe7\xd7\xdc\xdf\xb4L\xafU\xc8\xd2\x9a\x93\xd1!\x0ej%"`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `payout`: `1900000000000000000000`
  - `executor`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02'`
  - `user`: `0x12BD5D79a1A6433A03c4f4e93870255d16572C72`
  - `grossPayout`: `2000000000000000000000`
  - `taxAmount`: `100000000000000000000`
  - `netPayout`: `1900000000000000000000`

### TX-22 `CLAIM_REFERRAL_REWARD_REFERRER`
- sender: `referrer` / `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
- tx_hash: `c176547ca995af1159a706463fe0e7ff23fb1639056064cbe16ea93e2609b0fa`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `62907`
- tx_fee: `62907000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,035` | `99,947,035` | `0` | `14.6501830174555412` | `14.6501830174555412` | `0` |
| `referrer` | `1,500` | `1,530` | `30` | `0.058871169` | `0.058808262` | `-0.000062907` |
| `alice` | `4,890` | `4,890` | `0` | `0.058194814` | `0.058194814` | `0` |
| `bob` | `4,361.544` | `4,361.544` | `0` | `0.057692847` | `0.057692847` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,040` | `1,040` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,160` | `6,160` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,491` | `5,461` | `-30` | `0` | `0` | `0` |

#### Event Logs
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `value`: `30000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `ReferralClaimed`
  - `referrer`: `0x2FB13cbFe9FA98AEE5225D5023C2031EbB734322`
  - `oddAmount`: `30000000000000000000`

### TX-23 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `257db57434cdcfa2ec0cd13e33330c5d528d5013a73739c5c894e63d34eae500`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `260877`
- tx_fee: `260877000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,035` | `99,947,035` | `0` | `14.6501830174555412` | `14.6499221404555412` | `-0.000260877` |
| `referrer` | `1,530` | `1,530` | `0` | `0.058808262` | `0.058808262` | `0` |
| `alice` | `4,890` | `4,890` | `0` | `0.058194814` | `0.058194814` | `0` |
| `bob` | `4,361.544` | `4,861.544` | `500` | `0.057692847` | `0.057692847` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,040` | `1,040` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,160` | `6,160` | `0` | `0` | `0` | `0` |
| `BettingPool` | `5,461` | `4,961` | `-500` | `0` | `0` | `0` |

#### Event Logs
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `MatchPoolDepositClosed`
  - `matchId`: `b'3\xce\xeb\xe0\xf1\x1f\xbc\xb0\xcfm\xe6\xc8\xdc\xfaY\xcb6\xe0\xc7\x06\x88\xa8]\x83\x02&\r\xcb\xedg<e'`
  - `poolId`: `23433553747903800369816951791142429211683790876538375368704868796267548327013`
  - `reason`: `0`
- `LiquidityPool` @ `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` -> `LiquidityAccountingSnapshot`
  - `matchId`: `b'3\xce\xeb\xe0\xf1\x1f\xbc\xb0\xcfm\xe6\xc8\xdc\xfaY\xcb6\xe0\xc7\x06\x88\xa8]\x83\x02&\r\xcb\xedg<e'`
  - `poolId`: `23433553747903800369816951791142429211683790876538375368704868796267548327013`
  - `positionId`: `0`
  - `actionKind`: `3`
  - `requestableLiquidityAfter`: `5160000000000000000000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1000000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `ODDToken` @ `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` -> `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `value`: `500000000000000000000`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `BetRefunded`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x04'`
  - `marketId`: `b'\xd4\xe9\x8b\x1b\xf00\x95\xd2\xb6\x89b&J\xf7\xcf\x0c\xabK\x13>%V\x90\x10\xfa\r\xa1\xc7\xfa\x1c\x91\xb2'`
  - `user`: `0xaA1E10ee23792640284ecbEC8B45A3428e63d09d`
  - `refundAmount`: `500000000000000000000`
  - `reason`: `2`
  - `quoteVersion`: `3`
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'\xd4\xe9\x8b\x1b\xf00\x95\xd2\xb6\x89b&J\xf7\xcf\x0c\xabK\x13>%V\x90\x10\xfa\r\xa1\xc7\xfa\x1c\x91\xb2'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-24 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `2f00329d4117cd4525e614a5bbf811bbab2771f68f2f11ac56182841ae6396ba`
- status: `1`
- gas_price: `1000000000` wei
- gas_used: `81638`
- tx_fee: `81638000000000` wei

#### 账户余额变化
| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | `99,947,035` | `99,947,035` | `0` | `14.6499221404555412` | `14.6498405024555412` | `-0.000081638` |
| `referrer` | `1,530` | `1,530` | `0` | `0.058808262` | `0.058808262` | `0` |
| `alice` | `4,890` | `4,890` | `0` | `0.058194814` | `0.058194814` | `0` |
| `bob` | `4,861.544` | `4,861.544` | `0` | `0.057692847` | `0.057692847` | `0` |
| `carol` | `2,123.456` | `2,123.456` | `0` | `0.06` | `0.06` | `0` |
| `lpUser` | `5,000` | `5,000` | `0` | `0.058855626` | `0.058855626` | `0` |
| `ODDToken` | `0` | `0` | `0` | `0` | `0` | `0` |
| `StakingPool` | `1,040` | `1,040` | `0` | `0` | `0` | `0` |
| `LiquidityPool` | `6,160` | `6,160` | `0` | `0` | `0` | `0` |
| `BettingPool` | `4,961` | `4,961` | `0` | `0` | `0` | `0` |

#### Event Logs
- `BettingPool` @ `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` -> `MarketSettlementFinalized`
  - `marketId`: `b'\xd4\xe9\x8b\x1b\xf00\x95\xd2\xb6\x89b&J\xf7\xcf\x0c\xabK\x13>%V\x90\x10\xfa\r\xa1\xc7\xfa\x1c\x91\xb2'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `0`
  - `lpMarginShare`: `0`
  - `platformMarginShare`: `0`
  - `quoteVersion`: `4`
