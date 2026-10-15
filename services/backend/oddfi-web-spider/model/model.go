package model

import (
	"oddfi-web-spider/config"
	"time"
)

// Pagination 分页元数据
type Pagination struct {
	Count       int  `json:"count"`
	PerPage     int  `json:"per_page"`
	CurrentPage int  `json:"current_page"`
	HasMore     bool `json:"has_more"`
}

// RateLimit 限流元数据
type RateLimit struct {
	ResetsInSeconds int    `json:"resets_in_seconds"`
	Remaining       int    `json:"remaining"`
	RequestedEntity string `json:"requested_entity"`
}

// LeagueData API 返回的原始联赛结构 (用于解析)
type LeagueData struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	SportID      int    `json:"sport_id"`
	CountryID    int    `json:"country_id"`
	ImagePath    string `json:"image_path"`
	Active       bool   `json:"active"`
	Category     int    `json:"category"`
	Type         string `json:"type"`
	SubType      string `json:"sub_type"`
	ShortCode    string `json:"short_code"`
	LastPlayedAt string `json:"last_played_at"`
}

// -- DB Models --

// League 数据库表模型
type League struct {
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

type Fixture struct {
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

//	{
//		"id": 5,
//		"state": "FT",
//		"name": "Full Time",
//		"short_name": "FT",
//		"developer_name": "FT"
//	  }
//
// 赛事对于的状态表数据记录

// CREATE TABLE `oddfi_dev_states` (
// 	`id` int NOT NULL COMMENT '主键ID，不自增',
// 	`state` varchar(50) NOT NULL DEFAULT '' COMMENT '状态标识',
// 	`name` varchar(255) NOT NULL DEFAULT '' COMMENT '名称',
// 	`short_name` varchar(50) NOT NULL DEFAULT '' COMMENT '短名称',
// 	`developer_name` varchar(50) NOT NULL DEFAULT '' COMMENT '开发名称',
// 	PRIMARY KEY (`id`)
//   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='比赛状态配置表';

// 已废弃
type StateDB struct {
	Id            int    `gorm:"primaryKey;autoIncrement:false"`
	State         string `gorm:"size:50" json:"state"`
	Name          string `gorm:"size:255" json:"name"`
	ShortName     string `gorm:"size:50" json:"short_name"`
	DeveloperName string `gorm:"size:50" json:"developer_name"`
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

// {
// 	"id": 849134836,
// 	"fixture_id": 19683229,
// 	"type_id": 45,
// 	"participant_id": 8,
// 	"data": {
// 	  "value": 53
// 	},
// 	"location": "home"
//   },

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

type StatisticDB struct {
	ID            int64  `gorm:"primaryKey;" json:"id"`
	FixtureID     int64  `gorm:"not null" json:"fixture_id"`
	TypeID        int    `gorm:"not null" json:"type_id"`
	ParticipantID int    `gorm:"not null" json:"participant_id"`
	Value         int    `gorm:"not null" json:"value"`
	Location      string `gorm:"not null" json:"location"`
}

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

// -- API Response Structs (简略版，用于解析 JSON) --
type APIFixtureResponse struct {
	Data []APIFixture `json:"data"`
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

//	"state": {
//		"id": 5,
//		"state": "FT",
//		"name": "Full Time",
//		"short_name": "FT",
//		"developer_name": "FT"
//	  },
type APIState struct {
	ID    int    `json:"id"`
	State string `json:"state"` // "FT", "CANCELLED" 等
	Name  string `json:"name"`
}

//	{
//		"id": 19999257,
//		"fixture_id": 19683230,
//		"type_id": 1525,
//		"participant_id": 19,
//		"score": {
//		  "goals": 0,
//		  "participant": "home"
//		},
//		"description": "CURRENT"
//	  }
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

// 记录赛事相关的状态和比分详细表 为结算服务做准备
type FixtureResultDB struct {
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
	// 加时与点球比分用于 GET /v1/match/:id/state 展示；nil 表示数据源未提供，不能用 0 猜测。
	HomeScoreExtra   *int `gorm:"column:home_score_extra" json:"home_score_extra,omitempty"`
	AwayScoreExtra   *int `gorm:"column:away_score_extra" json:"away_score_extra,omitempty"`
	HomeScorePenalty *int `gorm:"column:home_score_penalty" json:"home_score_penalty,omitempty"`
	AwayScorePenalty *int `gorm:"column:away_score_penalty" json:"away_score_penalty,omitempty"`

	// 兜底数据源：保存 API 原始的 scores 和 events 数组
	RawScoreData string `gorm:"type:json" json:"raw_score_data"`
	RawStateDate string `gorm:"type:json" json:"raw_state_date"`

	// 结算控制机状态
	SettlementStatus string `gorm:"size:20;default:'PENDING';index" json:"settlement_status"` // PENDING, PROCESSING, PROCESSED, ERROR
	Remark           string `gorm:"type:text" json:"remark"`                                  // 如果结算报错，记录错误堆栈或原因

	CreatedAt time.Time `gorm:"autoCreateTime;<-:create" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (FixtureResultDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.FixtureResults == "" {
		return "oddfi_fixture_results" // 兜底默认值
	}
	return cfg.MySQL.Tables.FixtureResults
}

// League 联赛模型
func (League) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Leagues == "" {
		return "oddfi_leagues" // 兜底默认值
	}
	return cfg.MySQL.Tables.Leagues
}

// Fixture 赛程模型
func (Fixture) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Fixtures == "" {
		return "oddfi_fixtures"
	}
	return cfg.MySQL.Tables.Fixtures
}

func (OddDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Odds == "" {
		return "oddfi_odds"
	}
	return cfg.MySQL.Tables.Odds
}

func (StatisticDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Statistics == "" {
		return "oddfi_statistics"
	}
	return cfg.MySQL.Tables.Statistics
}

// state DB
func (StateDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.States == "" {
		return "oddfi_states"
	}
	return cfg.MySQL.Tables.States
}
