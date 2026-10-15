package worker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"

	"oddfi-bet-settle/config"
	"oddfi-bet-settle/internal/model"
	"oddfi-bet-settle/internal/service"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	// 默认 fixture_id 使用高位固定 ID，目的是避开 SportMonks 真实赛事 ID，降低误覆盖真实赛事数据的风险。
	defaultMockUCLFixtureID int64 = 99200001
	// 默认 300 秒一轮，对齐产品要求的“5 分钟自动结算一次”。
	defaultMockUCLPeriodSec = 300
	// 默认前 240 秒可下注，后 60 秒封盘等待结算，给下单事务和结算事务留出缓冲。
	defaultMockUCLBetOpenSec = 240
	// 默认 DB 锁名固定，保证多实例部署时所有 worker 竞争同一把锁。
	defaultMockUCLLockName = "oddfi_ucl_mock_5min"

	// MockUCLActivityID 写入 remark/mock_activity，方便接口、日志和运营排查时识别这是体验盘。
	MockUCLActivityID = "UCL_MOCK_5MIN"
	// MockUCLLeagueID 固定为 2，让市场接口把该赛事归到欧冠列表。
	MockUCLLeagueID = 2
	// Stage/Season/Team ID 使用高位 mock 值，只满足前端展示和表结构约束，不参与真实赛程采集。
	MockUCLStageID    = 992
	MockUCLSeasonID   = 202604
	MockUCLHomeTeamID = 992001
	MockUCLAwayTeamID = 992002
	// MockUCLFixtureName 和队徽 URL 必须和前端市场展示口径一致；fixture 主表是展示字段的权威来源。
	MockUCLFixtureName  = "葡萄牙 vs 阿根廷"
	MockUCLHomeTeamLogo = "https://cdn.sportmonks.com/images/soccer/teams/13/18701.png"
	MockUCLAwayTeamLogo = "https://cdn.sportmonks.com/images/soccer/teams/20/18644.png"
	// MockUCLBookmakerID 复用系统现有 bookmaker 过滤习惯，避免前端盘口筛选拿不到数据。
	MockUCLBookmakerID = 20
	// 5 秒轮询比普通结算更细，目的是让封盘和自动结算的体验误差更小。
	mockUCLPollInterval = 5 * time.Second
)

// mockUCLRuntimeConfig 是启动后的归一化配置；先归一再运行，避免每个 tick 重复处理默认值和边界条件。
type mockUCLRuntimeConfig struct {
	enabled    bool   // 是否启用 mock 盘；生产默认关闭，避免误写线上体验数据。
	fixtureID  int64  // 体验盘固定赛事 ID；下注、赔率、赛果都围绕这个 ID 串联。
	periodSec  int    // 完整一轮周期，产品要求为 300 秒。
	betOpenSec int    // 开盘可下注窗口，必须短于 periodSec。
	lockName   string // 多实例并发推进轮次时使用的 MySQL 用户级锁名。
}

// mockUCLOddSeed 是固定盘口种子；盘口固定可让前端、下注 API 和结算规则都稳定验收。
type mockUCLOddSeed struct {
	OddID             int64  // 固定 odd_id 是下注 API 的唯一入口，跨轮复用但注单状态会隔离历史轮次。
	MarketID          int    // 1=胜平负，6=让球，7=大小球，和现有 OddDB 语义保持一致。
	Label             string // 对齐 SportMonks 原始格式，只放 Home/Away/Over/Under 等纯标签，盘口数值放 Handicap/Total。
	Selection         string // 服务端标准选项，web-api 会归一成 1/x/2/over/under 写入注单。
	Value             string // 十进制赔率字符串，下注校验要求客户端传入值和这里一致。
	MarketDescription string // 盘口分组标题，用于市场接口展示和下注校验归一化。
	Handicap          string // 让球线；只有 market_id=6 时使用。
	Total             string // 大小球线；只有 market_id=7 时使用。
}

