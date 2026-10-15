// Package read exposes read-only on-chain data only. It has zero DB
// dependency: a read-svc can be deployed with no chain_actions access and no
// private keys at all, minimizing its blast radius.
//
// chain_actions queries (GetActionStatus / GetActionByIdempotencyKey) used to
// live here; they now live on action.Repo where they belong — the admin /
// relay services that submit transactions hold the action.Repo and query
// their own submission status from there.
//
// Naming (N2 decision 2026-05-14): contract-qualified prefix
// (BettingPoolPaused, LiquidityPoolPaused, etc.) on the flat Client surface.
// We deliberately don't nest sub-handles — that would mirror the SDK's
// internal layout instead of presenting a clean facade.
//
// Caching (D2 decision = scheme Y):
//
//	33 reads are cached (B/C/D classes), 9 are not (A user-scoped + E dynamic + F low-frequency).
//	C-class (22 globals) → process-local sync.Once; B/D (10) → Redis with event invalidation.
//	See findings.md §2.5.7 + §6 for the mapping.
package read

import (
	"context"
	"errors"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// Config wires the read client.
type Config struct {
	// Cache is the optional Redis-backed cache; if nil, every read hits the chain.
	Cache CacheClient
	// EnableProcessCache enables sync.Once for C-class globals (default true).
	EnableProcessCache bool
	// BettingPool is the BettingPool proxy address. Required only for the parlay
	// lens reads (PreviewParlay / EstimateParlayValue), which pass it to the
	// BettingParlayLens. Leave zero if those are unused.
	BettingPool common.Address
}

// CacheClient is the minimum surface needed from the cache layer.
// The concrete implementation lives in package cache (see findings.md §4.5).
// TODO Phase 6: define and link.
type CacheClient interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, value []byte, ttlSeconds int) error
	Del(ctx context.Context, keys ...string) error
}

// Client is the read handle. Holds only RPC + SDK — no DB, no keys.
type Client struct {
	cfg         Config
	eth         *ethclient.Client
	sdk         *oddfi.Client
	bettingPool common.Address // BettingPool proxy; passed to the parlay lens reads
}

// New constructs a read.Client. Zero-DB by design: read-svc must be safe to
// run with no chain_actions access.
func New(eth *ethclient.Client, sdk *oddfi.Client, cfg Config) (*Client, error) {
	if sdk == nil {
		return nil, errors.New("read: nil sdk")
	}
	return &Client{cfg: cfg, eth: eth, sdk: sdk, bettingPool: cfg.BettingPool}, nil
}

// ─── ODDToken reads (7) ──────────────────────────────────────────────────

func (c *Client) Name(ctx context.Context) (string, error) {
	return c.sdk.ODDToken().Name(ctx)
}
func (c *Client) Symbol(ctx context.Context) (string, error) {
	return c.sdk.ODDToken().Symbol(ctx)
}
func (c *Client) Decimals(ctx context.Context) (uint8, error) {
	return c.sdk.ODDToken().Decimals(ctx)
}
func (c *Client) TotalSupply(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.ODDToken().TotalSupply(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("TotalSupply", err)
	}
	return wrapBigInt(v), nil
}
func (c *Client) TokenPaused(ctx context.Context) (bool, error) {
	return c.sdk.ODDToken().Paused(ctx)
}

// BalanceOf is a user-scoped read (A class) — never cached.
func (c *Client) BalanceOf(ctx context.Context, account common.Address) (decimal.Decimal, error) {
	v, err := c.sdk.ODDToken().BalanceOf(ctx, account)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("BalanceOf", err)
	}
	return wrapBigInt(v), nil
}

// Allowance is a user-scoped read (A class) — never cached.
func (c *Client) Allowance(ctx context.Context, owner, spender common.Address) (decimal.Decimal, error) {
	v, err := c.sdk.ODDToken().Allowance(ctx, owner, spender)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("Allowance", err)
	}
	return wrapBigInt(v), nil
}

// ─── BettingPool reads (15) ─ skeleton: methods 1-3 fully implemented, rest stubbed for Phase 6.

func (c *Client) BettingPoolPaused(ctx context.Context) (bool, error) {
	return c.sdk.BettingPool().Paused(ctx)
}

func (c *Client) BetTaxBps(ctx context.Context) (uint16, error) {
	return c.sdk.BettingPool().BetTaxBps(ctx)
}

func (c *Client) PayoutTaxBps(ctx context.Context) (uint16, error) {
	return c.sdk.BettingPool().PayoutTaxBps(ctx)
}

// GetMarket fetches an open market's state by its human-readable triplet.
// The library hashes (matchID, marketType, line) into the contract-format
// marketID internally — callers pass MarketKey, never the 32-byte hash.
func (c *Client) GetMarket(ctx context.Context, key coretypes.MarketKey) (Market, error) {
	raw, err := c.sdk.BettingPool().GetMarket(ctx, key.MarketID())
	if err != nil {
		return Market{}, wrapInfraRPC("GetMarket", err)
	}
	return Market{
		MatchID:        coretypes.MatchID(raw.MatchID),
		MarketType:     raw.MarketType,
		Line:           raw.Line,
		OutcomeCount:   raw.OutcomeCount,
		MatchStartTime: raw.MatchStartTime,
		LockAt:         raw.LockAt,
		Status:         MarketStatus(raw.Status),
		MatchEndTime:   raw.MatchEndTime,
	}, nil
}

