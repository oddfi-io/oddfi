package main

import (
	"sync"

	"github.com/shopspring/decimal"
)

// ─── DD002 mock 夹具：8 个事件覆盖联调 A 全形态 ─────────────────────────────
//
// 覆盖矩阵（process/README.md §4 联调 A）：
//   e1 green / e2 yellow / e3 orange / e5 red —— 四灯色
//   e4 未开盘（opened=false，signal/风险字段全 null）
//   e6 已结算（score + settle_pl + settle 时间，结算卡替换）
//   e7 红灯已决策（chain=red、展示 orange、pending_decision=false、decision 对象）
//   e5 同时是「红灯重升重入队」：带上一轮 decision，但链上重升后 pending_decision=true
//   e8 普通 green 待开始（已开盘），凑足 8 个并测 status 筛选
//
// 夹具 schema 即联调 A 的契约真值，字段名/类型/null 性与 OPS-01c 交付逐字段一致。
// 注意：score / settle_pl / times.settle 真上游在 OPS-01d 前恒 null，
// mock 预先点亮 e6 是为了让前端先行开发结算态渲染（docs/api.md §3.12 已标注）。

// strPtr / f64Ptr 字面量取址辅助。
func strPtr(s string) *string   { return &s }
func f64Ptr(f float64) *float64 { return &f }

// mockScore 终场比分，仅 settled 非空。
type mockScore struct {
	Home int `json:"home"`
	Away int `json:"away"`
}

// mockTimes 四个关键时间点；settle 在 OPS-01d 前真上游恒 null。
type mockTimes struct {
	Open    *string `json:"open"`
	Lock    *string `json:"lock"`
	Kickoff *string `json:"kickoff"`
	Settle  *string `json:"settle"`
}

// mockDecision 红灯人工决策记录（admin_risk_decisions 镜像）。
type mockDecision struct {
	Action    string `json:"action"`
	DecidedBy string `json:"decided_by"`
	DecidedAt string `json:"decided_at"`
	Remark    string `json:"remark"`
}

// mockEvent 列表行（DD002 §3.3 契约）。signal 为「展示信号」：
// 链上 red 且已决策 → 降级 orange（决策态状态机，DD §3.3）。
type mockEvent struct {
	EventID         string        `json:"event_id"`
	Sport           string        `json:"sport"`
	League          string        `json:"league"`
	EventName       string        `json:"event_name"`
	Status          string        `json:"status"` // active / pending / settled
	Opened          bool          `json:"opened"`
	Score           *mockScore    `json:"score"`
	Times           mockTimes     `json:"times"`
	LpPoolAmount    *string       `json:"lp_pool_amount"` // 恒 null（OPS-01d 前）
	BetAmountTotal  *string       `json:"bet_amount_total"`
	MaxExposure     *string       `json:"max_exposure"` // 展示量 adjMaxL
	SettlePL        *string       `json:"settle_pl"`
	Signal          *string       `json:"signal"` // 展示信号；未开盘 null
	MarketCount     int           `json:"market_count"`
	DirectionCount  int           `json:"direction_count"`
	YieldRatio      *float64      `json:"yield_ratio"` // 恒 null（依赖 lp_pool）
	PendingDecision bool          `json:"pending_decision"`
	Decision        *mockDecision `json:"decision"`

	// ─ 以下为 mock 内部状态，不序列化 ─
	// ChainSignal 链上判级（判级源 maxL 判出）；决策只盖「展示与队列」，链上不变。
	ChainSignal string `json:"-"`
}

// mockDirection 方向明细（PRD §5.3 direction 级字段）。
type mockDirection struct {
	DirectionID        string   `json:"direction_id"`
	DirectionName      string   `json:"direction_name"` // 已结算带「✓ 胜出 / 未中 / 走盘」标注（接口设计 :692）
	BetAmount          string   `json:"bet_amount"`
	OriginalOdds       float64  `json:"original_odds"`
	ThirdPartyOdds     *float64 `json:"third_party_odds"`
	ThirdPartySource   *string  `json:"third_party_source"`
	OddsDiff           *float64 `json:"odds_diff"` // 第三方 − 当前（base=新赔率，未调整=开盘）
	AdjustedOdds       *float64 `json:"adjusted_odds"`
	OriginalExposure   string   `json:"original_exposure"`
	AdjustedExposure   *string  `json:"adjusted_exposure"` // 未调整为 null
	AdjustRatio        *float64 `json:"adjust_ratio"`
	Signal             string   `json:"signal"`
	AdjustHistoryCount int      `json:"adjust_history_count"`
}

