package model

import (
	"time"
)

type SignalColor int

type BetSignal struct {
	FixtureID   int64
	MarketID    int
	BookmakerID int
}

const (
	SignalGreen  SignalColor = 0
	SignalYellow SignalColor = 1
	SignalOrange SignalColor = 2
	SignalRed    SignalColor = 3
)

// Odd 赔率表：完全兼容 oddfi-web-spider 并扩展风控引擎字段
type Odd struct {
	// --- 爬虫原始字段 (保持完全一致) ---
	ID          int64  `gorm:"primaryKey;autoIncrement:false" json:"id"`
	FixtureID   int64  `gorm:"uniqueIndex:idx_fixture_market_book_label;not null" json:"fixture_id"`    // 关联的比赛 ID
	MarketID    int    `gorm:"uniqueIndex:idx_fixture_market_book_label;not null" json:"market_id"`     // 1=1X2, 6=亚让, 7=亚大小
	BookmakerID int    `gorm:"uniqueIndex:idx_fixture_market_book_label;not null" json:"bookmaker_id"`  // 做市商 ID
	Label       string `gorm:"uniqueIndex:idx_fixture_market_book_label;size:50;not null" json:"label"` // "Home"/"Draw"/"Away"/"Over"/"Under"

	// Value 是给前端看的字符串格式赔率 (如 "2.10")
	// 引擎计算后会同步更新这个字符串
	Value             string `gorm:"size:20;not null" json:"value"`
	MarketDescription string `gorm:"size:255"`
	Handicap          string `gorm:"size:50"`
	Total             string `gorm:"size:50"`
	Winning           bool   `gorm:"default:false"`
	Stopped           bool   `gorm:"default:false"`

	// --- 赔率引擎扩展字段 (新增) ---

	// BaseValue: 爬虫抓取并加完 10% Margin 后的原始数值 (用于计算基准)
	BaseValue float64 `gorm:"column:base_value;type:decimal(10,3)" json:"base_value"`

	// CurrentValue: 引擎重算后的实时数值 (用于下一次重算)
	CurrentValue float64 `gorm:"column:current_value;type:decimal(10,3)" json:"current_value"`

	// ManualOffset: 人工干预窗口 (±0.30)
	ManualOffset float64 `gorm:"column:manual_offset;type:decimal(10,3);default:0" json:"manual_offset"`

	// TotalStake: 该选项累计投注金额 (S_i)
	TotalStake float64 `gorm:"column:total_stake;type:decimal(16,2);default:0" json:"total_stake"`

	// WorstLoss: 该选项发生时的平台最坏亏损 (L_i)
	WorstLoss float64 `gorm:"column:worst_loss;type:decimal(16,2);default:0" json:"worst_loss"`

	// Signal: 该选项所属市场的信号灯状态 (注意：虽然信号灯是市场级的，但存在 Odd 里最方便查询)
	Signal int `gorm:"column:signal;default:0" json:"signal"`

	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

// Bet 记录用户的每一笔真实投注
type Bet struct {
	// 基础信息
	ID     string `gorm:"primaryKey;type:varchar(64)" json:"id"`
	UserID string `gorm:"index;type:varchar(64)" json:"user_id"`

	// 关联赔率表的关键 ID (必须记录，用于结算时找回对应的 Odd 行)
	OddID int64 `gorm:"index;not null" json:"odd_id"`

	// 冗余快照字段 (非常重要：即使 odds 表数据变了，注单里的这些信息也不能变)
	FixtureID   int64  `gorm:"index" json:"fixture_id"`
	MarketID    int    `json:"market_id"`
	BookmakerID int    `json:"bookmaker_id"`
	Selection   string `gorm:"size:50" json:"selection"` // 例如 "Home", "Over 2.5"

	// 金额与赔率 (使用 decimal 保证精度)
	Stake     float64 `gorm:"type:decimal(16,2);not null" json:"stake"`       // 投注本金
	OddsAtBet float64 `gorm:"type:decimal(10,3);not null" json:"odds_at_bet"` // 下单瞬间的实时赔率 (CurrentValue)

	// 预期数据
	PotentialPayout float64 `gorm:"type:decimal(16,2)" json:"potential_payout"` // 预期返还 (Stake * OddsAtBet)

	// 状态控制
	// pending: 待开奖, won: 中奖, lost: 未中奖, void: 无效/退本金, settled: 已派奖
	Status string `gorm:"type:varchar(20);default:'pending';index" json:"status"`

	// 时间戳
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// Outcome 对应具体的投注选项（主胜、大球等）
type Outcome struct {
	ID           string  `gorm:"primaryKey"`
	MarketID     string  `gorm:"index"`
	Name         string  // "Home", "Over"
	BaseOdds     float64 // 原始开盘赔率 (Sportmonks 转换后)
	CurrentOdds  float64 // 动态调整后的当前赔率
	TotalStake   float64 // 累计投注额
	ManualOffset float64 // 人工调整 (±0.30)
}

// MarketStateUpdate 用于 WebSocket 推送的消息体
type MarketStateUpdate struct {
	FixtureID   int64       `json:"fixture_id"`
	MarketID    int         `json:"market_id"`
	BookmakerID int         `json:"bookmaker_id"`
	Signal      SignalColor `json:"signal"`
	Outcomes    []Outcome   `json:"outcomes"`
	Line        float64     `json:"line"`
	Odds        []Odd       `json:"odd"`
}
