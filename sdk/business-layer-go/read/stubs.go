// stubs.go — the remaining 28 read methods.
//
// Each follows the pattern of client.go: forward to SDK, wrap *big.Int into
// decimal.Decimal, wrap uint8 enums into typed Go enums. Caching is NOT yet
// applied here (Phase 6 follow-up — see findings.md §6).

package read

import (
	"context"

	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// ─── BettingPool — 8 remaining ────────────────────────────────────────────

func (c *Client) BettingPoolOddToken(ctx context.Context) (common.Address, error) {
	return c.sdk.BettingPool().OddToken(ctx)
}
func (c *Client) BettingPoolStakingPool(ctx context.Context) (common.Address, error) {
	return c.sdk.BettingPool().StakingPool(ctx)
}
func (c *Client) BettingPoolLiquidityPool(ctx context.Context) (common.Address, error) {
	return c.sdk.BettingPool().LiquidityPool(ctx)
}
func (c *Client) BettingPoolPlatformTreasury(ctx context.Context) (common.Address, error) {
	return c.sdk.BettingPool().PlatformTreasury(ctx)
}
func (c *Client) PlatformReserve(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.BettingPool().PlatformReserve(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("PlatformReserve", err)
	}
	return wrapBigInt(v), nil
}
// PreviewSignal asks the contract what a hypothetical bet would look like
// (acceptance, locked odds, partial-fill signal). Takes a MarketKey for
// consistency with the rest of the read API; library hashes internally.
func (c *Client) PreviewSignal(ctx context.Context, key coretypes.MarketKey, outcome uint8, requestedAmount decimal.Decimal) (Signal, error) {
	raw, err := c.sdk.BettingPool().PreviewSignal(ctx, key.MarketID(), outcome, requestedAmount.BigInt())
	if err != nil {
		return Signal{}, wrapInfraRPC("PreviewSignal", err)
	}
	scale := decimal.New(1, 4)
	return Signal{
		Color:               SignalColor(raw.Signal),
		AcceptedAmount:      wrapBigInt(raw.AcceptedAmount),
		LockedOdds:          wrapBigInt(raw.LockedOdds).Div(scale),
		PartialFill:         raw.PartialFill,
		MaxAcceptableAmount: wrapBigInt(raw.MaxAcceptableAmount),
	}, nil
}
func (c *Client) IsMatchTerminal(ctx context.Context, matchID coretypes.MatchID) (bool, error) {
	return c.sdk.BettingPool().IsMatchTerminal(ctx, matchID)
}
func (c *Client) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	return c.sdk.BettingPool().HasRole(ctx, role, account)
}

// ─── LiquidityPool — 12 reads ─────────────────────────────────────────────

func (c *Client) LiquidityPoolOddToken(ctx context.Context) (common.Address, error) {
	return c.sdk.LiquidityPool().OddToken(ctx)
}
func (c *Client) LiquidityPoolBettingPool(ctx context.Context) (common.Address, error) {
	return c.sdk.LiquidityPool().BettingPool(ctx)
}
func (c *Client) LiquidityPoolPaused(ctx context.Context) (bool, error) {
	return c.sdk.LiquidityPool().Paused(ctx)
}
func (c *Client) MinDeposit(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.LiquidityPool().MinDeposit(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("MinDeposit", err)
	}
	return wrapBigInt(v), nil
}
func (c *Client) RequestableLiquidity(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.LiquidityPool().RequestableLiquidity(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("RequestableLiquidity", err)
	}
	return wrapBigInt(v), nil
}
func (c *Client) TotalActiveDeposited(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.LiquidityPool().TotalActiveDeposited(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("TotalActiveDeposited", err)
	}
	return wrapBigInt(v), nil
}
func (c *Client) TotalOutstandingPayoutReserved(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.LiquidityPool().TotalOutstandingPayoutReserved(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("TotalOutstandingPayoutReserved", err)
	}
	return wrapBigInt(v), nil
}
func (c *Client) PayoutLiquidityWindow(ctx context.Context, matchID coretypes.MatchID) (PayoutWindow, error) {
	_, err := c.sdk.LiquidityPool().PayoutLiquidityWindow(ctx, matchID)
	if err != nil {
		return PayoutWindow{}, wrapInfraRPC("PayoutLiquidityWindow", err)
	}
	// TODO Phase 6: map SDK fields once we confirm them (see findings.md §3.16.6 N3).
	return PayoutWindow{}, nil
}
func (c *Client) UnbondEpochs(ctx context.Context) (uint32, error) {
	return c.sdk.LiquidityPool().UnbondEpochs(ctx)
}
func (c *Client) NextLpPositionID(ctx context.Context) (coretypes.LpPositionID, error) {
	return c.sdk.LiquidityPool().NextLpPositionID(ctx)
}
func (c *Client) GetLpPositionState(ctx context.Context, positionID coretypes.LpPositionID) (LpPositionState, error) {
	raw, err := c.sdk.LiquidityPool().GetPositionState(ctx, positionID)
	if err != nil {
		return 0, wrapInfraRPC("GetLpPositionState", err)
	}
	return LpPositionState(raw), nil
}

