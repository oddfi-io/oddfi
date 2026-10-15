// methods.go — admin write methods, each in two forms (A: hash-only,
// B: WithReceipt).
//
// Two underlying paths:
//   - c.submit         — pack calldata via SDK *Calldata helper, sign & send
//                        in-process (AddPlatformReserve / GrantRole /
//                        OpenMarket / SettleMarketBetsByScore /
//                        FinalizeMarketSettlement).
//   - c.submitViaSDK   — delegate signing + send to the SDK's typed wrapper
//                        (UpdateOdds / RefundBets). These keep using the typed
//                        wrapper for continuity; SDK v0.0.5 also added matching
//                        *Calldata variants, so they could move to c.submit.
//
// Both paths share chain_actions persistence and the IdempotencyKey contract.
//
// GetMarketBetIds is the lone read here — it pages a market's bet IDs to feed
// the SettleMarketBetsByScore batch loop.
//
// See findings.md §3.2–§3.5 for predicate checks and failure semantics.

package admin

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// ─── AddPlatformReserve (findings.md §3.2) ───────────────────────────────

type AddPlatformReserveRequest struct {
	Amount         *big.Int
	IdempotencyKey string
}

func (c *Client) AddPlatformReserve(ctx context.Context, req AddPlatformReserveRequest) (AsyncResult, error) {
	// Predicate (multicall): ODD.BalanceOf(admin) >= Amount && ODD.Allowance(admin, BettingPool) >= Amount
	// TODO Phase 6: implement multicall predicate.
	calldata, err := c.sdk.BettingPool().AddPlatformReserveCalldata(req.Amount)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "AddPlatformReserve", err)
	}
	hash, aid, err := c.submit(ctx, "AddPlatformReserve", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"amount": req.Amount.String(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) AddPlatformReserveWithReceipt(ctx context.Context, req AddPlatformReserveRequest) (ReceiptResult, error) {
	async, err := c.AddPlatformReserve(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── GrantRole (findings.md §3.3) ────────────────────────────────────────

type GrantRoleRequest struct {
	Role           [32]byte
	Account        common.Address
	IdempotencyKey string
}

func (c *Client) GrantRole(ctx context.Context, req GrantRoleRequest) (AsyncResult, error) {
	calldata, err := c.sdk.BettingPool().GrantRoleCalldata(req.Role, req.Account)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "GrantRole", err)
	}
	hash, aid, err := c.submit(ctx, "GrantRole", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"role":    req.Role,
		"account": req.Account.Hex(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) GrantRoleWithReceipt(ctx context.Context, req GrantRoleRequest) (ReceiptResult, error) {
	async, err := c.GrantRole(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── OpenMarket (findings.md §3.4) ───────────────────────────────────────

type OpenMarketRequest struct {
	MatchID        coretypes.MatchID
	MarketType     uint8
	Line           uint8
	MatchStartTime uint64
	MatchEndTime   uint64
	BaseOdds       []*big.Int
	UpdatedAt      uint64
	IdempotencyKey string
}

type OpenMarketResult struct {
	ReceiptResult
	MarketID coretypes.MarketID // parsed from MarketOpened event
}

func (c *Client) OpenMarket(ctx context.Context, req OpenMarketRequest) (AsyncResult, error) {
	calldata, err := c.sdk.BettingPool().OpenMarketCalldata(
		req.MatchID, req.MarketType, req.Line,
		req.MatchStartTime, req.MatchEndTime, req.BaseOdds, req.UpdatedAt,
	)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "OpenMarket", err)
	}
	hash, aid, err := c.submit(ctx, "OpenMarket", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, nil)
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) OpenMarketWithReceipt(ctx context.Context, req OpenMarketRequest) (OpenMarketResult, error) {
	async, err := c.OpenMarket(ctx, req)
	if err != nil {
		return OpenMarketResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return OpenMarketResult{}, err
	}
	// TODO: parse MarketOpened event to populate MarketID.
	return OpenMarketResult{
		ReceiptResult: ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed},
	}, nil
}

// ─── LockMarket (OPERATOR_ROLE, BettingPool) ─────────────────────────────
//
// Manually locks an open market, halting new bets ahead of its scheduled
// auto-lock (lockAt = matchStartTime − 5min). Caller holds OPERATOR_ROLE.
// The contract reverts if the market is missing or not in the Open state;
// such reverts surface as ErrChainTxReverted via WithReceipt. Idempotent via
// chain_actions. Uses the SDK calldata helper + the shared submit path (same
// shape as OpenMarket).

type LockMarketRequest struct {
	Market         coretypes.MarketKey
	IdempotencyKey string
}

func (c *Client) LockMarket(ctx context.Context, req LockMarketRequest) (AsyncResult, error) {
	marketID := req.Market.MarketID()
	calldata, err := c.sdk.BettingPool().LockMarketCalldata([32]byte(marketID))
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "LockMarket", err)
	}
	hash, aid, err := c.submit(ctx, "LockMarket", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"marketId": common.Hash(marketID).Hex(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) LockMarketWithReceipt(ctx context.Context, req LockMarketRequest) (ReceiptResult, error) {
	async, err := c.LockMarket(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── Score-based settlement (findings.md §3.5) ───────────────────────────
//
// SDK v0.0.5 replaced the single-call SettleMarket(resultKind, winningOutcome)
// with a score-based, batched flow. The contract now derives each bet's
// win / lose / push from the final score instead of a caller-supplied outcome:
//
//	1. GetMarketBetIds(market, offset, limit)         — page the bet IDs
//	2. SettleMarketBetsByScore(market, home, away, …)  — settle each batch
//	3. FinalizeMarketSettlement(market, resultKind)   — mark the market terminal
//
// Refund / cancel flows skip step 2: call FinalizeMarketSettlement with
// resultKind 1 (Refunded) or 2 (Cancelled), then batch-refund via RefundBets.

// GetMarketBetIds pages a market's bet IDs. Call it repeatedly, advancing
// offset by limit, until it returns fewer than limit IDs; feed each page to
// SettleMarketBetsByScore. This is a direct chain read (no chain_actions row).
func (c *Client) GetMarketBetIds(ctx context.Context, market coretypes.MarketKey, offset, limit *big.Int) ([]coretypes.BetID, error) {
	marketID := market.MarketID()
	raw, err := c.sdk.BettingPool().GetMarketBetIds(ctx, marketID, offset, limit)
	if err != nil {
		return nil, coretypes.WrapRetryable(coretypes.ErrInfraRPC, "GetMarketBetIds", err)
	}
	out := make([]coretypes.BetID, len(raw))
	for i, b := range raw {
		out[i] = coretypes.BetID(b)
	}
	return out, nil
}

// SettleMarketBetsByScoreRequest carries one batch of bet IDs to settle against
// the final score. Caller holds SETTLER_ROLE; block.timestamp must be >=
// matchEndTime. The contract caps the batch size (see MaxSettleScoreBatch).
//
// MaxSettleScoreBatch is the client-side guard on bet IDs per
// SettleMarketBetsByScore call. The on-chain hard cap is enforced via the
// RefundBatchTooLarge revert; this pre-RPC guard fails fast before submission.
const MaxSettleScoreBatch = 50

type SettleMarketBetsByScoreRequest struct {
	Market         coretypes.MarketKey
	HomeScore      uint16
	AwayScore      uint16
	BetIDs         []coretypes.BetID
	IdempotencyKey string
}

func (c *Client) SettleMarketBetsByScore(ctx context.Context, req SettleMarketBetsByScoreRequest) (AsyncResult, error) {
	if n := len(req.BetIDs); n == 0 || n > MaxSettleScoreBatch {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SettleMarketBetsByScore",
			fmt.Errorf("betIds length %d must be in [1,%d]", n, MaxSettleScoreBatch))
	}
	marketID := req.Market.MarketID()
	rawBets := toRawBetIDs(req.BetIDs)
	calldata, err := c.sdk.BettingPool().SettleMarketBetsByScoreCalldata(marketID, req.HomeScore, req.AwayScore, rawBets)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SettleMarketBetsByScore", err)
	}
	hash, aid, err := c.submit(ctx, "SettleMarketBetsByScore", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"marketId":  common.Hash(marketID).Hex(),
		"homeScore": req.HomeScore,
		"awayScore": req.AwayScore,
		"betIds":    stringifyBetIDs(req.BetIDs),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) SettleMarketBetsByScoreWithReceipt(ctx context.Context, req SettleMarketBetsByScoreRequest) (ReceiptResult, error) {
	async, err := c.SettleMarketBetsByScore(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// FinalizeMarketSettlementRequest marks a market terminal after its score
// batches are settled. ResultKind: 0=Settled, 1=Refunded, 2=Cancelled.
// Caller holds SETTLER_ROLE.
type FinalizeMarketSettlementRequest struct {
	Market         coretypes.MarketKey
	ResultKind     uint8
	IdempotencyKey string
}

func (c *Client) FinalizeMarketSettlement(ctx context.Context, req FinalizeMarketSettlementRequest) (AsyncResult, error) {
	if req.ResultKind > 2 {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "FinalizeMarketSettlement",
			fmt.Errorf("resultKind %d out of range [0,2] (0=Settled,1=Refunded,2=Cancelled)", req.ResultKind))
	}
	marketID := req.Market.MarketID()
	calldata, err := c.sdk.BettingPool().FinalizeMarketSettlementCalldata(marketID, req.ResultKind)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "FinalizeMarketSettlement", err)
	}
	hash, aid, err := c.submit(ctx, "FinalizeMarketSettlement", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"marketId":   common.Hash(marketID).Hex(),
		"resultKind": req.ResultKind,
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) FinalizeMarketSettlementWithReceipt(ctx context.Context, req FinalizeMarketSettlementRequest) (ReceiptResult, error) {
	async, err := c.FinalizeMarketSettlement(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── UpdateOdds (OPERATOR_ROLE, BettingPool) ─────────────────────────────
//
// Updates baseOdds for an open market and bumps quoteVersion. Uses the SDK's
// direct (`*bind.TransactOpts`, …) wrapper instead of a calldata helper, so
// signing + send are handled by go-ethereum bind. Chain_actions persistence
// is preserved via the submitViaSDK helper.
//
// Pre-conditions (enforced by the contract):
//   - market exists and is not in a terminal state;
//   - block.timestamp < lockAt (i.e. lockAt = matchStartTime - 5min);
//   - len(BaseOdds) == market.outcomeCount.

type UpdateOddsRequest struct {
	Market         coretypes.MarketKey
	BaseOdds       []*big.Int
	UpdatedAt      uint64
	IdempotencyKey string
}

func (c *Client) UpdateOdds(ctx context.Context, req UpdateOddsRequest) (AsyncResult, error) {
	marketID := req.Market.MarketID()
	args := map[string]any{
		"marketId":  common.Hash(marketID).Hex(),
		"baseOdds":  stringifyBigSlice(req.BaseOdds),
		"updatedAt": req.UpdatedAt,
	}
	hash, aid, err := c.submitViaSDK(ctx, "UpdateOdds", req.IdempotencyKey, args,
		func(opts *bind.TransactOpts) (*types.Transaction, error) {
			return c.sdk.BettingPool().UpdateOdds(opts, [32]byte(marketID), req.BaseOdds, req.UpdatedAt)
		},
	)
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) UpdateOddsWithReceipt(ctx context.Context, req UpdateOddsRequest) (ReceiptResult, error) {
	async, err := c.UpdateOdds(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── RefundBets (SETTLER_ROLE, BettingPool) ──────────────────────────────
//
// Batch-refund individual bets for a market already in Refunded / Cancelled
// state (reached via FinalizeMarketSettlement with resultKind 1 or 2). This
// is the replacement for the removed PushRefundMarket: finalize as Refunded,
// then refund the pending bets in batches here. Contract requires
// len(BetIDs) ≤ 20 and len(BetIDs) == len(RefundAmounts).

type RefundBetsRequest struct {
	Market         coretypes.MarketKey
	BetIDs         []coretypes.BetID
	RefundAmounts  []*big.Int
	IdempotencyKey string
}

func (c *Client) RefundBets(ctx context.Context, req RefundBetsRequest) (AsyncResult, error) {
	if len(req.BetIDs) != len(req.RefundAmounts) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "RefundBets",
			fmt.Errorf("betIds length %d != refundAmounts length %d", len(req.BetIDs), len(req.RefundAmounts)))
	}
	marketID := req.Market.MarketID()
	rawBets := toRawBetIDs(req.BetIDs)
	args := map[string]any{
		"marketId":      common.Hash(marketID).Hex(),
		"betIds":        stringifyBetIDs(req.BetIDs),
		"refundAmounts": stringifyBigSlice(req.RefundAmounts),
	}
	hash, aid, err := c.submitViaSDK(ctx, "RefundBets", req.IdempotencyKey, args,
		func(opts *bind.TransactOpts) (*types.Transaction, error) {
			return c.sdk.BettingPool().RefundBets(opts, [32]byte(marketID), rawBets, req.RefundAmounts)
		},
	)
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) RefundBetsWithReceipt(ctx context.Context, req RefundBetsRequest) (ReceiptResult, error) {
	async, err := c.RefundBets(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── helpers ─────────────────────────────────────────────────────────────

func toRawBetIDs(ids []coretypes.BetID) [][32]byte {
	out := make([][32]byte, len(ids))
	for i, b := range ids {
		out[i] = [32]byte(b)
	}
	return out
}

func stringifyBetIDs(ids []coretypes.BetID) []string {
	out := make([]string, len(ids))
	for i, b := range ids {
		out[i] = common.Hash(b).Hex()
	}
	return out
}

func stringifyBigSlice(xs []*big.Int) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		if x == nil {
			out[i] = "<nil>"
		} else {
			out[i] = x.String()
		}
	}
	return out
}
