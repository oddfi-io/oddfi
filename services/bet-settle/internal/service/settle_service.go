package service

import (
	"fmt"
	"log"
	"strings"

	"oddfi-bet-settle/internal/model"

	"github.com/shopspring/decimal"
)

// PushFeeRate 是走水手续费率；文档要求 PUSH 退还 90% 本金。
var PushFeeRate = decimal.RequireFromString("0.10")

// 结算状态常量对齐 model，测试和业务代码都从同一套枚举读取。
const (
	StatusWon  = model.StatusWon
	StatusLost = model.StatusLost
	StatusPush = model.StatusPush
	StatusVoid = model.StatusVoid
)

// Score 是结算用的 90 分钟比分快照。
type Score struct {
	Home int
	Away int
}

// SourceScore 是 SportMonks scores 数组的最小解析结构。
type SourceScore struct {
	Description string `json:"description"`
	Score       struct {
		Goals       int    `json:"goals"`
		Participant string `json:"participant"`
	} `json:"score"`
	Participant string `json:"participant"`
}

// BetResult 是单笔注单判定后的业务结果，包含状态和实际派彩金额。
type BetResult struct {
	Status string
	Payout decimal.Decimal
}

// JudgeBet 是九条玩法判定入口；未知玩法不判输，降级为 VOID 以保护资金安全。
func JudgeBet(bet model.UserBetHolding, score Score) BetResult {
	switch normalizeMarket(bet.Market) {
	case "1x2":
		return judge1x2(bet, score)
	case "handicap":
		return judgeHandicap(bet, score)
	case "overunder":
		return judgeOverUnder(bet, score)
	default:
		return resultFor(bet, model.StatusVoid)
	}
}

// CalcPayout 根据结算状态计算实际派彩，所有金额都必须使用 decimal。
func CalcPayout(stake decimal.Decimal, odds decimal.Decimal, status string) decimal.Decimal {
	switch status {
	case model.StatusWon:
		return stake.Mul(odds)
	case model.StatusPush:
		return stake.Mul(decimal.NewFromInt(1).Sub(PushFeeRate))
	case model.StatusVoid:
		return stake
	default:
		return decimal.Zero
	}
}

// ExtractFinalScore 按状态提取最终结算比分：FT 取 CURRENT，AET/FT_PEN 取 2ND_HALF。
func ExtractFinalScore(stateID int, scores []SourceScore) (Score, error) {
	if !model.IsSettleState(stateID) {
		err := fmt.Errorf("state_id %d does not allow settlement", stateID)
		log.Printf("[ERROR] 非结算态禁止提取比分 state_id=%d: %v", stateID, err)
		return Score{}, err
	}

	targetDescription := "CURRENT"
	if stateID == model.StateIDAET || stateID == model.StateIDFTPEN {
		targetDescription = "2ND_HALF"
	}

	var final Score
	foundHome := false
	foundAway := false
	for _, score := range scores {
		// 只读取目标 description，避免 AET/点球后的 CURRENT 污染常规盘口结算。
		if !strings.EqualFold(score.Description, targetDescription) {
			continue
		}

		// SportMonks 原始 scores 在不同采集版本里 participant 可能位于顶层，也可能位于 score 内；两种都兼容，避免真实赛果 JSON 被误判为比分缺失。
		switch normalizeParticipant(sourceScoreParticipant(score)) {
		case "home":
			final.Home = score.Score.Goals
			foundHome = true
		case "away":
			final.Away = score.Score.Goals
			foundAway = true
		}
	}

	if !foundHome || !foundAway {
		err := fmt.Errorf("missing %s score for state_id %d", targetDescription, stateID)
		log.Printf("[ERROR] 比分数据不完整 state_id=%d target_description=%s found_home=%t found_away=%t: %v",
			stateID, targetDescription, foundHome, foundAway, err)
		return Score{}, err
	}
	return final, nil
}

// ExtractScoreByDescription 从 SportMonks scores 中按 description 提取完整主客比分。
func ExtractScoreByDescription(scores []SourceScore, description string) (Score, bool) {
	var final Score
	foundHome := false
	foundAway := false
	for _, score := range scores {
		if !strings.EqualFold(score.Description, description) {
			continue
		}

		switch normalizeParticipant(sourceScoreParticipant(score)) {
		case "home":
			final.Home = score.Score.Goals
			foundHome = true
		case "away":
			final.Away = score.Score.Goals
			foundAway = true
		}
	}
	return final, foundHome && foundAway
}

