package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"oddfi-bet-settle/config"
	"oddfi-bet-settle/internal/model"
	"oddfi-bet-settle/internal/service"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// unsettledBetStatuses 定义 worker 可处理的未结算注单状态，避免重复结算已落账注单。
var unsettledBetStatuses = []string{
	model.StatusPending,
	model.StatusLive,
}

// SettlementPollInterval 是结算 worker 的唯一轮询间隔来源，避免启动日志和实际 ticker 配置漂移。
const SettlementPollInterval time.Duration = 30 * time.Second

// SettleWorker 只消费 spider 已经落库的 FixtureDB / FixtureResult，不再直接请求 SportMonks。
type SettleWorker struct {
	DB               *gorm.DB
	Now              func() time.Time
	SettlementUserID uint64
}

// settlementCandidate 是本轮需要检查的赛事快照；来源是未结注单、赔率快照和 FixtureResult 的关联结果。
type settlementCandidate struct {
	MatchID          uint64    `gorm:"column:match_id"`
	StateID          int       `gorm:"column:state_id"`
	StateCode        string    `gorm:"column:state_code"`
	StateName        string    `gorm:"column:state_name"`
	HomeScoreFull    int       `gorm:"column:home_score_full"`
	AwayScoreFull    int       `gorm:"column:away_score_full"`
	RawScoreData     string    `gorm:"column:raw_score_data"`
	SettlementStatus string    `gorm:"column:settlement_status"`
	UpdatedAt        time.Time `gorm:"column:updated_at"`
}

// NewSettleWorker 创建结算 worker；真实赛果来源已经切到数据库，配置里的 user_id 可用于线上单用户灰度结算。
func NewSettleWorker(db *gorm.DB, cfg *config.Config) *SettleWorker {
	userID := uint64(0)
	if cfg != nil {
		userID = cfg.Settlement.UserID
	}

	w := &SettleWorker{
		DB:               db,
		Now:              time.Now,
		SettlementUserID: userID,
	}
	if userID > 0 {
		// 线上临时灰度时只处理指定测试用户，避免历史脏注单或其他真实用户资金被本轮验证误触发。
		log.Printf("[settlement] scoped to user_id=%d", userID)
	}
	return w
}

// StartPolling 启动轮询。多实例部署时必须在外层接 Redis setnx / DB advisory lock。
func (w *SettleWorker) StartPolling(ctx context.Context) {
	ticker := time.NewTicker(SettlementPollInterval)
	defer ticker.Stop()

	// 启动后先立即轮询一次，避免刚启动时错过已经完成的赛事结算窗口。
	w.pollAndSettle()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.pollAndSettle()
		}
	}
}

// settleMatch 处理正常完赛赛事：锁定同场未结注单，逐笔判定并落账到 claimable。
func (w *SettleWorker) settleMatch(matchID uint64, finalScore service.Score) error {
	err := w.DB.Transaction(func(tx *gorm.DB) error {
		return w.settleMatchTx(tx, matchID, finalScore)
	})
	if err != nil {
		log.Printf("[ERROR] 比赛结算事务回滚 match_id=%d score=%d-%d: %v", matchID, finalScore.Home, finalScore.Away, err)
		return err
	}
	log.Printf("[settleMatch] succ 比赛 %d 完成结算", matchID)
	return nil
}

// settleMatchTx 在调用方已开启的事务内完成单场结算；mock 赛事需要把“封盘、结算、开下一轮”放进同一事务，避免半状态暴露。
func (w *SettleWorker) settleMatchTx(tx *gorm.DB, matchID uint64, finalScore service.Score) error {
	bets, err := w.lockUnsettledBets(tx, matchID)
	if err != nil {
		log.Printf("[ERROR] 锁定待结算注单失败 match_id=%d: %v", matchID, err)
		return err
	}

	now := w.now()
	for _, bet := range bets {
		result := service.JudgeBet(bet, finalScore)
		if err := w.persistBetSettlement(tx, bet, result, now); err != nil {
			log.Printf("[ERROR] 注单结算落库失败 match_id=%d bet_id=%d status=%s payout=%s: %v",
				matchID, bet.ID, result.Status, result.Payout.String(), err)
			return err
		}
	}
	return nil
}

