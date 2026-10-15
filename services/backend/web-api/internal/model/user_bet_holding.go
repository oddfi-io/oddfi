package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"

	"github.com/shopspring/decimal"
)

// 用户 持仓 记录表
type UserBetHolding struct {
	ID          uint64 `gorm:"primaryKey;autoIncrement" json:"id"`                                                              // 物理主键：订单号
	UserID      uint64 `gorm:"index:idx_user_status;uniqueIndex:idx_user_client_ref_odd" json:"user_id"`                        // 逻辑关联：用户ID
	OddID       int64  `gorm:"index;uniqueIndex:idx_user_client_ref_odd" json:"odd_id"`                                         // 投注的 marketId
	ClientRefID string `gorm:"column:client_ref_id;size:64;uniqueIndex:idx_user_client_ref_odd" json:"client_ref_id,omitempty"` // 客户端幂等键，防止重试重复下注

	// 【新增】玩法与盘口特征（对应文档 judgeBet 依赖）
	Market       string          `gorm:"type:varchar(20)" json:"market"`         // 玩法：fulltime_result, asian_handicap, asian_over_under
	Label        string          `gorm:"type:varchar(20)" json:"label"`          // 投注项：1(主), 2(客), over(大), under(小)
	HandicapLine decimal.Decimal `gorm:"type:decimal(8,2)" json:"handicap_line"` // 盘口线：例如 -0.5, 2.5 (大小球线也复用此字段)

	// 【改造】拆分预计与实际派彩
	EstimatedPayout decimal.Decimal `gorm:"type:decimal(16,2)" json:"estimated_payout"` // 预计赔付 (Stake * Odds)
	ActualPayout    decimal.Decimal `gorm:"type:decimal(16,2)" json:"actual_payout"`    // 【新增】实际派彩 (WON满赔, PUSH退本金/扣手续费, LOST为0)

	Stake     decimal.Decimal `gorm:"type:decimal(16,2)" json:"stake"`      // 下注金额
	Odds      decimal.Decimal `gorm:"type:decimal(8,4)" json:"odds"`        // 下注时的赔率快照
	Payout    decimal.Decimal `gorm:"type:decimal(16,2)" json:"payout"`     // 预计赔付 (Stake * Odds)
	Status    string          `gorm:"index:idx_user_status;default:'live'"` // 注单原始状态：live/pending=未结算；WON/LOST/PUSH/VOID=结算结果；CANCELLED=撤单；CLAIMED=历史领取状态
	Type      string          `gorm:"type:varchar(20)"`                     // SINGLE, PARLAY
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"` // 【新增】记录结算更新时间
}

func (UserBetHolding) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "user_bet_holding_dev"
	}
	return "user_bet_holding"
}

// ===================  prod 数据库表模型  ===================
type OddDB struct {
	OddID int64 `gorm:"primaryKey;" json:"odd_id"` // API 返回的赔率 ID
	// 如果 API 没有稳定的 ID，或者你需要自己防重，必须建立联合唯一索引 (idx_fixture_market_book_label)
	FixtureID   int64  `gorm:"uniqueIndex:idx_fixture_market_book_label;not null" json:"fixture_id"`    // 关联的联赛ID
	MarketID    int    `gorm:"uniqueIndex:idx_fixture_market_book_label;not null" json:"market_id"`     // 按盘口分组（1=1X2, 6=亚让, 7=亚大小）
	BookmakerID int    `gorm:"uniqueIndex:idx_fixture_market_book_label;not null" json:"bookmaker_id"`  // 做市商 ID
	Label       string `gorm:"uniqueIndex:idx_fixture_market_book_label;size:50;not null" json:"label"` // 投注按钮文字（"Home"/"Draw"/"Away"/"Over"/"Under"）

	FixtureName       string `gorm:"size:255"`                      // 赛事名称
	FixtureTime       string `gorm:"size:255"`                      // 赛事时间
	Value             string `gorm:"size:20;not null" json:"value"` // 赔率值，用 string
	MarketDescription string `gorm:"size:255"`                      // 盘口说明标题（"Fulltime Result" 等）
	Handicap          string `gorm:"size:50"`                       // 亚让球线（"−0.5" 等，前端已归一化分裂盘）
	Total             string `gorm:"size:50"`                       // 大小球线（"2.5" 等，前端已归一化分裂盘）
	Winning           bool   `gorm:"default:false"`                 // 已结算赢注标记（赛后结算 UI 会需要）
	Stopped           bool   `gorm:"default:false"`                 // 投注暂停标记（赛事中断/临开赛时禁投）
	Selection         string `gorm:"size:50"`                       // 选择（"Home"/"Draw"/"Away"/"Over"/"Under"）
	UpdatedAt         int64  `gorm:"autoUpdateTime"`                // 毫秒级时间戳
}

type FixtureDB struct {
	ID int64 `gorm:"primaryKey;autoIncrement:false"`
	// 优化：增加联合索引，加速按联赛+时间范围的查询
	LeagueID            int       `gorm:"index:idx_league_time;index"`
	Name                string    `gorm:"size:255"`
	StartingAt          time.Time `gorm:"type:datetime;index:idx_league_time;index"`
	StartingAtTimestamp int64     `gorm:"index"`
	StateID             int       `gorm:"index"`

	StageID  int64 `gorm:"index"`
	SeasonID int64 `gorm:"index"`

	// 拍平的主客队信息 (反范式)
	HomeTeamID           int    `gorm:"index"` // 增加 ID 索引，方便查某个队的往绩
	HomeTeamName         string `gorm:"size:255"`
	HomeTeamLogo         string `gorm:"size:500"`
	HomeTeamCountryID    int
	HomeTeamMetaLocation string `gorm:"size:50"`
	HomeType             string `gorm:"size:50"`
	HomeTeamMetaWinner   bool   `gorm:"default:false"`
	HomeTeamShortCode    string `gorm:"size:50"`

	AwayTeamID           int    `gorm:"index"`
	AwayTeamName         string `gorm:"size:255"`
	AwayTeamLogo         string `gorm:"size:500"`
	AwayTeamCountryID    int
	AwayTeamMetaLocation string `gorm:"size:50"`
	AwayType             string `gorm:"size:50"`
	AwayTeamMetaWinner   bool   `gorm:"default:false"`
	AwayTeamShortCode    string `gorm:"size:50"`

	HasOdds bool `gorm:"default:false"`

	// 关键优化：
	// 1. 显式记录创建时间，且禁止在 Update 时覆盖 (<-:create 表示仅创建时写入)
	CreatedAt time.Time `gorm:"autoCreateTime;<-:create"`
	// 2. 自动更新时间
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

func (OddDB) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "oddfi_dev_odds"
	}
	return "oddfi_odds"
}

func (FixtureDB) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "oddfi_dev_fixtures"
	}
	return "oddfi_fixtures"
}
