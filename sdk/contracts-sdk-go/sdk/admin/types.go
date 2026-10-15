package admin

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// ── Enums (mirror Solidity uint8 enums) ──────────────────────────────────────

// MarketType identifies the pricing market for a given (matchId, line) bucket.
//
// Solidity enum MarketType { X12, AH, OU } in src/shared/types/BetTypes.sol.
type MarketType uint8

const (
	// MarketX12 = 主胜 / 平局 / 客胜 (1×2).
	MarketX12 MarketType = 0
	// MarketAH = Asian Handicap 让分.
	MarketAH MarketType = 1
	// MarketOU = Over/Under 大小球.
	MarketOU MarketType = 2
)

// String returns a short human label for logs.
func (m MarketType) String() string {
	switch m {
	case MarketX12:
		return "X12"
	case MarketAH:
		return "AH"
	case MarketOU:
		return "OU"
	default:
		return "MarketType(?)"
	}
}

// SignalColor matches Solidity enum SignalColor { Green, Yellow, Red }.
type SignalColor uint8

const (
	SignalGreen  SignalColor = 0
	SignalYellow SignalColor = 1
	SignalRed    SignalColor = 2
)

func (s SignalColor) String() string {
	switch s {
	case SignalGreen:
		return "Green"
	case SignalYellow:
		return "Yellow"
	case SignalRed:
		return "Red"
	default:
		return "SignalColor(?)"
	}
}

// ── Args structs (one per admin method) ──────────────────────────────────────

// CreditDepositArgs records an off-chain user deposit on the contract,
// crediting `amount` USDT to `user`'s in-contract balance. `txHash` is the
// off-chain reference (typically the user's deposit tx hash) and is stored
// as a one-shot dedup key by the contract.
type CreditDepositArgs struct {
	User   common.Address
	Amount *big.Int // USDT 6-decimals
	TxHash [32]byte
}

// OpenMarketArgs opens (or reopens, contract-side semantics permitting) the
// (matchId, market, line) bucket for new bets.
type OpenMarketArgs struct {
	MatchID [32]byte
	Market  MarketType
	Line    uint8
}

// CloseMarketArgs closes a market bucket — no further bets can lock until
// reopened or settled.
type CloseMarketArgs struct {
	MatchID [32]byte
	Market  MarketType
	Line    uint8
}

// BatchOpenMarketsArgs opens multiple markets in a single tx for the same
// match. len(Markets) must equal len(Lines).
type BatchOpenMarketsArgs struct {
	MatchID [32]byte
	Markets []MarketType
	Lines   []uint8
}

// BatchCloseMarketsArgs is the close counterpart.
type BatchCloseMarketsArgs struct {
	MatchID [32]byte
	Markets []MarketType
	Lines   []uint8
}

// LockBetArgs records a regular (non-credit, non-parlay) bet. The contract
// debits Amount from the user's in-contract balance and locks it pending
// settlement. LockedOdds is the integer-encoded odds (×1000, e.g. 1.818 → 1818).
type LockBetArgs struct {
	BetID      [32]byte
	User       common.Address
	Amount     *big.Int
	MatchID    [32]byte
	Market     MarketType
	Outcome    uint8
	Line       uint8
	LockedOdds *big.Int
}

// LockCreditBetArgs records a credit bet: a follow-up bet collateralised by a
// previously placed (and not-yet-settled) regular bet's potential payout.
// CollateralBetID references that prior bet.
type LockCreditBetArgs struct {
	BetID           [32]byte
	CollateralBetID [32]byte
	User            common.Address
	Amount          *big.Int
	MatchID         [32]byte
	Market          MarketType
	Outcome         uint8
	Line            uint8
	LockedOdds      *big.Int
}

// LockParlayArgs records a parlay (multi-leg combo) bet. All leg slices
// must have the same length, and len ≥ 2 (single-leg parlay = LockBet).
type LockParlayArgs struct {
	ParlayID  [32]byte
	User      common.Address
	Stake     *big.Int
	MatchIDs  [][32]byte
	Markets   []MarketType
	Outcomes  []uint8
	Lines     []uint8
	LegOdds   []*big.Int
	LegBetIDs [][32]byte
}

// UnlockBetArgs is the reverse of LockBet — used when a market is cancelled
// and a bet must be refunded. CreditBetIDs lists any credit bets that were
// collateralised by this bet (they are also unwound atomically).
type UnlockBetArgs struct {
	BetID        [32]byte
	CreditBetIDs [][32]byte
}

// UnlockParlayArgs is the reverse of LockParlay.
type UnlockParlayArgs struct {
	ParlayID [32]byte
}

// UpdateSignalArgs records the signal/heavy-side flag for a market bucket.
// The signal informs LP risk and possibly affects odds movement.
type UpdateSignalArgs struct {
	MatchID     [32]byte
	Market      MarketType
	Line        uint8
	HeavyAmount *big.Int
	HeavySide   uint8 // 0/1/2 for X12; 0/1 for AH/OU; contract validates
	Color       SignalColor
}

// ── Helpers to convert []MarketType → []uint8 for binding calls ──────────────

func marketTypesToUint8(ms []MarketType) []uint8 {
	out := make([]uint8, len(ms))
	for i, m := range ms {
		out[i] = uint8(m)
	}
	return out
}
