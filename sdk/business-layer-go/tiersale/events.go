// events.go — receipt log parsers for TierSale events. Used by *WithReceipt
// variants to populate result fields without an extra RPC round-trip (the
// receipt is already in hand from waitReceipt).

package tiersale

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// PurchaseRecorded event signature (TierSale.sol):
//
//	PurchaseRecorded(
//	    uint256 indexed purchaseId,
//	    address indexed user,
//	    uint256 oddAmount,
//	    uint256 usdtPaid,
//	    uint256 totalSoldAfter
//	)
//
// 2 indexed → topics[1..2]; 3 non-indexed packed as data (3×32 bytes = 96 B).
var purchaseRecordedTopic0 = crypto.Keccak256Hash([]byte(
	"PurchaseRecorded(uint256,address,uint256,uint256,uint256)",
))

type purchaseRecordedParsed struct {
	Found      bool
	PurchaseID *big.Int
	OddAmount  *big.Int
	UsdtPaid   *big.Int
}

// parsePurchaseRecorded scans receipt.Logs for the first PurchaseRecorded event
// emitted by the TierSale contract and decodes the fields needed by BuyResult.
func parsePurchaseRecorded(receipt *types.Receipt, tierSaleAddr common.Address) purchaseRecordedParsed {
	for _, lg := range receipt.Logs {
		if lg.Address != tierSaleAddr {
			continue
		}
		if len(lg.Topics) < 3 || lg.Topics[0] != purchaseRecordedTopic0 {
			continue
		}
		out := purchaseRecordedParsed{Found: true}
		out.PurchaseID = new(big.Int).SetBytes(lg.Topics[1].Bytes())
		// Data layout:
		//   [ 0..32)  oddAmount      ← we want
		//   [32..64)  usdtPaid       ← we want
		//   [64..96)  totalSoldAfter
		if len(lg.Data) >= 64 {
			out.OddAmount = new(big.Int).SetBytes(lg.Data[0:32])
			out.UsdtPaid = new(big.Int).SetBytes(lg.Data[32:64])
		}
		return out
	}
	return purchaseRecordedParsed{}
}

// PurchaseRefunded event signature (TierSale.sol):
//
//	PurchaseRefunded(
//	    uint256 indexed purchaseId,
//	    address indexed user,
//	    uint256 oddAmount,
//	    uint256 usdtAmount,
//	    uint256 refundedOdd
//	)
//
// 2 indexed → topics[1..2]; 3 non-indexed packed as data (3×32 bytes = 96 B).
var purchaseRefundedTopic0 = crypto.Keccak256Hash([]byte(
	"PurchaseRefunded(uint256,address,uint256,uint256,uint256)",
))

type purchaseRefundedParsed struct {
	Found       bool
	PurchaseID  *big.Int
	OddAmount   *big.Int
	UsdtAmount  *big.Int
	RefundedOdd *big.Int
}

// parsePurchaseRefunded scans receipt.Logs for the first PurchaseRefunded event
// emitted by the TierSale contract and decodes the fields needed by RefundResult.
func parsePurchaseRefunded(receipt *types.Receipt, tierSaleAddr common.Address) purchaseRefundedParsed {
	for _, lg := range receipt.Logs {
		if lg.Address != tierSaleAddr {
			continue
		}
		if len(lg.Topics) < 3 || lg.Topics[0] != purchaseRefundedTopic0 {
			continue
		}
		out := purchaseRefundedParsed{Found: true}
		out.PurchaseID = new(big.Int).SetBytes(lg.Topics[1].Bytes())
		// Data layout:
		//   [ 0..32)  oddAmount    ← we want
		//   [32..64)  usdtAmount   ← we want
		//   [64..96)  refundedOdd  ← we want
		if len(lg.Data) >= 96 {
			out.OddAmount = new(big.Int).SetBytes(lg.Data[0:32])
			out.UsdtAmount = new(big.Int).SetBytes(lg.Data[32:64])
			out.RefundedOdd = new(big.Int).SetBytes(lg.Data[64:96])
		}
		return out
	}
	return purchaseRefundedParsed{}
}
