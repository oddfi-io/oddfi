// Package repository — presale_deposit admin 专用方法（DD-003 v3.1 B5）。
package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
)

// PresaleDepositFilter admin 列表查询条件。
type PresaleDepositFilter struct {
	RoundID      string
	EoaAddress   string
	Status       string
	VaultAddress string
	FromTs       int64
	ToTs         int64
	Page         int
	Size         int
}

// AdminPresaleDepositRepository admin 专用入账操作接口。
type AdminPresaleDepositRepository interface {
	// AdminGetByTxHash 按 txHash 查询单笔（不限 user_id，admin 专用）
	AdminGetByTxHash(ctx context.Context, txHash string) (*model.PresaleDeposit, error)

	// AdminGetByTxHashTx 在已有事务内按 txHash 查询（before 快照用）
	AdminGetByTxHashTx(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error)

	// AdminGetForUpdate 在事务内加行锁读取 deposit（migrate-round 防并发）
	AdminGetForUpdate(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error)

	// AdminList 分页查询（admin filter，支持多条件）
	AdminList(ctx context.Context, f PresaleDepositFilter) ([]*model.PresaleDeposit, int64, error)

	// UpdateMigrateFields 更新 migrate-round 后的 deposit 字段（tx 内）
	UpdateMigrateFields(tx *gorm.DB, depositID uint64, fields map[string]any) error
}

type adminPresaleDepositRepo struct {
	db *gorm.DB
}

// NewAdminPresaleDepositRepo 构造 admin 专用 deposit repo。
func NewAdminPresaleDepositRepo(db *gorm.DB) AdminPresaleDepositRepository {
	return &adminPresaleDepositRepo{db: db}
}

func (r *adminPresaleDepositRepo) AdminGetByTxHash(ctx context.Context, txHash string) (*model.PresaleDeposit, error) {
	var dep model.PresaleDeposit
	if err := r.db.WithContext(ctx).Where("tx_hash = ?", txHash).First(&dep).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDepositNotFound
		}
		return nil, fmt.Errorf("[AdminPresaleDepositRepo] get by tx_hash %s: %w", txHash, err)
	}
	return &dep, nil
}

func (r *adminPresaleDepositRepo) AdminGetByTxHashTx(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error) {
	var dep model.PresaleDeposit
	if err := tx.Where("tx_hash = ?", txHash).First(&dep).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDepositNotFound
		}
		return nil, fmt.Errorf("[AdminPresaleDepositRepo] get by tx_hash tx %s: %w", txHash, err)
	}
	return &dep, nil
}

func (r *adminPresaleDepositRepo) AdminGetForUpdate(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error) {
	var dep model.PresaleDeposit
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("tx_hash = ?", txHash).First(&dep).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDepositNotFound
		}
		return nil, fmt.Errorf("[AdminPresaleDepositRepo] get for update %s: %w", txHash, err)
	}
	return &dep, nil
}

func (r *adminPresaleDepositRepo) AdminList(ctx context.Context, f PresaleDepositFilter) ([]*model.PresaleDeposit, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.PresaleDeposit{})

	if f.RoundID != "" {
		q = q.Where("round_id = ?", f.RoundID)
	}
	if f.EoaAddress != "" {
		q = q.Where("eoa_address = ?", f.EoaAddress)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.VaultAddress != "" {
		q = q.Where("vault_address = ?", f.VaultAddress)
	}
	if f.FromTs > 0 {
		q = q.Where("block_timestamp >= ?", f.FromTs)
	}
	if f.ToTs > 0 {
		q = q.Where("block_timestamp < ?", f.ToTs)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("[AdminPresaleDepositRepo] count: %w", err)
	}

	page := f.Page
	if page <= 0 {
		page = 1
	}
	size := f.Size
	if size <= 0 || size > 100 {
		size = 20
	}
	offset := (page - 1) * size

	var items []*model.PresaleDeposit
	if err := q.Order("block_timestamp DESC").Offset(offset).Limit(size).Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("[AdminPresaleDepositRepo] list: %w", err)
	}
	return items, total, nil
}

func (r *adminPresaleDepositRepo) UpdateMigrateFields(tx *gorm.DB, depositID uint64, fields map[string]any) error {
	fields["updated_at"] = time.Now().UnixMilli()
	result := tx.Model(&model.PresaleDeposit{}).Where("id = ?", depositID).Updates(fields)
	if result.Error != nil {
		return fmt.Errorf("[AdminPresaleDepositRepo] update migrate fields deposit=%d: %w", depositID, result.Error)
	}
	return nil
}
