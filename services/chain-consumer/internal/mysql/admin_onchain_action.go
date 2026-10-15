package mysql

import (
	"context"
	"time"

	"gorm.io/gorm/clause"
)

// AdminOnchainAction 链上「管理员特权操作」审计表。
// 唯一键 (chain_id, tx_hash, log_index) 保证重扫幂等。
//
// params 列存事件全部参数的 JSON 文本：
//   - 大整数(uint256/int256)一律存十进制字符串，绝不存 JSON number，避免读回时浮点丢精度/出错；
//   - 地址统一小写 0x；bytes32 统一 0x + 64hex；
//   - Params 字段用 string 承载已序列化好的合法 JSON，写入即可被 MySQL JSON 列接受，读回也不会解析失败；
//   - 绝不写入空串（空串不是合法 JSON），无参数时至少写 "{}"。
type AdminOnchainAction struct {
	ID uint64 `gorm:"column:id;primaryKey;autoIncrement" json:"id"`

	ContractAddress string  `gorm:"column:contract_address;type:char(42);not null" json:"contract_address"`
	Category        string  `gorm:"column:category;type:varchar(16);not null" json:"category"`
	EventName       string  `gorm:"column:event_name;type:varchar(48);not null" json:"event_name"`
	Operator        string  `gorm:"column:operator;type:char(42);not null" json:"operator"`
	Role            *string `gorm:"column:role;type:char(66)" json:"role"`
	TargetAddress   *string `gorm:"column:target_address;type:char(42)" json:"target_address"`
	Params          string  `gorm:"column:params;type:json;not null" json:"params"`

	ChainID     uint   `gorm:"column:chain_id;type:int unsigned;not null;uniqueIndex:uk_log,priority:1" json:"chain_id"`
	BlockNumber uint64 `gorm:"column:block_number;type:bigint unsigned;not null" json:"block_number"`
	BlockTime   time.Time `gorm:"column:block_time;type:datetime;not null" json:"block_time"`
	TxHash      string `gorm:"column:tx_hash;type:char(66);not null;uniqueIndex:uk_log,priority:2" json:"tx_hash"`
	TxFrom      string `gorm:"column:tx_from;type:char(42);not null" json:"tx_from"`
	LogIndex    uint   `gorm:"column:log_index;type:int unsigned;not null;uniqueIndex:uk_log,priority:3" json:"log_index"`
	BlockHash   string `gorm:"column:block_hash;type:char(66);not null" json:"block_hash"`
}

func (AdminOnchainAction) TableName() string { return "admin_onchain_action" }

// BatchInsertAdminActions 批量写入管理员操作审计，命中唯一键则跳过（幂等）。
func BatchInsertAdminActions(ctx context.Context, rows []*AdminOnchainAction) error {
	if len(rows) == 0 {
		return nil
	}
	return GetDB().WithContext(ctx).Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "chain_id"}, {Name: "tx_hash"}, {Name: "log_index"}},
			DoNothing: true,
		}).CreateInBatches(rows, 200).Error
}
