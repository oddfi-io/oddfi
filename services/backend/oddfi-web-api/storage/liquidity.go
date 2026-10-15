package storage

import (
	"context"
	"log"
	"oddfi-web-api/model"
	"time"
)

var liquidityUpcomingStateIDs = []int{1, 13}

// GetLiquidityUpcomingFixtures 查询流动池可展示的未开赛赛事。
func (r *FixtureRepo) GetLiquidityUpcomingFixtures(ctx context.Context, locale string) ([]model.Fixture, error) {
	var dbFixtures []model.FixtureDB
	nowUnix := time.Now().Unix()

	// 仅依赖 state_id 容易留下历史脏数据，所以同时用开赛时间戳兜底过滤，避免流动池页面展示已经开赛的盘口。
	err := r.db.WithContext(ctx).
		Where("state_id IN ?", liquidityUpcomingStateIDs).
		Where("starting_at_timestamp > ?", nowUnix).
		Order("starting_at_timestamp ASC, id ASC").
		Find(&dbFixtures).Error
	if err != nil {
		log.Printf("❌ GetLiquidityUpcomingFixtures failed: %v", err)
		return nil, err
	}

	apiFixtures := make([]model.Fixture, len(dbFixtures))
	for i := range dbFixtures {
		apiFixtures[i] = r.ConvertToAPI(&dbFixtures[i], locale)
	}

	return r.EnrichFixtures(ctx, apiFixtures, false, locale)
}