// voidMatch 处理取消、弃权、中止等退款态：同场未结注单全部置为 VOID 并退还本金。
func (w *SettleWorker) voidMatch(matchID uint64) error {
	err := w.DB.Transaction(func(tx *gorm.DB) error {
		bets, err := w.lockUnsettledBets(tx, matchID)
		if err != nil {
			log.Printf("[ERROR] 锁定待退款注单失败 match_id=%d: %v", matchID, err)
			return err
		}

		now := w.now()
		for _, bet := range bets {
			result := service.BetResult{
				Status: model.StatusVoid,
				Payout: service.CalcPayout(
					bet.Stake,
					bet.Odds,
					model.StatusVoid,
				),
			}
			if err := w.persistBetSettlement(tx, bet, result, now); err != nil {
				log.Printf("[ERROR] VOID 注单退款落库失败 match_id=%d bet_id=%d payout=%s: %v",
					matchID, bet.ID, result.Payout.String(), err)
				return err
			}
		}
		return nil
	})
	if err != nil {
		log.Printf("[ERROR] 比赛 VOID 事务回滚 match_id=%d: %v", matchID, err)
		return err
	}
	log.Printf("[voidMatch] succ 比赛 %d 完成退款", matchID)
	return nil
}

// lockUnsettledBets 使用 odd_id 反查 fixture_id 后行锁读取同场未结注单，保证多 worker/重复轮询下不会重复入账。
func (w *SettleWorker) lockUnsettledBets(tx *gorm.DB, matchID uint64) ([]model.UserBetHolding, error) {
	var bets []model.UserBetHolding
	betTable := model.UserBetHolding{}.TableName()
	oddTable := model.OddDB{}.TableName()

	query := tx.Table(betTable+" AS b").
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("b.*").
		Joins("JOIN "+oddTable+" AS o ON o.odd_id = b.odd_id").
		Where("o.fixture_id = ? AND b.status IN ?", matchID, unsettledBetStatuses)
	if w.SettlementUserID > 0 {
		// 用户过滤必须放在锁单阶段；只过滤候选赛事不够，同一场 fixture 可能还有其他用户未结注单。
		query = query.Where("b.user_id = ?", w.SettlementUserID)
	}

	err := query.Find(&bets).Error
	if err != nil {
		log.Printf("[ERROR] 查询待结算注单失败 match_id=%d: %v", matchID, err)
	}
	return bets, err
}

// persistBetSettlement 先更新注单状态，再同步资金账户；RowsAffected=0 表示注单已被其他流程结算。
func (w *SettleWorker) persistBetSettlement(tx *gorm.DB, bet model.UserBetHolding, result service.BetResult, now time.Time) error {
	updated := tx.Model(&model.UserBetHolding{}).
		Where("id = ? AND status IN ?", bet.ID, unsettledBetStatuses).
		Updates(map[string]interface{}{
			"status":        result.Status,
			"actual_payout": result.Payout,
			"updated_at":    now,
		})
	if updated.Error != nil {
		log.Printf("[ERROR] 更新注单结算状态失败 bet_id=%d status=%s payout=%s: %v",
			bet.ID, result.Status, result.Payout.String(), updated.Error)
		return updated.Error
	}
	if updated.RowsAffected == 0 {
		// 幂等保护：注单已不是未结状态时，不再重复扣减 Bet 或增加 Claimable。
		return nil
	}

	return applySettlementBalance(tx, bet, result.Payout)
}

// applySettlementBalance 完成资金承接：Bet 锁定余额扣减，非 LOST 派彩进入 claimable。
func applySettlementBalance(tx *gorm.DB, bet model.UserBetHolding, payout decimal.Decimal) error {
	updates := map[string]interface{}{
		"bet_lock_balance": gorm.Expr("bet_lock_balance - ?", bet.Stake),
	}

	if payout.IsPositive() {
		updates["claimable_balance"] = gorm.Expr("claimable_balance + ?", payout)
	}

	balance, err := lockSettlementBalance(tx, bet)
	if err != nil {
		return err
	}

	updated := tx.Model(&model.UserBalance{}).
		Where("id = ? AND user_id = ? AND bet_lock_balance >= ?", balance.ID, bet.UserID, bet.Stake).
		Updates(updates)
	if updated.Error != nil {
		log.Printf("[ERROR] 更新用户余额失败 user_id=%d balance_id=%d bet_id=%d payout=%s: %v",
			bet.UserID, balance.ID, bet.ID, payout.String(), updated.Error)
		return updated.Error
	}
	if updated.RowsAffected == 0 {
		err := fmt.Errorf("balance update rejected for user_id=%d balance_id=%d bet_id=%d", bet.UserID, balance.ID, bet.ID)
		log.Printf("[ERROR] 用户余额更新被拒绝，通常是余额行不存在或 bet_lock 不足 user_id=%d balance_id=%d bet_id=%d stake=%s: %v",
			bet.UserID, balance.ID, bet.ID, bet.Stake.String(), err)
		return err
	}
	return nil
}

