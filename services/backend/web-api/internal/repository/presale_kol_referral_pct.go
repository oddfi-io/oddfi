// Package repository — presale_kol_referral_pct 表的访问层（REQ-004）。
//
// 写方法成对暴露：
//   - 无 Tx 后缀（Upsert / Update / Delete）走主 db，给非事务上下文（脚本 / 后台任务）用
//   - Tx 后缀（UpsertTx / UpdateTx / DeleteTx）必须传入外部 tx，给 admin handler 与 audit
//     middleware 同事务原子化用 — 避免业务写已提交但 audit 失败 rollback 时审计链断裂
//     （REV-006 MAJ-1：INC-002 同型原子性空洞防退化）
//
// 其他约定：
//   - referrer_eoa 由 caller（handler）保证已 ToLower，repo 不再二次规整
//   - GetByEoa 路径热点（每笔 deposit 都查一次），轻量 SELECT PK
package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"everything_finance/org/web-api/internal/model"
)

// ErrKolNotFound KOL EOA 在白名单中找不到，调用方按"未命中"路径处理。
// deposit 路径用此错误区分"未配置 KOL"和"DB 异常"两种情况：
// 前者降级用 round.referral_reward_pct，后者降级时打告警日志。
var ErrKolNotFound = errors.New("presale kol referral pct not found")

// KolReferralPctRepository KOL 自定义返佣比例的 CRUD 接口。
type KolReferralPctRepository interface {
	// List 分页查询。eoaFilter 非空时按 referrer_eoa 模糊匹配（LIKE %eoa%）。
	// 返回总数用于前端分页控件。caller 须保证 eoaFilter 不含 SQL LIKE 通配符 `%` / `_`。
	List(ctx context.Context, eoaFilter string, page, size int) ([]*model.PresaleKolReferralPct, int64, error)

	// Upsert POST 幂等用：存在则覆盖 referral_pct + note + created_by + updated_at，
	// 不存在则插入。created_by / created_at 仅插入时写入。
	Upsert(ctx context.Context, kol *model.PresaleKolReferralPct) error
	// UpsertTx 同 Upsert，在外部 tx 上执行（admin handler audit 共事务）。
	UpsertTx(ctx context.Context, tx *gorm.DB, kol *model.PresaleKolReferralPct) error

	// Update PATCH 用：要求行已存在，否则返 ErrKolNotFound。
	// note 为 nil 时不改 note 字段（保留原值），传 *""（空字符串指针）时清空。
	Update(ctx context.Context, eoa string, pct decimal.Decimal, note *string, updatedAt int64) error
	// UpdateTx 同 Update，在外部 tx 上执行（admin handler audit 共事务）。
	UpdateTx(ctx context.Context, tx *gorm.DB, eoa string, pct decimal.Decimal, note *string, updatedAt int64) error

	// Delete 删除一条；返 found=true 表示真的删了一行，false 表示原本不存在。
	Delete(ctx context.Context, eoa string) (found bool, err error)
	// DeleteTx 同 Delete，在外部 tx 上执行（admin handler audit 共事务）。
	DeleteTx(ctx context.Context, tx *gorm.DB, eoa string) (found bool, err error)

	// GetByEoa 单条查询（PK 命中）。未命中返 ErrKolNotFound。
	// deposit 落 confirmed 路径调用，eoa 必须已 ToLower。
	GetByEoa(ctx context.Context, eoa string) (*model.PresaleKolReferralPct, error)
}

type kolReferralPctRepo struct {
	db *gorm.DB
}

// NewKolReferralPctRepository 构造函数，接受 *gorm.DB（同 admin 路径主 db）。
func NewKolReferralPctRepository(db *gorm.DB) KolReferralPctRepository {
	return &kolReferralPctRepo{db: db}
}

func (r *kolReferralPctRepo) List(ctx context.Context, eoaFilter string, page, size int) ([]*model.PresaleKolReferralPct, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 || size > 100 {
		size = 20
	}

	q := r.db.WithContext(ctx).Model(&model.PresaleKolReferralPct{})
	if eoaFilter != "" {
		q = q.Where("referrer_eoa LIKE ?", "%"+eoaFilter+"%")
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("[KolReferralPctRepo] count: %w", err)
	}

	var list []*model.PresaleKolReferralPct
	if err := q.Order("updated_at desc").
		Offset((page - 1) * size).
		Limit(size).
		Find(&list).Error; err != nil {
		return nil, 0, fmt.Errorf("[KolReferralPctRepo] list: %w", err)
	}
	return list, total, nil
}

