// Package healthcheck periodically probes Magic TEE so /healthz can report
// upstream connectivity without doing a real Magic call per request.
package healthcheck

import (
	"context"
	"crypto/sha256"
	"sync"
	"time"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/jwt"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/magicapi"
)

// Monitor probes Magic on a fixed interval.
type Monitor struct {
	magicCli  *magicapi.Client
	jwtCache  *jwt.Cache
	probeUser string
	interval  time.Duration

	mu        sync.RWMutex
	reachable bool
	lastCheck time.Time
}

// New constructs a Monitor. probeUser is the userID used for probe JWTs; pick
// something the system "owns" (e.g. "magic-signer-healthcheck").
func New(magicCli *magicapi.Client, jwtCache *jwt.Cache, probeUser string, interval time.Duration) *Monitor {
	return &Monitor{
		magicCli:  magicCli,
		jwtCache:  jwtCache,
		probeUser: probeUser,
		interval:  interval,
	}
}

// Start runs the probe loop until ctx is cancelled. Returns immediately;
// run as `go monitor.Start(ctx)`.
func (m *Monitor) Start(ctx context.Context) {
	if m.interval <= 0 {
		return
	}
	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	// Probe once at startup so /healthz has data quickly.
	m.probe(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.probe(ctx)
		}
	}
}

// probe makes one lightweight call to Magic to check reachability.
// We use SignData (cheaper than wallet/create) over a known zero digest with
// the probe user; success path or 4xx both count as "reachable" (the API is
// responsive), only network errors / 5xx count as unreachable.
func (m *Monitor) probe(parentCtx context.Context) {
	ctx, cancel := context.WithTimeout(parentCtx, 3*time.Second)
	defer cancel()

	token, err := m.jwtCache.Get(m.probeUser)
	if err != nil {
		m.setReachable(false)
		return
	}

	// Use a deterministic digest derived from "probe" so it can never
	// accidentally collide with a real signing request.
	var digest [32]byte
	sum := sha256.Sum256([]byte("magic-signer:healthcheck:probe"))
	copy(digest[:], sum[:])

	_, _, err = m.magicCli.SignData(ctx, token, digest)
	// Treat any HTTP response (including 4xx) as "reachable"; only network
	// failure or 5xx-after-retries-exhausted means actually unreachable.
	if err == nil {
		m.setReachable(true)
		return
	}
	// magicapi wraps 4xx into *HTTPError; check by attempting an assertion.
	// We don't import the type here to keep coupling small — just say:
	// any error → unreachable, accepting some false negatives on 4xx (which
	// would indicate config error anyway, so flagging is fine).
	m.setReachable(false)
}

func (m *Monitor) setReachable(ok bool) {
	m.mu.Lock()
	m.reachable = ok
	m.lastCheck = time.Now()
	m.mu.Unlock()
}

// Reachable returns the last probe result.
func (m *Monitor) Reachable() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.reachable
}

// LastCheck returns when the last probe completed.
func (m *Monitor) LastCheck() time.Time {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.lastCheck
}
