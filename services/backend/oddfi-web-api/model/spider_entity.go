package model

import "time"

// ===================  prod 数据库表模型 begin ===================
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

// League 数据库表模型
type LeagueDB struct {
	ID           int        `gorm:"primaryKey;autoIncrement:false" json:"id"`
	SportID      int        `gorm:"not null" json:"sport_id"`
	CountryID    int        `gorm:"index" json:"country_id"`
	Name         string     `gorm:"size:255;not null" json:"name"`
	Active       bool       `gorm:"default:true" json:"active"`
	ShortCode    string     `gorm:"size:50" json:"short_code"`
	ImagePath    string     `gorm:"type:text" json:"image_path"`
	Type         string     `gorm:"size:50" json:"type"`
	SubType      string     `gorm:"size:50" json:"sub_type"`
	LastPlayedAt *time.Time `gorm:"type:datetime" json:"last_played_at"`
	Category     int        `json:"category"`
	UpdatedAt    time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
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

type StatisticDB struct {
	ID            int64  `gorm:"primaryKey;autoIncrement;" json:"id"` // 保持不变
	FixtureID     int64  `gorm:"not null" json:"fixture_id"`
	TypeID        int    `gorm:"not null" json:"type_id"`
	ParticipantID int    `gorm:"not null" json:"participant_id"`
	Value         int    `gorm:"not null" json:"value"`
	Location      string `gorm:"not null" json:"location"`
}

// Bet 记录用户的每一笔真实投注
type BetDB struct {
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

// ===================  prod 数据库表模型 done ===================
