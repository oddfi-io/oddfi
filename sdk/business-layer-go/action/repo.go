package action

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// Repo persists chain_actions rows.
type Repo struct {
	db *gorm.DB
}

// New constructs a Repo bound to db.
func New(db *gorm.DB) *Repo { return &Repo{db: db} }

// InsertOrLoad attempts to INSERT row. On duplicate idempotency_key it returns
// the existing row's ID and existed=true.
func (r *Repo) InsertOrLoad(ctx context.Context, row *Row) (id int64, existed bool, err error) {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return 0, false, &coretypes.ErrDB{Op: "Begin", Cause: tx.Error}
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	now := time.Now().UTC()
	if row.CreatedAt.IsZero() {
		row.CreatedAt = now
	}
	row.UpdatedAt = now

	res := tx.Exec(`
		INSERT IGNORE INTO chain_actions
		  (idempotency_key, op, args_json, status, attempts, signer_address, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, ?, ?)
	`, row.IdempotencyKey, row.Op, row.ArgsJSON, row.Status, row.SignerAddress, row.CreatedAt, row.UpdatedAt)
	if res.Error != nil {
		return 0, false, &coretypes.ErrDB{Op: "InsertIgnore", Cause: res.Error}
	}

	if res.RowsAffected == 0 {
		var existing Row
		if e := tx.Where("idempotency_key = ?", row.IdempotencyKey).First(&existing).Error; e != nil {
			return 0, false, &coretypes.ErrDB{Op: "SelectExisting", Cause: e}
		}
		if e := tx.Commit().Error; e != nil {
			return 0, false, &coretypes.ErrDB{Op: "Commit", Cause: e}
		}
		return existing.ID, true, nil
	}

	var inserted Row
	if e := tx.Where("idempotency_key = ?", row.IdempotencyKey).First(&inserted).Error; e != nil {
		return 0, false, &coretypes.ErrDB{Op: "SelectInserted", Cause: e}
	}
	if e := tx.Commit().Error; e != nil {
		return 0, false, &coretypes.ErrDB{Op: "Commit", Cause: e}
	}
	return inserted.ID, false, nil
}

// Get fetches a row by ID.
func (r *Repo) Get(ctx context.Context, id int64) (*Row, error) {
	var row Row
	err := r.db.WithContext(ctx).First(&row, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, coretypes.ErrActionNotFound
	}
	if err != nil {
		return nil, &coretypes.ErrDB{Op: "Get", Cause: err}
	}
	return &row, nil
}

// GetByIdempotencyKey fetches a row by its idempotency_key.
func (r *Repo) GetByIdempotencyKey(ctx context.Context, key string) (*Row, error) {
	var row Row
	err := r.db.WithContext(ctx).Where("idempotency_key = ?", key).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, coretypes.ErrActionNotFound
	}
	if err != nil {
		return nil, &coretypes.ErrDB{Op: "GetByIdempotencyKey", Cause: err}
	}
	return &row, nil
}

// InsertMirroredSubmitted inserts (or returns existing) a chain_actions row
// already in 'submitted' status with tx_hash populated. Used by multisigpoll
// to mirror an executed Safe tx into chain_actions so the standard Watcher
// can confirm it. Idempotent on idempotency_key.
func (r *Repo) InsertMirroredSubmitted(ctx context.Context, row *Row, txHash string) (id int64, existed bool, err error) {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return 0, false, &coretypes.ErrDB{Op: "Begin", Cause: tx.Error}
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()
	now := time.Now().UTC()
	res := tx.Exec(`
		INSERT IGNORE INTO chain_actions
		  (idempotency_key, op, args_json, status, attempts, tx_hash, signer_address,
		   submitted_at, created_at, updated_at)
		VALUES (?, ?, ?, 'submitted', 0, ?, ?, ?, ?, ?)
	`, row.IdempotencyKey, row.Op, row.ArgsJSON, txHash, row.SignerAddress, now, now, now)
	if res.Error != nil {
		return 0, false, &coretypes.ErrDB{Op: "InsertMirroredSubmitted", Cause: res.Error}
	}
	if res.RowsAffected == 0 {
		var existing Row
		if e := tx.Where("idempotency_key = ?", row.IdempotencyKey).First(&existing).Error; e != nil {
			return 0, false, &coretypes.ErrDB{Op: "SelectExistingMirror", Cause: e}
		}
		if e := tx.Commit().Error; e != nil {
			return 0, false, &coretypes.ErrDB{Op: "Commit", Cause: e}
		}
		return existing.ID, true, nil
	}
	var inserted Row
	if e := tx.Where("idempotency_key = ?", row.IdempotencyKey).First(&inserted).Error; e != nil {
		return 0, false, &coretypes.ErrDB{Op: "SelectInsertedMirror", Cause: e}
	}
	if e := tx.Commit().Error; e != nil {
		return 0, false, &coretypes.ErrDB{Op: "Commit", Cause: e}
	}
	return inserted.ID, false, nil
}

