// stubs.go — skeletons for the remaining 9 relay methods.
//
// Each follows the same template as place_bet.go:
//
//	1. validate request
//	2. (optional) multicall predicate check
//	3. build SDK calldata via c.sdk.<Pool>.<Method>Calldata(...)
//	4. c.submit(ctx, submitJob{...})
//	5. A-form returns AsyncResult; WithReceipt variant waits + parses logs.
//
// User-side identity is supplied as UserID (Magic user_id, used to sign). The
// user's Magic EOA is resolved internally from UserID via resolveUserAddr
// (process-cached); callers never pass an address. No private keys.
//
// Phase 6 TODO: fill multicall predicates and event parsing per findings.md
// §3.6–§3.14.

package relay

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/multicall"
)

// ─── ClaimPayout (findings.md §3.6) ──────────────────────────────────────

type ClaimPayoutRequest struct {
	UserID         string
	BetID          coretypes.BetID
	IdempotencyKey string
}

type ClaimPayoutResult struct {
	ReceiptResult
	ClaimedAmount *big.Int
}

func (c *Client) ClaimPayout(ctx context.Context, req ClaimPayoutRequest) (AsyncResult, error) {
	if req.UserID == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimPayout", errStr("empty UserID"))
	}
	if req.BetID == (coretypes.BetID{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimPayout", errStr("zero BetID"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "ClaimPayout", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	// No multicall pre-flight per S3 decision: contract reverts (NotOwned/NotWon/PayoutZero) translate to typed errors via revert decoding.
	calldata, err := c.sdk.BettingPool().ClaimPayoutCalldata(req.BetID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimPayout", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method:         "ClaimPayout",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         c.cfg.Addresses.BettingPool,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
			"bet_id":          common.Hash(req.BetID).Hex(),
			"idempotency_key": req.IdempotencyKey,
		},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) ClaimPayoutWithReceipt(ctx context.Context, req ClaimPayoutRequest) (ClaimPayoutResult, error) {
	async, err := c.ClaimPayout(ctx, req)
	if err != nil {
		return ClaimPayoutResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return ClaimPayoutResult{}, err
	}
	// TODO: parse PayoutClaimed event for ClaimedAmount.
	return ClaimPayoutResult{
		ReceiptResult: ReceiptResult{
			TxHash:      async.TxHash,
			BlockNumber: receipt.BlockNumber.Uint64(),
			GasUsed:     receipt.GasUsed,
		},
	}, nil
}

// ─── DepositGlobal (findings.md §3.7) ────────────────────────────────────

type DepositGlobalRequest struct {
	UserID         string
	Amount         *big.Int
	PlanID         uint16
	IdempotencyKey string
}

type DepositGlobalResult struct {
	ReceiptResult
	PositionID coretypes.LpPositionID
}

func (c *Client) DepositGlobal(ctx context.Context, req DepositGlobalRequest) (AsyncResult, error) {
	if req.UserID == "" || req.Amount == nil || req.Amount.Sign() <= 0 || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "DepositGlobal", errStr("invalid request"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "DepositGlobal", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	if err := c.checkBalance(ctx, "DepositGlobal", userAddr, req.Amount); err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.LiquidityPool().DepositGlobalCalldata(req.Amount, req.PlanID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "DepositGlobal", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "DepositGlobal", UserID: req.UserID, UserAddr: userAddr,
		Target: c.cfg.Addresses.LiquidityPool, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"amount": req.Amount.String(), "plan_id": req.PlanID, "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}
func (c *Client) DepositGlobalWithReceipt(ctx context.Context, req DepositGlobalRequest) (DepositGlobalResult, error) {
	async, err := c.DepositGlobal(ctx, req)
	if err != nil {
		return DepositGlobalResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return DepositGlobalResult{}, err
	}
	// TODO: parse Deposited event for PositionID.
	return DepositGlobalResult{
		ReceiptResult: ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed},
	}, nil
}

// ─── DepositMatch (findings.md §3.8) ─────────────────────────────────────

// DepositMatchRequest is the input for sponsored single-match LP deposits.
//
// ⚠️ On-chain constraint — Amount MUST be >= LiquidityPool.minDeposit().
// Observed value on the deployed contract:
//
//	LiquidityPool.minDeposit() == 1000 * 10^18 wei == 1000 ODD
//
// Calls with Amount < 1000 ODD will be reverted by the contract (gas pattern
// ~86686) and surfaced as coretypes.ErrChainTxReverted. Read the current
// value via read.MinDeposit(ctx) before the call if you don't want to
// hard-code it.
type DepositMatchRequest struct {
	UserID         string
	MatchID        coretypes.MatchID
	Amount         *big.Int // wei; MUST be >= LiquidityPool.minDeposit() (currently 1000 ODD)
	IdempotencyKey string
}

type DepositMatchResult struct {
	ReceiptResult
	PositionID coretypes.LpPositionID
}

// DepositMatch (A-form) submits an LP deposit into the per-match liquidity
// pool of `req.MatchID` and returns immediately with the tx hash + ActionID.
//
// Caller must ensure:
//  1. The match has already been opened on BettingPool (OpenMarket triggers
//     LiquidityPool.openMatchPool automatically the first time).
//  2. req.Amount >= LiquidityPool.minDeposit() (currently 1000 ODD on this
//     chain). See DepositMatchRequest doc for details.
//  3. The bettor (UserID) holds >= req.Amount ODD AND has approved
//     LiquidityPool for >= req.Amount via relay.Approve beforehand.
//
// Internal flow:
//   - Pre-check via multicall: ODDToken.balanceOf(user) >= Amount.
//   - SDK builds LiquidityPool.depositMatch calldata.
//   - relay.submit signs (A, via Magic) + sponsors (B) + broadcasts SetCodeTx.
func (c *Client) DepositMatch(ctx context.Context, req DepositMatchRequest) (AsyncResult, error) {
	if req.UserID == "" || req.MatchID == (coretypes.MatchID{}) || req.Amount == nil || req.Amount.Sign() <= 0 || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "DepositMatch", errStr("invalid request"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "DepositMatch", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	// S5: ideally multicall BalanceOf + PayoutLiquidityWindow together. MVP does
	// BalanceOf only; window-closed reverts at the contract level → ErrChainTxReverted.
	if err := c.checkBalance(ctx, "DepositMatch", userAddr, req.Amount); err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.LiquidityPool().DepositMatchCalldata(req.MatchID, req.Amount)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "DepositMatch", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "DepositMatch", UserID: req.UserID, UserAddr: userAddr,
		Target: c.cfg.Addresses.LiquidityPool, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"match_id": common.Hash(req.MatchID).Hex(), "amount": req.Amount.String(), "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}

// DepositMatchWithReceipt (B-form) is the blocking variant of DepositMatch:
// submits the LP deposit and blocks until `Confirmations` blocks have been
// mined on top of the receipt block. Returns the receipt + the parsed
// LpPositionID (TODO: event parsing — currently zero-value).
//
// Same on-chain preconditions apply (see DepositMatch / DepositMatchRequest).
// In particular: req.Amount MUST be >= LiquidityPool.minDeposit()
// (currently 1000 ODD). A request with Amount below that threshold reverts
// at gas ~86686 and returns ErrChainTxReverted.
func (c *Client) DepositMatchWithReceipt(ctx context.Context, req DepositMatchRequest) (DepositMatchResult, error) {
	async, err := c.DepositMatch(ctx, req)
	if err != nil {
		return DepositMatchResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return DepositMatchResult{}, err
	}
	return DepositMatchResult{
		ReceiptResult: ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed},
	}, nil
}

// ─── RequestUnbond (findings.md §3.9) ────────────────────────────────────

type RequestUnbondRequest struct {
	UserID         string
	PositionID     coretypes.LpPositionID
	IdempotencyKey string
}

type RequestUnbondResult struct {
	ReceiptResult
	UnlockAtBlock uint64
}

func (c *Client) RequestUnbond(ctx context.Context, req RequestUnbondRequest) (AsyncResult, error) {
	if req.UserID == "" || req.PositionID == nil || req.PositionID.Sign() <= 0 || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "RequestUnbond", errStr("invalid request"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "RequestUnbond", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.LiquidityPool().RequestUnbondCalldata(req.PositionID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "RequestUnbond", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "RequestUnbond", UserID: req.UserID, UserAddr: userAddr,
		Target: c.cfg.Addresses.LiquidityPool, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"position_id": req.PositionID.String(), "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}
func (c *Client) RequestUnbondWithReceipt(ctx context.Context, req RequestUnbondRequest) (RequestUnbondResult, error) {
	async, err := c.RequestUnbond(ctx, req)
	if err != nil {
		return RequestUnbondResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return RequestUnbondResult{}, err
	}
	return RequestUnbondResult{
		ReceiptResult: ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed},
	}, nil
}

// ─── Withdraw (findings.md §3.10) ────────────────────────────────────────

type WithdrawRequest struct {
	UserID         string
	PositionID     coretypes.LpPositionID
	IdempotencyKey string
}

type WithdrawResult struct {
	ReceiptResult
	WithdrawnAmount *big.Int
}

func (c *Client) Withdraw(ctx context.Context, req WithdrawRequest) (AsyncResult, error) {
	if req.UserID == "" || req.PositionID == nil || req.PositionID.Sign() <= 0 || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Withdraw", errStr("invalid request"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "Withdraw", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.LiquidityPool().WithdrawCalldata(req.PositionID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Withdraw", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "Withdraw", UserID: req.UserID, UserAddr: userAddr,
		Target: c.cfg.Addresses.LiquidityPool, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"position_id": req.PositionID.String(), "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}
func (c *Client) WithdrawWithReceipt(ctx context.Context, req WithdrawRequest) (WithdrawResult, error) {
	async, err := c.Withdraw(ctx, req)
	if err != nil {
		return WithdrawResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return WithdrawResult{}, err
	}
	return WithdrawResult{
		ReceiptResult: ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed},
	}, nil
}

// ─── Stake (findings.md §3.11) ───────────────────────────────────────────

type StakeRequest struct {
	UserID         string
	Amount         *big.Int
	PlanID         uint16
	IdempotencyKey string
}

type StakeResult struct {
	ReceiptResult
	PositionID coretypes.StakePositionID
}

func (c *Client) Stake(ctx context.Context, req StakeRequest) (AsyncResult, error) {
	if req.UserID == "" || req.Amount == nil || req.Amount.Sign() <= 0 || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Stake", errStr("invalid request"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "Stake", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	if err := c.checkBalance(ctx, "Stake", userAddr, req.Amount); err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.StakingPool().StakeCalldata(req.Amount, req.PlanID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Stake", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "Stake", UserID: req.UserID, UserAddr: userAddr,
		Target: c.cfg.Addresses.StakingPool, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"amount": req.Amount.String(), "plan_id": req.PlanID, "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}
func (c *Client) StakeWithReceipt(ctx context.Context, req StakeRequest) (StakeResult, error) {
	async, err := c.Stake(ctx, req)
	if err != nil {
		return StakeResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return StakeResult{}, err
	}
	return StakeResult{
		ReceiptResult: ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed},
	}, nil
}

// ─── Unstake (findings.md §3.12) ─────────────────────────────────────────

type UnstakeRequest struct {
	UserID         string
	PositionID     coretypes.StakePositionID
	IdempotencyKey string
}

type UnstakeResult struct {
	ReceiptResult
	UnstakedAmount *big.Int
}

func (c *Client) Unstake(ctx context.Context, req UnstakeRequest) (AsyncResult, error) {
	if req.UserID == "" || req.PositionID == nil || req.PositionID.Sign() <= 0 || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Unstake", errStr("invalid request"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "Unstake", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.StakingPool().UnstakeCalldata(req.PositionID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Unstake", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "Unstake", UserID: req.UserID, UserAddr: userAddr,
		Target: c.cfg.Addresses.StakingPool, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"position_id": req.PositionID.String(), "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}
func (c *Client) UnstakeWithReceipt(ctx context.Context, req UnstakeRequest) (UnstakeResult, error) {
	async, err := c.Unstake(ctx, req)
	if err != nil {
		return UnstakeResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return UnstakeResult{}, err
	}
	return UnstakeResult{
		ReceiptResult: ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed},
	}, nil
}

// ─── EarlyUnstake (findings.md §3.12) ────────────────────────────────────

type EarlyUnstakeRequest struct {
	UserID         string
	PositionID     coretypes.StakePositionID
	IdempotencyKey string
}

type EarlyUnstakeResult struct {
	ReceiptResult
	UnstakedAmount *big.Int
}

func (c *Client) EarlyUnstake(ctx context.Context, req EarlyUnstakeRequest) (AsyncResult, error) {
	if req.UserID == "" || req.PositionID == nil || req.PositionID.Sign() <= 0 || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "EarlyUnstake", errStr("invalid request"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "EarlyUnstake", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.StakingPool().EarlyUnstakeCalldata(req.PositionID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "EarlyUnstake", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "EarlyUnstake", UserID: req.UserID, UserAddr: userAddr,
		Target: c.cfg.Addresses.StakingPool, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"position_id": req.PositionID.String(), "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}
func (c *Client) EarlyUnstakeWithReceipt(ctx context.Context, req EarlyUnstakeRequest) (EarlyUnstakeResult, error) {
	async, err := c.EarlyUnstake(ctx, req)
	if err != nil {
		return EarlyUnstakeResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return EarlyUnstakeResult{}, err
	}
	return EarlyUnstakeResult{
		ReceiptResult: ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed},
	}, nil
}

// ─── Transfer (findings.md §3.13) ────────────────────────────────────────

type TransferRequest struct {
	UserID         string
	To             common.Address
	Value          *big.Int
	IdempotencyKey string
}

func (c *Client) Transfer(ctx context.Context, req TransferRequest) (AsyncResult, error) {
	if req.UserID == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Transfer", errStr("empty UserID"))
	}
	if req.To == (common.Address{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Transfer", errStr("zero To"))
	}
	if req.Value == nil || req.Value.Sign() <= 0 {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Transfer", errStr("Value must be positive"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "Transfer", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}

	// Pre-flight: 1-call multicall for ODDToken.balanceOf(userAddr).
	// (Single call to remain consistent with other relay methods using the multicall path;
	//  could be a direct eth_call without much cost difference.)
	calls := []multicall.Call{
		{Target: c.cfg.Addresses.ODDToken, CallData: encodeBalanceOf(userAddr)},
	}
	results, err := c.mc.Aggregate3(ctx, calls)
	if err != nil {
		return AsyncResult{}, coretypes.WrapRetryable(coretypes.ErrInfraMulticall, "Transfer.precheck", err)
	}
	if len(results) != 1 || !results[0].Success {
		return AsyncResult{}, coretypes.WrapRetryable(coretypes.ErrInfraMulticall, "Transfer.precheck", errStr("balanceOf call failed"))
	}
	bal, derr := decodeUint256(results[0].ReturnData)
	if derr != nil {
		return AsyncResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, "Transfer.precheck", derr)
	}
	if bal.Cmp(req.Value) < 0 {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrUserInsufficientBalance, "Transfer", nil)
	}

	calldata, err := c.sdk.ODDToken().TransferCalldata(req.To, req.Value)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Transfer", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method:         "Transfer",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         c.cfg.Addresses.ODDToken,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
			"to":              req.To.Hex(),
			"value":           req.Value.String(),
			"idempotency_key": req.IdempotencyKey,
		},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) TransferWithReceipt(ctx context.Context, req TransferRequest) (ReceiptResult, error) {
	async, err := c.Transfer(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── Approve (findings.md §3.14) ─────────────────────────────────────────

type ApproveRequest struct {
	UserID         string
	Spender        common.Address
	Value          *big.Int // 0 is legal (revoke)
	IdempotencyKey string
}

func (c *Client) Approve(ctx context.Context, req ApproveRequest) (AsyncResult, error) {
	if req.UserID == "" || req.Spender == (common.Address{}) || req.Value == nil || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Approve", errStr("invalid request"))
	}
	// Value == 0 is legal (revoke approval) — do not gate on it.
	userAddr, err := c.resolveUserAddr(ctx, "Approve", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	calldata, err := c.sdk.ODDToken().ApproveCalldata(req.Spender, req.Value)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "Approve", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "Approve", UserID: req.UserID, UserAddr: userAddr,
		Target: c.cfg.Addresses.ODDToken, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"spender": req.Spender.Hex(), "value": req.Value.String(), "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}
func (c *Client) ApproveWithReceipt(ctx context.Context, req ApproveRequest) (ReceiptResult, error) {
	async, err := c.Approve(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── ApproveUsdt (USDT → spender, e.g. TierSale public sale) ───────────────

// ApproveUsdtRequest is the input for ApproveUsdt. Spender is the contract the
// USDT allowance is granted to — for the public-sale buy flow that is the
// TierSale proxy, which pulls USDT from the buyer via transferFrom in buy().
type ApproveUsdtRequest struct {
	UserID         string
	Spender        common.Address
	Value          *big.Int // 0 is legal (revoke)
	IdempotencyKey string
}

// ApproveUsdt grants the user's USDT allowance to Spender via the sponsored
// pathway. It mirrors Approve but targets the USDT token (Config.USDT) instead
// of ODDToken: the user (A) signs, the sponsor (B) pays gas.
//
// Call this before tiersale.Buy — TierSale.buy() does a USDT transferFrom on the
// buyer, which reverts without a prior allowance to the TierSale contract.
//
// USDT must be configured (Config.USDT); ApproveUsdt errors if it is the zero
// address. The ERC-20 approve(spender,uint256) calldata is token-agnostic, so the
// SDK's ODDToken approve encoder is reused — only the submit Target differs (USDT,
// not ODDToken). Value == 0 is legal (revokes the allowance).
func (c *Client) ApproveUsdt(ctx context.Context, req ApproveUsdtRequest) (AsyncResult, error) {
	if req.UserID == "" || req.Spender == (common.Address{}) || req.Value == nil || req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ApproveUsdt", errStr("invalid request"))
	}
	// USDT is not one of the core proxies; it must be explicitly wired for the
	// public-sale flow. Fail loudly instead of approving the zero address.
	usdt := c.cfg.USDT
	if usdt == (common.Address{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ApproveUsdt", errStr("USDT address not configured"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "ApproveUsdt", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	// approve(spender,uint256) calldata is identical for any ERC-20; reuse the
	// SDK encoder and override only the submit Target to the USDT contract.
	calldata, err := c.sdk.ODDToken().ApproveCalldata(req.Spender, req.Value)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ApproveUsdt", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method: "ApproveUsdt", UserID: req.UserID, UserAddr: userAddr,
		Target: usdt, Data: calldata, IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{"token": usdt.Hex(), "spender": req.Spender.Hex(), "value": req.Value.String(), "idempotency_key": req.IdempotencyKey},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(res.TxHash.Hex()), ActionID: res.ActionID, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) ApproveUsdtWithReceipt(ctx context.Context, req ApproveUsdtRequest) (ReceiptResult, error) {
	async, err := c.ApproveUsdt(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── shared helpers ──────────────────────────────────────────────────────

// checkBalance runs a 1-call multicall for ODDToken.balanceOf(user) and
// gates on amount sufficiency. Used by DepositGlobal/DepositMatch/Stake.
func (c *Client) checkBalance(ctx context.Context, op string, user common.Address, want *big.Int) error {
	calls := []multicall.Call{
		{Target: c.cfg.Addresses.ODDToken, CallData: encodeBalanceOf(user)},
	}
	results, err := c.mc.Aggregate3(ctx, calls)
	if err != nil {
		return coretypes.WrapRetryable(coretypes.ErrInfraMulticall, op+".precheck", err)
	}
	if len(results) != 1 || !results[0].Success {
		return coretypes.WrapRetryable(coretypes.ErrInfraMulticall, op+".precheck", errStr("balanceOf failed"))
	}
	bal, err := decodeUint256(results[0].ReturnData)
	if err != nil {
		return coretypes.WrapInternal(coretypes.ErrInternalInvariant, op+".precheck", err)
	}
	if bal.Cmp(want) < 0 {
		return coretypes.WrapBusiness(coretypes.ErrUserInsufficientBalance, op, nil)
	}
	return nil
}
