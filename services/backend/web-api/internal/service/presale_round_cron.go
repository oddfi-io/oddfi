package service

// presale_round_cron.go
//
// RoundCronService 负责每 5 分钟推进轮次状态机（B2 §6.5）：
//   - upcoming → active（now ≥ start_ts 且 manual_override=0）
//   - active → ended（now ≥ end_ts 或 sold_odd ≥ supply_odd，且 manual_override=0）
//
// manual_override=1 时 cron 完全不碰该轮次，防止覆盖运营手动操作（pause/resume/reopen/close）。
// 状态机保护：AdvanceStatus 的 WHERE 条件含 manual_override=0（数据库层二次保护）。

import (
	"context"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/repository"
)

// ===========================
// RoundCronService 接口
// ===========================

// RoundCronService 轮次状态自动推进服务
type RoundCronService interface {
	// Tick 执行一次状态推进检查（由 presale-worker ticker 每 5min 调用）
	// ctx 支持优雅退出
	Tick(ctx context.Context) error
}

// ===========================
// 实现结构体
// ===========================

type roundCronService struct {
	roundRepo repository.PresaleRoundRepository
}

// NewRoundCronService 构造函数，注入 PresaleRoundRepository
func NewRoundCronService(roundRepo repository.PresaleRoundRepository) RoundCronService {
	return &roundCronService{roundRepo: roundRepo}
}

// ===========================
// Tick 实现（状态机推进）
// ===========================

// Tick 执行一次轮次状态推进：
//  1. 查询所有需要自动推进的轮次（manual_override=0 的 upcoming/active）
//  2. upcoming → active：now ≥ start_ts
//  3. active → ended：now ≥ end_ts 或 sold_odd ≥ supply_odd
//
// 幂等：AdvanceStatus 的 WHERE 带 manual_override=0，运营干预后自动跳过
func (s *roundCronService) Tick(ctx context.Context) error {
	nowMs := time.Now().UnixMilli()

	// 取所有需要自动推进的轮次（manual_override=0 的 upcoming/active）
	rounds, err := s.roundRepo.ListAutoAdvanceable(ctx, nowMs)
	if err != nil {
		return fmt.Errorf("[RoundCronService] list auto-advanceable rounds: %w", err)
	}

	if len(rounds) == 0 {
		return nil
	}

	for _, r := range rounds {
		switch r.Status {
		case model.RoundStatusUpcoming:
			// upcoming → active：now ≥ start_ts（ListAutoAdvanceable 已确认，AdvanceStatus 再做一次保护）
			if err := s.roundRepo.AdvanceStatus(ctx, r.ID, model.RoundStatusUpcoming, model.RoundStatusActive); err != nil {
				// AdvanceStatus 失败只记日志，不阻断其他轮次推进（单轮失败不影响全局）
				logger.Errorf("[RoundCronService] advance round %s upcoming→active: %v", r.ID, err)
				continue
			}
			logger.Infof("[RoundCronService] round %s advanced upcoming→active at %d", r.ID, nowMs)

		case model.RoundStatusActive:
			// active → ended：now ≥ end_ts 或 sold_odd ≥ supply_odd
			if nowMs >= r.EndTs || r.SoldOdd.GreaterThanOrEqual(r.SupplyOdd) {
				reason := "time"
				if r.SoldOdd.GreaterThanOrEqual(r.SupplyOdd) {
					reason = "sold_out"
				}
				if err := s.roundRepo.AdvanceStatus(ctx, r.ID, model.RoundStatusActive, model.RoundStatusEnded); err != nil {
					logger.Errorf("[RoundCronService] advance round %s active→ended reason=%s: %v",
						r.ID, reason, err)
					continue
				}
				logger.Infof("[RoundCronService] round %s advanced active→ended reason=%s at %d",
					r.ID, reason, nowMs)
			}
		}
	}

	return nil
}

// ===========================
// 编译时接口断言
// ===========================

var _ RoundCronService = (*roundCronService)(nil)
