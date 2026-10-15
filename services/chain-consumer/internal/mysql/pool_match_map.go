package mysql

import (
	"context"
	"time"

	"github.com/samber/lo"
	"gorm.io/gorm/clause"
)

// PoolMatchMap 流动池→比赛映射，索引 MatchPoolOpened 事件填充。
// LiquidityDeposited 只带 poolId，靠这张表回填 match_id。
type PoolMatchMap struct {
	PoolID         string     `gorm:"column:pool_id;type:varchar(78);primaryKey" json:"pool_id"`
	MatchID        string     `gorm:"column:match_id;type:char(66);not null" json:"match_id"`
	MatchEndTime   *time.Time `gorm:"column:match_end_time;type:datetime" json:"match_end_time"`
	DepositCloseAt *time.Time `gorm:"column:deposit_close_at;type:datetime" json:"deposit_close_at"`
}

func (PoolMatchMap) TableName() string { return "pool_match_map" }

// BatchUpsertPoolMatchMap 批量写入流动池映射，主键 pool_id 冲突则跳过。
func BatchUpsertPoolMatchMap(ctx context.Context, rows []*PoolMatchMap) error {
	if len(rows) == 0 {
		return nil
	}
	return GetDB().WithContext(ctx).Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "pool_id"}},
			DoNothing: true,
		}).CreateInBatches(rows, 200).Error
}

// GetMatchIDsByPoolIDs 批量按 pool_id 查 match_id，用于 LIQUIDITY_* 入库时回填。
// 返回 pool_id -> match_id；查不到的不在结果里，调用方据此置 NULL。
func GetMatchIDsByPoolIDs(ctx context.Context, poolIDs []string) (map[string]string, error) {
	out := make(map[string]string)
	ids := lo.Uniq(poolIDs)
	if len(ids) == 0 {
		return out, nil
	}
	var rows []PoolMatchMap
	if err := GetDB().WithContext(ctx).
		Select("pool_id", "match_id").
		Where("pool_id IN ?", ids).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.PoolID] = r.MatchID
	}
	return out, nil
}