// MarkSubmitted is a context-flavored variant of MarkSubmittedTx for callers
// that don't run inside a signer_lease transaction (e.g. relay package).
func (r *Repo) MarkSubmitted(ctx context.Context, id int64, txHash string, nonce uint64) error {
	now := time.Now().UTC()
	res := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'submitted',
		       tx_hash = ?,
		       nonce = ?,
		       submitted_at = ?,
		       updated_at = ?,
		       attempts = attempts + 1
		 WHERE id = ?
	`, txHash, nonce, now, now, id)
	if res.Error != nil {
		return &coretypes.ErrDB{Op: "MarkSubmitted", Cause: res.Error}
	}
	return nil
}

// MarkSubmittedTx updates a row from pending → submitted with tx info. Must be
// called inside the same DB tx that holds the signer_lease lock.
func (r *Repo) MarkSubmittedTx(tx *gorm.DB, id int64, txHash string, nonce uint64) error {
	now := time.Now().UTC()
	res := tx.Exec(`
		UPDATE chain_actions
		   SET status = 'submitted',
		       tx_hash = ?,
		       nonce = ?,
		       submitted_at = ?,
		       updated_at = ?,
		       attempts = attempts + 1
		 WHERE id = ?
	`, txHash, nonce, now, now, id)
	if res.Error != nil {
		return &coretypes.ErrDB{Op: "MarkSubmittedTx", Cause: res.Error}
	}
	return nil
}

// MarkFailed transitions a row to failed status with a reason.
func (r *Repo) MarkFailed(ctx context.Context, id int64, kind string, cause error) error {
	now := time.Now().UTC()
	msg := ""
	if cause != nil {
		msg = cause.Error()
	}
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'failed',
		       last_error = ?,
		       last_error_kind = ?,
		       failed_at = ?,
		       updated_at = ?
		 WHERE id = ?
	`, msg, kind, now, now, id).Error; err != nil {
		return &coretypes.ErrDB{Op: "MarkFailed", Cause: err}
	}
	return nil
}

// ClaimSubmittedRow runs SELECT FOR UPDATE SKIP LOCKED to atomically claim a
// row in 'submitted' status that no worker is actively processing. Returns
// (nil, nil) when no row is available.
func (r *Repo) ClaimSubmittedRow(ctx context.Context, workerID string, staleHeartbeatAfter time.Duration) (*Row, error) {
	var claimed *Row
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		type idHolder struct{ ID int64 }
		var idResult idHolder
		err := tx.Raw(`
			SELECT id FROM chain_actions
			 WHERE status = 'submitted'
			   AND (assigned_to IS NULL OR heartbeat_at < ?)
			 ORDER BY updated_at
			 LIMIT 1
			 FOR UPDATE SKIP LOCKED
		`, time.Now().UTC().Add(-staleHeartbeatAfter)).Scan(&idResult).Error
		if err != nil {
			return err
		}
		if idResult.ID == 0 {
			return nil
		}
		now := time.Now().UTC()
		if err := tx.Exec(`
			UPDATE chain_actions
			   SET assigned_to = ?, heartbeat_at = ?, updated_at = ?
			 WHERE id = ?
		`, workerID, now, now, idResult.ID).Error; err != nil {
			return err
		}
		var row Row
		if err := tx.First(&row, idResult.ID).Error; err != nil {
			return err
		}
		claimed = &row
		return nil
	})
	if err != nil {
		return nil, &coretypes.ErrDB{Op: "ClaimSubmittedRow", Cause: err}
	}
	return claimed, nil
}