// GetMarketOdds fetches live odds + quote version for a market. See GetMarket
// for MarketKey semantics.
func (c *Client) GetMarketOdds(ctx context.Context, key coretypes.MarketKey) (MarketOdds, error) {
	raw, err := c.sdk.BettingPool().GetMarketOdds(ctx, key.MarketID())
	if err != nil {
		return MarketOdds{}, wrapInfraRPC("GetMarketOdds", err)
	}
	scale := decimal.New(1, 4) // 1e4
	scaleSlice := func(xs []*big.Int) []decimal.Decimal {
		out := make([]decimal.Decimal, len(xs))
		for i, x := range xs {
			out[i] = wrapBigInt(x).Div(scale)
		}
		return out
	}
	return MarketOdds{
		BaseOdds:     scaleSlice(raw.BaseOdds),
		QuotedOdds:   scaleSlice(raw.QuotedOdds),
		UpdatedAt:    raw.UpdatedAt,
		QuoteVersion: wrapBigInt(raw.QuoteVersion),
	}, nil
}

func (c *Client) GetBet(ctx context.Context, betID coretypes.BetID) (Bet, error) {
	raw, err := c.sdk.BettingPool().GetBet(ctx, betID)
	if err != nil {
		return Bet{}, wrapInfraRPC("GetBet", err)
	}
	scale := decimal.New(1, 4)
	return Bet{
		Owner:           raw.Owner,
		MarketID:        coretypes.MarketID(raw.MarketID),
		Outcome:         raw.Outcome,
		AcceptedAmount:  wrapBigInt(raw.AcceptedAmount),
		RefundedAmount:  wrapBigInt(raw.RefundedAmount),
		LockedOdds:      wrapBigInt(raw.LockedOdds).Div(scale),
		SettlementState: BetSettlementState(raw.SettlementState),
		ClaimablePayout: wrapBigInt(raw.ClaimablePayout),
	}, nil
}

// GetMarketBetIds returns a page of a market's bet IDs in placement order.
// offset/limit page the contract's per-market bet-id array. When the IDs feed a
// single SettleMarketBetsByScore batch, keep limit ≤ 50 — the settlement call
// caps each batch at 50 bet IDs (FINALIZE_BATCH_HARD_CAP). See GetMarket for
// MarketKey semantics.
func (c *Client) GetMarketBetIds(ctx context.Context, key coretypes.MarketKey, offset, limit *big.Int) ([]coretypes.BetID, error) {
	raw, err := c.sdk.BettingPool().GetMarketBetIds(ctx, key.MarketID(), offset, limit)
	if err != nil {
		return nil, wrapInfraRPC("GetMarketBetIds", err)
	}
	out := make([]coretypes.BetID, len(raw))
	for i, b := range raw {
		out[i] = coretypes.BetID(b)
	}
	return out, nil
}

// AccountedBalance is F-class (not cached; only called in PlaceBet path).
func (c *Client) AccountedBalance(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.BettingPool().AccountedBalance(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("AccountedBalance", err)
	}
	return wrapBigInt(v), nil
}

// ─── Stubs for the remaining ~28 reads (Phase 6 TODO) ────────────────────
//
// Pattern is identical to the implemented ones above — see findings.md §3.16.5.
//
// Already implemented above:
//   Name / Symbol / Decimals / TotalSupply / TokenPaused / BalanceOf / Allowance
//   BettingPoolPaused / BetTaxBps / PayoutTaxBps
//   GetMarket / GetMarketOdds / GetBet / AccountedBalance
//
// Remaining (replicate the pattern):
//   BettingPool: OddToken, StakingPool, LiquidityPool, PlatformTreasury,
//                PlatformReserve, PreviewSignal, IsMatchTerminal, HasRole
//   LiquidityPool: OddToken, BettingPool, LiquidityPoolPaused, MinDeposit,
//                  RequestableLiquidity, TotalActiveDeposited,
//                  TotalOutstandingPayoutReserved, PayoutLiquidityWindow,
//                  UnbondEpochs, NextLpPositionID, GetLpPositionState,
//                  PreviewWithdraw
//   StakingPool: OddToken, BettingPool, PlatformTreasury, StakingPoolPaused,
//                MinStakeAmount, TotalWeightedShares, AccountedOddBalance,
//                NextStakePositionID, GetActiveStakeAmount

// chain_actions queries moved out: see action.Repo.GetStatus /
// GetStatusByIdempotencyKey. admin and relay services that submit txs hold the
// action.Repo and query their own submission status directly.

// ─── Address utilities (forwarded from SDK) ──────────────────────────────

// ParseAddress is a strict 0x… 40-hex-digit parse.
func ParseAddress(s string) (common.Address, error) {
	return oddfi.ParseAddress(s)
}

// MustParseAddress panics on invalid input. Use only with compile-time-known strings.
func MustParseAddress(s string) common.Address {
	return oddfi.MustParseAddress(s)
}

// ─── helpers ─────────────────────────────────────────────────────────────

func wrapBigInt(v *big.Int) decimal.Decimal {
	if v == nil {
		return decimal.Zero
	}
	return decimal.NewFromBigInt(v, 0)
}

func wrapInfraRPC(op string, err error) error {
	return coretypes.WrapRetryable(coretypes.ErrInfraRPC, op, err)
}
