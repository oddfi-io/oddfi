// Package nonce serializes nonce assignment for a single admin EOA across
// multiple pods using a row-lock on signer_lease + eth_getTransactionCount on
// the chain. There is no counter to drift from — the chain is the source of
// truth.
package nonce

import (
	"context"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// EthClient is the narrow surface nonce.Lease needs from the RPC. The full
// *ethclient.Client satisfies it.
type EthClient interface {
	PendingNonceAt(ctx context.Context, addr common.Address) (uint64, error)
}

// Lease is the lock-and-query gate for nonce assignment. Construct one per
// signer address.
type Lease struct {
	db   *gorm.DB
	eth  EthClient
	addr common.Address
}

// New constructs a Lease.
func New(db *gorm.DB, eth EthClient, addr common.Address) *Lease {
	return &Lease{db: db, eth: eth, addr: addr}
}

// EnsureRow makes sure the signer_lease row exists. Call once at startup.
func (l *Lease) EnsureRow(ctx context.Context) error {
	now := time.Now().UTC()
	if err := l.db.WithContext(ctx).Exec(`
		INSERT IGNORE INTO signer_lease (signer_address, updated_at) VALUES (?, ?)
	`, l.addr.Hex(), now).Error; err != nil {
		return &coretypes.ErrDB{Op: "EnsureSignerLeaseRow", Cause: err}
	}
	return nil
}

// WithLockedNonce runs fn inside a single DB transaction that holds an
// exclusive row lock on signer_lease for this address. fn receives the next
// nonce (queried fresh from the chain inside the lock) and a *gorm.DB scoped
// to the transaction so additional updates atomically commit/rollback with the
// lock release.
//
// The lock is held for the full duration of fn (typically the broadcast RPC
// call). Throughput is therefore ~ 1 / (PendingNonceAt + broadcast latency).
func (l *Lease) WithLockedNonce(ctx context.Context, fn func(tx *gorm.DB, nonce uint64) error) error {
	return l.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Acquire the row lock. SKIP LOCKED would defeat the purpose — we MUST serialize.
		if err := tx.Exec(`
			SELECT 1 FROM signer_lease WHERE signer_address = ? FOR UPDATE
		`, l.addr.Hex()).Error; err != nil {
			return &coretypes.ErrDB{Op: "AcquireSignerLease", Cause: err}
		}

		// 2. Ask the chain for the next pending nonce.
		nonce, err := l.eth.PendingNonceAt(ctx, l.addr)
		if err != nil {
			return &coretypes.ErrRPC{Op: "PendingNonceAt", Cause: err}
		}

		// 3. Caller broadcasts and updates rows still inside this tx.
		if err := fn(tx, nonce); err != nil {
			return err
		}

		// 4. Refresh the lease's updated_at as a heartbeat.
		now := time.Now().UTC()
		if err := tx.Exec(`
			UPDATE signer_lease SET updated_at = ? WHERE signer_address = ?
		`, now, l.addr.Hex()).Error; err != nil {
			return &coretypes.ErrDB{Op: "TouchSignerLease", Cause: err}
		}
		return nil
	})
}
