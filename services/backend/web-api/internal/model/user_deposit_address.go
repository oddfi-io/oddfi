package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"
)

// 用户 存款 地址 记录表
type UserDepositAddress struct {
	ID           uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID       uint64    `gorm:"column:user_id;index" json:"user_id"`
	Chain        string    `gorm:"column:chain;size:20" json:"chain"`
	TokenAddress string    `gorm:"column:token_address;size:64" json:"token_address"`
	Address      string    `gorm:"column:address;size:128" json:"address"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (UserDepositAddress) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "user_deposit_address_dev"
	}
	return "user_deposit_address"
}
