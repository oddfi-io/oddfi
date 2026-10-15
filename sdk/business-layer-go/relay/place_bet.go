// place_bet.go — relay.PlaceBet + relay.PlaceBetWithReceipt.
//
// User story (from `findings.md`):
//
//	external caller passes ctx + A's *ecdsa.PrivateKey + amount → this method
//	signs a 7702-sponsored PlaceBet, B pays gas, returns the on-chain tx hash.
//
// Predicate reads (multicall, 1 RPC):
//
//	- ODDToken.BalanceOf(A)            >= req.Amount             (gate: ErrUserInsufficientBalance)
//	- BettingPool.AccountedBalance()   covers potential payout    (gate: ErrPoolUndercapitalized)
//	- BettingPool.GetMarketOdds(mid)   for QuoteVersion+UpdatedAt (input to QuoteGuard)
//
// Allowance is NOT pre-checked (per user 2026-05-14: caller guarantees approve).

package relay

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// PlaceBetRequest is the per-call input. See findings.md §3.1.
//
// Market is the human-readable (matchID, marketType, line) triplet; the
// library derives the 32-byte on-chain marketID via MarketKey.MarketID()
// internally — callers never compute that hash themselves.
type PlaceBetRequest struct {
	UserID            string // A's Magic user_id; the EOA is resolved from this via the Magic signer (process-cached).
	Market            coretypes.MarketKey
	Outcome           uint8
	Amount            *big.Int // ODD wei
	MinAcceptedAmount *big.Int // partial-fill protection
	MinOdds           *big.Int // 1e4 precision
	Deadline          uint64   // unix seconds
	IdempotencyKey    string
}

// PlaceBetResult is returned by PlaceBetWithReceipt (B-form).
type PlaceBetResult struct {
	ReceiptResult
	BetID          coretypes.BetID
	AcceptedAmount *big.Int // resolved by the contract (may be < Amount on partial fill)
	LockedOdds     *big.Int
}

// PlaceBet is the A-form (default): submit on-chain and return immediately.
//
//	res, err := client.PlaceBet(ctx, req)
//	// res.TxHash is the submitted tx; status is tracked async via chain_actions.
//	// Use read.GetActionStatus(res.ActionID) to poll the final outcome.
func (c *Client) PlaceBet(ctx context.Context, req PlaceBetRequest) (AsyncResult, error) {
	if err := validatePlaceBet(req); err != nil {
		return AsyncResult{}, err
	}
	userAddr, err := c.resolveUserAddr(ctx, "PlaceBet", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	marketID := req.Market.MarketID() // derive contract-format marketID internally

	// Predicate multicall — 1 RPC for 3 reads:
	//   [0] ODDToken.balanceOf(userAddr)    — gate ErrUserInsufficientBalance
	//   [1] BettingPool.accountedBalance()  — gate ErrPoolUndercapitalized
	//   [2] BettingPool.getMarketOdds(mid)  — feed QuoteGuard
	pre, err := c.prePlaceBet(ctx, userAddr, req.Amount, marketID)
	if err != nil {
		return AsyncResult{}, err
	}

	// Build QuoteGuardInput from the multicall'd MarketOdds.
	guard := quoteGuardInput{
		QuoteVersion:      pre.Odds.QuoteVersion,
		QuotedAt:          pre.Odds.UpdatedAt,
		MinOdds:           req.MinOdds,
		MinAcceptedAmount: req.MinAcceptedAmount,
		Deadline:          new(big.Int).SetUint64(req.Deadline),
	}

	// Build the inner BettingPool.PlaceBet calldata via the SDK helper.
	calldata, err := c.sdk.BettingPool().PlaceBetCalldata(marketID, req.Outcome, req.Amount, guard)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "PlaceBet", err)
	}

	// Hand off to the shared submit pipeline.
	res, err := c.submit(ctx, submitJob{
		Method:         "PlaceBet",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         c.cfg.Addresses.BettingPool,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
			"match_id":        common.Hash(req.Market.MatchID).Hex(),
			"market_type":     req.Market.MarketType,
			"line":            req.Market.Line,
			"outcome":         req.Outcome,
			"amount":          req.Amount.String(),
			"deadline":        req.Deadline,
			"idempotency_key": req.IdempotencyKey,
		},
	})
	if err != nil {
		return AsyncResult{}, err
	}

	return AsyncResult{
		TxHash:         coretypes.TxHash(res.TxHash.Hex()),
		ActionID:       res.ActionID,
		IdempotencyKey: req.IdempotencyKey,
	}, nil
}

// PlaceBetWithReceipt is the B-form: submit + wait for `Confirmations` blocks,
// then decode the BetPlaced event into PlaceBetResult.
//
//	res, err := client.PlaceBetWithReceipt(ctx, req)
//	// res.BetID is the on-chain bet identifier; safe to claim later.
func (c *Client) PlaceBetWithReceipt(ctx context.Context, req PlaceBetRequest) (PlaceBetResult, error) {
	async, err := c.PlaceBet(ctx, req)
	if err != nil {
		return PlaceBetResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return PlaceBetResult{}, err
	}
	parsed := parseBetPlaced(receipt, c.cfg.Addresses.BettingPool)
	res := PlaceBetResult{
		ReceiptResult: ReceiptResult{
			TxHash:      async.TxHash,
			BlockNumber: receipt.BlockNumber.Uint64(),
			GasUsed:     receipt.GasUsed,
		},
	}
	if parsed.Found {
		res.BetID = parsed.BetID
		res.AcceptedAmount = parsed.AcceptedAmount
		res.LockedOdds = parsed.LockedOdds
	}
	return res, nil
}

// ─── internal helpers ────────────────────────────────────────────────────

func validatePlaceBet(req PlaceBetRequest) error {
	op := "PlaceBet"
	if req.UserID == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("empty UserID"))
	}
	// The user's EOA is resolved from UserID at call time (see resolveUserAddr);
	// callers no longer pass an address.
	if req.Market.MatchID == (coretypes.MatchID{}) {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("zero MatchID in Market"))
	}
	if req.Amount == nil || req.Amount.Sign() <= 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("Amount must be positive"))
	}
	if req.Deadline == 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("Deadline must be set"))
	}
	if req.IdempotencyKey == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("IdempotencyKey required"))
	}
	return nil
}

// makeQuoteGuard is kept for reference; PlaceBet inlines the guard build now
// that the precheck returns marketOddsView directly. May be reused by ClaimPayout
// / Withdraw if they ever need a similar guard.
