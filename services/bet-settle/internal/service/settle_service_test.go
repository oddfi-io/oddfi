package service

import (
	"fmt"
	"testing"

	"oddfi-bet-settle/internal/model"

	"github.com/shopspring/decimal"
)

// TestJudgeBet_PRD24Cases 严格覆盖 prd.md 中的 24 条判定用例，作为结算规则回归测试的主入口。
func TestJudgeBet_PRD24Cases(t *testing.T) {
	tests := []struct {
		id         int
		name       string
		market     string
		label      string
		line       string
		score      Score
		wantStatus string
		wantPayout decimal.Decimal
	}{
		{1, "1x2 客胜命中", "1x2", "2", "0", Score{Home: 1, Away: 2}, StatusWon, d("200")},
		{2, "1x2 客胜未命中", "1x2", "2", "0", Score{Home: 2, Away: 1}, StatusLost, d("0")},
		{3, "让球 -0.5 命中", "handicap", "2", "-0.5", Score{Home: 1, Away: 2}, StatusWon, d("200")},
		{4, "让球 -0.5 未命中", "handicap", "2", "-0.5", Score{Home: 2, Away: 2}, StatusLost, d("0")},
		{5, "让球 -1 命中", "handicap", "2", "-1", Score{Home: 0, Away: 2}, StatusWon, d("200")},
		{6, "让球 -1 走水", "handicap", "2", "-1", Score{Home: 1, Away: 2}, StatusPush, d("90")},
		{7, "让球 -1 未命中", "handicap", "2", "-1", Score{Home: 2, Away: 2}, StatusLost, d("0")},
		{8, "让球 -1.5 命中", "handicap", "2", "-1.5", Score{Home: 0, Away: 2}, StatusWon, d("200")},
		{9, "让球 -1.5 未命中", "handicap", "2", "-1.5", Score{Home: 1, Away: 2}, StatusLost, d("0")},
		{10, "1x2 主胜命中", "1x2", "1", "0", Score{Home: 2, Away: 1}, StatusWon, d("200")},
		{11, "1x2 主胜未命中", "1x2", "1", "0", Score{Home: 1, Away: 2}, StatusLost, d("0")},
		{12, "让球 -0.5 命中", "handicap", "1", "-0.5", Score{Home: 2, Away: 1}, StatusWon, d("200")},
		{13, "让球 -0.5 未命中", "handicap", "1", "-0.5", Score{Home: 2, Away: 2}, StatusLost, d("0")},
		{14, "让球 -1 命中", "handicap", "1", "-1", Score{Home: 2, Away: 0}, StatusWon, d("200")},
		{15, "让球 -1 走水", "handicap", "1", "-1", Score{Home: 2, Away: 1}, StatusPush, d("90")},
		{16, "让球 -1 未命中", "handicap", "1", "-1", Score{Home: 2, Away: 2}, StatusLost, d("0")},
		{17, "让球 -1.5 命中", "handicap", "1", "-1.5", Score{Home: 2, Away: 0}, StatusWon, d("200")},
		{18, "让球 -1.5 未命中", "handicap", "1", "-1.5", Score{Home: 2, Away: 1}, StatusLost, d("0")},
		{19, "大 1.5 命中", "overunder", "over", "1.5", Score{Home: 1, Away: 1}, StatusWon, d("200")},
		{20, "大 1.5 未命中", "overunder", "over", "1.5", Score{Home: 0, Away: 1}, StatusLost, d("0")},
		{21, "小 2.5 命中", "overunder", "under", "2.5", Score{Home: 1, Away: 1}, StatusWon, d("200")},
		{22, "小 2.5 未命中", "overunder", "under", "2.5", Score{Home: 2, Away: 1}, StatusLost, d("0")},
		{23, "大 3.5 命中", "overunder", "over", "3.5", Score{Home: 2, Away: 2}, StatusWon, d("200")},
		{24, "大 3.5 未命中", "overunder", "over", "3.5", Score{Home: 1, Away: 2}, StatusLost, d("0")},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%02d_%s", tt.id, tt.name), func(t *testing.T) {
			got := JudgeBet(bet(tt.market, tt.label, tt.line, "100", "2.0"), tt.score)
			if got.Status != tt.wantStatus {
				t.Fatalf("status: got %s, want %s", got.Status, tt.wantStatus)
			}
			if !got.Payout.Equal(tt.wantPayout) {
				t.Fatalf("payout: got %s, want %s", got.Payout.StringFixed(2), tt.wantPayout.StringFixed(2))
			}
		})
	}
}

