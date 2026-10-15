// service.go — internal helpers shared by all tiersale write methods.
//
// submit is the workhorse: A signs intent + 7702 authorization via Magic, the
// sponsor (B) builds the SetCodeTx + signs + broadcasts. Idempotency is enforced
// via chain_actions. This is a self-contained copy of the relay submit pipeline,
// scoped to the TierSale target; it reuses only the shared internal/eip7702
// primitives.
//
// NOTE: single-pod implementation. Multi-pod deployments will experience nonce
// contention on the sponsor key (same caveat as relay).

package tiersale

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/holiman/uint256"
	"go.uber.org/zap"

	magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"

	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/eip7702"
)

// wrapMagicErr maps an error from the magic-signer client SDK into coretypes'
// standard error taxonomy so retry/alerting policy is consistent.
func wrapMagicErr(op string, err error) error {
	switch {
	case errors.Is(err, magicclient.ErrInvalidConfig),
		errors.Is(err, magicclient.ErrBadRequest),
		errors.Is(err, magicclient.ErrUnauthorized),
		errors.Is(err, magicclient.ErrOpNotAllowed):
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, err)
	case errors.Is(err, magicclient.ErrMagicUpstream),
		errors.Is(err, magicclient.ErrMagicNetwork),
		errors.Is(err, magicclient.ErrNetwork):
		return coretypes.WrapRetryable(coretypes.ErrInfraRPC, op, err)
	case errors.Is(err, magicclient.ErrServerInternal):
		return coretypes.WrapInternal(coretypes.ErrInternalInvariant, op, err)
	default:
		return coretypes.WrapRetryable(coretypes.ErrInfraRPC, op, err)
	}
}

// submitJob carries everything submit() needs.
type submitJob struct {
	Method         string         // chain_actions.op label
	UserID         string         // A's Magic user_id — passed to Signer
	UserAddr       common.Address // A's Magic EOA
	Target         common.Address // contract C (TierSale)
	Value          *big.Int       // typically 0
	Data           []byte         // inner call calldata (e.g. BuyCalldata output)
	IdempotencyKey string
	ArgsJSON       map[string]any // redacted args for chain_actions.args_json
}

// submitResult is the inner result of c.submit (before A/B-form wrapping).
type submitResult struct {
	TxHash   common.Hash
	ActionID coretypes.ActionID
}

