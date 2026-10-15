package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"

	"github.com/shopspring/decimal"
)

type DepositRecord struct {
	ID            uint64          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	TxID          string          `gorm:"column:tx_id;size:128" json:"tx_id"`
	UserID        uint64          `gorm:"column:user_id;index" json:"user_id"`
	Chain         string          `gorm:"column:chain;size:20" json:"chain"`
	Amount        decimal.Decimal `gorm:"column:amount;type:decimal(40,18)" json:"amount"`
	FromAddress   string          `gorm:"column:from_address;size:128" json:"from_address"`
	ToAddress     string          `gorm:"column:to_address;size:128" json:"to_address"`
	BlockHeight   int64           `gorm:"column:block_height" json:"block_height"`
	Status        int8            `gorm:"column:status;default:0" json:"status"`
	Confirmations int             `gorm:"column:confirmations;default:0" json:"confirmations"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (DepositRecord) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "deposit_record_dev"
	}
	return "deposit_record"
}

type DepositStatus int8

const (
	DepositStatusPending    DepositStatus = 0 // 待确认
	DepositStatusConfirming DepositStatus = 1 // 确认中
	DepositStatusCompleted  DepositStatus = 2 // 已入账
	DepositStatusAbnormal   DepositStatus = 3 // 异常
)
