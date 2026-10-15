package model

import (
	"oddfi-web-spider/config"
	"time"
)

// MoneylineSnapshot 是 Moneyline 历史事实表。
// 每次完整采集固定写入 Home/Draw/Away 三行，不做覆盖，用 captured_at 串成前端折线图。
type MoneylineSnapshot struct {
	ID uint64 `gorm:"primaryKey;autoIncrement" json:"id"`

	FixtureID   int64  `gorm:"not null;index:idx_fid_label_time,priority:1;index:idx_fid_time,priority:1" json:"fixture_id"`
	MarketID    int    `gorm:"not null;default:1" json:"market_id"`
	BookmakerID int    `gorm:"not null" json:"bookmaker_id"`
	Label       string `gorm:"size:8;not null;index:idx_fid_label_time,priority:2" json:"label"`

	// value/probability/normalized_pct 都使用 decimal 约束，避免赔率曲线因为浮点展示误差抖动。
	Value         float64   `gorm:"type:decimal(8,3);not null" json:"value"`
	Probability   float64   `gorm:"type:decimal(6,3);not null" json:"probability"`
	NormalizedPct float64   `gorm:"type:decimal(6,3);not null" json:"normalized_pct"`
	StateID       int       `gorm:"not null" json:"state_id"`
	CapturedAt    time.Time `gorm:"type:datetime(3);not null;index:idx_fid_label_time,priority:3;index:idx_captured_at;index:idx_fid_time,priority:2" json:"captured_at"`
}

// MoneylineCollectionStatus 保存每场比赛的采集状态机。
// next_poll_at 是调度核心字段，runner 只扫描到期记录，避免对白名单内所有 fixture 做固定频率全量轮询。
type MoneylineCollectionStatus struct {
	FixtureID int64  `gorm:"primaryKey;autoIncrement:false" json:"fixture_id"`
	Status    string `gorm:"type:enum('PENDING','POLLING','COMPLETED','STOPPED','ANOMALY');not null;default:'PENDING';index:idx_status_next,priority:1" json:"status"`

	FirstCapturedAt *time.Time `gorm:"type:datetime(3)" json:"first_captured_at"`
	LastCapturedAt  *time.Time `gorm:"type:datetime(3)" json:"last_captured_at"`
	LastStateID     *int       `json:"last_state_id"`
	CaptureCount    int        `gorm:"not null;default:0" json:"capture_count"`
	NextPollAt      *time.Time `gorm:"type:datetime(3);index:idx_status_next,priority:2" json:"next_poll_at"`
	Notes           string     `gorm:"type:text" json:"notes"`
	UpdatedAt       time.Time  `gorm:"type:datetime(3);not null;autoUpdateTime:milli" json:"updated_at"`
}

func (MoneylineSnapshot) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.MoneylineSnapshots == "" {
		return "oddfi_moneyline_snapshots"
	}
	return cfg.MySQL.Tables.MoneylineSnapshots
}

func (MoneylineCollectionStatus) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.MoneylineCollectionStatus == "" {
		return "oddfi_moneyline_collection_status"
	}
	return cfg.MySQL.Tables.MoneylineCollectionStatus
}
