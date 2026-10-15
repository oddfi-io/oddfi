package watcher

import (
	"context"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"go.uber.org/zap"
)

// track owns the lifecycle of a single claimed row from 'submitted' onwards.
func (w *Watcher) track(ctx context.Context, id int64, workerID, txHash, op string) {
	hbCtx, hbCancel := context.WithCancel(ctx)
	defer hbCancel()
	go w.heartbeatLoop(hbCtx, id, workerID)

	hash := common.HexToHash(txHash)

	receipt, err := w.waitReceipt(ctx, hash)
	if err != nil {
		w.logger.Warn("watcher: waitReceipt failed", zap.Error(err), zap.Int64("id", id))
		return
	}

	if receipt.Status == 0 {
		err := w.repo.MarkFailed(ctx, id, "revert", errors.New("on-chain revert (receipt.Status=0)"))
		if err != nil {
			w.logger.Warn("watcher: MarkFailed", zap.Error(err))
		}
		return
	}

	gasPrice := "0"
	if receipt.EffectiveGasPrice != nil {
		gasPrice = receipt.EffectiveGasPrice.String()
	}
	if err := w.repo.MarkMined(ctx, id, receipt.BlockNumber.Uint64(), receipt.BlockHash.Hex(), receipt.GasUsed, gasPrice); err != nil {
		w.logger.Warn("watcher: MarkMined", zap.Error(err))
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(w.pollInterval):
		}
		head, err := w.blockNumber(ctx)
		if err != nil {
			continue
		}
		if head < receipt.BlockNumber.Uint64()+uint64(w.confirmations) {
			continue
		}
		hdrCtx, cancel := context.WithTimeout(ctx, w.rpcTimeout)
		hdr, err := w.eth.HeaderByNumber(hdrCtx, big.NewInt(int64(receipt.BlockNumber.Uint64())))
		cancel()
		if err != nil {
			w.logger.Debug("watcher: reorg check failed", zap.Error(err))
			continue
		}
		if hdr.Hash() != receipt.BlockHash {
			w.logger.Warn("watcher: reorg detected", zap.Int64("id", id), zap.Uint64("block", receipt.BlockNumber.Uint64()))
			if err := w.repo.MarkResubmittedAfterReorg(ctx, id); err != nil {
				w.logger.Warn("watcher: MarkResubmittedAfterReorg", zap.Error(err))
			}
			return
		}
		if err := w.repo.MarkConfirmed(ctx, id); err != nil {
			w.logger.Warn("watcher: MarkConfirmed", zap.Error(err))
		}
		return
	}
}

func (w *Watcher) waitReceipt(ctx context.Context, hash common.Hash) (*recHolder, error) {
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		rctx, cancel := context.WithTimeout(ctx, w.rpcTimeout)
		r, err := w.eth.TransactionReceipt(rctx, hash)
		cancel()
		if err == nil {
			return &recHolder{
				Status:            r.Status,
				BlockNumber:       r.BlockNumber,
				BlockHash:         r.BlockHash,
				GasUsed:           r.GasUsed,
				EffectiveGasPrice: r.EffectiveGasPrice,
			}, nil
		}
		if !isNotFound(err) {
			w.logger.Debug("watcher: TransactionReceipt error", zap.Error(err))
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(w.pollInterval):
		}
	}
}

// recHolder is a receipt projection limited to fields the Watcher uses.
type recHolder struct {
	Status            uint64
	BlockNumber       *big.Int
	BlockHash         common.Hash
	GasUsed           uint64
	EffectiveGasPrice *big.Int
}

func (w *Watcher) blockNumber(ctx context.Context) (uint64, error) {
	bctx, cancel := context.WithTimeout(ctx, w.rpcTimeout)
	defer cancel()
	return w.eth.BlockNumber(bctx)
}

func isNotFound(err error) bool {
	if errors.Is(err, ethereum.NotFound) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "not found")
}

func (w *Watcher) heartbeatLoop(ctx context.Context, id int64, workerID string) {
	t := time.NewTicker(w.heartbeatPeriod)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		if err := w.repo.Heartbeat(ctx, id, workerID); err != nil {
			w.logger.Debug("watcher: heartbeat", zap.Error(err))
		}
	}
}