// lockSettlementBalance 在新持仓表不携带 coin_symbol 的前提下，为测试环境的一用户一币路径定位唯一余额行。
func lockSettlementBalance(tx *gorm.DB, bet model.UserBetHolding) (model.UserBalance, error) {
	var balances []model.UserBalance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("user_id = ? AND bet_lock_balance >= ?", bet.UserID, bet.Stake).
		Limit(2).
		Find(&balances).Error
	if err != nil {
		log.Printf("[ERROR] 锁定用户余额失败 user_id=%d bet_id=%d: %v", bet.UserID, bet.ID, err)
		return model.UserBalance{}, err
	}
	if len(balances) == 0 {
		err := fmt.Errorf("no balance row with enough bet_lock for user_id=%d bet_id=%d", bet.UserID, bet.ID)
		log.Printf("[ERROR] 用户余额不存在或 bet_lock 不足 user_id=%d bet_id=%d stake=%s: %v",
			bet.UserID, bet.ID, bet.Stake.String(), err)
		return model.UserBalance{}, err
	}
	if len(balances) > 1 {
		err := fmt.Errorf("multiple eligible balance rows for user_id=%d bet_id=%d; coin_symbol is unavailable on bet", bet.UserID, bet.ID)
		log.Printf("[ERROR] 新持仓表缺少币种且用户存在多条可扣余额，拒绝猜测扣款行 user_id=%d bet_id=%d: %v",
			bet.UserID, bet.ID, err)
		return model.UserBalance{}, err
	}
	return balances[0], nil
}

// getFinishedMatchesToSettle 兼容旧调用：只在 fixture_results 已落最终状态时返回可结算比分。
func (w *SettleWorker) getFinishedMatchesToSettle(fixtureID uint64) (*service.Score, bool) {
	candidate, found, err := w.loadCandidateByFixtureID(fixtureID)
	if err != nil {
		log.Printf("[ERROR] 查询赛果快照失败 fixture_id=%d: %v", fixtureID, err)
		return nil, false
	}
	if !found {
		return nil, false
	}

	score, err := scoreFromFixtureResult(candidate)
	if err != nil {
		log.Printf("[ERROR] 提取完赛比分失败 fixture_id=%d state_id=%d: %v", fixtureID, candidate.StateID, err)
		return nil, false
	}
	return &score, true
}

// pollAndSettle 查询存在未结注单的赛事，并按 FixtureResult.state_id 分派 settle/refund/hold。
func (w *SettleWorker) pollAndSettle() {
	if w.DB == nil {
		log.Println("[ERROR] 结算 worker DB 为空，跳过本轮轮询")
		return
	}

	candidates, err := w.loadSettlementCandidates()
	if err != nil {
		log.Printf("[ERROR] 查询待处理赛事快照失败: %v", err)
		return
	}

	log.Println("[pollAndSettle]待处理赛事数量:", len(candidates))

	for _, candidate := range candidates {
		rule := model.MatchStateFor(candidate.StateID)
		switch rule.Action {
		case model.MatchActionSettle:
			score, err := scoreFromFixtureResult(candidate)
			if err != nil {
				log.Printf("[ERROR] 提取结算比分失败 match_id=%d state_id=%d: %v", candidate.MatchID, candidate.StateID, err)
				w.updateFixtureSettlement(candidate.MatchID, "ERROR", err.Error())
				continue
			}
			w.updateFixtureSettlement(candidate.MatchID, "PROCESSING", "")
			if err := w.settleMatch(candidate.MatchID, score); err != nil {
				log.Printf("[ERROR] 正常完赛结算失败 match_id=%d: %v", candidate.MatchID, err)
				w.updateFixtureSettlement(candidate.MatchID, "ERROR", err.Error())
				continue
			}
			w.updateFixtureSettlement(candidate.MatchID, "PROCESSED", "")
		case model.MatchActionRefund:
			w.updateFixtureSettlement(candidate.MatchID, "PROCESSING", "")
			if err := w.voidMatch(candidate.MatchID); err != nil {
				log.Printf("[ERROR] 异常赛事退款失败 match_id=%d: %v", candidate.MatchID, err)
				w.updateFixtureSettlement(candidate.MatchID, "ERROR", err.Error())
				continue
			}
			w.updateFixtureSettlement(candidate.MatchID, "PROCESSED", "")
		case model.MatchActionNone:
			// 未开赛/进行中属于正常等待状态，不能当作异常打印 ERROR，否则 30 秒轮询会持续制造误报。
			continue
		case model.MatchActionHold:
			if rule.Code == "UNKNOWN" {
				// 未知第三方状态必须保守挂起，避免新增枚举被误判为可结算或可退款。
				log.Printf("[WARN] 未知赛事状态，暂缓结算 match_id=%d state_id=%d state_name=%s", candidate.MatchID, candidate.StateID, candidate.StateName)
			}
			continue
		default:
			log.Printf("[ERROR] 未知结算指令 match_id=%d state_id=%d state_name=%s", candidate.MatchID, candidate.StateID, candidate.StateName)
			continue
		}
	}
}