// mockUCLOdds 固定覆盖 1x2、让球和大小球三个市场，避免体验盘依赖第三方赔率采集。
var mockUCLOdds = []mockUCLOddSeed{
	{OddID: 9920000101, MarketID: 1, Label: "Home", Selection: "Home", Value: "2.10", MarketDescription: "Fulltime Result"},
	{OddID: 9920000102, MarketID: 1, Label: "Draw", Selection: "Draw", Value: "3.40", MarketDescription: "Fulltime Result"},
	{OddID: 9920000103, MarketID: 1, Label: "Away", Selection: "Away", Value: "3.20", MarketDescription: "Fulltime Result"},
	{OddID: 9920000104, MarketID: 6, Label: "Home", Selection: "Home", Value: "1.95", MarketDescription: "Asian Handicap", Handicap: "-0.5"},
	{OddID: 9920000105, MarketID: 6, Label: "Away", Selection: "Away", Value: "1.85", MarketDescription: "Asian Handicap", Handicap: "0.5"},
	{OddID: 9920000106, MarketID: 6, Label: "Home", Selection: "Home", Value: "2.50", MarketDescription: "Asian Handicap", Handicap: "-1.0"},
	{OddID: 9920000107, MarketID: 6, Label: "Away", Selection: "Away", Value: "1.55", MarketDescription: "Asian Handicap", Handicap: "1.0"},
	{OddID: 9920000108, MarketID: 6, Label: "Home", Selection: "Home", Value: "3.10", MarketDescription: "Asian Handicap", Handicap: "-1.5"},
	{OddID: 9920000109, MarketID: 6, Label: "Away", Selection: "Away", Value: "1.35", MarketDescription: "Asian Handicap", Handicap: "1.5"},
	{OddID: 9920000110, MarketID: 7, Label: "Over", Selection: "Over", Value: "1.40", MarketDescription: "Asian Over/Under", Total: "1.5"},
	{OddID: 9920000111, MarketID: 7, Label: "Under", Selection: "Under", Value: "2.85", MarketDescription: "Asian Over/Under", Total: "1.5"},
	{OddID: 9920000112, MarketID: 7, Label: "Over", Selection: "Over", Value: "1.90", MarketDescription: "Asian Over/Under", Total: "2.5"},
	{OddID: 9920000113, MarketID: 7, Label: "Under", Selection: "Under", Value: "1.90", MarketDescription: "Asian Over/Under", Total: "2.5"},
	{OddID: 9920000114, MarketID: 7, Label: "Over", Selection: "Over", Value: "2.70", MarketDescription: "Asian Over/Under", Total: "3.5"},
	{OddID: 9920000115, MarketID: 7, Label: "Under", Selection: "Under", Value: "1.45", MarketDescription: "Asian Over/Under", Total: "3.5"},
}

// StartMockUCLLoop 启动 5 分钟一轮的欧冠 mock 赛事；默认关闭，只有配置显式 enabled 才会触发写库和结算。
func (w *SettleWorker) StartMockUCLLoop(ctx context.Context, cfg config.MockUCLConfig) {
	// 先把配置归一化，避免配置缺省或错误时每个 tick 都重复做兜底判断。
	runtimeCfg := normalizeMockUCLConfig(cfg)
	if !runtimeCfg.enabled {
		return
	}
	if w.DB == nil {
		// DB 为空时直接跳过，避免后台 goroutine panic 后影响普通结算 worker。
		log.Println("[mock_ucl] DB 为空，mock 赛事循环未启动")
		return
	}

	log.Printf("[mock_ucl] started fixture_id=%d period=%ds open=%ds", runtimeCfg.fixtureID, runtimeCfg.periodSec, runtimeCfg.betOpenSec)
	// 启动后立即推进一次，避免进程刚发布时要等一个 poll 周期前端才看到 mock 数据。
	w.runMockUCLTick(runtimeCfg)

	ticker := time.NewTicker(mockUCLPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			// 退出信号来自主进程，及时停止 ticker，避免服务关闭时继续持有数据库连接。
			return
		case <-ticker.C:
			w.runMockUCLTick(runtimeCfg)
		}
	}
}

