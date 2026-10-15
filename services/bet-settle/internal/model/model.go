package model

import (
	"time"

	"oddfi-bet-settle/config"

	"github.com/shopspring/decimal"
)

// 必须首字母大写才能被外部包引用
const (
	// StatusPending 表示注单尚未结算，可被 worker 锁定处理。
	StatusPending = "PENDING"
	// StatusLive 兼容历史下注流程中的 live 未结状态。
	StatusLive = "live"
	// StatusWon 表示注单赢，派彩为本金乘赔率。
	StatusWon = "WON"
	// StatusLost 表示注单输，派彩为 0。
	StatusLost = "LOST"
	// StatusPush 表示走水，按文档扣除 10% 后进入 claimable。
	StatusPush = "PUSH"
	// StatusVoid 表示作废或退款，派彩为本金。
	StatusVoid = "VOID"
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

	Stake     decimal.Decimal `gorm:"type:decimal(16,2)" json:"stake"`                    // 下注金额
	Odds      decimal.Decimal `gorm:"type:decimal(8,4)" json:"odds"`                      // 下注时的赔率快照
	Payout    decimal.Decimal `gorm:"type:decimal(16,2)" json:"payout"`                   // 预计赔付 (Stake * Odds)
	Status    string          `gorm:"index:idx_user_status;default:'live'" json:"status"` // live, WON, LOST
	Type      string          `gorm:"type:varchar(20)"`                                   // SINGLE, PARLAY
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"` // 【新增】记录结算更新时间
}

// TableName 按环境选择注单表，dev 环境隔离到 user_dev_bet_holding。
func (UserBetHolding) TableName() string {
	if config.GetConfig().App.Env == "dev" {
		return "user_dev_bet_holding"
	}
	return "user_bet_holding"
}