// loadSettlementCandidates 只读取“存在未结注单”的赛事，避免全表扫 FixtureResult。
func (w *SettleWorker) loadSettlementCandidates() ([]settlementCandidate, error) {
	var candidates []settlementCandidate
	betTable := model.UserBetHolding{}.TableName()
	oddTable := model.OddDB{}.TableName()
	resultTable := model.FixtureResult{}.TableName()

	query := w.DB.Table(betTable+" AS b").
		Select(`DISTINCT o.fixture_id AS match_id,
			fr.state_id,
			fr.state_code,
			fr.state_name,
			fr.home_score_full,
			fr.away_score_full,
			fr.raw_score_data,
			fr.settlement_status,
			fr.updated_at`).
		Joins("JOIN "+oddTable+" AS o ON o.odd_id = b.odd_id").
		Joins("JOIN "+resultTable+" AS fr ON fr.fixture_id = o.fixture_id").
		Where("b.status IN ?", unsettledBetStatuses)
	if w.SettlementUserID > 0 {
		// 候选阶段先缩小到指定测试用户，避免旧测试数据或其他用户注单把无关 fixture 拉入本轮结算。
		query = query.Where("b.user_id = ?", w.SettlementUserID)
	}

	err := query.Scan(&candidates).Error
	if err != nil {
		log.Printf("[ERROR] 读取待结算赛事快照失败: %v", err)
		return nil, err
	}
	return candidates, nil
}

// loadCandidateByFixtureID 读取单场赛果快照，兼容旧辅助函数和测试场景。
func (w *SettleWorker) loadCandidateByFixtureID(fixtureID uint64) (settlementCandidate, bool, error) {
	var candidate settlementCandidate
	err := w.DB.Model(&model.FixtureResult{}).
		Select("fixture_id AS match_id, state_id, state_code, state_name, home_score_full, away_score_full, raw_score_data, settlement_status, updated_at").
		Where("fixture_id = ?", int64(fixtureID)).
		First(&candidate).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return settlementCandidate{}, false, nil
		}
		log.Printf("[ERROR] 读取单场赛果快照失败 fixture_id=%d: %v", fixtureID, err)
		return settlementCandidate{}, false, err
	}
	return candidate, true, nil
}

// scoreFromFixtureResult 优先使用 raw_score_data 复算结算比分；缺失时再回退扁平化字段。
func scoreFromFixtureResult(candidate settlementCandidate) (service.Score, error) {
	if scores, hasScores, err := parseRawScores(candidate.RawScoreData); err != nil {
		log.Printf("[ERROR] 解析 raw_score_data 失败 match_id=%d state_id=%d: %v", candidate.MatchID, candidate.StateID, err)
		return service.Score{}, err
	} else if hasScores {
		score, err := service.ExtractFinalScore(candidate.StateID, scores)
		if err != nil {
			log.Printf("[ERROR] 使用 raw_score_data 提取结算比分失败 match_id=%d state_id=%d: %v", candidate.MatchID, candidate.StateID, err)
			return service.Score{}, err
		}
		return score, nil
	}

	if !model.IsSettleState(candidate.StateID) {
		err := fmt.Errorf("state_id %d does not allow settlement", candidate.StateID)
		log.Printf("[ERROR] 非结算态禁止提取比分 match_id=%d state_id=%d: %v", candidate.MatchID, candidate.StateID, err)
		return service.Score{}, err
	}
	return service.Score{
		Home: candidate.HomeScoreFull,
		Away: candidate.AwayScoreFull,
	}, nil
}

// parseRawScores 解析 spider 落库的原始比分 JSON；空串、null、[] 都视为“没有原始比分”而不是错误。
func parseRawScores(raw string) ([]service.SourceScore, bool, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "null" || trimmed == "[]" {
		return nil, false, nil
	}

	var scores []service.SourceScore
	if err := json.Unmarshal([]byte(trimmed), &scores); err != nil {
		log.Printf("[ERROR] 反序列化 raw_score_data 失败: %v", err)
		return nil, false, err
	}
	if len(scores) == 0 {
		return nil, false, nil
	}
	return scores, true, nil
}

// updateFixtureSettlement 更新赛果快照的结算机状态，方便接口和运营后台识别处理进度。
func (w *SettleWorker) updateFixtureSettlement(matchID uint64, status string, remark string) {
	if err := w.DB.Model(&model.FixtureResult{}).
		Where("fixture_id = ?", int64(matchID)).
		Updates(map[string]interface{}{
			"settlement_status": status,
			"remark":            remark,
			"updated_at":        w.now(),
		}).Error; err != nil {
		log.Printf("[ERROR] 更新赛果结算状态失败 match_id=%d status=%s: %v", matchID, status, err)
	}
}

// now 返回当前时间，测试时可通过注入 Now 固定时间。
func (w *SettleWorker) now() time.Time {
	if w.Now != nil {
		return w.Now()
	}
	return time.Now()
}