// normalizeMockUCLConfig 统一处理配置缺省和非法窗口；这样线上只改配置也不会把开盘窗口配成不可结算状态。
func normalizeMockUCLConfig(cfg config.MockUCLConfig) mockUCLRuntimeConfig {
	fixtureID := cfg.FixtureID
	if fixtureID <= 0 {
		// fixture_id 非法时使用固定默认值，避免写入 0 号赛事污染真实表。
		fixtureID = defaultMockUCLFixtureID
	}
	periodSec := cfg.PeriodSec
	if periodSec <= 0 {
		// 周期缺省时回落到产品要求的 5 分钟。
		periodSec = defaultMockUCLPeriodSec
	}
	betOpenSec := cfg.BetOpenSec
	if betOpenSec <= 0 || betOpenSec >= periodSec {
		// 开盘窗口必须短于完整周期，留出封盘到结算的缓冲，防止最后一秒下注和结算事务抢同一批赔率行。
		betOpenSec = defaultMockUCLBetOpenSec
		if betOpenSec >= periodSec {
			betOpenSec = periodSec - 60
		}
		if betOpenSec <= 0 {
			betOpenSec = periodSec / 2
		}
	}
	lockName := cfg.LockName
	if lockName == "" {
		// 锁名必须稳定；空锁名会让不同实例无法互斥推进同一个 mock 盘。
		lockName = defaultMockUCLLockName
	}
	return mockUCLRuntimeConfig{
		enabled:    cfg.Enabled,
		fixtureID:  fixtureID,
		periodSec:  periodSec,
		betOpenSec: betOpenSec,
		lockName:   lockName,
	}
}

// runMockUCLTick 推进一次 mock 盘状态机；所有写库动作都放进 DB 锁保护下，避免多实例重复开盘或重复结算。
func (w *SettleWorker) runMockUCLTick(cfg mockUCLRuntimeConfig) {
	if err := w.withMockUCLLock(cfg, func(tx *gorm.DB) error {
		// 截断到秒可以让 DB 展示、接口倒计时和日志更稳定，不受纳秒级差异影响。
		now := w.now().Truncate(time.Second)
		if err := w.ensureMockUCLRowsTx(tx, cfg, now); err != nil {
			return err
		}

		// 锁住 fixture 行后再计算阶段，防止同一轮中其它实例或人工脚本同时改 starting_at。
		fixture, err := w.lockMockUCLFixtureTx(tx, cfg.fixtureID)
		if err != nil {
			return err
		}
		closeAt := fixture.StartingAt
		if closeAt.IsZero() {
			// 历史脏数据可能没有封盘时间；这里直接补成当前轮开盘窗口，避免状态机停住。
			closeAt = now.Add(time.Duration(cfg.betOpenSec) * time.Second)
		}

		settleAt := closeAt.Add(time.Duration(cfg.periodSec-cfg.betOpenSec) * time.Second)
		switch {
		case now.Before(closeAt):
			// 开盘期允许下注，同时保持赛果为 NS/PENDING，避免普通结算 worker 提前处理新单。
			return w.markMockUCLOpenTx(tx, cfg, closeAt, now)
		case now.Before(settleAt):
			// 封盘期只停止赔率，不结算注单；这个缓冲期用于阻断最后一秒下注和结算并发。
			return w.markMockUCLSealedTx(tx, cfg, closeAt, now)
		default:
			// 到达结算点后先生成本轮比分，再结算老注单，最后开启下一轮。
			score := randomMockUCLScore()
			if err := w.finishMockUCLRoundTx(tx, cfg, score, closeAt, now); err != nil {
				return err
			}
			return w.openNextMockUCLRoundTx(tx, cfg, score, now)
		}
	}); err != nil {
		log.Printf("[mock_ucl] tick failed fixture_id=%d: %v", cfg.fixtureID, err)
	}
}

