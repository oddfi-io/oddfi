// Package repository — presale_config admin 专用方法（DD-003 v3.1 B5）。
package repository

import (
	"errors"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
)

// AdminPresaleConfigRepository admin 专用配置操作接口。
type AdminPresaleConfigRepository interface {
	// GetForUpdate 在事务内加行锁读取配置（PATCH 操作前使用）
	GetForUpdate(tx *gorm.DB) (*model.PresaleConfig, error)

	// UpdateFields 按 map 更新配置指定字段（tx 内）
	UpdateFields(tx *gorm.DB, fields map[string]any) error
}

type adminPresaleConfigRepo struct {
	db *gorm.DB
}

// NewAdminPresaleConfigRepo 构造 admin 专用 config repo。
func NewAdminPresaleConfigRepo(db *gorm.DB) AdminPresaleConfigRepository {
	return &adminPresaleConfigRepo{db: db}
}

func (r *adminPresaleConfigRepo) GetForUpdate(tx *gorm.DB) (*model.PresaleConfig, error) {
	var cfg model.PresaleConfig
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = 1").First(&cfg).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPresaleConfigNotFound
		}
		return nil, fmt.Errorf("[AdminPresaleConfigRepo] get for update: %w", err)
	}
	return &cfg, nil
}

func (r *adminPresaleConfigRepo) UpdateFields(tx *gorm.DB, fields map[string]any) error {
	fields["updated_at"] = time.Now().UnixMilli()
	result := tx.Model(&model.PresaleConfig{}).Where("id = 1").Updates(fields)
	if result.Error != nil {
		return fmt.Errorf("[AdminPresaleConfigRepo] update fields: %w", result.Error)
	}
	return nil
}