// upsertOn 写实现，db 由 caller 提供（主 db 或 audit tx）
func (r *kolReferralPctRepo) upsertOn(ctx context.Context, db *gorm.DB, kol *model.PresaleKolReferralPct) error {
	if kol == nil || kol.ReferrerEoa == "" {
		return fmt.Errorf("[KolReferralPctRepo] upsert: nil entry or empty referrer_eoa")
	}

	// gorm clause.OnConflict 跨 DB 兼容 MySQL ON DUPLICATE KEY UPDATE / SQLite UPSERT。
	// 业务语义：PK 冲突时覆盖 referral_pct / note / created_by / updated_at；
	// created_at 仅插入时写入，PATCH 走 Update 分支保留原值。
	if err := db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "referrer_eoa"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"referral_pct", "note", "created_by", "updated_at",
		}),
	}).Create(kol).Error; err != nil {
		return fmt.Errorf("[KolReferralPctRepo] upsert eoa=%s: %w", kol.ReferrerEoa, err)
	}
	return nil
}

func (r *kolReferralPctRepo) Upsert(ctx context.Context, kol *model.PresaleKolReferralPct) error {
	return r.upsertOn(ctx, r.db, kol)
}

func (r *kolReferralPctRepo) UpsertTx(ctx context.Context, tx *gorm.DB, kol *model.PresaleKolReferralPct) error {
	if tx == nil {
		return fmt.Errorf("[KolReferralPctRepo] UpsertTx requires non-nil tx")
	}
	return r.upsertOn(ctx, tx, kol)
}

func (r *kolReferralPctRepo) updateOn(ctx context.Context, db *gorm.DB, eoa string, pct decimal.Decimal, note *string, updatedAt int64) error {
	if eoa == "" {
		return fmt.Errorf("[KolReferralPctRepo] update: empty referrer_eoa")
	}

	// 显式构造 UPDATE 字段，避免 GORM Struct Updates 把零值 note 当未传过滤掉
	updates := map[string]interface{}{
		"referral_pct": pct,
		"updated_at":   updatedAt,
	}
	if note != nil {
		updates["note"] = *note
	}

	result := db.WithContext(ctx).
		Model(&model.PresaleKolReferralPct{}).
		Where("referrer_eoa = ?", eoa).
		Updates(updates)
	if result.Error != nil {
		return fmt.Errorf("[KolReferralPctRepo] update eoa=%s: %w", eoa, result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrKolNotFound
	}
	return nil
}

func (r *kolReferralPctRepo) Update(ctx context.Context, eoa string, pct decimal.Decimal, note *string, updatedAt int64) error {
	return r.updateOn(ctx, r.db, eoa, pct, note, updatedAt)
}

func (r *kolReferralPctRepo) UpdateTx(ctx context.Context, tx *gorm.DB, eoa string, pct decimal.Decimal, note *string, updatedAt int64) error {
	if tx == nil {
		return fmt.Errorf("[KolReferralPctRepo] UpdateTx requires non-nil tx")
	}
	return r.updateOn(ctx, tx, eoa, pct, note, updatedAt)
}

func (r *kolReferralPctRepo) deleteOn(ctx context.Context, db *gorm.DB, eoa string) (bool, error) {
	if eoa == "" {
		return false, fmt.Errorf("[KolReferralPctRepo] delete: empty referrer_eoa")
	}
	result := db.WithContext(ctx).
		Where("referrer_eoa = ?", eoa).
		Delete(&model.PresaleKolReferralPct{})
	if result.Error != nil {
		return false, fmt.Errorf("[KolReferralPctRepo] delete eoa=%s: %w", eoa, result.Error)
	}
	return result.RowsAffected > 0, nil
}

func (r *kolReferralPctRepo) Delete(ctx context.Context, eoa string) (bool, error) {
	return r.deleteOn(ctx, r.db, eoa)
}

func (r *kolReferralPctRepo) DeleteTx(ctx context.Context, tx *gorm.DB, eoa string) (bool, error) {
	if tx == nil {
		return false, fmt.Errorf("[KolReferralPctRepo] DeleteTx requires non-nil tx")
	}
	return r.deleteOn(ctx, tx, eoa)
}

func (r *kolReferralPctRepo) GetByEoa(ctx context.Context, eoa string) (*model.PresaleKolReferralPct, error) {
	if eoa == "" {
		return nil, ErrKolNotFound
	}
	var kol model.PresaleKolReferralPct
	if err := r.db.WithContext(ctx).
		Where("referrer_eoa = ?", eoa).
		First(&kol).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrKolNotFound
		}
		return nil, fmt.Errorf("[KolReferralPctRepo] get eoa=%s: %w", eoa, err)
	}
	return &kol, nil
}
