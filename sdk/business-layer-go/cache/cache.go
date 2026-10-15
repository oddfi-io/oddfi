// Package cache is the read-layer cache abstraction. Phase 6 MVP ships an
// in-process sync.Map implementation; a Redis-backed implementation and the
// HTTP-poll event invalidator are scheduled for follow-up work (see findings.md §6).
//
// Usage:
//
//	c := cache.NewInProcess()
//	readCli, _ := read.New(eth, sdk, actionsRepo, read.Config{Cache: c})
package cache

import (
	"context"
	"errors"
	"sync"
	"time"
)

// Client is the minimal surface needed by the read package.
type Client interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, value []byte, ttlSeconds int) error
	Del(ctx context.Context, keys ...string) error
}

// ─── InProcess implementation (sync.Map + per-key expiry) ────────────────

type inProcess struct {
	m sync.Map // key string → entry
}

type entry struct {
	value     []byte
	expiresAt time.Time // zero = no expiry
}

// NewInProcess returns a Client backed by an in-memory sync.Map.
// Suitable for single-pod deployments and tests; not suitable across processes.
func NewInProcess() Client { return &inProcess{} }

func (p *inProcess) Get(ctx context.Context, key string) ([]byte, bool, error) {
	if ctx == nil {
		return nil, false, errors.New("cache: nil ctx")
	}
	v, ok := p.m.Load(key)
	if !ok {
		return nil, false, nil
	}
	e := v.(entry)
	if !e.expiresAt.IsZero() && time.Now().After(e.expiresAt) {
		p.m.Delete(key)
		return nil, false, nil
	}
	return e.value, true, nil
}

func (p *inProcess) Set(ctx context.Context, key string, value []byte, ttlSeconds int) error {
	if ctx == nil {
		return errors.New("cache: nil ctx")
	}
	e := entry{value: append([]byte(nil), value...)}
	if ttlSeconds > 0 {
		e.expiresAt = time.Now().Add(time.Duration(ttlSeconds) * time.Second)
	}
	p.m.Store(key, e)
	return nil
}

func (p *inProcess) Del(ctx context.Context, keys ...string) error {
	if ctx == nil {
		return errors.New("cache: nil ctx")
	}
	for _, k := range keys {
		p.m.Delete(k)
	}
	return nil
}

// ─── Redis impl (placeholder) ────────────────────────────────────────────
//
// TODO Phase 6 follow-up: implement with go-redis/v9.
//   - same Client interface
//   - JSON-encode complex values
//   - support pipelined MGet/MSet for batch reads
//
// TODO Phase 6 follow-up: HTTP-poll event invalidator
//   - new file cache/invalidator.go
//   - reuse watcher/ ticker + worker pattern
//   - eth.FilterLogs(FromBlock=cursor, Topics=[...]) → map → Client.Del(keys...)
//   - cursor stored in MySQL `cache_invalidator_cursor` table