// withMockUCLLock 使用 MySQL GET_LOCK 做跨进程互斥；这是最小改动方案，不需要引入 Redis 或新锁表。
func (w *SettleWorker) withMockUCLLock(cfg mockUCLRuntimeConfig, fn func(tx *gorm.DB) error) error {
	return w.DB.Transaction(func(tx *gorm.DB) error {
		var gotLock int
		// GET_LOCK 是连接级锁；放在同一个 GORM 事务里可以保证获取、推进、释放都使用同一条连接。
		if err := tx.Raw("SELECT GET_LOCK(?, 0)", cfg.lockName).Scan(&gotLock).Error; err != nil {
			return err
		}
		if gotLock != 1 {
			// 多实例部署时只有拿到 DB 锁的 worker 能推进轮次；未拿锁实例静默跳过，避免重复生成比分。
			return nil
		}
		defer func() {
			// 释放失败只打日志：事务结束时连接关闭或复用也会释放锁，不能因为释放日志覆盖真实业务错误。
			if err := tx.Exec("SELECT RELEASE_LOCK(?)", cfg.lockName).Error; err != nil {
				log.Printf("[mock_ucl] release lock failed lock=%s err=%v", cfg.lockName, err)
			}
		}()
		return fn(tx)
	})
}

// ensureMockUCLRowsTx 幂等补齐 fixture/result/odds 基础行；这样本地或预发漏跑 seed 时 worker 也能自愈。
func (w *SettleWorker) ensureMockUCLRowsTx(tx *gorm.DB, cfg mockUCLRuntimeConfig, now time.Time) error {
	// 新建基础数据时按“当前时间 + 开盘窗口”初始化封盘点，避免刚创建就立刻结算。
	closeAt := now.Add(time.Duration(cfg.betOpenSec) * time.Second)
	fixture := model.FixtureDB{
		ID:                  cfg.fixtureID,
		LeagueID:            MockUCLLeagueID,
		Name:                MockUCLFixtureName,
		StartingAt:          closeAt,
		StartingAtTimestamp: closeAt.Unix(),
		StateID:             1,
		StageID:             MockUCLStageID,
		SeasonID:            MockUCLSeasonID,
		HomeTeamID:          MockUCLHomeTeamID,
		HomeTeamName:        "葡萄牙",
		HomeTeamLogo:        MockUCLHomeTeamLogo,
		HomeTeamCountryID:   20,
		HomeType:            "team",
		HomeTeamShortCode:   "POR",
		AwayTeamID:          MockUCLAwayTeamID,
		AwayTeamName:        "阿根廷",
		AwayTeamLogo:        MockUCLAwayTeamLogo,
		AwayTeamCountryID:   44,
		AwayType:            "team",
		AwayTeamShortCode:   "ARG",
		HasOdds:             true,
	}
	// 已存在的 mock fixture 不能重置 starting_at/state_id，否则会打断当前 5 分钟状态机；这里只修复名称、队徽等静态展示字段。
	if err := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"league_id":            fixture.LeagueID,
			"name":                 fixture.Name,
			"stage_id":             fixture.StageID,
			"season_id":            fixture.SeasonID,
			"home_team_id":         fixture.HomeTeamID,
			"home_team_name":       fixture.HomeTeamName,
			"home_team_logo":       fixture.HomeTeamLogo,
			"home_team_country_id": fixture.HomeTeamCountryID,
			"home_type":            fixture.HomeType,
			"home_team_short_code": fixture.HomeTeamShortCode,
			"away_team_id":         fixture.AwayTeamID,
			"away_team_name":       fixture.AwayTeamName,
			"away_team_logo":       fixture.AwayTeamLogo,
			"away_team_country_id": fixture.AwayTeamCountryID,
			"away_type":            fixture.AwayType,
			"away_team_short_code": fixture.AwayTeamShortCode,
			"has_odds":             fixture.HasOdds,
		}),
	}).Create(&fixture).Error; err != nil {
		return err
	}

	// 初始赛果必须是 NS/PENDING；普通结算 worker 只会在终局状态处理注单，避免刚开盘就误结算。
	result := model.FixtureResult{
		FixtureID:        cfg.fixtureID,
		StateID:          1,
		StateCode:        "NS",
		StateName:        "Not Started",
		RawScoreData:     "[]",
		SettlementStatus: "PENDING",
		Remark:           fmt.Sprintf(`{"activity_id":"%s"}`, MockUCLActivityID),
	}
	// raw_state_data 在历史库里曾出现过命名差异，mock 结算只依赖 raw_score_data，因此建初始行时避开该列提升灰度兼容性。
	if err := tx.Omit("RawStateData").Clauses(clause.OnConflict{DoNothing: true}).Create(&result).Error; err != nil {
		return err
	}

	for _, seed := range mockUCLOdds {
		// 赔率行已存在时只修复 SportMonks 兼容的静态元数据，不碰赔率值和 stopped，避免影响当前轮下注窗口。
		odd := model.OddDB{
			OddID:             seed.OddID,
			FixtureID:         cfg.fixtureID,
			MarketID:          seed.MarketID,
			BookmakerID:       MockUCLBookmakerID,
			Label:             seed.Label,
			FixtureName:       MockUCLFixtureName,
			FixtureTime:       closeAt.Format(time.DateTime),
			Value:             seed.Value,
			MarketDescription: seed.MarketDescription,
			Handicap:          seed.Handicap,
			Total:             seed.Total,
			Winning:           false,
			Stopped:           false,
			Selection:         seed.Selection,
			UpdatedAt:         now.UnixMilli(),
		}
		// 盘口 label 必须保持 SportMonks 兼容格式；这里冲突时只修复静态元数据，不覆盖 value/stopped，避免重启 worker 干扰当前开封盘状态。
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "odd_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"fixture_id":         odd.FixtureID,
				"market_id":          odd.MarketID,
				"bookmaker_id":       odd.BookmakerID,
				"label":              odd.Label,
				"fixture_name":       odd.FixtureName,
				"market_description": odd.MarketDescription,
				"handicap":           odd.Handicap,
				"total":              odd.Total,
				"selection":          odd.Selection,
			}),
		}).Create(&odd).Error; err != nil {
			return err
		}
	}
	return nil
}