func (c *Client) submit(ctx context.Context, job submitJob) (submitResult, error) {
	if ctx == nil {
		return submitResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, job.Method, errors.New("nil ctx"))
	}
	if job.UserID == "" {
		return submitResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, job.Method, errors.New("empty UserID"))
	}
	if job.UserAddr == (common.Address{}) {
		return submitResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, job.Method, errors.New("zero UserAddr"))
	}
	if job.IdempotencyKey == "" {
		return submitResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, job.Method, errors.New("missing idempotency key"))
	}
	if job.Target == (common.Address{}) {
		return submitResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, job.Method, errors.New("zero Target"))
	}

	c.log.Info("tiersale.submit start",
		zap.String("method", job.Method),
		zap.String("user_id", job.UserID),
		zap.String("user_addr", job.UserAddr.Hex()),
		zap.String("target", job.Target.Hex()),
		zap.String("idempotency_key", job.IdempotencyKey),
	)

	// 1) Insert chain_actions row (status=pending). On duplicate idempotency_key
	//    the existing row is loaded and we short-circuit if it already has a tx hash.
	argsBytes, _ := json.Marshal(job.ArgsJSON)
	rowID, existed, err := c.actions.InsertOrLoad(ctx, &action.Row{
		IdempotencyKey: job.IdempotencyKey,
		Op:             job.Method,
		ArgsJSON:       string(argsBytes),
		Status:         coretypes.StatusPending,
		SignerAddress:  c.sponsorAt.Hex(),
	})
	if err != nil {
		return submitResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, job.Method+".InsertOrLoad", err)
	}
	actionID := coretypes.ActionID(rowID)
	if existed {
		row, gerr := c.actions.Get(ctx, rowID)
		if gerr != nil {
			return submitResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, job.Method+".Get", gerr)
		}
		if row.TxHash.Valid && row.TxHash.String != "" {
			return submitResult{TxHash: common.HexToHash(row.TxHash.String), ActionID: actionID}, nil
		}
		// otherwise fall through and re-submit
	}

	// 2) Read chain context: chainID (derived + cached), A's tx-nonce.
	chainID, err := c.getChainID(ctx)
	if err != nil {
		return submitResult{}, err
	}
	aTxNonce, err := c.eth.NonceAt(ctx, job.UserAddr, nil)
	if err != nil {
		return submitResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, job.Method+".NonceAt(A)", err)
	}

	deadline := big.NewInt(time.Now().Unix() + int64(c.cfg.SignatureDeadline.Seconds()))
	// SponsoredDelegator uses bitmap-based one-shot nonces (any uint256).
	execNonce := big.NewInt(time.Now().UnixNano())

	// 3) Sign SetCodeAuthorization via Magic (A delegates her EOA to ImplAddress).
	authDigest, err := eip7702.AuthorizationDigest(chainID, c.cfg.ImplAddress, aTxNonce)
	if err != nil {
		return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".AuthorizationDigest", err)
	}
	c.log.Debug("tiersale.submit auth digest",
		zap.String("method", job.Method), zap.String("user_id", job.UserID),
		zap.String("auth_digest", hexutil.Encode(authDigest[:])),
		zap.Uint64("auth_nonce", aTxNonce),
	)
	authSig, err := c.signer.SignDigest(ctx, job.UserID, authDigest)
	if err != nil {
		c.log.Warn("tiersale.submit magic sign auth failed",
			zap.String("method", job.Method), zap.String("user_id", job.UserID), zap.Error(err))
		return submitResult{}, wrapMagicErr(job.Method+".SignAuthorization", err)
	}
	auth, err := eip7702.AssembleAuthorization(chainID, c.cfg.ImplAddress, aTxNonce, authSig)
	if err != nil {
		return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".AssembleAuthorization", err)
	}

	// 4) Sign Execute typed data via Magic (A's intent: one inner call to Target).
	value := job.Value
	if value == nil {
		value = big.NewInt(0)
	}
	calls := []eip7702.Call{{Target: job.Target, Value: value, Data: job.Data}}
	execDigest, err := eip7702.ExecuteRequestDigest(eip7702.ExecuteDigestInput{
		ChainID:           chainID,
		VerifyingContract: job.UserAddr,
		Calls:             calls,
		Nonce:             execNonce,
		Deadline:          deadline,
	})
	if err != nil {
		return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".ExecuteDigest", err)
	}
	c.log.Debug("tiersale.submit execute digest",
		zap.String("method", job.Method), zap.String("user_id", job.UserID),
		zap.String("execute_digest", hexutil.Encode(execDigest[:])),
		zap.String("execute_nonce", execNonce.String()),
	)
	execSig, err := c.signer.SignDigest(ctx, job.UserID, execDigest)
	if err != nil {
		c.log.Warn("tiersale.submit magic sign execute failed",
			zap.String("method", job.Method), zap.String("user_id", job.UserID), zap.Error(err))
		return submitResult{}, wrapMagicErr(job.Method+".SignExecute", err)
	}
	// SponsoredDelegator's OZ ECDSA.recover expects r||s||v with v ∈ {27,28},
	// which is exactly what the Signer returns — pass the 65 bytes through.
	sig := execSig[:]

	// 5) Encode outer calldata: SponsoredDelegator.executeBatch(calls, nonce, deadline, signature).
	outerData, err := eip7702.EncodeBatchExecute(calls, execNonce, deadline, sig)
	if err != nil {
		return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".EncodeBatchExecute", err)
	}

	// 6) Sponsor (B) assembles + signs + broadcasts the SetCodeTx (type 0x04).
	bNonce, err := c.eth.PendingNonceAt(ctx, c.sponsorAt)
	if err != nil {
		return submitResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, job.Method+".PendingNonceAt(B)", err)
	}
	tipCap, err := c.eth.SuggestGasTipCap(ctx)
	if err != nil {
		return submitResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, job.Method+".SuggestGasTipCap", err)
	}
	feeCapBase, err := c.eth.SuggestGasPrice(ctx)
	if err != nil {
		return submitResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, job.Method+".SuggestGasPrice", err)
	}
	feeCap := new(big.Int).Add(feeCapBase, tipCap)

	// Dynamic gas budget: estimate the inner business call, add sponsored
	// overhead + 20% buffer. Fall back to a hardcoded ceiling if estimation
	// fails (e.g. RPC can't simulate type-0x04, or inner call reverts under
	// simulation state — buy reverts if allowance/state isn't ready yet).
	const (
		gasOverheadSponsored = uint64(70_000)
		gasFallbackLimit     = uint64(2_000_000)
		gasBufferPercent     = uint64(120)
	)
	var gasLimit uint64
	innerEstimate, estErr := c.eth.EstimateGas(ctx, ethereum.CallMsg{
		From: job.UserAddr,
		To:   &job.Target,
		Data: job.Data,
	})
	if estErr != nil {
		gasLimit = gasFallbackLimit
	} else {
		gasLimit = max((innerEstimate+gasOverheadSponsored)*gasBufferPercent/100, uint64(200_000))
	}

	unsigned, err := buildSetCodeTx(chainID, bNonce, job.UserAddr, gasLimit, tipCap, feeCap, outerData, auth)
	if err != nil {
		return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".buildSetCodeTx", err)
	}
	signed, err := types.SignTx(unsigned, types.NewPragueSigner(chainID), c.cfg.SponsorPrivateKey)
	if err != nil {
		return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".SignTx", err)
	}
	if err := c.eth.SendTransaction(ctx, signed); err != nil {
		_ = c.actions.MarkFailed(ctx, rowID, "send", err)
		c.log.Warn("tiersale.submit broadcast failed",
			zap.String("method", job.Method), zap.String("user_id", job.UserID), zap.Error(err))
		return submitResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, job.Method+".SendTransaction", err)
	}

	// 7) Update chain_actions row (status=submitted, tx_hash, nonce).
	hash := signed.Hash()
	c.log.Info("tiersale.submit broadcast",
		zap.String("method", job.Method),
		zap.String("user_id", job.UserID),
		zap.String("tx_hash", hash.Hex()),
		zap.Int64("action_id", int64(actionID)),
		zap.Uint64("sponsor_nonce", bNonce),
	)
	if uerr := c.actions.MarkSubmitted(ctx, rowID, hash.Hex(), bNonce); uerr != nil {
		return submitResult{TxHash: hash, ActionID: actionID}, coretypes.WrapInternal(
			coretypes.ErrInternalInvariant, job.Method+".MarkSubmitted", uerr,
		)
	}

	return submitResult{TxHash: hash, ActionID: actionID}, nil
}