// mockSettle 玩法结算条，仅已结算非空。
type mockSettle struct {
	Winners    []string `json:"winners"`
	Payout     string   `json:"payout"`
	PlatformPL string   `json:"platform_pl"` // 正=平台盈利
}

// mockMarket 玩法（PRD §5.3 market 级字段）。
type mockMarket struct {
	MarketID   string          `json:"market_id"`
	MarketName string          `json:"market_name"`
	Settle     *mockSettle     `json:"settle"`
	Directions []mockDirection `json:"directions"`
}

// mockAdjustRecord 调整历史单条（PRD §5.4）。exposure / lp_ratio 在
// OPS-01a/01d 落库前恒 null（D6 null 组）。
type mockAdjustRecord struct {
	Seq           int      `json:"seq"`
	Time          string   `json:"time"`
	Odds          float64  `json:"odds"`
	Exposure      *string  `json:"exposure"`
	LpRatio       *float64 `json:"lp_ratio"`
	Source        string   `json:"source"` // 本期恒 Auto
	MarketName    string   `json:"market_name"`
	DirectionName string   `json:"direction_name"`
}

// store 是 mock 的内存状态：risk-decision 有状态（联调 A 演练决策闭环 +
// RISK_DECISION_CONFLICT），重启即复位。
type store struct {
	mu     sync.Mutex
	events []*mockEvent
	// details / adjustHist 静态只读，不随决策变化
	details    map[string][]mockMarket
	adjustHist map[string][]mockAdjustRecord
}

