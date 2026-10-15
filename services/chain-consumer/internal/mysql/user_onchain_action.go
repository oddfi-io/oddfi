package mysql

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// UserOnchainAction 链上用户行为流水（单事件单行）。
// 唯一键 (chain_id, tx_hash, log_index) 保证重扫幂等。
//
// 金额列 DECIMAL(65,0) 存原始最小单位整数(wei)，用 decimal.NullDecimal 以支持 NULL；
// extra 列存事件附加参数 JSON 文本（大整数同样存字符串），无附加参数时存 NULL（不写空串）。
type UserOnchainAction struct {
	ID uint64 `gorm:"column:id;primaryKey;autoIncrement" json:"id"`

	UserAddress         string  `gorm:"column:user_address;type:char(42);not null" json:"user_address"`
	CounterpartyAddress *string `gorm:"column:counterparty_address;type:char(42)" json:"counterparty_address"`
	ActionType          string  `gorm:"column:action_type;type:varchar(32);not null" json:"action_type"`

	BetID      *string `gorm:"column:bet_id;type:char(66)" json:"bet_id"`
	MarketID   *string `gorm:"column:market_id;type:char(66)" json:"market_id"`
	MatchID    *string `gorm:"column:match_id;type:char(66)" json:"match_id"`
	PositionID *string `gorm:"column:position_id;type:varchar(78)" json:"position_id"`

	Amount          decimal.NullDecimal `gorm:"column:amount;type:decimal(65,0)" json:"amount"`
	AmountGross     decimal.NullDecimal `gorm:"column:amount_gross;type:decimal(65,0)" json:"amount_gross"`
	AmountTax       decimal.NullDecimal `gorm:"column:amount_tax;type:decimal(65,0)" json:"amount_tax"`
	AmountSecondary decimal.NullDecimal `gorm:"column:amount_secondary;type:decimal(65,0)" json:"amount_secondary"`

	Extra *string `gorm:"column:extra;type:json" json:"extra"`

	ChainID         uint      `gorm:"column:chain_id;type:int unsigned;not null;uniqueIndex:uk_log,priority:1" json:"chain_id"`
	ContractAddress string    `gorm:"column:contract_address;type:char(42);not null" json:"contract_address"`
	BlockNumber     uint64    `gorm:"column:block_number;type:bigint unsigned;not null" json:"block_number"`
	BlockTime       time.Time `gorm:"column:block_time;type:datetime;not null" json:"block_time"`
	TxHash          string    `gorm:"column:tx_hash;type:char(66);not null;uniqueIndex:uk_log,priority:2" json:"tx_hash"`
	TxFrom          *string   `gorm:"column:tx_from;type:char(42)" json:"tx_from"`
	LogIndex        uint      `gorm:"column:log_index;type:int unsigned;not null;uniqueIndex:uk_log,priority:3" json:"log_index"`
	BlockHash       string    `gorm:"column:block_hash;type:char(66);not null" json:"block_hash"`
}

func (UserOnchainAction) TableName() string { return "user_onchain_action" }

// BatchInsertUserActions 批量写入用户行为流水，命中唯一键则跳过（幂等）。
func BatchInsertUserActions(ctx context.Context, rows []*UserOnchainAction) error {
	if len(rows) == 0 {
		return nil
	}
	return GetDB().WithContext(ctx).Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "chain_id"}, {Name: "tx_hash"}, {Name: "log_index"}},
			DoNothing: true,
		}).CreateInBatches(rows, 200).Error
}

// InsertUserActionWithTx 在给定事务内幂等插入单条用户行为，返回实际插入行数(命中 uk_log 唯一键时为 0)。
// 用于"插入审计行 + 加减余额"放在同一事务里：affected=1 才是首次处理，应加减余额；affected=0 跳过(幂等)。
func InsertUserActionWithTx(tx *gorm.DB, row *UserOnchainAction) (int64, error) {
	res := tx.Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "chain_id"}, {Name: "tx_hash"}, {Name: "log_index"}},
			DoNothing: true,
		}).Create(row)
	return res.RowsAffected, res.Error
}