// waitReceipt polls until the tx is mined and `Confirmations` blocks have been
// stacked on top. Returns the canonical receipt; a status-0 receipt is surfaced
// as a fatal ErrChainTxReverted.
func (c *Client) waitReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error) {
	pollInterval := 1 * time.Second
	deadline := time.Now().Add(2 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return nil, coretypes.WrapRetryable(coretypes.ErrInfraReceiptTimeout, "waitReceipt", ctx.Err())
		default:
		}
		if time.Now().After(deadline) {
			return nil, coretypes.WrapRetryable(coretypes.ErrInfraReceiptTimeout, "waitReceipt", errors.New("internal 2-min deadline"))
		}
		receipt, err := c.eth.TransactionReceipt(ctx, txHash)
		if err == nil && receipt != nil {
			head, herr := c.eth.HeaderByNumber(ctx, nil)
			if herr != nil {
				return nil, coretypes.WrapRetryable(coretypes.ErrInfraRPC, "waitReceipt.HeaderByNumber", herr)
			}
			needed := receipt.BlockNumber.Uint64() + uint64(c.cfg.Confirmations)
			if head.Number.Uint64() >= needed {
				if receipt.Status != 1 {
					return receipt, coretypes.WrapFatal(coretypes.ErrChainTxReverted, "waitReceipt", fmt.Errorf("tx %s reverted on-chain (status=0, block=%d, gas_used=%d)", txHash.Hex(), receipt.BlockNumber.Uint64(), receipt.GasUsed))
				}
				return receipt, nil
			}
		}
		time.Sleep(pollInterval)
	}
}

// buildSetCodeTx constructs the unsigned 0x04 SetCodeTx.
func buildSetCodeTx(
	chainID *big.Int,
	bNonce uint64,
	aAddr common.Address,
	gasLimit uint64,
	tipCap, feeCap *big.Int,
	data []byte,
	auth types.SetCodeAuthorization,
) (*types.Transaction, error) {
	cid, overflow := uint256.FromBig(chainID)
	if overflow {
		return nil, fmt.Errorf("chainID overflows uint256")
	}
	tip, overflow := uint256.FromBig(tipCap)
	if overflow {
		return nil, fmt.Errorf("gasTipCap overflows uint256")
	}
	fee, overflow := uint256.FromBig(feeCap)
	if overflow {
		return nil, fmt.Errorf("gasFeeCap overflows uint256")
	}
	inner := &types.SetCodeTx{
		ChainID:   cid,
		Nonce:     bNonce,
		GasTipCap: tip,
		GasFeeCap: fee,
		Gas:       gasLimit,
		To:        aAddr,
		Value:     uint256.NewInt(0),
		Data:      data,
		AuthList:  []types.SetCodeAuthorization{auth},
	}
	return types.NewTx(inner), nil
}

// getChainID returns the EVM chain ID, derived from the RPC on first use and
// cached thereafter. The value is immutable for a given endpoint, so caching is
// safe; a failed fetch is not cached and retries on the next call.
func (c *Client) getChainID(ctx context.Context) (*big.Int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.chainID != nil {
		return c.chainID, nil
	}
	id, err := c.eth.ChainID(ctx)
	if err != nil {
		return nil, coretypes.WrapRetryable(coretypes.ErrInfraRPC, "ChainID", err)
	}
	c.chainID = id
	return id, nil
}
