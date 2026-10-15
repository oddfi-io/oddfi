// events.go — receipt log parsers for BettingPool / LiquidityPool / StakingPool
// events. Used by *WithReceipt variants to populate result fields without an
// extra RPC round-trip (the receipt is already in hand from waitReceipt).

package relay

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// BetPlaced event signature:
//
//	BetPlaced(
//	    bytes32 indexed betId,
//	    bytes32 indexed marketId,
//	    address indexed user,
//	    uint256 requestedAmount,
//	    uint256 acceptedAmount,
//	    uint256 lockedOdds,
//	    uint256 quoteVersion,
//	    uint8   outcome
//	)
//
// 3 indexed → topics[1..3]; 5 non-indexed packed as data (5×32 bytes = 160 B).
var betPlacedTopic0 = crypto.Keccak256Hash([]byte(
	"BetPlaced(bytes32,bytes32,address,uint256,uint256,uint256,uint256,uint8)",
))

type betPlacedParsed struct {
	Found          bool
	BetID          coretypes.BetID
	AcceptedAmount *big.Int
	LockedOdds     *big.Int
}

// parseBetPlaced scans receipt.Logs for the first BetPlaced event emitted by
// the BettingPool contract and decodes the fields needed by PlaceBetResult.
// Returns Found=false when no matching log is present (e.g. when the inner
// call reverted but the outer SetCodeTx somehow still succeeded — defensive).
func parseBetPlaced(receipt *types.Receipt, bpAddr common.Address) betPlacedParsed {
	for _, lg := range receipt.Logs {
		if lg.Address != bpAddr {
			continue
		}
		if len(lg.Topics) < 4 || lg.Topics[0] != betPlacedTopic0 {
			continue
		}
		out := betPlacedParsed{Found: true}
		copy(out.BetID[:], lg.Topics[1].Bytes())
		// Data layout:
		//   [  0.. 32)  requestedAmount
		//   [ 32.. 64)  acceptedAmount  ← we want
		//   [ 64.. 96)  lockedOdds      ← we want
		//   [ 96..128)  quoteVersion
		//   [128..160)  outcome (right-aligned in 32-byte slot)
		if len(lg.Data) >= 96 {
			out.AcceptedAmount = new(big.Int).SetBytes(lg.Data[32:64])
			out.LockedOdds = new(big.Int).SetBytes(lg.Data[64:96])
		}
		return out
	}
	return betPlacedParsed{}
}

// BetCashedOut event signature:
//
//	BetCashedOut(
//	    bytes32 indexed betId,
//	    bytes32 indexed marketId,
//	    address indexed user,
//	    uint256 remainingStake,
//	    uint256 cashOutAmount,
//	    uint256 currentOdds,
//	    uint16  feeBps,
//	    uint256 quoteVersion
//	)
//
// 3 indexed → topics[1..3]; 5 non-indexed packed as data (5×32 bytes = 160 B).
var betCashedOutTopic0 = crypto.Keccak256Hash([]byte(
	"BetCashedOut(bytes32,bytes32,address,uint256,uint256,uint256,uint16,uint256)",
))

type betCashedOutParsed struct {
	Found         bool
	BetID         coretypes.BetID
	CashOutAmount *big.Int
}

// parseBetCashedOut scans receipt.Logs for the first BetCashedOut event emitted
// by the BettingPool contract and decodes the fields needed by CashOutResult.
// Returns Found=false when no matching log is present.
func parseBetCashedOut(receipt *types.Receipt, bpAddr common.Address) betCashedOutParsed {
	for _, lg := range receipt.Logs {
		if lg.Address != bpAddr {
			continue
		}
		if len(lg.Topics) < 4 || lg.Topics[0] != betCashedOutTopic0 {
			continue
		}
		out := betCashedOutParsed{Found: true}
		copy(out.BetID[:], lg.Topics[1].Bytes())
		// Data layout:
		//   [  0.. 32)  remainingStake
		//   [ 32.. 64)  cashOutAmount   ← we want
		//   [ 64.. 96)  currentOdds
		//   [ 96..128)  feeBps (right-aligned in 32-byte slot)
		//   [128..160)  quoteVersion
		if len(lg.Data) >= 64 {
			out.CashOutAmount = new(big.Int).SetBytes(lg.Data[32:64])
		}
		return out
	}
	return betCashedOutParsed{}
}

