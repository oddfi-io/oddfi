package model

// BetEvent 记录一笔成功落单的事件
type BetEvent struct {
	BetID     string  `json:"bet_id"`
	MatchID   string  `json:"match_id"`
	MarketID  string  `json:"market_id"`
	OutcomeID string  `json:"outcome_id"`
	Stake     float64 `json:"stake"`
	Timestamp int64   `json:"timestamp"`
}

// OddsChangeEvent 当赔率变动超过 0.05 阈值时触发
type OddsChangeEvent struct {
	MarketID  string      `json:"market_id"`
	MatchID   string      `json:"match_id"`
	Signal    SignalColor `json:"signal"`
	NewOdds   []Outcome   `json:"new_odds"`
	UpdatedAt int64       `json:"updated_at"`
}
