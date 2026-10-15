package analysis

// Outcome 表示一场比赛三种结果的概率分布（百分比，加起来 = 100）
type Outcome struct {
	Home int `json:"home"`
	Draw int `json:"draw"`
	Away int `json:"away"`
}

// Analysis 是欧冠决赛（或其他锁定比赛）的赛前分析卡
type Analysis struct {
	Match           string   `json:"match"`           // "Real Madrid vs PSG"
	StartTime       string   `json:"startTime"`       // 人类可读，如 "2026-05-30 22:00 CET"
	HoursToStart    float64  `json:"hoursToStart"`    // 距开赛还有多少小时
	AiProb          Outcome  `json:"aiProb"`          // AI 估计的三种结果概率
	MarketProb      Outcome  `json:"marketProb"`      // 市场隐含的三种结果概率
	Evidence        []string `json:"evidence"`        // 关键论据 ≥ 3 条
	Unknown         string   `json:"unknown"`         // 不知道但会影响结果的关键变量
	SuggestionRange string   `json:"suggestionRange"` // 建议仓位区间
	PickLabel       string   `json:"pickLabel"`       // 主推方向
	PickOdds        float64  `json:"pickOdds"`        // 主推赔率
	Summary         string   `json:"summary"`         // 一句话核心结论
	UpdatedAt       int64    `json:"updatedAt"`       // unix ms
	BasedOnTweets   int      `json:"basedOnTweets"`   // 引用了多少条推文
}
