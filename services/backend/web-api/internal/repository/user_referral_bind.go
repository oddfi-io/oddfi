package repository

import (
	"context"
	"errors"
	"fmt"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrReferralBindNotFound = errors.New("referral bind not found")

// UserReferralBindRepository 邀请绑定数据访问接口
type UserReferralBindRepository interface {
	// GetByUserID 按被邀请人 user_id 查绑定关系
	GetByUserID(ctx context.Context, userID uint64) (*model.UserReferralBind, error)

	// CreateIdempotent INSERT ... ON DUPLICATE KEY UPDATE user_id=user_id（幂等写入，不改任何字段）
	// 一旦绑定不可撤销/不可改。
	// 返回 inserted=true 表示本次真正写入；inserted=false 表示 PK 冲突、行已存在（幂等）。
	// 调用方需检查 inserted：并发竞态下两路请求绑定不同邀请码，DB 保证只有一路成功写入。
	CreateIdempotent(ctx context.Context, tx *gorm.DB, bind *model.UserReferralBind) (inserted bool, err error)

	// ListByReferrer 查邀请人邀请了哪些用户（分页）
	ListByReferrer(ctx context.Context, referrerUserID uint64, page, size int) ([]*model.UserReferralBind, int64, error)

	// ListByReferrerFiltered 查邀请人邀请的用户列表，支持按 business 筛选（空字符串=不筛选）
	// B1 GET /referral/list 使用此方法，兼容后续多业务扩展
	ListByReferrerFiltered(ctx context.Context, referrerUserID uint64, business string, page, size int) ([]*model.UserReferralBind, int64, error)
}

type userReferralBindRepo struct {
	db *gorm.DB
}

func NewUserReferralBindRepo(db *gorm.DB) UserReferralBindRepository {
	return &userReferralBindRepo{db: db}
}

func (r *userReferralBindRepo) GetByUserID(ctx context.Context, userID uint64) (*model.UserReferralBind, error) {
	var bind model.UserReferralBind
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&bind).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrReferralBindNotFound
		}
		return nil, fmt.Errorf("[UserReferralBindRepo] get by user_id %d: %w", userID, err)
	}
	return &bind, nil
}

func (r *userReferralBindRepo) CreateIdempotent(ctx context.Context, tx *gorm.DB, bind *model.UserReferralBind) (bool, error) {
	db := tx
	if db == nil {
		db = r.db
	}
	// ON DUPLICATE KEY UPDATE user_id=user_id：冲突时不更新任何字段
	// 保证一旦绑定关系存在，重复调用不会破坏原关系（不可改语义）
	// RowsAffected=1 表示真正写入；=0 表示 PK 冲突（幂等）
	result := db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{"user_id": gorm.Expr("user_id")}),
		}).
		Create(bind)
	if result.Error != nil {
		return false, fmt.Errorf("[UserReferralBindRepo] create idempotent bind user=%d referrer=%d: %w", bind.UserID, bind.ReferrerUserID, result.Error)
	}
	return result.RowsAffected == 1, nil
}

func (r *userReferralBindRepo) ListByReferrer(ctx context.Context, referrerUserID uint64, page, size int) ([]*model.UserReferralBind, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.UserReferralBind{}).Where("referrer_user_id = ?", referrerUserID)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("[UserReferralBindRepo] count binds for referrer %d: %w", referrerUserID, err)
	}

	var binds []*model.UserReferralBind
	offset := (page - 1) * size
	if err := q.Order("bound_at DESC").Offset(offset).Limit(size).Find(&binds).Error; err != nil {
		return nil, 0, fmt.Errorf("[UserReferralBindRepo] list binds for referrer %d: %w", referrerUserID, err)
	}
	return binds, total, nil
}

func (r *userReferralBindRepo) ListByReferrerFiltered(ctx context.Context, referrerUserID uint64, business string, page, size int) ([]*model.UserReferralBind, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.UserReferralBind{}).Where("referrer_user_id = ?", referrerUserID)
	if business != "" {
		// business 筛选：后续多业务（presale/betting 等）扩展时可按业务分页查看
		q = q.Where("business = ?", business)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("[UserReferralBindRepo] count filtered binds for referrer %d business=%s: %w", referrerUserID, business, err)
	}

	var binds []*model.UserReferralBind
	offset := (page - 1) * size
	if err := q.Order("bound_at DESC").Offset(offset).Limit(size).Find(&binds).Error; err != nil {
		return nil, 0, fmt.Errorf("[UserReferralBindRepo] list filtered binds for referrer %d business=%s: %w", referrerUserID, business, err)
	}
	return binds, total, nil
}
