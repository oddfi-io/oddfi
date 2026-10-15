// Package watcher tracks chain_actions rows from 'submitted' to 'confirmed'.
package watcher

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// EthClient is the narrow surface the Watcher needs. *ethclient.Client
// satisfies it.
type EthClient interface {
	TransactionReceipt(ctx context.Context, hash common.Hash) (*types.Receipt, error)
	BlockNumber(ctx context.Context) (uint64, error)
	HeaderByNumber(ctx context.Context, n *big.Int) (*types.Header, error)
}