// TestJudgeBet_AwayLabel 覆盖客队视角下的 1x2 和让球盘判定。
func TestJudgeBet_AwayLabel(t *testing.T) {
	tests := []struct {
		name       string
		bet        model.UserBetHolding
		score      Score
		wantStatus string
		wantPayout decimal.Decimal
	}{
		{"1x2 客胜命中", bet("1x2", "2", "0", "100", "2.0"), Score{1, 2}, StatusWon, d("200")},
		{"1x2 客胜未命中", bet("1x2", "2", "0", "100", "2.0"), Score{2, 1}, StatusLost, d("0")},
		{"让球 -0.5 命中", bet("handicap", "2", "-0.5", "100", "1.9"), Score{1, 2}, StatusWon, d("190")},
		{"让球 -0.5 未命中", bet("handicap", "2", "-0.5", "100", "1.9"), Score{2, 2}, StatusLost, d("0")},
		{"让球 -1 命中", bet("handicap", "2", "-1", "100", "2.1"), Score{0, 2}, StatusWon, d("210")},
		{"让球 -1 走水", bet("handicap", "2", "-1", "100", "2.1"), Score{1, 2}, StatusPush, d("90")},
		{"让球 -1 未命中", bet("handicap", "2", "-1", "100", "2.1"), Score{2, 2}, StatusLost, d("0")},
		{"让球 -1.5 命中", bet("handicap", "2", "-1.5", "100", "2.5"), Score{0, 2}, StatusWon, d("250")},
		{"让球 -1.5 未命中", bet("handicap", "2", "-1.5", "100", "2.5"), Score{1, 2}, StatusLost, d("0")},
	}

	assertJudgeBet(t, tests)
}

// TestJudgeBet_HomeLabel 覆盖主队视角下的 1x2、平局和让球盘判定。
func TestJudgeBet_HomeLabel(t *testing.T) {
	tests := []struct {
		name       string
		bet        model.UserBetHolding
		score      Score
		wantStatus string
		wantPayout decimal.Decimal
	}{
		{"1x2 主胜命中", bet("1x2", "1", "0", "100", "2.0"), Score{2, 1}, StatusWon, d("200")},
		{"1x2 主胜未命中", bet("1x2", "1", "0", "100", "2.0"), Score{1, 2}, StatusLost, d("0")},
		{"1x2 平局命中", bet("1x2", "X", "0", "100", "3.2"), Score{1, 1}, StatusWon, d("320")},
		{"1x2 平局未命中", bet("1x2", "X", "0", "100", "3.2"), Score{2, 1}, StatusLost, d("0")},
		{"让球 -0.5 命中", bet("handicap", "1", "-0.5", "100", "1.9"), Score{2, 1}, StatusWon, d("190")},
		{"让球 -0.5 未命中", bet("handicap", "1", "-0.5", "100", "1.9"), Score{2, 2}, StatusLost, d("0")},
		{"让球 -1 命中", bet("handicap", "1", "-1", "100", "2.1"), Score{2, 0}, StatusWon, d("210")},
		{"让球 -1 走水", bet("handicap", "1", "-1", "100", "2.1"), Score{2, 1}, StatusPush, d("90")},
		{"让球 -1 未命中", bet("handicap", "1", "-1", "100", "2.1"), Score{2, 2}, StatusLost, d("0")},
		{"让球 -1.5 命中", bet("handicap", "1", "-1.5", "100", "2.5"), Score{2, 0}, StatusWon, d("250")},
		{"让球 -1.5 未命中", bet("handicap", "1", "-1.5", "100", "2.5"), Score{2, 1}, StatusLost, d("0")},
	}

	assertJudgeBet(t, tests)
}

