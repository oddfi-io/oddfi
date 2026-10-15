package repository

import (
	"testing"

	"everything_finance/org/web-api/internal/model"

	"github.com/shopspring/decimal"
)

func TestValidateHandicapLineAcceptsMockAsianHandicap(t *testing.T) {
	odd := model.OddDB{
		OddID:             9920000108,
		MarketID:          6,
		MarketDescription: "Asian Handicap",
		Handicap:          "-1.5",
		Total:             "",
	}

	if err := validateHandicapLine("asian_handicap", decimal.RequireFromString("-1.5"), odd); err != nil {
		t.Fatalf("validateHandicapLine() error = %v, want nil", err)
	}
}

func TestValidateHandicapLineAcceptsMockAsianOverUnder(t *testing.T) {
	odd := model.OddDB{
		OddID:             9920000110,
		MarketID:          7,
		MarketDescription: "Asian Over/Under",
		Handicap:          "",
		Total:             "1.5",
	}

	if err := validateHandicapLine("asian_over_under", decimal.RequireFromString("1.5"), odd); err != nil {
		t.Fatalf("validateHandicapLine() error = %v, want nil", err)
	}
}

func TestValidateHandicapLineAcceptsSlashSeparatedTotalMarket(t *testing.T) {
	odd := model.OddDB{
		MarketID:          7,
		MarketDescription: "Asian Over/Under",
		Total:             "1.5",
	}

	// SQL seed/repair 使用 Asian Over/Under 展示名；归一化必须去掉斜杠，否则大小球会走不到 total 盘口线校验。
	if err := validateHandicapLine("Asian Over/Under", decimal.RequireFromString("1.5"), odd); err != nil {
		t.Fatalf("validateHandicapLine() error = %v, want nil", err)
	}
}

func TestValidateHandicapLineRejectsMismatch(t *testing.T) {
	odd := model.OddDB{
		OddID:             9920000110,
		MarketID:          7,
		MarketDescription: "Asian Over/Under",
		Total:             "1.5",
	}

	err := validateHandicapLine("asian_over_under", decimal.RequireFromString("2.5"), odd)
	if err == nil || err.Error() != "HANDICAP_LINE_MISMATCH" {
		t.Fatalf("validateHandicapLine() error = %v, want HANDICAP_LINE_MISMATCH", err)
	}
}

func TestValidateHandicapLineUsesServerMarketBeforeRequestMarket(t *testing.T) {
	odd := model.OddDB{
		OddID:             9920000108,
		MarketID:          6,
		MarketDescription: "Asian Handicap",
		Handicap:          "-1.5",
		Total:             "1.5",
	}

	// 客户端 market 可能传错，但 odd_id 对应的服务端盘口类型才是风控校验依据，不能因为请求名是大小球就改读 total 字段。
	err := validateHandicapLine("asian_over_under", decimal.RequireFromString("1.5"), odd)
	if err == nil || err.Error() != "HANDICAP_LINE_MISMATCH" {
		t.Fatalf("validateHandicapLine() error = %v, want HANDICAP_LINE_MISMATCH", err)
	}
}
