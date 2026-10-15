package repository

import (
	"context"
	"errors"
	"fmt"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrReferralCodeNotFound = errors.New("referral code not found")

// UserReferralCodeRepository 邀请码数据访问接口
type UserReferralCodeRepository interface {
	// GetByUserID 按用户 ID 查邀请码
	GetByUserID(ctx context.Context, userID uint64) (*model.UserReferralCode, error)

	// GetByCode 按邀请码字符串查（输入须已归一化为大写）
	GetByCode(ctx context.Context, code string) (*model.UserReferralCode, error)

	// CreateIfNotExists INSERT IGNORE 创建邀请码，冲突（uk_code）时返回 ErrCodeConflict
	// 调用方负责 CSPRNG 生成 + 最多 5 次重试
	CreateIfNotExists(ctx context.Context, rc *model.UserReferralCode) error

	// InsertIgnore 为 B1 service 提供的语义更清晰的写法：
	// 若该 user_id 已有邀请码（uk_eoa 冲突）则静默返回 (false, nil)；
	// 若 code 碰撞（uk_code 冲突）则返回 (false, ErrCodeConflict)，调用方重试；
	// 成功写入返回 (true, nil)。
	// 等价于 CreateIfNotExists，但返回 inserted bool 让调用方区分"已存在"与"新建"两种成功路径。
	InsertIgnore(ctx context.Context, userID uint64, eoa string, code string) (inserted bool, err error)

	// ListByUserIDs 批量按 user_id 列表查邀请码，用于避免 ListReferred 的 N+1 查询。
	// 返回值以 map[userID]*UserReferralCode 方式组织，调用方按需查找。
	// 查不到的 user_id 不会出现在 map 中（新用户可能尚未生成邀请码）。
	ListByUserIDs(ctx context.Context, userIDs []uint64) (map[uint64]*model.UserReferralCode, error)
}

// ErrCodeConflict 邀请码唯一键冲突，调用方应重新生成 code 后重试
var ErrCodeConflict = errors.New("referral code conflict, retry with new code")

type userReferralCodeRepo struct {
	db *gorm.DB
}

func NewUserReferralCodeRepo(db *gorm.DB) UserReferralCodeRepository {
	return &userReferralCodeRepo{db: db}
}

func (r *userReferralCodeRepo) GetByUserID(ctx context.Context, userID uint64) (*model.UserReferralCode, error) {
	var rc model.UserReferralCode
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&rc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrReferralCodeNotFound
		}
		return nil, fmt.Errorf("[UserReferralCodeRepo] get by user_id %d: %w", userID, err)
	}
	return &rc, nil
}

func (r *userReferralCodeRepo) GetByCode(ctx context.Context, code string) (*model.UserReferralCode, error) {
	var rc model.UserReferralCode
	if err := r.db.WithContext(ctx).Where("code = ?", code).First(&rc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrReferralCodeNotFound
		}
		return nil, fmt.Errorf("[UserReferralCodeRepo] get by code %s: %w", code, err)
	}
	return &rc, nil
}

func (r *userReferralCodeRepo) CreateIfNotExists(ctx context.Context, rc *model.UserReferralCode) error {
	// DoNothing：uk_code 或 uk_eoa 冲突时 RowsAffected=0
	result := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(rc)
	if result.Error != nil {
		return fmt.Errorf("[UserReferralCodeRepo] create referral code user=%d code=%s: %w", rc.UserID, rc.Code, result.Error)
	}
	if result.RowsAffected == 0 {
		// uk_code 冲突，调用方重新生成 code 后重试
		return ErrCodeConflict
	}
	return nil
}

func (r *userReferralCodeRepo) ListByUserIDs(ctx context.Context, userIDs []uint64) (map[uint64]*model.UserReferralCode, error) {
	if len(userIDs) == 0 {
		return map[uint64]*model.UserReferralCode{}, nil
	}
	var records []*model.UserReferralCode
	if err := r.db.WithContext(ctx).Where("user_id IN ?", userIDs).Find(&records).Error; err != nil {
		return nil, fmt.Errorf("[UserReferralCodeRepo] list by user_ids: %w", err)
	}
	result := make(map[uint64]*model.UserReferralCode, len(records))
	for _, rc := range records {
		result[rc.UserID] = rc
	}
	return result, nil
}

func (r *userReferralCodeRepo) InsertIgnore(ctx context.Context, userID uint64, eoa string, code string) (bool, error) {
	rc := &model.UserReferralCode{
		UserID:     userID,
		EoaAddress: eoa,
		Code:       code,
	}
	// DoNothing：uk_code 或 uk_eoa 冲突时 RowsAffected=0
	// - uk_eoa 冲突：该用户已有邀请码，属于幂等正常路径，返回 (false, nil)
	// - uk_code 冲突：code 碰撞，调用方应重新 CSPRNG 生成 code 后重试，返回 (false, ErrCodeConflict)
	// 由于 ON CONFLICT DO NOTHING 时 MySQL 不区分是哪个 unique key 触发冲突，
	// 需要额外查一次：若该 user_id 已有记录则为幂等；否则为 code 碰撞。
	result := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(rc)
	if result.Error != nil {
		return false, fmt.Errorf("[UserReferralCodeRepo] insert ignore user=%d code=%s: %w", userID, code, result.Error)
	}
	if result.RowsAffected == 1 {
		// 成功写入新记录
		return true, nil
	}
	// RowsAffected == 0：冲突未插入，判断是幂等还是 code 碰撞
	// 查是否已有该 user_id 的记录（uk_eoa/user_id 冲突 → 幂等）
	existing, err := r.GetByUserID(ctx, userID)
	if err == nil && existing != nil {
		// 该用户已有邀请码，幂等正常退出
		return false, nil
	}
	// 用户没有邀请码但 RowsAffected==0 → uk_code 碰撞，调用方重试
	return false, ErrCodeConflict
}
