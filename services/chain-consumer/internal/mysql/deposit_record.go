package mysql

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm/clause"
)

// DepositRecord 链上充值记录表
type DepositRecord struct {
	TxID          string          `gorm:"column:tx_id;type:varchar(128);not null;uniqueIndex:uk_tx_log,priority:1" json:"tx_id"` // 链上交易Hash
	UserID        uint64          `gorm:"column:user_id;not null" json:"user_id"`
	LogIndex      uint            `gorm:"column:log_index;not null;uniqueIndex:uk_tx_log,priority:2" json:"log_index"` // 交易内日志索引，与 tx_id 共同构成唯一键
	Chain         string          `gorm:"column:chain;type:varchar(20);not null" json:"chain"`
	Amount        decimal.Decimal `gorm:"column:amount;type:decimal(40,18);not null" json:"amount"` // 充值金额，使用高精度 Decimal
	FromAddress   string          `gorm:"column:from_address;type:varchar(128)" json:"from_address"`
	ToAddress     string          `gorm:"column:to_address;type:varchar(128);not null" json:"to_address"`
	BlockHeight   uint64          `gorm:"column:block_height" json:"block_height"`
	Status        int8            `gorm:"column:status;not null;default:0" json:"status"`      // 0-待确认, 1-确认中, 2-已入账, 3-异常
	Confirmations int             `gorm:"column:confirmations;default:0" json:"confirmations"` // 当前确认数
	CreatedAt     time.Time       `gorm:"column:created_at;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (DepositRecord) TableName() string {
	return "deposit_record"
}

// CreateDepositRecord 幂等插入充值记录，返回实际插入行数(命中唯一键 (tx_id, log_index) 时为 0)。
// 调用方据此判断是否首次处理，避免重复加余额。
func CreateDepositRecord(ctx context.Context, chain string, txID string, logIndex uint, userID uint64, amount decimal.Decimal, fromAddress string, toAddress string, blockHeight uint64, status int8, confirmations int) (int64, error) {
	db := GetDB()
	res := db.WithContext(ctx).Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "tx_id"}, {Name: "log_index"}},
			DoNothing: true, // 如果已存在则不做任何操作，防止重复加钱
		}).Create(&DepositRecord{
		TxID:          txID,
		LogIndex:      logIndex,
		UserID:        userID,
		Chain:         chain,
		Amount:        amount,
		FromAddress:   fromAddress,
		ToAddress:     toAddress,
		BlockHeight:   blockHeight,
		Status:        status,
		Confirmations: confirmations,
		UpdatedAt:     time.Now(),
	})
	if res.Error != nil {
		return 0, res.Error
	}
	return res.RowsAffected, nil
}