// PreviewWithdraw previews the amount an LP position would withdraw using the
// same frozen accounting basis as withdraw, without owning the position or
// submitting a transaction. User-scoped read (A class) — never cached.
func (c *Client) PreviewWithdraw(ctx context.Context, positionID coretypes.LpPositionID) (WithdrawPreview, error) {
	raw, err := c.sdk.LiquidityPool().PreviewWithdraw(ctx, positionID)
	if err != nil {
		return WithdrawPreview{}, wrapInfraRPC("PreviewWithdraw", err)
	}
	return toWithdrawPreview(raw), nil
}

// toWithdrawPreview maps the SDK preview struct into the read DTO. Pure (no RPC)
// so the field/scaling mapping can be unit-tested without a chain.
func toWithdrawPreview(raw oddfi.LiquidityWithdrawPreview) WithdrawPreview {
	return WithdrawPreview{
		WithdrawAmount: wrapBigInt(raw.WithdrawAmount),
		NetPnL:         wrapBigInt(raw.NetPnL),
		EffectiveState: LpPositionState(uint8(raw.EffectiveState)),
	}
}

// ─── StakingPool — 9 reads ────────────────────────────────────────────────

func (c *Client) StakingPoolOddToken(ctx context.Context) (common.Address, error) {
	return c.sdk.StakingPool().OddToken(ctx)
}
func (c *Client) StakingPoolBettingPool(ctx context.Context) (common.Address, error) {
	return c.sdk.StakingPool().BettingPool(ctx)
}
func (c *Client) StakingPoolPlatformTreasury(ctx context.Context) (common.Address, error) {
	return c.sdk.StakingPool().PlatformTreasury(ctx)
}
func (c *Client) StakingPoolPaused(ctx context.Context) (bool, error) {
	return c.sdk.StakingPool().Paused(ctx)
}
func (c *Client) MinStakeAmount(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.StakingPool().MinStakeAmount(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("MinStakeAmount", err)
	}
	return wrapBigInt(v), nil
}
func (c *Client) TotalWeightedShares(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.StakingPool().TotalWeightedShares(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("TotalWeightedShares", err)
	}
	return wrapBigInt(v), nil
}
func (c *Client) AccountedOddBalance(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.StakingPool().AccountedOddBalance(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("AccountedOddBalance", err)
	}
	return wrapBigInt(v), nil
}
func (c *Client) NextStakePositionID(ctx context.Context) (coretypes.StakePositionID, error) {
	return c.sdk.StakingPool().NextPositionID(ctx)
}
func (c *Client) GetActiveStakeAmount(ctx context.Context, user common.Address) (decimal.Decimal, error) {
	v, err := c.sdk.StakingPool().GetActiveStakeAmount(ctx, user)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("GetActiveStakeAmount", err)
	}
	return wrapBigInt(v), nil
}