// lockMockUCLFixtureTx 锁住 mock fixture 行后再计算阶段，确保同一轮状态推进有单一时间基准。
func (w *SettleWorker) lockMockUCLFixtureTx(tx *gorm.DB, fixtureID int64) (model.FixtureDB, error) {
	var fixture model.FixtureDB
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", fixtureID).
		First(&fixture).Error
	if err != nil {
		return model.FixtureDB{}, err
	}
	return fixture, nil
}

// markMockUCLOpenTx 把赛事恢复到可下注状态；每轮重开都要清空上一轮赛果，避免普通结算 worker 误处理新注单。
func (w *SettleWorker) markMockUCLOpenTx(tx *gorm.DB, cfg mockUCLRuntimeConfig, closeAt time.Time, now time.Time) error {
	// fixture.starting_at 在 mock 盘里表示本轮封盘时间，web-api 和 web-api 下注校验都会复用这个时间判断是否可下注。
	if err := tx.Model(&model.FixtureDB{}).
		Where("id = ?", cfg.fixtureID).
		Updates(map[string]interface{}{
			"state_id":              1,
			"starting_at":           closeAt,
			"starting_at_timestamp": closeAt.Unix(),
			"home_team_meta_winner": false,
			"away_team_meta_winner": false,
			"has_odds":              true,
			"updated_at":            now,
		}).Error; err != nil {
		return err
	}
	// 赛果恢复为 NS/PENDING 是关键：下一轮开盘时旧比分只能留在 remark，不能留在可结算字段里。
	if err := tx.Model(&model.FixtureResult{}).
		Where("fixture_id = ?", cfg.fixtureID).
		Updates(map[string]interface{}{
			"state_id":          1,
			"state_code":        "NS",
			"state_name":        "Not Started",
			"home_score_full":   0,
			"away_score_full":   0,
			"raw_score_data":    "[]",
			"settlement_status": "PENDING",
			"updated_at":        now,
		}).Error; err != nil {
		return err
	}
	return w.updateMockUCLOddsTx(tx, cfg, closeAt, false, now)
}

