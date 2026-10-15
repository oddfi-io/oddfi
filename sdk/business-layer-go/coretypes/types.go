// Package coretypes is the dependency-free type & error nucleus shared by all
// other packages of contracts-business-layer.
//
// The root `business` package re-exports these via type aliases so callers can
// still write business.Status / business.ErrNotImplemented / etc.
//
// Sub-packages (action, proposal, writes, multisig, watcher, multisigpoll,
// internal/nonce) import coretypes directly to avoid an import cycle with the
// root package, which itself imports those sub-packages for wiring.
package coretypes

import (
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/shopspring/decimal"
)

// ── Identifiers ─────────────────────────────────────────────────────────────

type ActionID int64
type ProposalID int64
type TxHash string
type BetID [32]byte

// MarketID is the 32-byte on-chain identifier that BettingPool computes as
//
//	keccak256(abi.encode(matchID, marketType, line))
//
// Most callers should not handle MarketID directly — pass a MarketKey instead
// and let the library compute the hash internally.
type MarketID [32]byte

// MatchID is the operator-supplied 32-byte identifier of a match
// (e.g. derived off-chain from a sportsbook event ID).
type MatchID [32]byte

// MarketKey is the human-readable triplet identifying a market. Pass this to
// the library; the library derives the 32-byte on-chain MarketID internally.
//
// Wire format inside the contract:
//
//	marketID = keccak256(abi.encode(matchID, marketType, line))
//
// Both abi.encode pad rules — bytes32 raw + uint8 right-aligned in 32-byte
// slot — apply. See MarketKey.MarketID for the exact computation.
type MarketKey struct {
	MatchID    MatchID
	MarketType uint8
	Line       uint8
}

// MarketID returns the contract-recognized 32-byte marketID for this key.
// External callers normally don't call this directly: every relay / admin /
// read method that targets a market accepts MarketKey and computes the
// MarketID internally. Use it only when you need to compare against a raw
// MarketID returned by an event or stored elsewhere.
func (k MarketKey) MarketID() MarketID {
	buf := make([]byte, 96) // 3 × 32-byte slots, as abi.encode produces
	copy(buf[0:32], k.MatchID[:])
	buf[63] = k.MarketType // uint8 right-aligned in slot 2
	buf[95] = k.Line       // uint8 right-aligned in slot 3
	h := crypto.Keccak256Hash(buf)
	var out MarketID
	copy(out[:], h.Bytes())
	return out
}

type LpPositionID = *big.Int
type StakePositionID = *big.Int

// ParlayID is the 32-byte on-chain identifier of a parlay bet, emitted by the
// BettingPool.ParlayPlaced event. Like BetID, callers treat it as opaque.
type ParlayID [32]byte

// ParlayLegInput is one selection within a parlay order. It is the business-layer
// input shared by relay.PlaceParlay (submit) and read.PreviewParlay (quote): the
// caller passes the human-readable MarketKey plus the quote snapshot they saw
// (QuoteVersion / QuotedAt / MinOdds), and the library derives the 32-byte
// marketID internally. The four quote fields mirror cashOut's caller-owned quote
// protection — the frontend supplies the version/timestamp/floor the user
// accepted; the contract enforces staleness on submit.
type ParlayLegInput struct {
	Market       MarketKey // human-readable (matchID, marketType, line); marketID derived internally
	Outcome      uint8     // selected outcome within the market
	QuoteVersion *big.Int  // = getMarketOdds(marketId).quoteVersion the user saw
	QuotedAt     uint64    // market quote timestamp (unix seconds) the user saw
	MinOdds      *big.Int  // minimum acceptable odds for this leg (1e4 precision)
}

// ── Status ──────────────────────────────────────────────────────────────────

type Status string

const (
	StatusPending   Status = "pending"
	StatusSubmitted Status = "submitted"
	StatusMined     Status = "mined"
	StatusConfirmed Status = "confirmed"
	StatusFailed    Status = "failed"
	StatusDropped   Status = "dropped"
)

type ProposalStatus string

const (
	ProposalProposed       ProposalStatus = "proposed"
	ProposalExecuted       ProposalStatus = "executed"
	ProposalExecutedFailed ProposalStatus = "executed_failed"
	ProposalRejected       ProposalStatus = "rejected"
)

// ── Tokens ──────────────────────────────────────────────────────────────────

type TokenSymbol string

type TokenInfo struct {
	Symbol   TokenSymbol
	Address  common.Address
	Decimals uint8
}

// ── Markets ─────────────────────────────────────────────────────────────────

type MarketKind uint8

const (
	MarketX12 MarketKind = 0
	MarketAH  MarketKind = 1
	MarketOU  MarketKind = 2
)

func (m MarketKind) String() string {
	switch m {
	case MarketX12:
		return "X12"
	case MarketAH:
		return "AH"
	case MarketOU:
		return "OU"
	default:
		return "MarketKind(?)"
	}
}

// ── Result of a write ──────────────────────────────────────────────────────

type Result struct {
	ActionID          ActionID
	TxHash            TxHash
	Status            Status
	BlockNumber       uint64
	BlockHash         common.Hash
	GasUsed           uint64
	EffectiveGasPrice decimal.Decimal
	Revert            *RevertInfo
	SubmittedAt       time.Time
	ConfirmedAt       time.Time
}

type RevertInfo struct {
	Method string
	Name   string
	Args   map[string]any
	Raw    string
}

type CalldataPacket struct {
	To        common.Address
	Value     decimal.Decimal
	Data      []byte
	Operation uint8
}

// ── Multisig Proposal ──────────────────────────────────────────────────────

type Proposal struct {
	ID                    ProposalID
	Op                    string
	SafeAddress           common.Address
	SafeTxHash            common.Hash
	SafeNonce             uint64
	ProposerAddress       common.Address
	Status                ProposalStatus
	ConfirmationsRequired uint
	ConfirmationsCount    uint
	OnChainTxHash         *common.Hash
	SafeUIURL             string
	ProposedAt            time.Time
	ExecutedAt            *time.Time
}

type ProposalResult struct {
	Proposal      Proposal
	OnChainResult *Result
}

// ── Wait options ────────────────────────────────────────────────────────────

type WaitOption func(*WaitConfig)

type WaitConfig struct {
	Confirmations int
	PollInterval  time.Duration
}

func WaitForConfirmations(n int) WaitOption {
	return func(c *WaitConfig) { c.Confirmations = n }
}

func WaitPollInterval(d time.Duration) WaitOption {
	return func(c *WaitConfig) { c.PollInterval = d }
}

func DefaultWaitConfig() WaitConfig {
	return WaitConfig{Confirmations: 2, PollInterval: 250 * time.Millisecond}
}

// ── Health ──────────────────────────────────────────────────────────────────

type HealthStatus struct {
	DBOK               bool
	RPCOK              bool
	SignerOK           bool
	LastBlockSeen      uint64
	PendingActionCount int
	OldestPendingAt    *time.Time
}
