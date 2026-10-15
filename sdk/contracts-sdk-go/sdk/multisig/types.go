package multisig

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// MarketType / SignalColor mirror the Solidity enums; we re-declare them
// here (rather than import sdk/admin) to keep package boundaries clean.
type MarketType uint8

const (
	MarketX12 MarketType = 0
	MarketAH  MarketType = 1
	MarketOU  MarketType = 2
)

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

// ── Args structs (one per multisig method) ───────────────────────────────────

// SettleArgs settles a market bucket with the winning outcome and lists every
// open bet on it (the contract debits/credits each per outcome).
type SettleArgs struct {
	MatchID        [32]byte
	Market         MarketType
	Line           uint8
	WinningOutcome uint8
	BetIDs         [][32]byte
}

// CancelMatchArgs cancels a single (matchId, market, line) and refunds every
// open bet on it.
type CancelMatchArgs struct {
	MatchID [32]byte
	Market  MarketType
	Line    uint8
	BetIDs  [][32]byte
}

// BatchCancelMatchArgs cancels multiple markets for the same match in one tx.
// All inner slices must be the same length; BetIDsByMarket[i] is the bet list
// for (Markets[i], Lines[i]).
type BatchCancelMatchArgs struct {
	MatchID         [32]byte
	Markets         []MarketType
	Lines           []uint8
	BetIDsByMarket  [][][32]byte
}

// ReopenMarketArgs reopens a previously closed market (admin closed it but
// settlement hasn't happened). Multisig-only because it's a sensitive override.
type ReopenMarketArgs struct {
	MatchID [32]byte
	Market  MarketType
	Line    uint8
}

// ReleaseOrForfeitureArgs decides a frozen credit-bet payout: either release
// to user (collateral was good) or forfeit (collateral failed).
type ReleaseOrForfeitureArgs struct {
	CreditBetID [32]byte
}

// WithdrawPlatformArgs sweeps `amount` USDT from the contract's platform
// balance to `to`.
type WithdrawPlatformArgs struct {
	To     common.Address
	Amount *big.Int
}

// SetMaxMarketsPerMatchArgs updates the per-match market cap.
type SetMaxMarketsPerMatchArgs struct {
	Max *big.Int
}

// SetRedLightThresholdArgs updates the heavy-side amount threshold for the
// red-light signal.
type SetRedLightThresholdArgs struct {
	Threshold *big.Int
}

// SetAdminArgs rotates the admin role.
type SetAdminArgs struct {
	NewAdmin common.Address
}

// SetLpShareBpsArgs updates the LP share basis points (out of 10_000).
type SetLpShareBpsArgs struct {
	NewBps *big.Int
}

// PauseArgs / UnpauseArgs are zero-arg toggles.
type PauseArgs struct{}
type UnpauseArgs struct{}

// ExecuteLargeWithdrawalArgs approves and executes a previously-queued large
// withdrawal (>$5000) after its 24h delay.
type ExecuteLargeWithdrawalArgs struct {
	RequestID [32]byte
}

// RejectLargeWithdrawalArgs rejects a queued large withdrawal (returns the
// funds to the user's spendable balance).
type RejectLargeWithdrawalArgs struct {
	RequestID [32]byte
}

// ── Proposal (Propose mode return type) ──────────────────────────────────────

// Proposal is what a successful Propose call returns. Most fields are populated
// from the Safe Transaction Service response; SafeUIURL is constructed
// client-side for convenience.
type Proposal struct {
	SafeTxHash            common.Hash
	SafeUIURL             string  // https://app.safe.global/transactions/queue?safe=...
	Nonce                 uint64
	ConfirmationsRequired uint
	ConfirmationsCount    uint
	Status                string         // "proposed" / "executed" / "cancelled"
	OnChainTxHash         *common.Hash   // non-nil after threshold met + executed
}

// ── helpers ──────────────────────────────────────────────────────────────────

func marketTypesToUint8(ms []MarketType) []uint8 {
	out := make([]uint8, len(ms))
	for i, m := range ms {
		out[i] = uint8(m)
	}
	return out
}