// markMockUCLSealedTx 进入封盘期，只停止赔率，不改变注单状态；资金处理必须等结算点统一完成。
func (w *SettleWorker) markMockUCLSealedTx(tx *gorm.DB, cfg mockUCLRuntimeConfig, closeAt time.Time, now time.Time) error {
	// 封盘阶段只停赔率，不改注单；已经成功创建的注单仍保持 live，等本轮结算时统一进入 claimable。
	return w.updateMockUCLOddsTx(tx, cfg, closeAt, true, now)
}

// finishMockUCLRoundTx 完成本轮 mock 结算；它必须和下一轮开盘在同一外层事务里执行，避免前端看到半结算状态。
func (w *SettleWorker) finishMockUCLRoundTx(tx *gorm.DB, cfg mockUCLRuntimeConfig, score service.Score, closeAt time.Time, now time.Time) error {
	rawScoreData, err := marshalMockUCLScore(score)
	if err != nil {
		// raw_score_data 生成失败时不能继续结算，否则普通赛果解析和展示会失去可对账依据。
		return err
	}
	homeWinner := score.Home > score.Away
	awayWinner := score.Away > score.Home

	// 先把 fixture 切到 FT，便于本事务内的结算日志和后续排查能看到本轮终局状态。
	if err := tx.Model(&model.FixtureDB{}).
		Where("id = ?", cfg.fixtureID).
		Updates(map[string]interface{}{
			"state_id":              model.StateIDFT,
			"starting_at":           closeAt,
			"starting_at_timestamp": closeAt.Unix(),
			"home_team_meta_winner": homeWinner,
			"away_team_meta_winner": awayWinner,
			"updated_at":            now,
		}).Error; err != nil {
		return err
	}
	// 赛果快照按真实 spider 结构写入，保证 mock 与真实赛事走同一套 JudgeBet/ExtractFinalScore 链路。
	if err := tx.Model(&model.FixtureResult{}).
		Where("fixture_id = ?", cfg.fixtureID).
		Updates(map[string]interface{}{
			"state_id":          model.StateIDFT,
			"state_code":        "FT",
			"state_name":        "Fulltime",
			"home_score_full":   score.Home,
			"away_score_full":   score.Away,
			"raw_score_data":    rawScoreData,
			"settlement_status": "PROCESSING",
			"remark":            fmt.Sprintf(`{"activity_id":"%s","round_close_at":"%s"}`, MockUCLActivityID, closeAt.Format(time.RFC3339)),
			"updated_at":        now,
		}).Error; err != nil {
		return err
	}

	if err := w.updateMockUCLOddsTx(tx, cfg, closeAt, true, now); err != nil {
		return err
	}
	// 复用真实结算事务内逻辑，避免 mock 盘写一套独立资金落账代码造成账务语义分叉。
	if err := w.settleMatchTx(tx, uint64(cfg.fixtureID), score); err != nil {
		return err
	}
	// 记录 PROCESSED 和 last_score 方便运营核验；随后外层会马上打开下一轮并重置赛果为 NS/PENDING。
	if err := tx.Model(&model.FixtureResult{}).
		Where("fixture_id = ?", cfg.fixtureID).
		Updates(map[string]interface{}{
			"settlement_status": "PROCESSED",
			"remark":            fmt.Sprintf(`{"activity_id":"%s","last_score":"%d-%d","round_close_at":"%s"}`, MockUCLActivityID, score.Home, score.Away, closeAt.Format(time.RFC3339)),
			"updated_at":        now,
		}).Error; err != nil {
		return err
	}

	log.Printf("[mock_ucl] settled fixture_id=%d score=%d-%d", cfg.fixtureID, score.Home, score.Away)
	return nil
}

