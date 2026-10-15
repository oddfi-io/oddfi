package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"
)

type DepositAddress struct {
	ID          uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Chain       string     `gorm:"column:chain;size:20" json:"chain"`
	Address     string     `gorm:"column:address;size:128" json:"address"`
	UserID      uint64     `gorm:"column:user_id;default:0;index" json:"user_id"`
	Status      int8       `gorm:"column:status;default:0" json:"status"`
	Version     int        `gorm:"column:version;default:0" json:"version"`
	AllocatedAt *time.Time `gorm:"column:allocated_at" json:"allocated_at,omitempty"`
	CreatedAt   time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (DepositAddress) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "deposit_address_dev"
	}
	return "deposit_address"
}

type DepositAddressStatus int8

const (
	DepositAddressStatusUnused    DepositAddressStatus = 0 // 未使用
	DepositAddressStatusAllocated DepositAddressStatus = 1 // 已分配
	DepositAddressStatusDisabled  DepositAddressStatus = 2 // 禁用
)
