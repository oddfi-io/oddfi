package model

import (
	"oddfi-web-api/config"
	"time"
)

// MoneylineSnapshotDB 对应 spider 写入的历史快照表。
// API 只读该表，避免在请求链路实时回源 SportMonks，保证详情页曲线稳定且响应可控。
type MoneylineSnapshotDB struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	FixtureID     int64     `gorm:"not null;index" json:"fixture_id"`
	MarketID      int       `gorm:"not null" json:"market_id"`
	BookmakerID   int       `gorm:"not null" json:"bookmaker_id"`
	Label         string    `gorm:"size:8;not null" json:"label"`
	Value         float64   `gorm:"type:decimal(8,3);not null" json:"value"`
	Probability   float64   `gorm:"type:decimal(6,3);not null" json:"probability"`
	NormalizedPct float64   `gorm:"type:decimal(6,3);not null" json:"normalized_pct"`
	StateID       int       `gorm:"not null" json:"state_id"`
	CapturedAt    time.Time `gorm:"type:datetime(3);not null;index" json:"captured_at"`
}

// MoneylineHistoryPoint 是前端折线图单点。
// value 保持字符串输出，是为了避免前端用 JS number 处理赔率时出现不必要的小数精度展示问题。
type MoneylineHistoryPoint struct {
	CapturedAt    string  `json:"captured_at"`
	Value         string  `json:"value"`
	Probability   float64 `json:"probability"`
	NormalizedPct float64 `json:"normalized_pct"`
	StateID       int     `json:"state_id"`
}

type MoneylineHistoryFixture struct {
	ID         int64  `json:"id"`
	StateID    int    `json:"state_id"`
	StartingAt string `json:"starting_at"`
}

type MoneylineHistoryResponse struct {
	Home    []MoneylineHistoryPoint  `json:"home"`
	Draw    []MoneylineHistoryPoint  `json:"draw"`
	Away    []MoneylineHistoryPoint  `json:"away"`
	Fixture *MoneylineHistoryFixture `json:"fixture"`
}

func (MoneylineSnapshotDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.MoneylineSnapshots == "" {
		return "oddfi_moneyline_snapshots"
	}
	return cfg.MySQL.Tables.MoneylineSnapshots
}