// judge1x2 判定全场胜平负：1=主胜，X=平局，2=客胜。
func judge1x2(bet model.UserBetHolding, score Score) BetResult {
	switch normalizeLabel(bet.Label) {
	case "1":
		if score.Home > score.Away {
			return resultFor(bet, model.StatusWon)
		}
	case "x":
		if score.Home == score.Away {
			return resultFor(bet, model.StatusWon)
		}
	case "2":
		if score.Away > score.Home {
			return resultFor(bet, model.StatusWon)
		}
	default:
		return resultFor(bet, model.StatusVoid)
	}
	return resultFor(bet, model.StatusLost)
}

// judgeHandicap 判定让球盘；整数盘打平走 PUSH，半球盘不会走水。
func judgeHandicap(bet model.UserBetHolding, score Score) BetResult {
	var diff int
	switch normalizeLabel(bet.Label) {
	case "1":
		diff = score.Home - score.Away
	case "2":
		diff = score.Away - score.Home
	default:
		return resultFor(bet, model.StatusVoid)
	}

	// 以投注方视角计算差值，再加盘口线；大于 0 赢，等于 0 走水，小于 0 输。
	adjustedDiff := decimal.NewFromInt(int64(diff)).Add(bet.HandicapLine)
	switch adjustedDiff.Cmp(decimal.Zero) {
	case 1:
		return resultFor(bet, model.StatusWon)
	case 0:
		return resultFor(bet, model.StatusPush)
	default:
		return resultFor(bet, model.StatusLost)
	}
}

// judgeOverUnder 判定大小球；新持仓表用 Label 保存 over/under，半球线没有 PUSH，整数线当前按文档仍只分 WON/LOST。
func judgeOverUnder(bet model.UserBetHolding, score Score) BetResult {
	totalGoals := decimal.NewFromInt(int64(score.Home + score.Away))
	selection := normalizeSelection(bet.Label)

	switch selection {
	case "over":
		if totalGoals.GreaterThan(bet.HandicapLine) {
			return resultFor(bet, model.StatusWon)
		}
	case "under":
		if totalGoals.LessThan(bet.HandicapLine) {
			return resultFor(bet, model.StatusWon)
		}
	default:
		return resultFor(bet, model.StatusVoid)
	}
	return resultFor(bet, model.StatusLost)
}

// resultFor 将状态转换为完整派彩结果，避免每个玩法重复写派彩公式。
func resultFor(bet model.UserBetHolding, status string) BetResult {
	return BetResult{
		Status: status,
		Payout: CalcPayout(
			bet.Stake,
			bet.Odds,
			status,
		),
	}
}

// normalizeMarket 兼容当前文档和既有库里的玩法命名。
func normalizeMarket(market string) string {
	switch strings.ToLower(strings.TrimSpace(market)) {
	case "1x2", "fulltime_result", "full_time_result", "fulltime result":
		return "1x2"
	case "handicap", "asian_handicap", "asian handicap":
		return "handicap"
	case "overunder", "over_under", "asian_over_under", "asian over under", "total", "totals":
		return "overunder"
	default:
		return ""
	}
}

// normalizeLabel 清洗投注项标签，主要服务 1x2 和让球盘。
func normalizeLabel(label string) string {
	return strings.ToLower(strings.TrimSpace(label))
}

// normalizeSelection 清洗大小球方向，兼容英文和中文输入。
func normalizeSelection(selection string) string {
	switch strings.ToLower(strings.TrimSpace(selection)) {
	case "over", "o", "大":
		return "over"
	case "under", "u", "小":
		return "under"
	default:
		return ""
	}
}

// sourceScoreParticipant 兼容 raw_score_data 的两种 participant 位置，优先使用顶层以保持旧测试和旧数据语义不变。
func sourceScoreParticipant(score SourceScore) string {
	if strings.TrimSpace(score.Participant) != "" {
		return score.Participant
	}
	return score.Score.Participant
}

// normalizeParticipant 清洗 SportMonks 返回的主客队标识。
func normalizeParticipant(participant string) string {
	switch strings.ToLower(strings.TrimSpace(participant)) {
	case "home", "localteam", "local":
		return "home"
	case "away", "visitorteam", "visitor":
		return "away"
	default:
		return ""
	}
}
