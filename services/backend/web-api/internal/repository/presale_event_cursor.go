package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrCursorNotFound = errors.New("presale event cursor not found")

// PresaleEventCursorRepository 监听器游标数据访问接口
type PresaleEventCursorRepository interface {
	// Load 取指定金库地址的游标，Worker 启动时调用
	Load(ctx context.Context, vaultAddress string) (*model.PresaleEventCursor, error)

	// Save 单事务提交游标推进：确保游标和 deposit 原子推进，避免漏块或重放
	// tx 参数是外部事务，cursor 和 deposit 在同一事务内 commit
	Save(ctx context.Context, tx *gorm.DB, vaultAddress string, blockNumber uint64, logIndex uint) error

	// EnsureAll 启动时为 env PRESALE_VAULT_POOL 里的每个地址 INSERT IGNORE 初始游标（幂等）
	// 重复调用不报错，已有游标不覆盖。
	// initBlockNumber：新建 cursor 时用作 last_block_number 初始值（传 0 表示从头扫，
	// 生产场景应传当前 BSC head block 避免新加 vault 时从高度 0 回扫整链）。
	EnsureAll(ctx context.Context, vaultAddresses []string, initBlockNumber uint64) error
}

type presaleEventCursorRepo struct {
	db *gorm.DB
}

func NewPresaleEventCursorRepo(db *gorm.DB) PresaleEventCursorRepository {
	return &presaleEventCursorRepo{db: db}
}

func (r *presaleEventCursorRepo) Load(ctx context.Context, vaultAddress string) (*model.PresaleEventCursor, error) {
	var cursor model.PresaleEventCursor
	if err := r.db.WithContext(ctx).Where("vault_address = ?", vaultAddress).First(&cursor).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCursorNotFound
		}
		return nil, fmt.Errorf("[PresaleEventCursorRepo] load cursor for vault %s: %w", vaultAddress, err)
	}
	return &cursor, nil
}

func (r *presaleEventCursorRepo) Save(ctx context.Context, tx *gorm.DB, vaultAddress string, blockNumber uint64, logIndex uint) error {
	db := tx
	if db == nil {
		db = r.db
	}
	nowMs := time.Now().UnixMilli()
	result := db.WithContext(ctx).
		Model(&model.PresaleEventCursor{}).
		Where("vault_address = ?", vaultAddress).
		Updates(map[string]interface{}{
			"last_block_number": blockNumber,
			"last_log_index":    logIndex,
			"updated_at":        nowMs,
		})
	if result.Error != nil {
		return fmt.Errorf("[PresaleEventCursorRepo] save cursor for vault %s block %d: %w", vaultAddress, blockNumber, result.Error)
	}
	return nil
}

func (r *presaleEventCursorRepo) EnsureAll(ctx context.Context, vaultAddresses []string, initBlockNumber uint64) error {
	if len(vaultAddresses) == 0 {
		return nil
	}
	nowMs := time.Now().UnixMilli()
	cursors := make([]model.PresaleEventCursor, 0, len(vaultAddresses))
	for _, addr := range vaultAddresses {
		cursors = append(cursors, model.PresaleEventCursor{
			VaultAddress:    addr,
			LastBlockNumber: initBlockNumber,
			LastLogIndex:    0,
			UpdatedAt:       nowMs,
		})
	}
	// DoNothing：已存在的游标地址跳过，不覆盖已有进度
	if err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&cursors).Error; err != nil {
		return fmt.Errorf("[PresaleEventCursorRepo] ensure all cursors: %w", err)
	}
	return nil
}
