# Write Scenario Results

Date: 2026-05-08

## Purpose

This document stores the latest real BNB testnet write scenario result for the public SDK package.

Primary test file:

- `pkg/oddfi/write_scenario_e2e_test.go`

Supplemental adapter/binding test file:

- `internal/infrastructure/contracts/write_scenario_e2e_test.go`

The `pkg` test is the acceptance entry point because SDK users import the public `pkg/oddfi` API. The `internal/infrastructure/contracts` test is retained to verify the lower-level contract adapters without making generated bindings part of the public API.

## Environment

Command shape:

```bash
ODDFI_WRITE_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_PRIVATE_KEY=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./pkg/oddfi -run 'TestWriteScenario.*ViaPublicSDK' -count=1 -v
```

Current test files keep each contract scenario as an independent test case:

| Scenario | Test |
| --- | --- |
| ODDToken transfer | `TestWriteScenarioODDTokenTransferViaPublicSDK` |
| ODDToken approve | `TestWriteScenarioODDTokenApproveViaPublicSDK` |
| StakingPool stake | `TestWriteScenarioStakingPoolStakeViaPublicSDK` |
| LiquidityPool depositGlobal | `TestWriteScenarioLiquidityPoolDepositGlobalViaPublicSDK` |
| BettingPool addPlatformReserve | `TestWriteScenarioBettingPoolAddPlatformReserveViaPublicSDK` |

To run all public SDK write scenarios:

```bash
go test ./pkg/oddfi -run 'TestWriteScenario.*ViaPublicSDK' -count=1 -v
```

To run one scenario, pass its exact test name to `-run`.

Result:

- Test: previous combined test run before the scenarios were split into independent tests.
- Result: `PASS`
- Duration: `75.49s`
- Sender: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- Recipient: sender address, because `ODDFI_SCENARIO_RECIPIENT` was not set.
- Safety: no owner/admin transfer or role change was executed.

## Transaction Results

| Step | Tx hash | Block | Gas used |
| --- | --- | ---: | ---: |
| `ODDToken.Transfer` | `0x6acc4541453427647bfb4691c7afdb05e783447e01954623e11855bf350c2f2f` | 106139338 | 33800 |
| `ODDToken.Approve` | `0xbfc2db3e62cca89f1ff7cb05862b1a263358e92de5a17bef05d051c0f281a728` | 106139355 | 50784 |
| `ODDToken.ApproveStakingPool` | `0x65c17644c66e22027af6e823360f448db054fd2e1dfc569ee5e03144bf563d5f` | 106139376 | 50856 |
| `StakingPool.Stake` | `0xa8aed468a09965ea7fbe2057efb6aaa6f653c0072ba94544366dfeb97e67348e` | 106139390 | 217920 |
| `ODDToken.ApproveLiquidityPool` | `0x63b4c6789098fa54543cabcf367c733ae1e29a1d35d81e8acc8ccfdee2067ef0` | 106139432 | 50856 |
| `LiquidityPool.DepositGlobal` | `0x4e95b49c845787387adeb9fe327243a6bd09a893e68294268ef8dd0e59925d10` | 106139448 | 204801 |
| `ODDToken.ApproveBettingPoolReserve` | `0x7041b1f809dc702dc30b0e78542f55941a69211234ad70bf5fd3b1e9d1bbf671` | 106139461 | 30884 |
| `BettingPool.AddPlatformReserve` | `0x0875027f3b728bc0f01b3709f64b6b98f562d754a251bb4b93f5dc6f4d8fdb04` | 106139474 | 100418 |

## Balance And Allowance Deltas

All ODD values are raw smallest-unit values.

| Step | Sender BNB delta | Sender ODD delta | Target ODD delta | Allowance delta |
| --- | ---: | ---: | ---: | ---: |
| `ODDToken.Transfer` | -33800000000000 | 0 | 0 | 0 |
| `ODDToken.Approve` | -50784000000000 | 0 | 0 | 1 |
| `ODDToken.ApproveStakingPool` | -50856000000000 | 0 | 0 | 100000000000000000000 |
| `StakingPool.Stake` | -217920000000000 | -100000000000000000000 | 100000000000000000000 | -100000000000000000000 |
| `ODDToken.ApproveLiquidityPool` | -50856000000000 | 0 | 0 | 1000000000000000000000 |
| `LiquidityPool.DepositGlobal` | -204801000000000 | -1000000000000000000000 | 1000000000000000000000 | -1000000000000000000000 |
| `ODDToken.ApproveBettingPoolReserve` | -30884000000000 | 0 | 0 | 0 |
| `BettingPool.AddPlatformReserve` | -100418000000000 | -1 | 1 | -1 |

Notes:

- `ODDToken.Transfer` used the sender as recipient, so sender and recipient ODD deltas net to zero.
- `ODDToken.ApproveBettingPoolReserve` set the existing allowance to the same value, so its allowance delta is zero.
- `BettingPool.AddPlatformReserve` consumed one smallest unit of ODD and increased the BettingPool ODD balance by one smallest unit.
