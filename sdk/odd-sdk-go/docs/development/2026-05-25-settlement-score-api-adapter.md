# Score-based BettingPool settlement API adapter

**Date:** 2026-05-25
**Scope:** `contracts/abi`, `internal/infrastructure/bindings`, `internal/infrastructure/contracts`, `pkg/oddfi`

## Background

The BettingPool ABI now uses score-based, batched settlement:

- `settleMarketBetsByScore(bytes32,uint16,uint16,bytes32[])`
- `finalizeMarketSettlement(bytes32,uint8)`
- `refundBets(bytes32,bytes32[],uint256[])`

The old `settleMarket(bytes32,uint8,uint8)` and `pushRefundMarket(bytes32,bytes32[])` entries are no longer present. `docs/architecture/contract_api.md` also documents AH/OU/1X2 settlement as score-derived, including AH half-win, half-loss, and push behavior.

## API Change Surface

Public SDK changes:

- Replace `BettingPool.SettleMarket` with `BettingPool.SettleMarketBetsByScore`.
- Add `BettingPool.FinalizeMarketSettlement`.
- Add `BettingPool.GetMarketBetIds`.
- Replace `BettingPool.SettleMarketCalldata` with `BettingPool.SettleMarketBetsByScoreCalldata`.
- Add `BettingPool.FinalizeMarketSettlementCalldata`.
- Add `BettingPool.UpdateOddsCalldata` and `BettingPool.RefundBetsCalldata` so every current BettingPool public write passthrough has a pure calldata encoder.
- Remove `BettingPool.PushRefundMarket`, because the contract no longer exposes it.
- Keep `BettingPool.RefundBets`, now used only after `FinalizeMarketSettlement(..., 1 or 2)` marks the market refunded or cancelled.

This is a breaking public API change for the pre-1.0 SDK and must be marked in CHANGELOG.

## Layering

Generated bindings remain internal under `internal/infrastructure/bindings`. Public APIs expose go-ethereum common types and SDK facade types only. The settlement module remains an internal delegatecall implementation detail; callers use the BettingPool proxy facade.

## Test Plan

- Regenerate bindings with `go generate ./internal/infrastructure/bindings/...`.
- Update unit tests for new calldata selectors and nil `*big.Int` validation.
- Update gated E2E scenarios to use `getMarketBetIds -> settleMarketBetsByScore -> finalizeMarketSettlement`.
- Run `go test ./...`, `go vet ./...`, `go test -race -count=1 ./...`, and available lint/security commands.

## Migration

Callers that previously used:

```go
pool.SettleMarket(opts, marketID, 0, winningOutcome)
```

must now page bet IDs, process score settlement batches, and finalize:

```go
betIDs, err := pool.GetMarketBetIds(ctx, marketID, big.NewInt(0), big.NewInt(100))
if err != nil {
	return err
}
if len(betIDs) > 0 {
	if _, err := pool.SettleMarketBetsByScore(opts, marketID, homeScore, awayScore, betIDs); err != nil {
		return err
	}
}
_, err = pool.FinalizeMarketSettlement(opts, marketID, 0)
```

Refund/cancel flows must call `FinalizeMarketSettlement(opts, marketID, 1 or 2)` first, then batch `RefundBets`.

## Rollback

Restore the previous ABI artifacts and generated bindings, then restore the old `SettleMarket`/`PushRefundMarket` facade methods and tests. This rollback would only be valid against a deployed BettingPool implementation that still exposes the old ABI.