// TestJudgeBet_OverUnder 覆盖新持仓表中用 label 写入大小球方向的判定。
func TestJudgeBet_OverUnder(t *testing.T) {
	tests := []struct {
		name       string
		bet        model.UserBetHolding
		score      Score
		wantStatus string
		wantPayout decimal.Decimal
	}{
		{"大 1.5 命中", bet("overunder", "over", "1.5", "100", "1.8"), Score{1, 1}, StatusWon, d("180")},
		{"大 1.5 未命中", bet("overunder", "over", "1.5", "100", "1.8"), Score{0, 1}, StatusLost, d("0")},
		{"小 2.5 命中", bet("overunder", "under", "2.5", "100", "1.9"), Score{1, 1}, StatusWon, d("190")},
		{"小 2.5 未命中", bet("overunder", "under", "2.5", "100", "1.9"), Score{2, 1}, StatusLost, d("0")},
		{"大 3.5 命中", bet("overunder", "over", "3.5", "100", "2.2"), Score{2, 2}, StatusWon, d("220")},
		{"大 3.5 未命中", bet("overunder", "over", "3.5", "100", "2.2"), Score{1, 2}, StatusLost, d("0")},
		{"asian_over_under over", bet("asian_over_under", "over", "1.5", "100", "1.8"), Score{1, 1}, StatusWon, d("180")},
	}

	assertJudgeBet(t, tests)
}

// TestJudgeBet_InvalidMetadataVoidsStake 确认未知玩法或非法标签不会被错误判输。
func TestJudgeBet_InvalidMetadataVoidsStake(t *testing.T) {
	tests := []struct {
		name       string
		bet        model.UserBetHolding
		score      Score
		wantStatus string
		wantPayout decimal.Decimal
	}{
		{"未知玩法不判输", bet("new_market", "1", "0", "100", "9.9"), Score{9, 0}, StatusVoid, d("100")},
		{"未知 1x2 label 不判输", bet("1x2", "HOME", "0", "100", "2.0"), Score{2, 1}, StatusVoid, d("100")},
		{"未知大小球方向不判输", bet("overunder", "middle", "2.5", "100", "2.0"), Score{1, 1}, StatusVoid, d("100")},
	}

	assertJudgeBet(t, tests)
}

// TestCalculateActualPayout 覆盖 WON/PUSH/VOID/LOST 的派彩公式。
func TestCalculateActualPayout(t *testing.T) {
	stake := d("100")
	odds := d("2.5")
	tests := []struct {
		status string
		want   decimal.Decimal
	}{
		{StatusWon, d("250")},
		{StatusPush, d("90")},
		{StatusVoid, d("100")},
		{StatusLost, d("0")},
		{"UNKNOWN", d("0")},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			bet := model.UserBetHolding{Stake: stake, Odds: odds}
			got := CalculateActualPayout(bet, BetResult{Status: tt.status})
			if !got.Equal(tt.want) {
				t.Fatalf("payout: got %s, want %s", got.StringFixed(2), tt.want.StringFixed(2))
			}
		})
	}
}

