package model

import (
	"oddfi-web-api/config"
	"sync"
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

// 内存缓存（线程安全，Gin高并发可用）
var (
	worldCupCache sync.Map
	cacheKey      = "worldcup_2026_all_fixtures"
)

type StageStruct struct {
	ID       int       `json:"id"`
	Fixtures []Fixture `json:"fixtures"`
}

// ===================== 前端响应标准结构体 =====================
// 比赛基础信息（前端需要的所有字段）
type Fixture struct {
	ID        int    `json:"id"`         // 比赛ID
	LeagueID  int    `json:"league_id"`  // 联赛ID
	StageID   int    `json:"stage_id"`   // 阶段ID
	StageName string `json:"stage_name"` // 阶段名称(小组赛/32强/16强...)

	Name string `json:"name"` // 比赛名展示、下注单存储

	StartingAt       string `json:"starting_at"`           // 比赛开始时间
	StartAtTimeStamp int64  `json:"starting_at_timestamp"` // 比赛开始时间戳
	StateID          int    `json:"state_id"`              // 比赛状态ID

	HasOdds      bool             `json:"has_odds"`     // 是否有赔率  精选赛事卡片过滤（无赔率赛事不展示）
	Participants []APIParticipant `json:"participants"` // 队名、队徽、主客场判断
	Odds         []APIOdd         `json:"odds"`         // 赔率
	League       APILeague        `json:"league"`       // 联赛信息
	Statistics   []APIStatistics  `json:"statistics"`   // 比赛统计信息
	EnableBet    bool             `json:"enable_bet"`   // 是否可以下注
	MockActivity *MockActivity    `json:"mock_activity,omitempty"`
}

type MockActivity struct {
	ActivityID  string `json:"activity_id"`
	PeriodSec   int    `json:"period_sec"`
	BetCloseSec int    `json:"bet_close_sec"`
	SettleAtSec int    `json:"settle_at_sec"`
	Phase       string `json:"phase"`
	// remaining_sec 是给前端展示倒计时的统一字段：开盘期倒向封盘，封盘期倒向结算，避免前端理解 worker 内部状态机细节。
	RemainingSec int64  `json:"remaining_sec"`
	BetCloseAt   string `json:"bet_close_at"`
	SettleAt     string `json:"settle_at"`
}

type APIStatistics struct {
	TypeId   int    `json:"type_id"`
	Location string `json:"location"`
	Date     struct {
		Value int `json:"value"`
	} `json:"date"`
}

type APIOdd struct {
	ID int64 `json:"id"`

	FixtureID   int64  `json:"fixture_id"`   // 关联的联赛ID
	MarketID    int    `json:"market_id"`    // 按盘口分组（1=1X2, 6=亚让, 7=亚大小）
	BookmakerID int    `json:"bookmaker_id"` // 做市商 ID
	Label       string `json:"label"`        // 投注按钮文字（"Home"/"Draw"/"Away"/"Over"/"Under"）

	Value             string `json:"value"`              // 赔率值，用 string
	MarketDescription string `json:"market_description"` // 盘口说明标题（"Fulltime Result" 等）
	Handicap          string `json:"handicap"`           // 亚让球线（"−0.5" 等，前端已归一化分裂盘）
	Total             string `json:"total"`              // 大小球线（"2.5" 等，前端已归一化分裂盘）
	Winning           bool   `json:"winning"`            // 已结算赢注标记（赛后结算 UI 会需要）
	Stopped           bool   `json:"stopped"`            // 投注暂停标记（赛事中断/临开赛时禁投）
	Selection         string `json:"selection"`          // 服务端标准选项，下注时前端可直接透传

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

// League 联赛结构体 (对应SportMonks联赛API数据)
type APILeague struct {
	ID           int    `json:"id"`             // 联赛ID
	SportID      int    `json:"sport_id"`       // 运动类型ID(1=足球)
	CountryID    int    `json:"country_id"`     // 国家/地区ID
	Name         string `json:"name"`           // 联赛名称
	Active       bool   `json:"active"`         // 是否启用
	ShortCode    string `json:"short_code"`     // 联赛缩写
	ImagePath    string `json:"image_path"`     // 联赛图标地址
	Type         string `json:"type"`           // 基础类型
	SubType      string `json:"sub_type"`       // 子类型(cup_international=国际杯赛)
	LastPlayedAt string `json:"last_played_at"` // 最近比赛时间
	Category     int    `json:"category"`       // 联赛分类
	HasJerseys   bool   `json:"has_jerseys"`    // 是否拥有球队球衣数据
}

// 统一响应格式
type Response struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

// OddsAPIData 定义 Odds-API 的结构
type OddsAPIData struct {
	HomeTeam   string         `json:"home_team"`
	AwayTeam   string         `json:"away_team"`
	Bookmakers []ApiBookmaker `json:"bookmakers"`
}

type ApiBookmaker struct {
	Markets []ApiMarket `json:"markets"`
}

type ApiMarket struct {
	Key      string       `json:"key"`
	Outcomes []ApiOutcome `json:"outcomes"`
}

type ApiOutcome struct {
	OddID int     `json:"odd_id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	Point float64 `json:"point,omitempty"`
}

// PriceResponse 定义返回结构
type PriceResponse struct {
	Data struct {
		Attributes struct {
			PriceUSD string `json:"price_usd"`
			Symbol   string `json:"symbol"`
			Name     string `json:"name"`
		} `json:"attributes"`
	} `json:"data"`
}

// // TableRegistry 用于存储从配置文件读取的实际表名
// var TableRegistry struct {
// 	Leagues    string
// 	Fixtures   string
// 	Odds       string
// 	Statistics string
// }

// // 为各个模型实现 TableName 接口
// func (LeagueDB) TableName() string {
// 	return TableRegistry.Leagues
// }

// func (FixtureDB) TableName() string {
// 	return TableRegistry.Fixtures
// }

// func (OddDB) TableName() string {
// 	return TableRegistry.Odds
// }

// func (StatisticDB) TableName() string {
// 	return TableRegistry.Statistics
// }

// League 联赛模型
func (LeagueDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Leagues == "" {
		return "oddfi_prod_leagues" // 兜底默认值
	}
	return cfg.MySQL.Tables.Leagues
}

// Fixture 赛程模型
func (FixtureDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Fixtures == "" {
		return "oddfi_prod_fixtures"
	}
	return cfg.MySQL.Tables.Fixtures
}

func (OddDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Odds == "" {
		return "oddfi_prod_odds"
	}
	return cfg.MySQL.Tables.Odds
}

func (StatisticDB) TableName() string {
	cfg := config.GetConfig()
	if cfg.MySQL.Tables.Statistics == "" {
		return "oddfi_prod_statistics"
	}
	return cfg.MySQL.Tables.Statistics
}
