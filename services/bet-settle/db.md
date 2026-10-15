
# 系统已有的表
```go
// 用户 持仓 记录表
type UserBetHolding struct {
	ID     uint64 `gorm:"primaryKey;autoIncrement" json:"id"`   // 物理主键：订单号
	UserID uint64 `gorm:"index:idx_user_status" json:"user_id"` // 逻辑关联：用户ID
	OddID  int64  `gorm:"index" json:"odd_id"`                  // 投注的 marketId

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
	Status    string          `gorm:"index:idx_user_status;default:'live'"` // live, WON, LOST
	Type      string          `gorm:"type:varchar(20)"`                     // SINGLE, PARLAY
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"` // 【新增】记录结算更新时间
}

// 用户资产流水表
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

// 用户 余额 记录表
type UserBalance struct {
	ID               uint64          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID           uint64          `gorm:"column:user_id;index" json:"user_id"`
	CoinSymbol       string          `gorm:"column:coin_symbol;size:20" json:"coin_symbol"`
	AvailableBalance decimal.Decimal `gorm:"column:available_balance;type:decimal(40,18);default:0" json:"available_balance"`
	FrozenBalance    decimal.Decimal `gorm:"column:frozen_balance;type:decimal(40,18);default:0" json:"frozen_balance"`
	BetLockBalance   decimal.Decimal `gorm:"column:bet_lock_balance;type:decimal(40,18);default:0" json:"bet_lock_balance"`
	StakeLockBalance decimal.Decimal `gorm:"column:stake_lock_balance;type:decimal(40,18);default:0" json:"stake_lock_balance"`
	LiqLockBalance   decimal.Decimal `gorm:"column:liq_lock_balance;type:decimal(40,18);default:0" json:"liq_lock_balance"`
	UpdateTime       time.Time       `gorm:"column:update_time;autoUpdateTime" json:"update_time"`
}


//赔率表
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
// 基础赛事表
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
```

# 待新建的表 
```go
Match 赛事表：对接 Sportmonks 数据
type MatchDB struct {
	ID        uint64     `gorm:"primaryKey" json:"id"` // 对应 Sportmonks 的 fixture_id
	HomeTeam  string     `json:"home_team"`            // 主队名称
	AwayTeam  string     `json:"away_team"`            // 客队名称
	Status    string     `gorm:"index" json:"status"`  // 本地状态：UPCOMING, IN_PLAY, FINISHED
	StateID   int        `json:"state_id"`             // Sportmonks 原始状态 ID (5, 7, 8 等)
	HomeScore int        `json:"home_score"`           // 最终主队比分
	AwayScore int        `json:"away_score"`           // 最终客队比分
	SettledAt *time.Time `json:"settled_at"`           // 结算时间
	MatchTime time.Time  `json:"match_time"`           // 开赛时间
	CreatedAt time.Time
	UpdatedAt time.Time
}

// 待新建的表
type FixtureResult struct {
	FixtureID int64 `gorm:"primaryKey;autoIncrement:false" json:"fixture_id"` // 与 FixtureDB 的 ID 1:1 对应

	// 赛事官方状态
	StateID   int    `gorm:"index" json:"state_id"`      // 如 5
	StateCode string `gorm:"size:20;index" json:"state"` // 如 "FT", "AET", "CANCELLED"

	// 核心比分 (扁平化，提升结算引擎读取速度)
	HomeScoreFull int `gorm:"default:0" json:"home_score_full"` // 全场主队进球
	AwayScoreFull int `gorm:"default:0" json:"away_score_full"` // 全场客队进球
	HomeScoreHalf int `gorm:"default:0" json:"home_score_half"` // 半场主队进球 (用于半场盘口)
	AwayScoreHalf int `gorm:"default:0" json:"away_score_half"` // 半场客队进球

	// 兜底数据源：保存 API 原始的 scores 和 events 数组
	RawScoreData string `gorm:"type:json" json:"raw_score_data"`

	// 结算控制机状态
	SettlementStatus string `gorm:"size:20;default:'PENDING';index" json:"settlement_status"` // PENDING, PROCESSING, PROCESSED, ERROR
	Remark           string `gorm:"type:text" json:"remark"`                                  // 如果结算报错，记录错误堆栈或原因

	CreatedAt time.Time `gorm:"autoCreateTime;<-:create" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}
```