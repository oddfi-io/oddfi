// Package oddtoken contains ODD token business concepts.
package oddtoken

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// Snapshot is the read model for user-facing ODD token status.
type Snapshot struct {
	Address     common.Address
	Name        string
	Symbol      string
	Decimals    uint8
	TotalSupply *big.Int
	Paused      bool
}

// Copy returns a defensive copy of Snapshot.
func (s Snapshot) Copy() Snapshot {
	out := s
	if s.TotalSupply != nil {
		out.TotalSupply = new(big.Int).Set(s.TotalSupply)
	}
	return out
}
