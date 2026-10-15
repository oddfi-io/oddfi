# SDK Foundation Progress

## 2026-05-08

- Added the first public `pkg/oddfi` facade slice:
  - `Config`
  - `NewClient(ctx, cfg, opts...)`
  - `Client.Close(ctx)`
  - `Client.ODDToken()`
  - `Client.StakingPool()`
  - `Client.LiquidityPool()`
  - `Client.BettingPool()`
  - read-only `ODDToken` calls: `Name`, `Symbol`, `Decimals`, `TotalSupply`, `BalanceOf`, `Allowance`, `Paused`
- `ODDToken` write passthroughs: `Transfer` and `Approve`, both using caller-supplied `*bind.TransactOpts` and returning `*types.Transaction`.
- Added read-only public facades for `StakingPool`, `LiquidityPool`, and `BettingPool`; current methods cover core configuration and accounting status.
- Public APIs use common go-ethereum public types directly where chain data is exposed.
- Added owned infrastructure adapters under `internal/infrastructure/chain` and `internal/infrastructure/contracts`.
- `internal/domain` is organized by contract business domain (`oddtoken`, `stakingpool`, `liquiditypool`, `bettingpool`) rather than generic EVM value-object wrappers.
- Added deterministic unit tests with fake contract callers, a gated read-only e2e test, and a read-only example that takes RPC details only from environment variables.
- Added `tools/importcheck` as the CI import-direction gate for the layering rules in `docs/architecture/layering.md`.
- Import-direction enforcement is limited to documented dependency rules; it does not validate godoc completeness, examples, or runtime behavior.

## 2026-05-14

- Added 14 `XxxCalldata` methods covering all mutating methods on the four core contracts:
  - `ODDToken`: `TransferCalldata`, `ApproveCalldata`
  - `StakingPool`: `StakeCalldata`, `UnstakeCalldata`
  - `LiquidityPool`: `DepositGlobalCalldata`, `DepositMatchCalldata`, `RequestUnbondCalldata`, `WithdrawCalldata`
  - `BettingPool`: `AddPlatformReserveCalldata`, `GrantRoleCalldata`, `OpenMarketCalldata`, `PlaceBetCalldata`, `SettleMarketCalldata`, `ClaimPayoutCalldata`
- Each `XxxCalldata` is a pure local ABI encoder: takes the same parameters as the corresponding write method (minus `*bind.TransactOpts`), returns `([]byte, error)`, does not sign, broadcast, or query RPC. Functions on read-only clients (no `transactor` dependency).
- Designed for downstream EIP-7702 sponsored execution and admin-direct broadcast paths in `contracts-business-layer`; downstream code can now reuse the SDK's `abigen`-embedded ABI source instead of hand-packing selectors.
- Errors from `abi.Pack` wrap as `*UserError` (caller-input class), not `*InfraError`. nil `*big.Int` parameters are caught at the facade layer and returned as `*UserError` carrying the new shared `ErrNilBigIntParam` sentinel.
- 43 selector-equivalence unit tests added across four new `*_calldata_test.go` files (one per contract); each test pair independently re-derives the expected selector from `crypto.Keccak256` of the Solidity signature AND re-packs via `<contract>MetaData.GetAbi()`, then asserts byte equality. All tests run offline against stub `bind.ContractCaller` implementations.
- `ExampleBettingPool_PlaceBetCalldata` added to `pkg/oddfi/example_test.go` mirroring the env-driven shape of `ExampleNewClient`.
- Implementation reference: [`docs/development/2026-05-14-calldata-methods.md`](../development/2026-05-14-calldata-methods.md).

## 2026-05-25

- Regenerated all internal bindings from the updated ABI artifacts.
- Updated the BettingPool public facade for the score-based settlement API:
  - added `GetMarketBetIds(ctx, marketID, offset, limit)`;
  - replaced `SettleMarket` with `SettleMarketBetsByScore`;
  - added `FinalizeMarketSettlement`;
  - removed `PushRefundMarket` because the ABI no longer exposes it.
- Updated BettingPool calldata support:
  - added `UpdateOddsCalldata`;
  - replaced `SettleMarketCalldata` with `SettleMarketBetsByScoreCalldata`;
  - added `FinalizeMarketSettlementCalldata`;
  - added `RefundBetsCalldata`.
- Updated gated full-match and refund/cancel E2E flows to use `getMarketBetIds -> settleMarketBetsByScore -> finalizeMarketSettlement` for normal settlement and `finalizeMarketSettlement -> refundBets` for refund/cancel paths.
- Implementation reference: [`docs/development/2026-05-25-settlement-score-api-adapter.md`](../development/2026-05-25-settlement-score-api-adapter.md).

## 2026-05-28

- Regenerated the BettingPool internal binding from the updated ABI artifact.
- Added `BettingPool.GetMarketExposure(ctx, marketID)` and `MarketExposure` to expose per-outcome accepted stake, payout exposure, and signal color without exposing generated binding types.
- Implementation reference: [`docs/development/2026-05-28-market-exposure-api.md`](../development/2026-05-28-market-exposure-api.md).

## 2026-05-29

