# Changelog

All notable changes to ODD-SDK will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning once `v1.0.0` is released.

## [Unreleased]

### Added

- Initial SDK foundation planning for contract business domains, infrastructure adapters, public API facades, and gated e2e validation.
- Raw ABI artifacts and generated internal bindings for `BettingPool`, `LiquidityPool`, `ODDToken`, and `StakingPool`.
- Infrastructure-local RPC client lifecycle, four-contract adapters, ODDToken write passthroughs using caller-supplied `bind.TransactOpts`, and noop logging scaffolding.
- Public `pkg/oddfi` client facade with proxy-address config, `Close(ctx)`, go-ethereum-compatible public types, and read-only calls for `ODDToken`, `StakingPool`, `LiquidityPool`, and `BettingPool`.
- Read-only example and gated e2e test that take RPC URL and proxy addresses only from environment variables.
- CI configuration for generation drift, vet, lint, race tests, vulnerability scan, gosec, import direction, and API diff.
- `tools/importcheck` import-direction gate for the layering rules documented in `docs/architecture/layering.md`.
- Progress documentation that records the current SDK foundation and quality scaffolding state without claiming planned runtime layers are complete.
- Testing validation notes template/report for import-direction scaffolding.
- `LiquidityPool.PayoutLiquidityWindow(ctx, matchID)` read facade and full match E2E diagnostics for LP payout-window reserve/paid-out state.
- `LiquidityPool.PreviewWithdraw(ctx, positionID)` read facade with `LiquidityWithdrawPreview` and `LiquidityPositionState` constants for LP withdrawal amount, signed net PnL, and effective position state.
- `TestE2EFullMatchScenario` recovery mode via `ODDFI_FULL_E2E_TOP_UP_RESERVE=1`, allowing the test to top up BettingPool reserve after a claim shortfall, retry `ClaimPayout`, and continue LP unbond/withdraw polling.
- `XxxCalldata` methods for current mutating methods on `ODDToken` (`Transfer`, `Approve`), `StakingPool` (`Stake`, `Unstake`), `LiquidityPool` (`DepositGlobal`, `DepositMatch`, `RequestUnbond`, `Withdraw`), and `BettingPool` (`AddPlatformReserve`, `GrantRole`, `OpenMarket`, `UpdateOdds`, `PlaceBet`, `SettleMarketBetsByScore`, `FinalizeMarketSettlement`, `RefundBets`, `ClaimPayout`). Each returns ABI-encoded calldata bytes (`([]byte, error)`) without signing, broadcasting, or querying RPC — usable as the `data` field of an EIP-7702 inner call, a multisig payload, or any offline-signing flow. The same `abigen` ABI metadata backs both the existing `bind.TransactOpts`-based write methods and the new calldata methods, eliminating downstream selector drift. Pack failures wrap to `*UserError`; nil `*big.Int` parameters surface as `*UserError` carrying the new `ErrNilBigIntParam` sentinel. Works on read-only clients (no `transactor` dependency). See `docs/development/2026-05-14-calldata-methods.md` and `docs/development/2026-05-25-settlement-score-api-adapter.md` for the design and `pkg/oddfi/example_test.go` `ExampleBettingPool_PlaceBetCalldata` for usage.
- Internal `BettingSettlementModule` ABI artifact and generated binding package for settlement-module inspection/testing without exposing it through the public SDK facade.
- Public `BettingPool.UpdateOdds`, `BettingPool.GetMarketBetIds`, `BettingPool.SettleMarketBetsByScore`, `BettingPool.FinalizeMarketSettlement`, and `BettingPool.RefundBets` methods for the score-based settlement API.
- Public `BettingPool.GetMarketExposure(ctx, marketID)` read method for per-outcome stake exposure, payout exposure, and signal color.
- Public `StakingPool.EarlyUnstake(opts, positionID)` write method and `EarlyUnstakeCalldata(positionID)` for the pre-maturity unstake path that returns principal only (accrued reward redirected to remaining stakers or platform treasury). Mirrors the existing `Unstake`/`UnstakeCalldata` shape; calldata works on read-only clients (no `transactor` dependency).
- Public `BettingPool.LockMarket(opts, marketID)` and `BettingPool.LockMarketCalldata(marketID)` methods for the manual market lock selector.
- Public `BettingPool.CashOut(opts, betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)` and `BettingPool.CashOutCalldata(...)` methods for the pre-settlement Cash Out selector.
- Internal bindings for `BettingParlayModule` and `BettingParlayLens`.
- Public BettingPool parlay methods: `ParlayModule`, `NextParlayNonce`, `OpenParlayMaxPayout`, `MarketFinalResult`, `GetParlay`, `GetParlayLeg`, `PlaceParlay`, `SettleParlay`, `ClaimParlayPayout`, `ReleasePayoutReserve`, and matching calldata helpers for new mutating methods.
- Public LiquidityPool global liquidity methods: `GlobalRequestableLiquidity`, `GlobalRequestableLiquidityInitialized`, `InitializeGlobalRequestableLiquidity`, `DistributeGlobalLoss`, `DistributeGlobalMargin`, `ReleasePayoutReserve`, and matching calldata helpers for new mutating methods.
- Optional `BettingParlayLens` client facade via `Config.BettingParlayLensContract`, exposing `PreviewParlay` and `EstimateParlayValue` without generated binding types.
- Public facade coverage for contract API front/backend entrypoints that were present in `contract_api.md` but missing from `pkg`: standard AccessControl/Pausable/UUPS reads, referral binding/claims, `placeBet` referrer overload, tax/risk/referral getters, governance setters, role management, pause/unpause, and `upgradeToAndCall` across the core proxy facades where applicable. Newly exposed BettingPool and ODDToken mutating methods include calldata helpers.
- Internal bindings for `BettingBetModule`, `BettingMarketModule`, and `BettingReferralModule`.
- Public BettingPool modular-entrypoint methods: `BetModule`, `MarketModule`, `ReferralModule`, `GetMatchMarketIds`, `GetClaimStatus`, `EstimateBetValue`, `GetParlayClaimStatus`, `EstimateParlayValue`, `SetBetModule`, `SetMarketModule`, `SetReferralModule`, and matching calldata helpers for new mutating methods.
- Public LiquidityPool match-pool and payout-liquidity methods: `OpenMatchPool`, `CloseMatchPoolDeposit`, `DistributeLoss`, `DistributeMargin`, `RequestPayoutLiquidity`, and matching calldata helpers.
- Internal bindings and optional public facades for the 2026-06-12 proxy set: `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`.
- Complete public proxy ABI coverage for `ODDToken`, `StakingPool`, `LiquidityPool`, `BettingPool`, `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`, including ODDToken lock/source-ledger methods, initializer wrappers, `LiquidityPool.PayoutWindow`, `BettingPool.ReferralSwapExpectedPool`, and `BettingPool.SetReferralSwapConfigWithExpectedPool`.
- Public `EcosystemRewards.ClaimCalldata(claimID)` returning ABI-encoded `claim(uint256)` calldata bytes (`([]byte, error)`) without signing, broadcasting, or querying RPC — usable as the `data` field of a sponsored EIP-7702 inner call so a backend relay can claim ecosystem rewards on behalf of the claimable owner (`msg.sender`). Mirrors the existing `TierSale.BuyCalldata` shape: pack failures wrap to `*UserError`, nil `claimID` surfaces `ErrNilBigIntParam`, and it works on read-only clients (no `transactor` dependency). See `docs/development/2026-06-22-ecosystemrewards-claim-calldata.md` and `pkg/oddfi/example_test.go` `ExampleEcosystemRewards_ClaimCalldata`.

