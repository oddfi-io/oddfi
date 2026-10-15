package mysql

import (
	"time"

	"github.com/shopspring/decimal"
)

// AssetLedger 资金变动流水表
type AssetLedger struct {
	ID            uint64          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID        uint64          `gorm:"column:user_id;not null;index:idx_user_coin" json:"user_id"`
	BusinessType  string          `gorm:"column:business_type;type:varchar(32);not null" json:"business_type"` // DEPOSIT-充值, WITHDRAW-提现, TRADE-交易, FREEZE-冻结
	Amount        decimal.Decimal `gorm:"column:amount;type:decimal(40,18);not null" json:"amount"`            // 变动金额(正负)
	BalanceBefore decimal.Decimal `gorm:"column:balance_before;type:decimal(40,18);not null" json:"balance_before"`
	BalanceAfter  decimal.Decimal `gorm:"column:balance_after;type:decimal(40,18);not null" json:"balance_after"`
	RefID         string          `gorm:"column:ref_id;type:varchar(80);not null;default:'';index:idx_ref_id" json:"ref_id"` // 关联业务订单号 (如 tx_hash，66字符)
	TokenAddress  string          `gorm:"column:token_address;type:varchar(20);not null;default:'';index:idx_user_coin" json:"token_address"`
	CreatedAt     time.Time       `gorm:"column:created_at;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (AssetLedger) TableName() string {
	return "asset_ledger"
}
