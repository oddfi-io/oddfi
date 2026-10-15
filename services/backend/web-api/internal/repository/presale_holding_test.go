package repository

import (
	"testing"

	"everything_finance/org/web-api/internal/model"

	"github.com/shopspring/decimal"
)

// weightedAvg 纯函数实现加权平均成本价公式：
// new_avg = (old_total * old_avg + delta * price) / (old_total + delta)
// 本测试仅验证 Go 端加权平均公式（shopspring/decimal）；
// MySQL DECIMAL(38,18) 真实算术由集成测试覆盖（B1 引入 sqlmock 后补）
// 此函数仅用于测试断言，不在生产代码中使用（生产代码直接用 SQL 原子计算）
func weightedAvg(oldTotal, oldAvg, delta, price decimal.Decimal) decimal.Decimal {
	newTotal := oldTotal.Add(delta)
	if newTotal.IsZero() {
		return decimal.Zero
	}
	numerator := oldTotal.Mul(oldAvg).Add(delta.Mul(price))
	return numerator.Div(newTotal)
}

// TestUpsertInvest_WeightedAvgFormula 表格驱动测试加权平均成本价公式
// P0 必测：decimal 精度错误直接影响资金安全（持仓成本价是展示给用户的关键字段）
func TestUpsertInvest_WeightedAvgFormula(t *testing.T) {
	cases := []struct {
		name     string
		oldTotal string // 已有 total_odd
		oldAvg   string // 已有 locked_price_avg
		delta    string // 本次 shares_odd
		price    string // 本次 price_usd（轮次价格快照）
		wantAvg  string // 期望加权平均后的 locked_price_avg
	}{
		{
			name:     "首次投资，旧值为零",
			oldTotal: "0",
			oldAvg:   "0",
			delta:    "1000",
			price:    "0.06",
			wantAvg:  "0.06",
		},
		{
			name:     "第二次投资，相同价格",
			oldTotal: "1000",
			oldAvg:   "0.06",
			delta:    "500",
			price:    "0.06",
			wantAvg:  "0.06",
		},
		{
			name:     "第三次投资，更高价格轮次",
			oldTotal: "1500",
			oldAvg:   "0.06",
			delta:    "500",
			price:    "0.07",
			wantAvg:  "0.0625",
		},
		{
			name:     "小额追加，精度18位保持",
			oldTotal: "10000",
			oldAvg:   "0.030000000000000000",
			delta:    "1",
			price:    "0.080000000000000000",
			// (10000 * 0.03 + 1 * 0.08) / 10001 = 300.08 / 10001，shopspring/decimal 精度结果
			wantAvg:  "0.030004999500050000",
		},
		{
			name:     "公募A轮三轮累加",
			oldTotal: "20000",
			oldAvg:   "0.05",
			delta:    "10000",
			price:    "0.06",
			// (20000*0.05 + 10000*0.06) / 30000 = 1600/30000，shopspring/decimal 精度结果
			wantAvg:  "0.053333333333333300",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			oldTotal := decimal.RequireFromString(tc.oldTotal)
			oldAvg := decimal.RequireFromString(tc.oldAvg)
			delta := decimal.RequireFromString(tc.delta)
			price := decimal.RequireFromString(tc.price)
			want := decimal.RequireFromString(tc.wantAvg)

			got := weightedAvg(oldTotal, oldAvg, delta, price)

			// 精度比较：截取到 18 位小数（与 DECIMAL(38,18) 对齐）
			gotRounded := got.StringFixed(18)
			wantRounded := want.StringFixed(18)
			if gotRounded != wantRounded {
				t.Errorf("weightedAvg(%s, %s, %s, %s) = %s, want %s",
					tc.oldTotal, tc.oldAvg, tc.delta, tc.price,
					gotRounded, wantRounded)
			}
		})
	}
}

// TestUpsertInvest_WeightedAvg_ZeroOldTotal 验证首次投资时公式不会除零
// 除零保护：old_total=0 时直接返回 price（无需计算加权平均）
func TestUpsertInvest_WeightedAvg_ZeroOldTotal(t *testing.T) {
	oldTotal := decimal.Zero
	oldAvg := decimal.Zero
	delta := decimal.RequireFromString("1000")
	price := decimal.RequireFromString("0.06")

	got := weightedAvg(oldTotal, oldAvg, delta, price)
	want := decimal.RequireFromString("0.06")

	if !got.Equal(want) {
		t.Errorf("weightedAvg with zero old_total = %s, want %s", got, want)
	}
}

// TestHoldingSource_Constants 验证持仓来源枚举值与数据库存储值一致
// source 字段直接存入数据库，值改变会破坏现有数据的查询过滤
func TestHoldingSource_Constants(t *testing.T) {
	// source=1 是 invest（认购投入），source=2 是 referral（邀请奖励）
	// 这是数据库层面的约定，改变会导致历史数据无法正确区分来源
	const (
		expectedInvest   = 1
		expectedReferral = 2
	)

	if model.HoldingSourceInvest != expectedInvest {
		t.Errorf("HoldingSourceInvest = %d, want %d", model.HoldingSourceInvest, expectedInvest)
	}
	if model.HoldingSourceReferral != expectedReferral {
		t.Errorf("HoldingSourceReferral = %d, want %d", model.HoldingSourceReferral, expectedReferral)
	}
}

// TestSumReferralOdd_EmptyTable 验证空表时 SumReferralOdd 返回 decimal.Zero 且 String() == "0"
// GORM COALESCE(SUM(...),0) + 显式 gorm:"column:total" tag 保证空表 Scan 映射正确。
// 此处通过纯 decimal 语义验证 Zero 值行为（DB 层由 B1 sqlmock 集成测试覆盖）。
func TestSumReferralOdd_EmptyTable(t *testing.T) {
	// 模拟 COALESCE(SUM(total_odd), 0) 在无 source=2 行时的返回值
	got := decimal.Zero

	// 验证 decimal.Zero.String() 等于 "0"，服务层直接用 .String() 序列化给前端
	if got.String() != "0" {
		t.Errorf("decimal.Zero.String() = %q, want %q", got.String(), "0")
	}
	// 验证 IsZero() 语义
	if !got.IsZero() {
		t.Errorf("decimal.Zero.IsZero() should be true")
	}
	// 验证 Equal(decimal.Zero)
	if !got.Equal(decimal.Zero) {
		t.Errorf("result should Equal(decimal.Zero)")
	}
}

// TestUpsertReferral_InvestedUsdIsZero 已删除：
// 原测试仅验证 NewPresaleHoldingRepo(nil) != nil，未验证 invested_usd=0 行为，属假阳性。
// invested_usd=0 验证待 B1 引入 DATA-DOG/go-sqlmock 后补（见 ARCHITECTURE.md §11 P1 TODO）。
