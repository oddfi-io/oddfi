// refund.go — tiersale.RefundPurchase + tiersale.RefundPurchaseWithReceipt.
//
// User story: after the sale is CANCELLED by governance (TierSale.cancelSale),
// each buyer reclaims their funds. The buyer's proxy wallet (A) signs via Magic;
// a sponsor (B) pays gas. The inner call is TierSale.refundPurchase(purchaseId,
// oddAmount): the contract pulls the ODD back from A (requires an ODD allowance
// to TierSale — handled elsewhere) and returns the proportional USDT.
//
// Preconditions enforced on-chain (surface via receipt status / revert decode):
//   - sale must be cancelled (SaleNotCancelled otherwise);
//   - msg.sender must be the original buyer of purchaseId (InvalidPurchase);
//   - oddAmount must be ≤ the purchase's not-yet-refunded ODD (InvalidRefundAmount).
//
// Supports partial / repeated refunds: oddAmount may be less than the purchase
// total; the contract tracks cumulative refundedOdd/refundedUsdt.

package tiersale

import (
	"context"
	"math/big"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// RefundRequest is the per-call input.
type RefundRequest struct {
	UserID         string   // buyer's Magic user_id; the EOA is resolved internally
	PurchaseID     *big.Int // the purchase id to refund (from the Buy/PurchaseRecorded event)
	OddAmount      *big.Int // ODD wei to refund from that purchase
	IdempotencyKey string
}

// RefundResult is returned by RefundPurchaseWithReceipt (B-form).
type RefundResult struct {
	ReceiptResult
	PurchaseID  *big.Int // echoed purchase id
	OddAmount   *big.Int // ODD reclaimed from the buyer
	UsdtAmount  *big.Int // USDT returned to the buyer
	RefundedOdd *big.Int // cumulative ODD refunded for this purchase after this call
}

// RefundPurchase is the A-form (default): submit on-chain and return immediately.
func (c *Client) RefundPurchase(ctx context.Context, req RefundRequest) (AsyncResult, error) {
	if err := validateRefund(req); err != nil {
		return AsyncResult{}, err
	}
	userAddr, err := c.resolveUserAddr(ctx, "RefundPurchase", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}

	calldata, err := c.sdk.TierSale().RefundPurchaseCalldata(req.PurchaseID, req.OddAmount)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "RefundPurchase", err)
	}

	res, err := c.submit(ctx, submitJob{
		Method:         "RefundPurchase",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         c.cfg.TierSale,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
			"purchase_id":     req.PurchaseID.String(),
			"odd_amount":      req.OddAmount.String(),
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

// RefundPurchaseWithReceipt is the B-form: submit + wait for `Confirmations`
// blocks, then decode the PurchaseRefunded event into RefundResult.
func (c *Client) RefundPurchaseWithReceipt(ctx context.Context, req RefundRequest) (RefundResult, error) {
	async, err := c.RefundPurchase(ctx, req)
	if err != nil {
		return RefundResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return RefundResult{}, err
	}
	parsed := parsePurchaseRefunded(receipt, c.cfg.TierSale)
	res := RefundResult{
		ReceiptResult: ReceiptResult{
			TxHash:      async.TxHash,
			BlockNumber: receipt.BlockNumber.Uint64(),
			GasUsed:     receipt.GasUsed,
		},
	}
	if parsed.Found {
		res.PurchaseID = parsed.PurchaseID
		res.OddAmount = parsed.OddAmount
		res.UsdtAmount = parsed.UsdtAmount
		res.RefundedOdd = parsed.RefundedOdd
	}
	return res, nil
}

func validateRefund(req RefundRequest) error {
	op := "RefundPurchase"
	if req.UserID == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("empty UserID"))
	}
	if req.PurchaseID == nil || req.PurchaseID.Sign() <= 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("PurchaseID must be positive"))
	}
	if req.OddAmount == nil || req.OddAmount.Sign() <= 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("OddAmount must be positive"))
	}
	if req.IdempotencyKey == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("IdempotencyKey required"))
	}
	return nil
}
