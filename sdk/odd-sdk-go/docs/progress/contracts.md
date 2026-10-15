# Contract Integration Progress

Last updated: 2026-06-22

## Actual State

| Contract | ABI artifact | Generated binding | Infrastructure adapter | Public facade | Runtime coverage |
| --- | --- | --- | --- | --- | --- |
| `ODDToken` | `contracts/abi/ODDToken.abi.json` | `internal/infrastructure/bindings/oddtoken` | `internal/infrastructure/contracts.ODDTokenAdapter` | `pkg/oddfi.ODDToken` | unit + gated read-only e2e |
| `StakingPool` | `contracts/abi/StakingPool.abi.json` | `internal/infrastructure/bindings/stakingpool` | `internal/infrastructure/contracts.StakingPoolAdapter` | `pkg/oddfi.StakingPool` | unit + gated read-only e2e |
| `LiquidityPool` | `contracts/abi/LiquidityPool.abi.json` | `internal/infrastructure/bindings/liquiditypool` | `internal/infrastructure/contracts.LiquidityPoolAdapter` | `pkg/oddfi.LiquidityPool` | unit + gated read-only e2e |
| `BettingPool` | `contracts/abi/BettingPool.abi.json` | `internal/infrastructure/bindings/bettingpool` | `internal/infrastructure/contracts.BettingPoolAdapter` | `pkg/oddfi.BettingPool` | unit + gated read-only e2e |
| `BettingBetModule` | `contracts/abi/BettingBetModule.abi.json` | `internal/infrastructure/bindings/bettingbetmodule` | none; module is delegatecall implementation detail | none; not a public SDK entrypoint | generated binding compile coverage |
| `BettingMarketModule` | `contracts/abi/BettingMarketModule.abi.json` | `internal/infrastructure/bindings/bettingmarketmodule` | none; module is delegatecall implementation detail | none; not a public SDK entrypoint | generated binding compile coverage |
| `BettingReferralModule` | `contracts/abi/BettingReferralModule.abi.json` | `internal/infrastructure/bindings/bettingreferralmodule` | none; module is delegatecall implementation detail | none; not a public SDK entrypoint | generated binding compile coverage |
| `BettingSettlementModule` | `contracts/abi/BettingSettlementModule.abi.json` | `internal/infrastructure/bindings/bettingsettlementmodule` | none; module is delegatecall implementation detail | none; not a public SDK entrypoint | generated binding compile coverage |
| `BettingParlayModule` | `contracts/abi/BettingParlayModule.abi.json` | `internal/infrastructure/bindings/bettingparlaymodule` | none; module is delegatecall implementation detail | none; not a public SDK entrypoint | generated binding compile coverage |
| `BettingParlayLens` | `contracts/abi/BettingParlayLens.abi.json` | `internal/infrastructure/bindings/bettingparlaylens` | `internal/infrastructure/contracts.BettingParlayLensAdapter` | `pkg/oddfi.BettingParlayLens` | generated binding compile coverage |
| `TierSale` | `contracts/abi/TierSale.abi.json` | `internal/infrastructure/bindings/tiersale` | `internal/infrastructure/contracts.TierSaleAdapter` | `pkg/oddfi.TierSale` | generated binding compile coverage |
| `HouseVault` | `contracts/abi/HouseVault.abi.json` | `internal/infrastructure/bindings/housevault` | `internal/infrastructure/contracts.HouseVaultAdapter` | `pkg/oddfi.HouseVault` | generated binding compile coverage |
| `DexLaunchController` | `contracts/abi/DexLaunchController.abi.json` | `internal/infrastructure/bindings/dexlaunchcontroller` | `internal/infrastructure/contracts.DexLaunchControllerAdapter` | `pkg/oddfi.DexLaunchController` | generated binding compile coverage |
| `DexLpLocker` | `contracts/abi/DexLpLocker.abi.json` | `internal/infrastructure/bindings/dexlplocker` | `internal/infrastructure/contracts.DexLpLockerAdapter` | `pkg/oddfi.DexLpLocker` | generated binding compile coverage |
| `EcosystemRewards` | `contracts/abi/EcosystemRewards.abi.json` | `internal/infrastructure/bindings/ecosystemrewards` | `internal/infrastructure/contracts.EcosystemRewardsAdapter` | `pkg/oddfi.EcosystemRewards` | generated binding compile coverage |

