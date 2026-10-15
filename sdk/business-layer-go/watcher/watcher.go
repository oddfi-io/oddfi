package watcher

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/Crypto-Barrett/contracts-business-layer/action"
)

// Config tunes the Watcher.
type Config struct {
	Workers             int
	PollInterval        time.Duration
	RPCTimeout          time.Duration
	Confirmations       int
	StaleHeartbeatAfter time.Duration
	HeartbeatPeriod     time.Duration
	OrphanPendingAfter  time.Duration
}

// Watcher is the in-process pool that progresses chain_actions rows.
type Watcher struct {
	repo            *action.Repo
	eth             EthClient
	workers         int
	pollInterval    time.Duration
	rpcTimeout      time.Duration
	confirmations   int
	staleHeartbeat  time.Duration
	heartbeatPeriod time.Duration
	orphanAfter     time.Duration
	logger          *zap.Logger

	wg     sync.WaitGroup
	cancel context.CancelFunc
	id     string
}

// New constructs (but does not start) a Watcher.
func New(repo *action.Repo, eth EthClient, cfg Config, logger *zap.Logger) *Watcher {
	if cfg.Workers <= 0 {
		cfg.Workers = 4
	}
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = 500 * time.Millisecond
	}
	if cfg.RPCTimeout <= 0 {
		cfg.RPCTimeout = 5 * time.Second
	}
	if cfg.Confirmations <= 0 {
		cfg.Confirmations = 2
	}
	if cfg.StaleHeartbeatAfter <= 0 {
		cfg.StaleHeartbeatAfter = 60 * time.Second
	}
	if cfg.HeartbeatPeriod <= 0 {
		cfg.HeartbeatPeriod = 20 * time.Second
	}
	if cfg.OrphanPendingAfter <= 0 {
		cfg.OrphanPendingAfter = 5 * time.Minute
	}
	if logger == nil {
		logger = zap.NewNop()
	}
	host, _ := os.Hostname()
	return &Watcher{
		repo:            repo,
		eth:             eth,
		workers:         cfg.Workers,
		pollInterval:    cfg.PollInterval,
		rpcTimeout:      cfg.RPCTimeout,
		confirmations:   cfg.Confirmations,
		staleHeartbeat:  cfg.StaleHeartbeatAfter,
		heartbeatPeriod: cfg.HeartbeatPeriod,
		orphanAfter:     cfg.OrphanPendingAfter,
		logger:          logger,
		id:              fmt.Sprintf("%s/%d", host, os.Getpid()),
	}
}

// Start launches the worker pool + orphan sweeper. Returns immediately.
// Call Stop() to shut down (or cancel the supplied ctx).
func (w *Watcher) Start(parent context.Context) {
	ctx, cancel := context.WithCancel(parent)
	w.cancel = cancel
	for i := 0; i < w.workers; i++ {
		workerID := fmt.Sprintf("%s/w%d", w.id, i)
		w.wg.Add(1)
		go func() {
			defer w.wg.Done()
			w.workerLoop(ctx, workerID)
		}()
	}
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.orphanSweepLoop(ctx)
	}()
}

// Stop cancels and waits for all goroutines.
func (w *Watcher) Stop() {
	if w.cancel != nil {
		w.cancel()
	}
	w.wg.Wait()
}

func (w *Watcher) workerLoop(ctx context.Context, workerID string) {
	t := time.NewTicker(w.pollInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		w.tickOnce(ctx, workerID)
	}
}

func (w *Watcher) tickOnce(ctx context.Context, workerID string) {
	row, err := w.repo.ClaimSubmittedRow(ctx, workerID, w.staleHeartbeat)
	if err != nil {
		w.logger.Warn("watcher: claim failed", zap.Error(err))
		return
	}
	if row == nil {
		return
	}
	w.track(ctx, row.ID, workerID, row.TxHash.String, row.Op)
}

func (w *Watcher) orphanSweepLoop(ctx context.Context) {
	period := w.orphanAfter / 2
	if period < 30*time.Second {
		period = 30 * time.Second
	}
	t := time.NewTicker(period)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		n, err := w.repo.SweepOrphanPending(ctx, w.orphanAfter)
		if err != nil {
			w.logger.Warn("watcher: orphan sweep failed", zap.Error(err))
			continue
		}
		if n > 0 {
			w.logger.Info("watcher: swept orphan pending rows", zap.Int64("rows", n))
		}
	}
}
