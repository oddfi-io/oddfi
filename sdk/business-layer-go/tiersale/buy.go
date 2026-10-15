// buy.go — tiersale.Buy + tiersale.BuyWithReceipt.
//
// User story: a buyer purchases ODD in the public sale. The buyer's proxy
// wallet (A) signs the intent via Magic; a sponsor account (B) pays gas. The
// inner call is TierSale.buy(oddAmount); the contract reverse-prices the USDT,
// pulls it from A (requires a pre-existing USDT allowance to TierSale — handled
// elsewhere), and distributes the ODD to A in the same tx.
//
// The buy amount is denominated in ODD wei (the contract input is the ODD
// quantity, not USDT). Use EstimateOddForUsdt to derive OddAmount from a USDT
// budget before calling this.
//
// No multicall pre-flight: contract reverts (SaleNotActive / SaleClosed /
// SaleCapExceeded / UserSaleCapExceeded / paused / insufficient allowance)
// surface via the receipt status / revert decoding.

package tiersale

import (
	"context"
	"math/big"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// BuyRequest is the per-call input.
type BuyRequest struct {
	UserID         string   // buyer's Magic user_id; the EOA is resolved internally
	OddAmount      *big.Int // ODD wei to purchase (contract input)
	IdempotencyKey string
}

// BuyResult is returned by BuyWithReceipt (B-form).
type BuyResult struct {
	ReceiptResult
	PurchaseID *big.Int // on-chain purchase id, parsed from PurchaseRecorded
	OddAmount  *big.Int // ODD credited to the buyer
	UsdtPaid   *big.Int // USDT charged by the contract
}

// Buy is the A-form (default): submit on-chain and return immediately.
//
//	res, err := client.Buy(ctx, req)
//	// res.TxHash is the submitted tx; poll status via the action repo / watcher.
func (c *Client) Buy(ctx context.Context, req BuyRequest) (AsyncResult, error) {
	if err := validateBuy(req); err != nil {
		return AsyncResult{}, err
	}
	userAddr, err := c.resolveUserAddr(ctx, "Buy", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}

	// Build the inner TierSale.buy calldata via the SDK helper (v0.0.14+).
	calldata, err := c.sdk.TierSale().BuyCalldata(req.OddAmount)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Buy", err)
	}

	res, err := c.submit(ctx, submitJob{
		Method:         "Buy",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         c.cfg.TierSale,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
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

// BuyWithReceipt is the B-form: submit + wait for `Confirmations` blocks, then
// decode the PurchaseRecorded event into BuyResult.
func (c *Client) BuyWithReceipt(ctx context.Context, req BuyRequest) (BuyResult, error) {
	async, err := c.Buy(ctx, req)
	if err != nil {
		return BuyResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return BuyResult{}, err
	}
	parsed := parsePurchaseRecorded(receipt, c.cfg.TierSale)
	res := BuyResult{
		ReceiptResult: ReceiptResult{
			TxHash:      async.TxHash,
			BlockNumber: receipt.BlockNumber.Uint64(),
			GasUsed:     receipt.GasUsed,
		},
	}
	if parsed.Found {
		res.PurchaseID = parsed.PurchaseID
		res.OddAmount = parsed.OddAmount
		res.UsdtPaid = parsed.UsdtPaid
	}
	return res, nil
}

func validateBuy(req BuyRequest) error {
	op := "Buy"
	if req.UserID == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("empty UserID"))
	}
	if req.OddAmount == nil || req.OddAmount.Sign() <= 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("OddAmount must be positive"))
	}
	if req.IdempotencyKey == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("IdempotencyKey required"))
	}
	return nil
}
