package repository

import (
	"context"
	"strconv"

	"everything_finance/org/web-api/internal/pkg/logger"
)

const liquidityFixtureBetCountKeyPrefix = "liquidity:fixture:bet_count:"

func liquidityFixtureBetCountKey(fixtureID int64) string {
	return liquidityFixtureBetCountKeyPrefix + strconv.FormatInt(fixtureID, 10)
}

func (r *userRepo) recordLiquidityFixtureBetCounts(ctx context.Context, fixtureIDs []int64) {
	if r.rdb == nil || len(fixtureIDs) == 0 {
		return
	}

	for _, fixtureID := range fixtureIDs {
		if fixtureID <= 0 {
			continue
		}
		// 这是流动池排序的派生统计，不能影响真实下注事务；失败只记录日志，后续下注会继续累加。
		if _, err := r.rdb.Incr(ctx, liquidityFixtureBetCountKey(fixtureID)); err != nil {
			logger.Errorf("[recordLiquidityFixtureBetCounts] redis incr failed, fixture_id:%d err:%v", fixtureID, err)
		}
	}
}