// ParlayPlaced event signature:
//
//	ParlayPlaced(
//	    bytes32 indexed parlayId,
//	    address indexed user,
//	    uint256 stake,
//	    uint256 betTax,
//	    uint256 totalDeduct,
//	    uint8   legCount,
//	    uint256 lockedComboOdds,
//	    uint256 maxPayout,
//	    bytes32 indexed parlayRiskId
//	)
//
// 3 indexed → topics[1..3]; 6 non-indexed packed as data (6×32 bytes = 192 B).
var parlayPlacedTopic0 = crypto.Keccak256Hash([]byte(
	"ParlayPlaced(bytes32,address,uint256,uint256,uint256,uint8,uint256,uint256,bytes32)",
))

type parlayPlacedParsed struct {
	Found           bool
	ParlayID        coretypes.ParlayID
	MaxPayout       *big.Int
	LockedComboOdds *big.Int
}

// parseParlayPlaced scans receipt.Logs for the first ParlayPlaced event emitted
// by the BettingPool contract and decodes the fields needed by PlaceParlayResult.
func parseParlayPlaced(receipt *types.Receipt, bpAddr common.Address) parlayPlacedParsed {
	for _, lg := range receipt.Logs {
		if lg.Address != bpAddr {
			continue
		}
		if len(lg.Topics) < 4 || lg.Topics[0] != parlayPlacedTopic0 {
			continue
		}
		out := parlayPlacedParsed{Found: true}
		copy(out.ParlayID[:], lg.Topics[1].Bytes())
		// Data layout:
		//   [  0.. 32)  stake
		//   [ 32.. 64)  betTax
		//   [ 64.. 96)  totalDeduct
		//   [ 96..128)  legCount (right-aligned)
		//   [128..160)  lockedComboOdds  ← we want
		//   [160..192)  maxPayout        ← we want
		if len(lg.Data) >= 192 {
			out.LockedComboOdds = new(big.Int).SetBytes(lg.Data[128:160])
			out.MaxPayout = new(big.Int).SetBytes(lg.Data[160:192])
		}
		return out
	}
	return parlayPlacedParsed{}
}

// ParlayPayoutClaimed event signature:
//
//	ParlayPayoutClaimed(
//	    bytes32 indexed parlayId,
//	    address indexed user,
//	    uint256 grossPayout,
//	    uint256 taxAmount,
//	    uint256 netPayout
//	)
//
// 2 indexed → topics[1..2]; 3 non-indexed packed as data (3×32 bytes = 96 B).
var parlayPayoutClaimedTopic0 = crypto.Keccak256Hash([]byte(
	"ParlayPayoutClaimed(bytes32,address,uint256,uint256,uint256)",
))

type parlayPayoutClaimedParsed struct {
	Found     bool
	ParlayID  coretypes.ParlayID
	NetPayout *big.Int
}

// parseParlayPayoutClaimed scans receipt.Logs for the first ParlayPayoutClaimed
// event emitted by the BettingPool contract and decodes the net payout.
func parseParlayPayoutClaimed(receipt *types.Receipt, bpAddr common.Address) parlayPayoutClaimedParsed {
	for _, lg := range receipt.Logs {
		if lg.Address != bpAddr {
			continue
		}
		if len(lg.Topics) < 3 || lg.Topics[0] != parlayPayoutClaimedTopic0 {
			continue
		}
		out := parlayPayoutClaimedParsed{Found: true}
		copy(out.ParlayID[:], lg.Topics[1].Bytes())
		// Data layout:
		//   [ 0..32)  grossPayout
		//   [32..64)  taxAmount
		//   [64..96)  netPayout  ← we want
		if len(lg.Data) >= 96 {
			out.NetPayout = new(big.Int).SetBytes(lg.Data[64:96])
		}
		return out
	}
	return parlayPayoutClaimedParsed{}
}