// TestExtractFinalScore 验证不同终局状态下的比分提取规则。
func TestExtractFinalScore(t *testing.T) {
	tests := []struct {
		name    string
		stateID int
		scores  []SourceScore
		want    Score
		wantErr bool
	}{
		{
			name:    "FT uses CURRENT",
			stateID: model.StateIDFT,
			scores:  []SourceScore{sourceScore("CURRENT", "home", 2), sourceScore("CURRENT", "away", 1)},
			want:    Score{Home: 2, Away: 1},
		},
		{
			name:    "FT uses nested participant from raw score",
			stateID: model.StateIDFT,
			scores:  []SourceScore{nestedSourceScore("CURRENT", "home", 2), nestedSourceScore("CURRENT", "away", 0)},
			want:    Score{Home: 2, Away: 0},
		},
		{
			name:    "AET uses 2ND_HALF",
			stateID: model.StateIDAET,
			scores: []SourceScore{
				sourceScore("CURRENT", "home", 3),
				sourceScore("CURRENT", "away", 2),
				sourceScore("2ND_HALF", "home", 2),
				sourceScore("2ND_HALF", "away", 2),
			},
			want: Score{Home: 2, Away: 2},
		},
		{
			name:    "non-settle state rejected",
			stateID: 22,
			scores:  []SourceScore{sourceScore("CURRENT", "home", 2), sourceScore("CURRENT", "away", 1)},
			wantErr: true,
		},
		{
			name:    "missing side rejected",
			stateID: model.StateIDFT,
			scores:  []SourceScore{sourceScore("CURRENT", "home", 2)},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ExtractFinalScore(tt.stateID, tt.scores)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("score: got %+v, want %+v", got, tt.want)
			}
		})
	}
}

// TestMatchStateMapping 验证 SportMonks state_id 到业务 result/action 的归一化规则。
func TestMatchStateMapping(t *testing.T) {
	tests := []struct {
		stateID    int
		wantCode   string
		wantResult string
		wantAction string
	}{
		{4, "BREAK", model.MatchResultLive, model.MatchActionNone},
		{5, "FT", model.MatchResultFinal, model.MatchActionSettle},
		{7, "AET", model.MatchResultFinal, model.MatchActionSettle},
		{8, "FT_PEN", model.MatchResultFinal, model.MatchActionSettle},
		{12, "CANCELLED", model.MatchResultCanceled, model.MatchActionRefund},
		{20, "DELETED", model.MatchResultVoid, model.MatchActionRefund},
		{23, "UNKNOWN", model.MatchResultPending, model.MatchActionHold},
	}

	for _, tt := range tests {
		t.Run(tt.wantCode, func(t *testing.T) {
			got := model.MatchStateFor(tt.stateID)
			if got.Code != tt.wantCode || got.Result != tt.wantResult || got.Action != tt.wantAction {
				t.Fatalf("state rule: got %+v", got)
			}
		})
	}
}

// assertJudgeBet 是判定测试的公共断言，统一比较状态和 decimal 金额。
func assertJudgeBet(t *testing.T, tests []struct {
	name       string
	bet        model.UserBetHolding
	score      Score
	wantStatus string
	wantPayout decimal.Decimal
}) {
	t.Helper()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := JudgeBet(tt.bet, tt.score)
			if got.Status != tt.wantStatus {
				t.Errorf("status: got %v, want %v", got.Status, tt.wantStatus)
			}
			if !got.Payout.Equal(tt.wantPayout) {
				t.Errorf("payout: got %s, want %s", got.Payout.StringFixed(2), tt.wantPayout.StringFixed(2))
			}
		})
	}
}

// bet 构造最小注单模型，避免每个用例重复填写无关字段。
func bet(market, label, line, stake, odds string) model.UserBetHolding {
	return model.UserBetHolding{
		Market:       market,
		Label:        label,
		HandicapLine: d(line),
		Stake:        d(stake),
		Odds:         d(odds),
	}
}

// sourceScore 构造 SportMonks scores 数组中的单侧比分。
func sourceScore(description, participant string, goals int) SourceScore {
	score := SourceScore{
		Description: description,
		Participant: participant,
	}
	score.Score.Goals = goals
	return score
}

// nestedSourceScore 模拟 spider 当前落库格式：participant 位于 score 对象内部。
func nestedSourceScore(description, participant string, goals int) SourceScore {
	score := SourceScore{
		Description: description,
	}
	score.Score.Goals = goals
	score.Score.Participant = participant
	return score
}

// d 将字符串金额转换为 decimal，测试中避免 float 精度污染。
func d(value string) decimal.Decimal {
	return decimal.RequireFromString(value)
}
