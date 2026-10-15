package mysql

import (
	"context"
	"time"

	"github.com/samber/lo"
	"gorm.io/gorm/clause"
)

// MarketMatchMap 盘口→比赛映射，索引 MarketOpened 事件填充。
// BetPlaced/BetClaimed/BetRefunded 只带 marketId，靠这张表回填 match_id。
type MarketMatchMap struct {
	MarketID   string     `gorm:"column:market_id;type:char(66);primaryKey" json:"market_id"`
	MatchID    string     `gorm:"column:match_id;type:char(66);not null" json:"match_id"`
	MarketType *uint8     `gorm:"column:market_type;type:tinyint unsigned" json:"market_type"`
	Line       *uint8     `gorm:"column:line;type:tinyint unsigned" json:"line"`
	LockAt     *time.Time `gorm:"column:lock_at;type:datetime" json:"lock_at"`
}

func (MarketMatchMap) TableName() string { return "market_match_map" }

// BatchUpsertMarketMatchMap 批量写入盘口映射，主键 market_id 冲突则跳过（同一盘口不变）。
func BatchUpsertMarketMatchMap(ctx context.Context, rows []*MarketMatchMap) error {
	if len(rows) == 0 {
		return nil
	}
	return GetDB().WithContext(ctx).Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "market_id"}},
			DoNothing: true,
		}).CreateInBatches(rows, 200).Error
}

// GetMatchIDsByMarketIDs 批量按 market_id 查 match_id，用于用户行为入库时回填。
// 返回 market_id(小写) -> match_id；查不到的 market_id 不在结果里，调用方据此置 NULL。
func GetMatchIDsByMarketIDs(ctx context.Context, marketIDs []string) (map[string]string, error) {
	out := make(map[string]string)
	ids := lo.Uniq(marketIDs)
	if len(ids) == 0 {
		return out, nil
	}
	var rows []MarketMatchMap
	if err := GetDB().WithContext(ctx).
		Select("market_id", "match_id").
		Where("market_id IN ?", ids).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.MarketID] = r.MatchID
	}
	return out, nil
}