// newStore 构建夹具初始状态。
func newStore() *store {
	events := []*mockEvent{
		{
			EventID: "1", Sport: "足球", League: "英超", EventName: "Arsenal vs Chelsea",
			Status: "active", Opened: true,
			Times: mockTimes{
				Open: strPtr("2026-06-04T18:00:00Z"), Lock: strPtr("2026-06-06T19:00:00Z"),
				Kickoff: strPtr("2026-06-06T19:30:00Z"), Settle: nil,
			},
			BetAmountTotal: strPtr("41200.00"), MaxExposure: strPtr("5230.00"),
			Signal: strPtr("green"), ChainSignal: "green",
			MarketCount: 2, DirectionCount: 5,
		},
		{
			EventID: "2", Sport: "篮球", League: "NBA", EventName: "Lakers vs Celtics",
			Status: "active", Opened: true,
			Times: mockTimes{
				Open: strPtr("2026-06-04T12:00:00Z"), Lock: strPtr("2026-06-06T01:00:00Z"),
				Kickoff: strPtr("2026-06-06T01:30:00Z"), Settle: nil,
			},
			BetAmountTotal: strPtr("58400.00"), MaxExposure: strPtr("12480.00"),
			Signal: strPtr("yellow"), ChainSignal: "yellow",
			MarketCount: 2, DirectionCount: 4,
		},
		{
			EventID: "3", Sport: "网球", League: "ATP", EventName: "Nadal vs Federer",
			Status: "active", Opened: true,
			Times: mockTimes{
				Open: strPtr("2026-06-05T08:00:00Z"), Lock: strPtr("2026-06-07T10:00:00Z"),
				Kickoff: strPtr("2026-06-07T10:30:00Z"), Settle: nil,
			},
			BetAmountTotal: strPtr("66100.00"), MaxExposure: strPtr("21300.00"),
			Signal: strPtr("orange"), ChainSignal: "orange",
			MarketCount: 2, DirectionCount: 5,
		},
		{
			// 未开盘：signal / 风险字段全 null，不计入 summary 四色计数（原型 :4315）
			EventID: "4", Sport: "电竞", League: "LOL", EventName: "T1 vs G2",
			Status: "pending", Opened: false,
			Times: mockTimes{
				Open: nil, Lock: nil,
				Kickoff: strPtr("2026-06-08T14:00:00Z"), Settle: nil,
			},
			BetAmountTotal: nil, MaxExposure: nil, Signal: nil, ChainSignal: "",
			MarketCount: 0, DirectionCount: 0,
		},
		{
			// 红灯重升重入队：上一轮已决策（decision 非空），但链上 quote_version
			// 晚于决策时间再次判红 → pending_decision 重新 true（DD §3.3 状态机）
			EventID: "5", Sport: "网球", League: "ATP", EventName: "Djokovic vs Alcaraz",
			Status: "active", Opened: true,
			Times: mockTimes{
				Open: strPtr("2026-06-05T18:00:00Z"), Lock: strPtr("2026-06-07T02:00:00Z"),
				Kickoff: strPtr("2026-06-07T02:30:00Z"), Settle: nil,
			},
			BetAmountTotal: strPtr("73955.00"), MaxExposure: strPtr("19246.00"),
			Signal: strPtr("red"), ChainSignal: "red",
			MarketCount: 2, DirectionCount: 5,
			PendingDecision: true,
			Decision: &mockDecision{
				Action: "approve_continue", DecidedBy: "lark:ou_previous_admin",
				DecidedAt: "2026-06-04T09:12:00Z", Remark: "上一轮人工评估后恢复开盘（其后敞口重升触发重入队）",
			},
		},
		{
			// 已结算：score + settle_pl + settle 时间点亮（mock 先行，真上游待 OPS-01d）
			EventID: "6", Sport: "足球", League: "德甲", EventName: "Bayern vs Dortmund",
			Status: "settled", Opened: true,
			Score: &mockScore{Home: 2, Away: 1},
			Times: mockTimes{
				Open: strPtr("2026-06-01T10:00:00Z"), Lock: strPtr("2026-06-03T18:00:00Z"),
				Kickoff: strPtr("2026-06-03T18:30:00Z"), Settle: strPtr("2026-06-03T20:35:00Z"),
			},
			BetAmountTotal: strPtr("38755.00"), MaxExposure: strPtr("-3200.00"), // 负=平台盈利
			SettlePL: strPtr("3200.00"),
			Signal:   strPtr("green"), ChainSignal: "green",
			MarketCount: 2, DirectionCount: 5,
		},
		{
			// 红灯已决策：链上仍 red，展示降级 orange + decision 对象（「已人工处理」）
			EventID: "7", Sport: "足球", League: "西甲", EventName: "Real Madrid vs Barcelona",
			Status: "active", Opened: true,
			Times: mockTimes{
				Open: strPtr("2026-06-04T08:00:00Z"), Lock: strPtr("2026-06-06T20:00:00Z"),
				Kickoff: strPtr("2026-06-06T20:30:00Z"), Settle: nil,
			},
			BetAmountTotal: strPtr("52100.00"), MaxExposure: strPtr("15800.00"),
			Signal: strPtr("orange"), ChainSignal: "red",
			MarketCount: 2, DirectionCount: 4,
			PendingDecision: false,
			Decision: &mockDecision{
				Action: "stop", DecidedBy: "lark:ou_mock_admin",
				DecidedAt: "2026-06-05T03:40:00Z", Remark: "敞口超限，人工确认维持停止接单",
			},
		},
		{
			// 待开始但已开盘（status=pending 与 opened 正交，测试 status 筛选）
			EventID: "8", Sport: "足球", League: "法甲", EventName: "PSG vs Marseille",
			Status: "pending", Opened: true,
			Times: mockTimes{
				Open: strPtr("2026-06-05T10:00:00Z"), Lock: strPtr("2026-06-09T19:00:00Z"),
				Kickoff: strPtr("2026-06-09T19:30:00Z"), Settle: nil,
			},
			BetAmountTotal: strPtr("6400.00"), MaxExposure: strPtr("980.00"),
			Signal: strPtr("green"), ChainSignal: "green",
			MarketCount: 1, DirectionCount: 3,
		},
	}

	return &store{
		events:     events,
		details:    buildDetails(),
		adjustHist: buildAdjustHist(),
	}
}

