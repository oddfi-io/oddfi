package relay

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// ─── ClaimEcosystemReward (DD-148 referral payout) ───────────────────────

// ClaimEcosystemRewardRequest is the input for ClaimEcosystemReward.
//
// UserID identifies the reward recipient (the referrer). It is resolved to the
// recipient's Magic EOA, which becomes msg.sender of the inner claim call — the
// EcosystemRewards contract requires msg.sender == claimable.user, so UserID
// MUST be the same user the claimable was created for, otherwise the on-chain
// call reverts with ClaimableNotOwner.
//
// ClaimID is the claimable identifier returned by createClaimable and parsed by
// the backend from the ClaimableCreated event. It must be positive.
type ClaimEcosystemRewardRequest struct {
	UserID         string
	ClaimID        *big.Int
	IdempotencyKey string
}

// ClaimEcosystemReward claims an ecosystem reward on behalf of the referrer via
// the sponsored pathway: the recipient (A, identified by UserID) signs the 7702
// authorization + EIP-712 execute digest, while the sponsor (B) pays gas and
// broadcasts. The inner call is EcosystemRewards.claim(claimId) targeting the
// configured EcosystemRewards proxy.
//
// EcosystemRewards must be configured (Config.EcosystemRewards); the method
// errors if it is the zero address. The claim(uint256) calldata is encoded by
// the oddfi-ODD-SDK EcosystemRewards facade, so the same ABI metadata backs both
// this relay path and any direct SDK use, eliminating selector drift.
//
// Returns immediately with the tx hash and chain_actions ID; use
// ClaimEcosystemRewardWithReceipt to block until the receipt is mined.
func (c *Client) ClaimEcosystemReward(ctx context.Context, req ClaimEcosystemRewardRequest) (AsyncResult, error) {
	if req.UserID == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimEcosystemReward", errStr("empty UserID"))
	}
	if req.ClaimID == nil || req.ClaimID.Sign() <= 0 {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimEcosystemReward", errStr("ClaimID must be positive"))
	}
	if req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimEcosystemReward", errStr("missing idempotency key"))
	}
	// EcosystemRewards is not one of the core proxies; it must be explicitly wired
	// for the referral-payout flow. Fail loudly instead of targeting the zero address.
	target := c.cfg.EcosystemRewards
	if target == (common.Address{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimEcosystemReward", errStr("EcosystemRewards address not configured"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "ClaimEcosystemReward", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.EcosystemRewards().ClaimCalldata(req.ClaimID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimEcosystemReward", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method:         "ClaimEcosystemReward",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         target,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
			"claim_id":        req.ClaimID.String(),
			"idempotency_key": req.IdempotencyKey,
		},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}

// ClaimEcosystemRewardWithReceipt submits ClaimEcosystemReward and blocks until
// the receipt is mined (Confirmations blocks deep).
func (c *Client) ClaimEcosystemRewardWithReceipt(ctx context.Context, req ClaimEcosystemRewardRequest) (ReceiptResult, error) {
	async, err := c.ClaimEcosystemReward(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}
