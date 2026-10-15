package mysql

import (
	"context"
	"time"

	"gorm.io/gorm/clause"
)

// OnchainTxOrder web-api relay 写交易与业务订单关联表。
// 该表由 web-api relay 写入并维护表结构，consumer 对它只做两件事：
//  1. 按 tx_hash 回填 onchain_bet_id（UpdateOnchainBetIDByTxHash，来自 BetPlaced）；
//  2. MarketSettlementFinalized 时 INSERT 一条结算行（BatchInsertSettlementOrders）。
//
// 结构体只声明本项目会读/写的列；其余列（spender/amount_wei/match_id/... 等）由 relay 维护，
// 不在此声明，INSERT 时自然落 DB 默认 NULL。
type OnchainTxOrder struct {
	ID uint64 `gorm:"column:id;primaryKey;autoIncrement" json:"id"`

	UserID         uint64 `gorm:"column:user_id" json:"user_id"`
	Chain          string `gorm:"column:chain" json:"chain"`
	Op             string `gorm:"column:op" json:"op"`
	IdempotencyKey string `gorm:"column:idempotency_key" json:"idempotency_key"`
	TxHash         string `gorm:"column:tx_hash;type:char(66);not null" json:"tx_hash"`
	Status         string `gorm:"column:status" json:"status"`
	// RequestJSON：合法 JSON 文本，写入 json 列（同 admin_onchain_action.params 的处理）。
	RequestJSON  string  `gorm:"column:request_json;type:json" json:"request_json"`
	OnchainBetID *string `gorm:"column:onchain_bet_id;type:char(66)" json:"onchain_bet_id"`

	SettlementStatus string     `gorm:"column:settlement_status" json:"settlement_status"`
	ActualPayoutWei  string     `gorm:"column:actual_payout_wei" json:"actual_payout_wei"`
	SettledAt        *time.Time `gorm:"column:settled_at" json:"settled_at"`
	CreatedAt        time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (OnchainTxOrder) TableName() string {
	return "onchain_tx_orders"
}

// UpdateOnchainBetIDByTxHash 按 tx_hash 回填 onchain_bet_id，返回受影响行数。
func UpdateOnchainBetIDByTxHash(ctx context.Context, txHash, betID string) (int64, error) {
	db := GetDB()
	result := db.WithContext(ctx).Model(&OnchainTxOrder{}).
		Where("tx_hash = ?", txHash).
		Update("onchain_bet_id", betID)
	return result.RowsAffected, result.Error
}

// BatchInsertSettlementOrders 批量 INSERT 盘口结算行（MarketSettlementFinalized）。
// 该表无 UNIQUE(chain_id,tx_hash,log_index)，幂等靠唯一键 idempotency_key + DoNothing：
// 重复消费同一区块不会插重。
func BatchInsertSettlementOrders(ctx context.Context, rows []*OnchainTxOrder) error {
	if len(rows) == 0 {
		return nil
	}
	return GetDB().WithContext(ctx).Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "idempotency_key"}},
			DoNothing: true,
		}).CreateInBatches(rows, 200).Error
}

// UpdateCashOutSettlementByBetID 把 BetCashedOut 回写到原 place_bet 行：标记已取消终态，
// 让 web-api History 据 settlement_status 把注单从「进行中」流转到「已结算 / 已取消」。
//
// 守卫 settlement_status 为空：① 幂等（重投不重复写）；② 绝不覆盖 spider 已写入的 WON/LOST/PUSH/VOID。
// 返回受影响行数：0 表示注单尚未回填 betId 或已是终态，调用方记日志即可，最终一致靠重扫/重投（本方法可重入）。
func UpdateCashOutSettlementByBetID(ctx context.Context, betID, actualPayoutWei string, settledAt time.Time) (int64, error) {
	db := GetDB()
	res := db.WithContext(ctx).Model(&OnchainTxOrder{}).
		Where("onchain_bet_id = ? AND op = ? AND (settlement_status IS NULL OR settlement_status = '')",
			betID, "place_bet").
		Updates(map[string]any{
			"settlement_status": "CASHED_OUT",
			"actual_payout_wei": actualPayoutWei,
			"settled_at":        settledAt,
			"updated_at":        settledAt,
		})
	return res.RowsAffected, res.Error
}
