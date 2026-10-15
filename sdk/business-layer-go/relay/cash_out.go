// cash_out.go — relay.CashOut + relay.CashOutWithReceipt.
//
// User story: a bet owner exits their own Pending bet before final market
// settlement. Like PlaceBet, this is a sponsored (EIP-7702) user action — A
// signs via Magic, B pays gas — so it lives in relay, not admin.
//
// Quote protection is supplied entirely by the caller (frontend); relay does
// NOT read or synthesize it. Per the contract (BettingPool.cashOut → delegate
// BettingSettlementModule):
//
//   - ExpectedQuoteVersion must equal marketOdds[marketId].quoteVersion at
//     submit time (stale-quote guard); the caller passes the version the user
//     saw, read from getMarketOdds(marketId).quoteVersion.
//   - QuotedAt is the frontend's cash-out quote timestamp — NOT
//     getMarketOdds.updatedAt — and the contract enforces a 30-second TTL:
//     quotedAt <= block.timestamp <= quotedAt + 30s. The whole sponsored path
//     (Magic sign → sponsor broadcast → inclusion) must land inside that
//     window or the tx reverts.
//   - MinAmountOut is the user-confirmed floor (contract also enforces a hard
//     >= 10 ODD minimum); there is no on-chain cash-out preview, so the
//     frontend computes the returnable amount itself.
//
// No multicall pre-flight (mirrors ClaimPayout, stubs.go S3): contract reverts
// (NotOwner / NotPending / MarketNotOpen / QuoteVersionMismatch / QuoteExpired
// / SlippageExceeded / …) surface as typed errors via revert decoding.

package relay

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// CashOutRequest is the per-call input. The four quote fields are caller-owned
// (see file header); relay only validates and forwards them.
type CashOutRequest struct {
	UserID               string          // A's Magic user_id; the EOA is resolved from this internally.
	BetID                coretypes.BetID // the Pending bet to exit
	ExpectedQuoteVersion *big.Int        // = getMarketOdds(marketId).quoteVersion (the version the user saw)
	QuotedAt             uint64          // frontend cash-out quote timestamp, unix seconds; 30s on-chain TTL
	MinAmountOut         *big.Int        // minimum acceptable return in ODD wei (contract floor: >= 10 ODD)
	Deadline             uint64          // unix seconds; converted to *big.Int internally (same as PlaceBet)
	IdempotencyKey       string
}

// CashOutResult is returned by CashOutWithReceipt (B-form).
type CashOutResult struct {
	ReceiptResult
	CashOutAmount *big.Int // ODD wei credited to the user, parsed from BetCashedOut
}

// CashOut is the A-form (default): submit on-chain and return immediately.
//
//	res, err := client.CashOut(ctx, req)
//	// res.TxHash is the submitted tx; poll status via read.GetActionStatus(res.ActionID).
func (c *Client) CashOut(ctx context.Context, req CashOutRequest) (AsyncResult, error) {
	if err := validateCashOut(req); err != nil {
		return AsyncResult{}, err
	}
	userAddr, err := c.resolveUserAddr(ctx, "CashOut", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}

	// Build the inner BettingPool.cashOut calldata via the SDK helper. The SDK
	// also rejects nil *big.Int quote/output/deadline params.
	deadline := new(big.Int).SetUint64(req.Deadline)
	calldata, err := c.sdk.BettingPool().CashOutCalldata(
		[32]byte(req.BetID), req.ExpectedQuoteVersion, req.QuotedAt, req.MinAmountOut, deadline,
	)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "CashOut", err)
	}

	res, err := c.submit(ctx, submitJob{
		Method:         "CashOut",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         c.cfg.Addresses.BettingPool,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
			"bet_id":                 common.Hash(req.BetID).Hex(),
			"expected_quote_version": req.ExpectedQuoteVersion.String(),
			"quoted_at":              req.QuotedAt,
			"min_amount_out":         req.MinAmountOut.String(),
			"deadline":               req.Deadline,
			"idempotency_key":        req.IdempotencyKey,
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

// CashOutWithReceipt is the B-form: submit + wait for `Confirmations` blocks,
// then decode the BetCashedOut event into CashOutResult.
func (c *Client) CashOutWithReceipt(ctx context.Context, req CashOutRequest) (CashOutResult, error) {
	async, err := c.CashOut(ctx, req)
	if err != nil {
		return CashOutResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return CashOutResult{}, err
	}
	parsed := parseBetCashedOut(receipt, c.cfg.Addresses.BettingPool)
	res := CashOutResult{
		ReceiptResult: ReceiptResult{
			TxHash:      async.TxHash,
			BlockNumber: receipt.BlockNumber.Uint64(),
			GasUsed:     receipt.GasUsed,
		},
	}
	if parsed.Found {
		res.CashOutAmount = parsed.CashOutAmount
	}
	return res, nil
}

// ─── internal helpers ────────────────────────────────────────────────────

func validateCashOut(req CashOutRequest) error {
	op := "CashOut"
	if req.UserID == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("empty UserID"))
	}
	if req.BetID == (coretypes.BetID{}) {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("zero BetID"))
	}
	if req.ExpectedQuoteVersion == nil {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("ExpectedQuoteVersion required"))
	}
	if req.QuotedAt == 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("QuotedAt must be set"))
	}
	if req.MinAmountOut == nil || req.MinAmountOut.Sign() < 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("MinAmountOut must be non-negative"))
	}
	if req.Deadline == 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("Deadline must be set"))
	}
	if req.IdempotencyKey == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("IdempotencyKey required"))
	}
	return nil
}
