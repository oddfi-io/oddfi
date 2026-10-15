// precheck.go — multicall3-batched on-chain read pre-flight for write methods.
//
// SDK doesn't expose raw calldata for read methods, so we encode/decode them
// here. Selectors mirror the proxy ABIs exactly.

package relay

import (
	"context"
	"errors"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/multicall"
)

// ─── 4-byte selectors (computed once) ────────────────────────────────────

var (
	selBalanceOf        = mustSelector("balanceOf(address)")
	selAccountedBalance = mustSelector("accountedBalance()")
	selGetMarketOdds    = mustSelector("getMarketOdds(bytes32)")
	// selAllowance / selGetBet intentionally omitted: relay paths skip these
	// pre-flight reads (S2: caller guarantees approval; S3: contract revert
	// surfaces ownership/state errors). Re-add here if those decisions change.
)

func mustSelector(sig string) []byte {
	return crypto.Keccak256([]byte(sig))[:4]
}

// ─── encoders ─────────────────────────────────────────────────────────────

func encodeBalanceOf(account common.Address) []byte {
	out := make([]byte, 0, 4+32)
	out = append(out, selBalanceOf...)
	out = append(out, common.LeftPadBytes(account.Bytes(), 32)...)
	return out
}

func encodeAccountedBalance() []byte {
	return append([]byte(nil), selAccountedBalance...)
}

func encodeGetMarketOdds(marketID coretypes.MarketID) []byte {
	out := make([]byte, 0, 4+32)
	out = append(out, selGetMarketOdds...)
	out = append(out, marketID[:]...)
	return out
}

// ─── decoders ─────────────────────────────────────────────────────────────

func decodeUint256(data []byte) (*big.Int, error) {
	if len(data) < 32 {
		return nil, fmt.Errorf("decodeUint256: short return (%d bytes)", len(data))
	}
	return new(big.Int).SetBytes(data[:32]), nil
}

// marketOddsView is the slim slice of GetMarketOdds we use for QuoteGuard.
// Decodes (uint256[] baseOdds, uint256[] quotedOdds, uint64 updatedAt, uint256 quoteVersion).
type marketOddsView struct {
	UpdatedAt    uint64
	QuoteVersion *big.Int
}

var marketOddsABI abi.Arguments

func init() {
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	uint256SliceTy, _ := abi.NewType("uint256[]", "", nil)
	uint64Ty, _ := abi.NewType("uint64", "", nil)
	marketOddsABI = abi.Arguments{
		{Type: uint256SliceTy},
		{Type: uint256SliceTy},
		{Type: uint64Ty},
		{Type: uint256Ty},
	}
}

func decodeMarketOdds(data []byte) (marketOddsView, error) {
	if len(data) == 0 {
		return marketOddsView{}, errors.New("decodeMarketOdds: empty return")
	}
	vals, err := marketOddsABI.Unpack(data)
	if err != nil {
		return marketOddsView{}, fmt.Errorf("decodeMarketOdds: %w", err)
	}
	if len(vals) != 4 {
		return marketOddsView{}, fmt.Errorf("decodeMarketOdds: expected 4 values, got %d", len(vals))
	}
	return marketOddsView{
		UpdatedAt:    vals[2].(uint64),
		QuoteVersion: vals[3].(*big.Int),
	}, nil
}

// ─── PlaceBet pre-flight ──────────────────────────────────────────────────

type placeBetPrecheck struct {
	Odds marketOddsView
}

// prePlaceBet runs the 3-call multicall predicate for PlaceBet:
//
//	[0] ODDToken.balanceOf(A)           — gate ErrUserInsufficientBalance
//	[1] BettingPool.accountedBalance()  — gate ErrPoolUndercapitalized (heuristic)
//	[2] BettingPool.getMarketOdds(mid)  — feed QuoteGuard
//
// Returns the decoded MarketOdds slice on success. On any predicate gate
// failure, returns a typed coretypes error so callers can errors.Is(...) it.
func (c *Client) prePlaceBet(ctx context.Context, userAddr common.Address, amount *big.Int, marketID coretypes.MarketID) (placeBetPrecheck, error) {
	if c.mc == nil {
		return placeBetPrecheck{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, "PlaceBet.precheck", errors.New("nil multicall"))
	}
	if c.cfg.Addresses.ODDToken == (common.Address{}) || c.cfg.Addresses.BettingPool == (common.Address{}) {
		return placeBetPrecheck{}, coretypes.WrapFatal(coretypes.ErrConfigChainInvalid, "PlaceBet.precheck", errors.New("missing proxy addresses in Config.Addresses"))
	}

	calls := []multicall.Call{
		{Target: c.cfg.Addresses.ODDToken, CallData: encodeBalanceOf(userAddr)},
		{Target: c.cfg.Addresses.BettingPool, CallData: encodeAccountedBalance()},
		{Target: c.cfg.Addresses.BettingPool, CallData: encodeGetMarketOdds(marketID)},
	}
	results, err := c.mc.Aggregate3(ctx, calls)
	if err != nil {
		return placeBetPrecheck{}, coretypes.WrapRetryable(coretypes.ErrInfraMulticall, "PlaceBet.precheck", err)
	}
	if len(results) != 3 {
		return placeBetPrecheck{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, "PlaceBet.precheck", fmt.Errorf("expected 3 results, got %d", len(results)))
	}
	if !results[0].Success || !results[1].Success || !results[2].Success {
		return placeBetPrecheck{}, coretypes.WrapRetryable(coretypes.ErrInfraMulticall, "PlaceBet.precheck", errors.New("at least one sub-call failed"))
	}

	balance, err := decodeUint256(results[0].ReturnData)
	if err != nil {
		return placeBetPrecheck{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, "PlaceBet.precheck.balance", err)
	}
	if balance.Cmp(amount) < 0 {
		return placeBetPrecheck{}, coretypes.WrapBusiness(coretypes.ErrUserInsufficientBalance, "PlaceBet", fmt.Errorf("balance=%s, want=%s", balance.String(), amount.String()))
	}

	// AccountedBalance is read but NOT used as a gate: it reflects BettingPool's
	// platform reserve (not LP payout capacity). Real undercapitalization is
	// enforced by the contract itself via LiquidityPool checks. We surface
	// reverts via decoded selectors → ErrPoolUndercapitalized if the contract
	// throws that. Keeping the multicall read for future use / observability.
	_, err = decodeUint256(results[1].ReturnData)
	if err != nil {
		return placeBetPrecheck{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, "PlaceBet.precheck.accountedBalance", err)
	}

	odds, err := decodeMarketOdds(results[2].ReturnData)
	if err != nil {
		return placeBetPrecheck{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, "PlaceBet.precheck.odds", err)
	}

	return placeBetPrecheck{Odds: odds}, nil
}