// buildDetails 构建 markets[] → directions[] 明细夹具。
// 只为联调 A 高频事件（红灯 e5、已结算 e6、橙灯 e3）配完整明细，
// 其余事件返回简化单玩法（前端展开行为一致即可）。
func buildDetails() map[string][]mockMarket {
	bet365 := "Bet365"
	pinnacle := "Pinnacle"

	generic := func(id string) []mockMarket {
		return []mockMarket{{
			MarketID: id + "01", MarketName: "胜负",
			Directions: []mockDirection{
				{
					DirectionID: id + "0101", DirectionName: "主胜", BetAmount: "12000.00",
					OriginalOdds: 1.85, ThirdPartyOdds: f64Ptr(1.88), ThirdPartySource: &bet365,
					OddsDiff: f64Ptr(0.03), OriginalExposure: "4200.00",
					Signal: "green", AdjustHistoryCount: 0,
				},
				{
					DirectionID: id + "0102", DirectionName: "客胜", BetAmount: "9800.00",
					OriginalOdds: 2.10, ThirdPartyOdds: f64Ptr(2.05), ThirdPartySource: &bet365,
					OddsDiff: f64Ptr(-0.05), OriginalExposure: "3100.00",
					Signal: "green", AdjustHistoryCount: 0,
				},
			},
		}}
	}

	return map[string][]mockMarket{
		"1": generic("1"), "2": generic("2"), "4": {}, "8": generic("8"),
		"3": {
			{
				MarketID: "301", MarketName: "胜负",
				Directions: []mockDirection{
					{
						DirectionID: "30101", DirectionName: "Nadal 胜", BetAmount: "38200.00",
						OriginalOdds: 1.92, ThirdPartyOdds: f64Ptr(1.95), ThirdPartySource: &pinnacle,
						OddsDiff: f64Ptr(0.07), AdjustedOdds: f64Ptr(1.88),
						OriginalExposure: "23400.00", AdjustedExposure: strPtr("21300.00"),
						AdjustRatio: f64Ptr(-0.09), Signal: "orange", AdjustHistoryCount: 2,
					},
					{
						DirectionID: "30102", DirectionName: "Federer 胜", BetAmount: "27900.00",
						OriginalOdds: 2.05, ThirdPartyOdds: f64Ptr(2.02), ThirdPartySource: &pinnacle,
						OddsDiff: f64Ptr(-0.03), OriginalExposure: "9800.00",
						Signal: "yellow", AdjustHistoryCount: 0,
					},
				},
			},
		},
		"5": {
			{
				MarketID: "501", MarketName: "胜负",
				Directions: []mockDirection{
					{
						DirectionID: "50101", DirectionName: "Djokovic 胜", BetAmount: "45000.00",
						OriginalOdds: 1.75, ThirdPartyOdds: f64Ptr(1.80), ThirdPartySource: &bet365,
						OddsDiff: f64Ptr(0.09), AdjustedOdds: f64Ptr(1.71),
						OriginalExposure: "31200.00", AdjustedExposure: strPtr("29100.00"),
						AdjustRatio: f64Ptr(-0.07), Signal: "red", AdjustHistoryCount: 3,
					},
					{
						DirectionID: "50102", DirectionName: "Alcaraz 胜", BetAmount: "21955.00",
						OriginalOdds: 2.30, ThirdPartyOdds: f64Ptr(2.25), ThirdPartySource: &bet365,
						OddsDiff: f64Ptr(-0.05), OriginalExposure: "8400.00",
						Signal: "yellow", AdjustHistoryCount: 0,
					},
				},
			},
			{
				MarketID: "502", MarketName: "盘数让分",
				Directions: []mockDirection{
					{
						DirectionID: "50201", DirectionName: "让 1.5 盘", BetAmount: "7000.00",
						OriginalOdds: 1.95, ThirdPartyOdds: nil, ThirdPartySource: nil,
						OddsDiff: nil, OriginalExposure: "2900.00",
						Signal: "green", AdjustHistoryCount: 0,
					},
				},
			},
		},
		"6": {
			{
				MarketID: "601", MarketName: "胜负",
				Settle: &mockSettle{
					Winners: []string{"拜仁胜"}, Payout: "21400.00", PlatformPL: "3200.00",
				},
				Directions: []mockDirection{
					{
						DirectionID: "60101", DirectionName: "拜仁胜 ✓ 胜出", BetAmount: "18600.00",
						OriginalOdds: 1.65, ThirdPartyOdds: f64Ptr(1.68), ThirdPartySource: &bet365,
						OddsDiff: f64Ptr(0.03), OriginalExposure: "-1200.00",
						Signal: "green", AdjustHistoryCount: 0,
					},
					{
						DirectionID: "60102", DirectionName: "多特胜 未中", BetAmount: "14200.00",
						OriginalOdds: 2.40, ThirdPartyOdds: f64Ptr(2.35), ThirdPartySource: &bet365,
						OddsDiff: f64Ptr(-0.05), OriginalExposure: "-2000.00",
						Signal: "green", AdjustHistoryCount: 0,
					},
					{
						DirectionID: "60103", DirectionName: "平局 走盘", BetAmount: "5955.00",
						OriginalOdds: 3.10, ThirdPartyOdds: nil, ThirdPartySource: nil,
						OddsDiff: nil, OriginalExposure: "0.00",
						Signal: "green", AdjustHistoryCount: 0,
					},
				},
			},
		},
		"7": {
			{
				MarketID: "701", MarketName: "胜负",
				Directions: []mockDirection{
					{
						DirectionID: "70101", DirectionName: "皇马胜", BetAmount: "33000.00",
						OriginalOdds: 1.80, ThirdPartyOdds: f64Ptr(1.83), ThirdPartySource: &pinnacle,
						OddsDiff: f64Ptr(0.03), OriginalExposure: "15800.00",
						Signal: "red", AdjustHistoryCount: 1,
					},
					{
						DirectionID: "70102", DirectionName: "巴萨胜", BetAmount: "19100.00",
						OriginalOdds: 2.15, ThirdPartyOdds: f64Ptr(2.10), ThirdPartySource: &pinnacle,
						OddsDiff: f64Ptr(-0.05), OriginalExposure: "6200.00",
						Signal: "yellow", AdjustHistoryCount: 0,
					},
				},
			},
		},
	}
}

