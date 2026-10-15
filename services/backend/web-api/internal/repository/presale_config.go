package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
)

var ErrPresaleConfigNotFound = errors.New("presale config not found")

// PresaleConfigRepository 预售全局配置数据访问接口
type PresaleConfigRepository interface {
	// Get 获取单行全局配置（PK=1）
	Get(ctx context.Context) (*model.PresaleConfig, error)

	// Update 更新全局配置（admin 接口使用）
	Update(ctx context.Context, tx *gorm.DB, cfg *model.PresaleConfig) error
}

type presaleConfigRepo struct {
	db *gorm.DB
}

func NewPresaleConfigRepo(db *gorm.DB) PresaleConfigRepository {
	return &presaleConfigRepo{db: db}
}

func (r *presaleConfigRepo) Get(ctx context.Context) (*model.PresaleConfig, error) {
	var cfg model.PresaleConfig
	if err := r.db.WithContext(ctx).Where("id = 1").First(&cfg).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPresaleConfigNotFound
		}
		return nil, fmt.Errorf("[PresaleConfigRepo] get config: %w", err)
	}
	return &cfg, nil
}

func (r *presaleConfigRepo) Update(ctx context.Context, tx *gorm.DB, cfg *model.PresaleConfig) error {
	db := tx
	if db == nil {
		db = r.db
	}
	cfg.UpdatedAt = time.Now().UnixMilli()
	if err := db.WithContext(ctx).Where("id = 1").Save(cfg).Error; err != nil {
		return fmt.Errorf("[PresaleConfigRepo] update config: %w", err)
	}
	return nil
}