// Heartbeat refreshes assigned_to/heartbeat_at if the row is still ours.
func (r *Repo) Heartbeat(ctx context.Context, id int64, workerID string) error {
	now := time.Now().UTC()
	res := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET heartbeat_at = ?, updated_at = ?
		 WHERE id = ? AND assigned_to = ?
	`, now, now, id, workerID)
	if res.Error != nil {
		return &coretypes.ErrDB{Op: "Heartbeat", Cause: res.Error}
	}
	return nil
}

// MarkMined moves submitted → mined.
func (r *Repo) MarkMined(ctx context.Context, id int64, blockNumber uint64, blockHash string, gasUsed uint64, effectiveGasPriceWei string) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'mined',
		       block_number = ?,
		       block_hash = ?,
		       gas_used = ?,
		       effective_gas_price = ?,
		       mined_at = ?,
		       updated_at = ?
		 WHERE id = ?
	`, blockNumber, blockHash, gasUsed, effectiveGasPriceWei, now, now, id).Error; err != nil {
		return &coretypes.ErrDB{Op: "MarkMined", Cause: err}
	}
	return nil
}

// MarkConfirmed moves mined → confirmed.
func (r *Repo) MarkConfirmed(ctx context.Context, id int64) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'confirmed',
		       confirmed_at = ?,
		       updated_at = ?
		 WHERE id = ?
	`, now, now, id).Error; err != nil {
		return &coretypes.ErrDB{Op: "MarkConfirmed", Cause: err}
	}
	return nil
}

// MarkResubmittedAfterReorg pushes a row from mined back to submitted (re-track).
func (r *Repo) MarkResubmittedAfterReorg(ctx context.Context, id int64) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'submitted',
		       block_number = NULL,
		       block_hash = NULL,
		       mined_at = NULL,
		       updated_at = ?
		 WHERE id = ?
	`, now, id).Error; err != nil {
		return &coretypes.ErrDB{Op: "MarkResubmittedAfterReorg", Cause: err}
	}
	return nil
}

// SweepOrphanPending marks pending rows older than threshold as failed.
func (r *Repo) SweepOrphanPending(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	res := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'failed',
		       last_error = 'orphan_pending_swept',
		       last_error_kind = 'interrupted',
		       failed_at = ?,
		       updated_at = ?
		 WHERE status = 'pending' AND created_at < ?
	`, time.Now().UTC(), time.Now().UTC(), cutoff)
	if res.Error != nil {
		return 0, &coretypes.ErrDB{Op: "SweepOrphanPending", Cause: res.Error}
	}
	return res.RowsAffected, nil
}

// CountPending returns the number of pending+submitted rows (queue depth) and
// the timestamp of the oldest one.
func (r *Repo) CountPending(ctx context.Context) (int, *time.Time, error) {
	var n int
	if err := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM chain_actions WHERE status IN ('pending','submitted')
	`).Scan(&n).Error; err != nil {
		return 0, nil, &coretypes.ErrDB{Op: "CountPending", Cause: err}
	}
	if n == 0 {
		return 0, nil, nil
	}
	type ts struct {
		T sql.NullTime
	}
	var oldest ts
	if err := r.db.WithContext(ctx).Raw(`
		SELECT MIN(created_at) AS t FROM chain_actions WHERE status IN ('pending','submitted')
	`).Scan(&oldest).Error; err != nil {
		return n, nil, &coretypes.ErrDB{Op: "OldestPending", Cause: err}
	}
	if oldest.T.Valid {
		return n, &oldest.T.Time, nil
	}
	return n, nil, nil
}