// buildAdjustHist 构建调整历史夹具。exposure / lp_ratio 恒 null（D6 null 组）。
func buildAdjustHist() map[string][]mockAdjustRecord {
	return map[string][]mockAdjustRecord{
		"3": {
			{Seq: 1, Time: "2026-06-06T09:10:00Z", Odds: 1.90, Source: "Auto", MarketName: "胜负", DirectionName: "Nadal 胜"},
			{Seq: 2, Time: "2026-06-06T14:30:00Z", Odds: 1.88, Source: "Auto", MarketName: "胜负", DirectionName: "Nadal 胜"},
		},
		"5": {
			{Seq: 1, Time: "2026-06-05T22:00:00Z", Odds: 1.74, Source: "Auto", MarketName: "胜负", DirectionName: "Djokovic 胜"},
			{Seq: 2, Time: "2026-06-06T03:20:00Z", Odds: 1.72, Source: "Auto", MarketName: "胜负", DirectionName: "Djokovic 胜"},
			{Seq: 3, Time: "2026-06-06T08:45:00Z", Odds: 1.71, Source: "Auto", MarketName: "胜负", DirectionName: "Djokovic 胜"},
		},
		"7": {
			{Seq: 1, Time: "2026-06-05T01:15:00Z", Odds: 1.78, Source: "Auto", MarketName: "胜负", DirectionName: "皇马胜"},
		},
	}
}

// summaryData 按当前内存状态实时计算 summary（决策后计数随之变化）。
// 计数口径：四色用展示信号（决策降级后算 orange）、不含未开盘（原型 :4315）；
// red_pending_count 用链上信号 red 且未决策（D4：队列只收 red）。
func (s *store) summaryData() map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()

	colorCount := map[string]int{}
	statusCount := map[string]int{}
	redPending := 0
	totalBet := decimal.Zero
	maxExposure := decimal.Zero
	maxID, maxName := "", ""

	for _, e := range s.events {
		statusCount[e.Status]++
		if e.BetAmountTotal != nil {
			if d, err := decimal.NewFromString(*e.BetAmountTotal); err == nil {
				totalBet = totalBet.Add(d)
			}
		}
		if e.Opened && e.Signal != nil {
			colorCount[*e.Signal]++
		}
		if e.ChainSignal == "red" && e.PendingDecision {
			redPending++
		}
		if e.MaxExposure != nil {
			if d, err := decimal.NewFromString(*e.MaxExposure); err == nil && d.GreaterThan(maxExposure) {
				maxExposure = d
				maxID, maxName = e.EventID, e.EventName
			}
		}
	}

	return map[string]any{
		"total_bet_amount":        totalBet.StringFixed(2),
		"total_events":            len(s.events),
		"active_count":            statusCount["active"],
		"pending_count":           statusCount["pending"],
		"settled_count":           statusCount["settled"],
		"green_count":             colorCount["green"],
		"yellow_count":            colorCount["yellow"],
		"orange_count":            colorCount["orange"],
		"red_count":               colorCount["red"],
		"red_pending_count":       redPending,
		"max_event_exposure":      maxExposure.StringFixed(2),
		"max_exposure_event_id":   maxID,
		"max_exposure_event_name": maxName,
	}
}