- Regenerated the LiquidityPool internal binding from the updated ABI artifact.
- Added `LiquidityPool.PreviewWithdraw(ctx, positionID)`, `LiquidityWithdrawPreview`, and `LiquidityPositionState` constants to expose LP withdrawal preview amount, signed net PnL, and effective position state without exposing generated binding types.
- Implementation reference: [`docs/development/2026-05-29-liquidity-preview-withdraw-api.md`](../development/2026-05-29-liquidity-preview-withdraw-api.md).
- Added `StakingPool.EarlyUnstake(opts, positionID)` and `StakingPool.EarlyUnstakeCalldata(positionID)` to expose the pre-maturity unstake path that returns principal only; accrued reward is redirected to remaining stakers or, if none, to the platform treasury. Both wrappers reuse the existing `abigen`-generated `earlyUnstake(uint256)` binding; calldata works on read-only clients (no `transactor` dependency).
- Added 3 selector-equivalence unit tests for `EarlyUnstakeCalldata` (selector, nil-receiver `ConfigError`, nil-positionID `UserError`) under `pkg/oddfi/stakingpool_calldata_test.go`.

## 2026-06-03

- Regenerated internal bindings from the updated BettingPool, BettingSettlementModule, and LiquidityPool ABI artifacts.
- Added `BettingPool.LockMarket(opts, marketID)` and `BettingPool.LockMarketCalldata(marketID)` for the new manual market lock selector.
- Implementation reference: [`docs/development/2026-06-03-lock-market-api.md`](../development/2026-06-03-lock-market-api.md).
- Regenerated internal bindings from the updated BettingPool and BettingSettlementModule ABI artifacts that include Cash Out.
- Added `BettingPool.CashOut(opts, betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)` and `BettingPool.CashOutCalldata(...)` for the new pre-settlement Cash Out selector.
- Implementation reference: [`docs/development/2026-06-03-cash-out-api.md`](../development/2026-06-03-cash-out-api.md).

## 2026-06-07

- Regenerated internal bindings from the updated BettingPool, BettingSettlementModule, LiquidityPool, BettingParlayModule, and BettingParlayLens ABI artifacts.
- Added BettingPool parlay facade methods and calldata helpers for `PlaceParlay`, `SettleParlay`, `ClaimParlayPayout`, and `ReleasePayoutReserve`, plus parlay read methods for module address, nonce, open max payout, market final result, parlay state, and parlay leg state.
- Added LiquidityPool global liquidity facade methods and calldata helpers for global requestable liquidity initialization, global loss/margin distribution, and payout reserve release.
- Added optional `BettingParlayLens` public facade through `Config.BettingParlayLensContract`, with `PreviewParlay` and `EstimateParlayValue` read methods.
- Expanded public facade coverage to match the frontend/backend API surface in `docs/architecture/contract_api.md`: standard AccessControl/Pausable/UUPS reads, referral binding/claims, `PlaceBetWithReferrer`, tax/risk/referral getters, role checks and role mutation, pause/unpause, UUPS `UpgradeToAndCall`, governance setters, raw staking/liquidity position reads, and liquidity pool weights. Newly exposed BettingPool and ODDToken mutating methods include calldata helpers.
- Updated `docs/architecture/contract_api.md` so `BettingSettlementModule` is documented only as a non-direct delegatecall implementation boundary; frontend/backend callers should use `BettingPool` proxy wrappers.
- Implementation reference: [`docs/development/2026-06-07-parlay-global-liquidity-api.md`](../development/2026-06-07-parlay-global-liquidity-api.md).

## 2026-06-12

- Regenerated all internal bindings from the refreshed ABI artifacts, including new proxy artifacts for `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`.
- Added optional `Config` proxy fields and `Client` accessors for `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`.
- Added complete public proxy facade coverage for the current ABI function surface of `ODDToken`, `StakingPool`, `LiquidityPool`, `BettingPool`, `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`; a mechanical ABI-vs-pkg check reports zero missing proxy methods.
- Extended `ODDToken` with lock/source-ledger, fixed-source, DEX launch, business snapshot, whitelist, treasury-sink, and initializer wrappers without exposing generated binding types.
- Added `StakingPool.Initialize`, `InitializeV2`, and `NotifyReward`; `LiquidityPool.Initialize` and raw `PayoutWindow`; `BettingPool.Initialize`, `InitializeV2`, `InitializeV3`, `ReferralSwapExpectedPool`, and the three-argument `SetReferralSwapConfigWithExpectedPool`.
- Kept all new proxy addresses optional to avoid breaking existing `Config` users; write methods continue to require caller-supplied `*bind.TransactOpts`.
- Re-ran binding generation after the same-day ABI method refresh. The generated diff touches the refreshed ODDToken and betting-module binding packages; the nine-proxy ABI-vs-`pkg/oddfi` check still reports zero missing public proxy facade methods.
- Added `pkg/oddfi` Solidity-spelling aliases for public proxy getters that already had idiomatic SDK names, so a naive ABI function-name check now also reports zero missing names across the nine proxy facades.
- Implementation reference: [`docs/development/2026-06-12-proxy-public-api-surface.md`](../development/2026-06-12-proxy-public-api-surface.md).

## 2026-06-13

- Regenerated internal bindings from the refreshed ABI artifacts.
- Rechecked the nine proxy ABI files against `pkg/oddfi`; the public facade name coverage remains zero missing across `ODDToken`, `StakingPool`, `LiquidityPool`, `BettingPool`, `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`.
- The only proxy overloads remain `BettingPool.placeBet` and `BettingPool.setReferralSwapConfig`, which are already covered by the existing Go-specific wrapper pairs.