// openNextMockUCLRoundTx 在本轮结算完成后立即开启下一轮；这样用户不用等待额外调度周期才能继续体验下注。
func (w *SettleWorker) openNextMockUCLRoundTx(tx *gorm.DB, cfg mockUCLRuntimeConfig, lastScore service.Score, now time.Time) error {
	// 下一轮封盘时间从当前事务时间开始计算，避免因为上一轮 worker 延迟导致周期持续漂移。
	nextCloseAt := now.Add(time.Duration(cfg.betOpenSec) * time.Second)
	if err := tx.Model(&model.FixtureDB{}).
		Where("id = ?", cfg.fixtureID).
		Updates(map[string]interface{}{
			"state_id":              1,
			"starting_at":           nextCloseAt,
			"starting_at_timestamp": nextCloseAt.Unix(),
			"home_team_meta_winner": false,
			"away_team_meta_winner": false,
			"has_odds":              true,
			"updated_at":            now,
		}).Error; err != nil {
		return err
	}
	// 重置为 NS/PENDING 是为了让下一轮新注单不会被普通轮询结算 worker 当作上一轮 FT 赛果处理。
	if err := tx.Model(&model.FixtureResult{}).
		Where("fixture_id = ?", cfg.fixtureID).
		Updates(map[string]interface{}{
			"state_id":          1,
			"state_code":        "NS",
			"state_name":        "Not Started",
			"home_score_full":   0,
			"away_score_full":   0,
			"raw_score_data":    "[]",
			"settlement_status": "PENDING",
			"remark":            fmt.Sprintf(`{"activity_id":"%s","last_score":"%d-%d"}`, MockUCLActivityID, lastScore.Home, lastScore.Away),
			"updated_at":        now,
		}).Error; err != nil {
		return err
	}
	return w.updateMockUCLOddsTx(tx, cfg, nextCloseAt, false, now)
}

// updateMockUCLOddsTx 统一更新盘口开停盘状态；下注 API 会锁 odd 行并读取 stopped，前端和后端才能保持一致。
func (w *SettleWorker) updateMockUCLOddsTx(tx *gorm.DB, cfg mockUCLRuntimeConfig, closeAt time.Time, stopped bool, now time.Time) error {
	updated := tx.Model(&model.OddDB{}).
		Where("fixture_id = ?", cfg.fixtureID).
		Updates(map[string]interface{}{
			"fixture_time": closeAt.Format(time.DateTime),
			"stopped":      stopped,
			"winning":      false,
			"updated_at":   now.UnixMilli(),
		})
	if updated.Error != nil {
		return updated.Error
	}
	if updated.RowsAffected == 0 {
		// 如果赔率行被人工清空，下一轮不能继续开盘，否则前端会展示无盘口赛事。
		return errors.New("MOCK_UCL_ODDS_MISSING")
	}
	return nil
}

// randomMockUCLScore 生成 0-4 的随机比分，严格按 PRD 使用 rand.Intn(5)，避免引入复杂赛果模型。
func randomMockUCLScore() service.Score {
	return service.Score{
		Home: rand.Intn(5),
		Away: rand.Intn(5),
	}
}

// marshalMockUCLScore 生成与真实 spider raw_score_data 兼容的 JSON，确保 mock 赛事不需要额外结算分支。
func marshalMockUCLScore(score service.Score) (string, error) {
	// raw_score_data 复用真实 spider 的 scores 结构，保证 mock 赛事和真实赛事走同一套 ExtractFinalScore 逻辑。
	payload := []map[string]interface{}{
		{
			"description": "CURRENT",
			"participant": "home",
			"score": map[string]interface{}{
				"goals":       score.Home,
				"participant": "home",
			},
		},
		{
			"description": "CURRENT",
			"participant": "away",
			"score": map[string]interface{}{
				"goals":       score.Away,
				"participant": "away",
			},
		},
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