## Public API Status

- `pkg/oddfi.Config` requires the four core proxy addresses and an RPC URL; `BettingParlayLensContract`, `TierSaleProxy`, `HouseVaultProxy`, `DexLaunchControllerProxy`, `DexLpLockerProxy`, and `EcosystemRewardsProxy` are optional and enable their matching `Client` accessors.
- Public method signatures use common go-ethereum public types such as `common.Address`, `*big.Int`, `*types.Transaction`, and `*bind.TransactOpts`.
- Generated binding types and `*ethclient.Client` remain internal implementation details.
- All public functions in the current proxy ABI files for `ODDToken`, `StakingPool`, `LiquidityPool`, `BettingPool`, `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards` have corresponding `pkg/oddfi` facade methods. ABI overloads use Go-specific method names where required, e.g. `BettingPool.SetReferralSwapConfigWithExpectedPool`.
- `pkg/oddfi` also exposes Solidity-spelling aliases for public proxy getters whose primary SDK methods use Go/domain names, including `Positions`, `Pools`, `PayoutWindows`, `MarketFinalResults`, `Parlays`, `ParlayLegs`, `ReferralClaimNonces`, `Referrers`, `Purchases`, `LpTokenId`, `LockedPositions`, `Claimables`, and `NextClaimId`.
- `BettingSettlementModule` and `BettingParlayModule` bindings are generated for internal inspection/testing only; SDK users still call the `BettingPool` proxy, not module implementation contracts.
- `BettingParlayLens` is exposed as an optional read-only facade for frontend parlay preview and display estimates.
- ODDToken exposes ERC-20 methods plus the 2026-06-12 lock/source-ledger and fixed-source methods, including `SourceBalanceOf`, `TransferableBalanceOf`, `LockedBalanceOf`, `BusinessSnapshotOf`, `FixedSources`, `AllocateInitialSupply`, source distribution/reclaim/register methods, DEX transfer-target governance, whitelist/treasury-sink flags, role management, pause/unpause, initializer, and UUPS upgrade. Signing, nonce, and gas remain entirely controlled by the caller-provided `*bind.TransactOpts`.
- `StakingPool`, `LiquidityPool`, and `BettingPool` expose write methods for the full match scenario and operator flows: `Stake/Unstake/EarlyUnstake/NotifyReward`, `DepositGlobal/DepositMatch/RequestUnbond/Withdraw/InitializeGlobalRequestableLiquidity/DistributeGlobalLoss/DistributeGlobalMargin/ReleasePayoutReserve`, `OpenMarket/LockMarket/UpdateOdds/PlaceBet/CashOut/PlaceParlay/SettleParlay/ClaimParlayPayout/ReleasePayoutReserve/GetMarketBetIds/SettleMarketBetsByScore/FinalizeMarketSettlement/RefundBets/ClaimPayout/GrantRole/AddPlatformReserve`.
- `BettingPool` settlement follows the current score-based API: callers page bet IDs, settle batches by `(homeScore, awayScore)`, then finalize the market terminal state. The older `SettleMarket(resultKind, winningOutcome)` and `PushRefundMarket` SDK methods were removed because the ABI no longer exposes those selectors.
- `BettingPool` exposes `GetMarketExposure(ctx, marketID)` for per-outcome accepted stake, potential payout exposure, and market signal color.
- `BettingPool` exposes `CashOut(opts, betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)` and `CashOutCalldata(...)` for the pre-settlement Cash Out path without exposing generated binding types.
- `BettingPool` exposes parlay reads and writes through the proxy facade: `ParlayModule`, `NextParlayNonce`, `OpenParlayMaxPayout`, `MarketFinalResult`, `GetParlay`, `GetParlayLeg`, `PlaceParlay`, `SettleParlay`, `ClaimParlayPayout`, `ReleasePayoutReserve`, and matching calldata helpers for new mutating methods.
- `BettingPool` also exposes referral binding/claims, `PlaceBetWithReferrer`, tax/risk/referral getters, module getters (`BetModule`, `MarketModule`, `ReferralModule`, `SettlementModule`, `ParlayModule`), frontend claim/estimate queries (`GetClaimStatus`, `EstimateBetValue`, `GetParlayClaimStatus`, `EstimateParlayValue`, `GetMatchMarketIds`), governance setters, module setters (`SetBetModule`, `SetMarketModule`, `SetReferralModule`, `SetSettlementModule`, `SetParlayModule`), role management, pause/unpause, UUPS upgrade, and matching calldata helpers for newly exposed mutating methods.
- `StakingPool` exposes user tier/daily-limit reads, raw position reads, governance setters, role management, pause/unpause, and UUPS upgrade.
- `LiquidityPool` now also exposes `PayoutLiquidityWindow(ctx, matchID)` so E2E and callers can inspect LP payout-window `reservedAmount / paidOutAmount / settledAt` without reaching into generated bindings.
- `LiquidityPool` exposes `PreviewWithdraw(ctx, positionID)` so callers can inspect `withdrawAmount / netPnl / effectiveState` before submitting a withdrawal transaction.
- `LiquidityPool` exposes global requestable liquidity reads, pool weights, raw pool/position reads, governance setters, role management, pause/unpause, UUPS upgrade, and operator/accounting write passthroughs: `GlobalRequestableLiquidity`, `GlobalRequestableLiquidityInitialized`, `InitializeGlobalRequestableLiquidity`, `DistributeGlobalLoss`, `DistributeGlobalMargin`, `ReleasePayoutReserve`, and matching calldata helpers.
- `LiquidityPool` also exposes BettingPool-only match-pool and payout-liquidity passthroughs: `OpenMatchPool`, `CloseMatchPoolDeposit`, `DistributeLoss`, `DistributeMargin`, `RequestPayoutLiquidity`, and matching calldata helpers.
- `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards` are optional proxy facades. They expose their complete current proxy ABI function surface through SDK-owned types and common go-ethereum public types; generated binding types remain hidden.
- `EcosystemRewards` exposes `ClaimCalldata(claimID)` returning raw `claim(uint256)` calldata bytes for sponsored EIP-7702 relay flows (backend DD-148 referral payout). The sponsored-submission relay client itself lives in the upstream `contracts-business-layer` repo, not here; this layer only provides the calldata primitive. See `docs/development/2026-06-22-ecosystemrewards-claim-calldata.md`.
- Runtime coverage upgraded to `unit + gated read-only e2e + full match scenario write e2e (TestE2EFullMatchScenario)`.
- Full 7-step scenario test executed 2026-05-13 against BSC Testnet; steps 1–4 passed, step 5 (ClaimPayout) reverted with Panic(0x11) — see `docs/testing/full-scenario-e2e-results.md` for tx hashes and analysis.
- `TestE2EFullMatchScenario` now logs payout-window diagnostics after settlement and on claim failure. Optional `ODDFI_FULL_E2E_TOP_UP_RESERVE=1` tops up the BettingPool reserve by the observed claim shortfall, retries claim, and continues LP unbond / withdraw polling.
- Internal bindings were regenerated from the 2026-06-13 ABI refresh. The nine-proxy ABI-to-`pkg/oddfi` name check still reports zero missing public facade methods.

## Known Gaps

- ABI source metadata in `contracts/abi/README.md` still needs authoritative source repository, commit, solc version, and compile command from the contract build pipeline.
- Revert decoding into structured domain errors is not implemented yet.
- Event watchers and `Upgraded(address)` hooks are not implemented yet.
- Fuzz tests and adversarial reorg / nonce / gas failure tests are still pending.