### Changed

- BREAKING: BettingPool settlement moved from `SettleMarket(marketID, resultKindRaw, winningOutcome)` to the score-based flow `GetMarketBetIds(ctx, marketID, offset, limit)` -> `SettleMarketBetsByScore(opts, marketID, homeScore, awayScore, betIDs)` -> `FinalizeMarketSettlement(opts, marketID, resultKindRaw)`.
- BREAKING: `BettingParlayLens.EstimateParlayValue` now takes `user common.Address` before `parlayID` to match the current ABI's user-scoped estimate query and returns `FloatingPnL`.
- `BettingPool.SetReferralSwapConfig` remains as the two-argument compatibility selector, while `BettingPool.SetReferralSwapConfigWithExpectedPool` exposes the current three-argument router/USDT/expected-pool selector.
- Regenerated internal bindings after the 2026-06-12 same-day ABI method refresh; public proxy facade coverage remains complete with no generated binding types exposed from `pkg`.
- Regenerated internal bindings after the 2026-06-13 ABI refresh; the nine-proxy public facade coverage check still reports zero missing ABI function names in `pkg`.
- Added Solidity-spelling proxy getter aliases in `pkg/oddfi` for public ABI names that already had idiomatic SDK methods, such as `Positions`, `Pools`, `MarketFinalResults`, `Referrers`, `Purchases`, `LpTokenId`, `LockedPositions`, and `Claimables`.
- `docs/architecture/contract_api.md` now treats `BettingSettlementModule` as a non-direct delegatecall implementation boundary instead of listing it as a frontend/backend API surface.

### Removed

- BREAKING: Removed public `BettingPool.PushRefundMarket` and `BettingPool.SettleMarketCalldata`; the ABI no longer exposes `pushRefundMarket` or `settleMarket`.