// FixtureResult 保存 spider 已经拍平后的赛果快照和结算状态。
type FixtureResult struct {
	FixtureID int64 `gorm:"primaryKey;autoIncrement:false" json:"fixture_id"` // 与 FixtureDB 的 ID 1:1 对应

	// 赛事官方状态
	StateID   int    `gorm:"index" json:"state_id"`           // 如 5
	StateCode string `gorm:"size:20;index" json:"state"`      // 如 "FT", "AET", "CANCELLED"
	StateName string `gorm:"size:20;index" json:"state_name"` // 如 "Fulltime", "AET", "Cancelled"
	// 核心比分 (扁平化，提升结算引擎读取速度)
	HomeScoreFull int `gorm:"default:0" json:"home_score_full"` // 结算全场主队进球：FT 取 CURRENT，AET/FT_PEN 取 2ND_HALF
	AwayScoreFull int `gorm:"default:0" json:"away_score_full"` // 结算全场客队进球：FT 取 CURRENT，AET/FT_PEN 取 2ND_HALF
	HomeScoreHalf int `gorm:"default:0" json:"home_score_half"` // 半场主队进球 (用于半场盘口)
	AwayScoreHalf int `gorm:"default:0" json:"away_score_half"` // 半场客队进球
	// 加时与点球比分保留给 web-api 展示使用；nil 表示数据源未提供，不能用 0 猜测。
	HomeScoreExtra   *int `gorm:"column:home_score_extra" json:"home_score_extra,omitempty"`
	AwayScoreExtra   *int `gorm:"column:away_score_extra" json:"away_score_extra,omitempty"`
	HomeScorePenalty *int `gorm:"column:home_score_penalty" json:"home_score_penalty,omitempty"`
	AwayScorePenalty *int `gorm:"column:away_score_penalty" json:"away_score_penalty,omitempty"`

	// 兜底数据源：保存 API 原始的 scores 和 events 数组
	RawScoreData string `gorm:"column:raw_score_data;type:json" json:"raw_score_data"`
	RawStateData string `gorm:"column:raw_state_data;type:json" json:"raw_state_data"`

	// 结算控制机状态
	SettlementStatus string `gorm:"size:20;default:'PENDING';index" json:"settlement_status"` // PENDING, PROCESSING, PROCESSED, ERROR
	Remark           string `gorm:"type:text" json:"remark"`                                  // 如果结算报错，记录错误堆栈或原因

	CreatedAt time.Time `gorm:"autoCreateTime;<-:create" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName 优先读取配置中的赛果快照表名；本地联调/生产 spider 可能使用 oddfi_fixture_results 这类业务前缀表。
func (FixtureResult) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.FixtureResults != "" {
		return cfg.MySQL.Tables.FixtureResults
	}
	return "fixture_results"
}

// 用户资产流水表。当前结算 worker 不伪造 before/after 快照；资产服务接入后再写入完整流水。
type AssetLedger struct {
	ID              uint64          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID          uint64          `gorm:"column:user_id;index" json:"user_id"`
	BusinessType    string          `gorm:"column:business_type;size:32" json:"business_type"`
	Amount          decimal.Decimal `gorm:"column:amount;type:decimal(40,18)" json:"amount"`
	BalanceBefore   decimal.Decimal `gorm:"column:balance_before;type:decimal(40,18)" json:"balance_before"`
	BalanceAfter    decimal.Decimal `gorm:"column:balance_after;type:decimal(40,18)" json:"balance_after"`
	FrozenBefore    decimal.Decimal `gorm:"column:frozen_before;type:decimal(40,18)" json:"frozen_before"`
	FrozenAfter     decimal.Decimal `gorm:"column:frozen_after;type:decimal(40,18)" json:"frozen_after"`
	BetLockBefore   decimal.Decimal `gorm:"column:bet_lock_before;type:decimal(40,18)" json:"bet_lock_before"`
	BetLockAfter    decimal.Decimal `gorm:"column:bet_lock_after;type:decimal(40,18)" json:"bet_lock_after"`
	StakeLockBefore decimal.Decimal `gorm:"column:stake_lock_before;type:decimal(40,18)" json:"stake_lock_before"`
	StakeLockAfter  decimal.Decimal `gorm:"column:stake_lock_after;type:decimal(40,18)" json:"stake_lock_after"`
	LiqLockBefore   decimal.Decimal `gorm:"column:liq_lock_before;type:decimal(40,18)" json:"liq_lock_before"`
	LiqLockAfter    decimal.Decimal `gorm:"column:liq_lock_after;type:decimal(40,18)" json:"liq_lock_after"`
	RefID           string          `gorm:"column:ref_id;size:64" json:"ref_id,omitempty"`
	TokenAddress    string          `gorm:"column:token_address;size:20" json:"token_address,omitempty"`
	CreatedAt       time.Time       `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

// TableName 按环境选择资产流水表；注意历史库名使用 asset_leager。
func (AssetLedger) TableName() string {
	if config.GetConfig().App.Env == "dev" {
		return "asset_leager_dev"
	}
	return "asset_leager"
}

// 用户余额记录表。ClaimableBalance 是结算后、用户 claim 前的资金承接账户。
type UserBalance struct {
	ID               uint64          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID           uint64          `gorm:"column:user_id;index" json:"user_id"`
	CoinSymbol       string          `gorm:"column:coin_symbol;size:20" json:"coin_symbol"`
	AvailableBalance decimal.Decimal `gorm:"column:available_balance;type:decimal(40,18);default:0" json:"available_balance"`
	ClaimableBalance decimal.Decimal `gorm:"column:claimable_balance;type:decimal(40,18);default:0" json:"claimable_balance"`
	FrozenBalance    decimal.Decimal `gorm:"column:frozen_balance;type:decimal(40,18);default:0" json:"frozen_balance"`
	BetLockBalance   decimal.Decimal `gorm:"column:bet_lock_balance;type:decimal(40,18);default:0" json:"bet_lock_balance"`
	StakeLockBalance decimal.Decimal `gorm:"column:stake_lock_balance;type:decimal(40,18);default:0" json:"stake_lock_balance"`
	LiqLockBalance   decimal.Decimal `gorm:"column:liq_lock_balance;type:decimal(40,18);default:0" json:"liq_lock_balance"`
	UpdateTime       time.Time       `gorm:"column:update_time;autoUpdateTime" json:"update_time"`
}

// TableName 按环境选择用户余额表，dev 环境隔离到 user_dev_balance。
func (UserBalance) TableName() string {
	if config.GetConfig().App.Env == "dev" {
		return "user_dev_balance"
	}
	return "user_balance"
}

// OddDB 保存赔率快照，结算时不再依赖实时赔率，必须以下注时快照为准。
type OddDB struct {
	// ✅ 正确：只用 API 返回的 odd_id 做主键（唯一、不重复）
	OddID int64 `gorm:"primaryKey;" json:"odd_id"` // API 返回的赔率 ID
	// 如果 API 没有稳定的 ID，或者你需要自己防重，必须建立联合唯一索引 (idx_fixture_market_book_label)
	FixtureID   int64  `gorm:"not null" json:"fixture_id"`   // 关联的联赛ID
	MarketID    int    `gorm:"not null" json:"market_id"`    // 按盘口分组（1=1X2, 6=亚让, 7=亚大小）
	BookmakerID int    `gorm:"not null" json:"bookmaker_id"` // 做市商 ID
	Label       string `gorm:"not null" json:"label"`        // 投注按钮文字（"Home"/"Draw"/"Away"/"Over"/"Under"）

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

// TableName 从配置读取赔率表名，未配置时回落到生产默认表名。
func (OddDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Odds == "" {
		return "oddfi_prod_odds"
	}
	return cfg.MySQL.Tables.Odds
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

// TableName 从配置读取 fixtures 主表名；结算服务必须与 spider 读写同一张赛事主表。
func (FixtureDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Fixtures == "" {
		return "oddfi_fixtures"
	}
	return cfg.MySQL.Tables.Fixtures
}

type APIFixture struct {
	ID           int64            `json:"id"`
	LeagueID     int              `json:"league_id"`
	Name         string           `json:"name"`
	StageID      int64            `json:"stage_id"`
	SeasonID     int64            `json:"season_id"`
	StartingAt   string           `json:"starting_at"`
	StateID      int              `json:"state_id"`
	Participants []APIParticipant `json:"participants"`
	HasOdds      bool             `json:"has_odds"`
	Odds         []APIOdd         `json:"odds"`
	Statistics   []APIStatistics  `json:"statistics"` // 只存储 TypeID = 34, 41, 84, 85 的统计信息
	Scores       []APIScore       `json:"scores"`
	State        APIState         `json:"state"`
}
type APIParticipant struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	ImagePath string `json:"image_path"`
	CountryID int    `json:"country_id"`
	Type      string `json:"type"`
	ShortCode string `json:"short_code"`
	Meta      struct {
		Location string `json:"location"` // "home" or "away"
		Winner   bool   `json:"winner"`
	} `json:"meta"`
}
type APIOdd struct {
	ID                    int64   `json:"id"`
	FixtureID             int64   `json:"fixture_id"`
	MarketID              int     `json:"market_id"`
	BookmakerID           int     `json:"bookmaker_id"`
	Label                 string  `json:"label"`
	Value                 string  `json:"value"`
	Name                  string  `json:"name"`
	SortOrder             int     `json:"sort_order"`
	MarketDescription     string  `json:"market_description"`
	Probability           string  `json:"probability"`
	Dp3                   string  `json:"dp3"`
	Fractional            string  `json:"fractional"`
	American              string  `json:"american"`
	Winning               bool    `json:"winning"`
	Stopped               bool    `json:"stopped"`
	Total                 *string `json:"total"`
	Handicap              *string `json:"handicap"`
	CreatedAt             string  `json:"created_at"`
	LatestBookmakerUpdate string  `json:"latest_bookmaker_update"`
}
type APIStatistics struct {
	ID            int64 `json:"id"`
	FixtureID     int64 `json:"fixture_id"`
	TypeID        int   `json:"type_id"`
	ParticipantID int   `json:"participant_id"`
	Data          struct {
		Value int `json:"value"`
	} `json:"data"`
	Location string `json:"location"`
}
type APIScore struct {
	ID          int64  `json:"id"`
	Description string `json:"description"` // "1ST_HALF", "CURRENT" 等
	FixtureID   int64  `json:"fixture_id"`
	TypeID      int    `json:"type_id"`
	Score       struct {
		Goals       int    `json:"goals"`
		Participant string `json:"participant"` // "home", "away"
	} `json:"score"`
}
type APIState struct {
	ID    int    `json:"id"`
	State string `json:"state"` // "FT", "CANCELLED" 等
	Name  string `json:"name"`
}
