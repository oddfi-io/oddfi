package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"oddfi-web-api/model"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DBStorage struct {
	db *gorm.DB
}

// GetDB 返回内部的 GORM 实例
func (s *DBStorage) GetDB() *gorm.DB {
	return s.db
}

type FixtureRepo struct{ db *gorm.DB }

func NewFixtureRepo(s *DBStorage) *FixtureRepo {
	return &FixtureRepo{db: s.db}
}

var liveFixtureStateIDs = []int{2, 3, 4, 6, 9}

// NewDBStorage 初始化数据库连接 (只读模式)
func NewDBStorage(dsn string) *DBStorage {
	// 1. GORM 配置优化
	gormConfig := &gorm.Config{
		// 性能优化：禁用默认事务，API 场景通常是查询
		SkipDefaultTransaction: true,
		// 安全优化：禁止不带条件的全局更新/删除
		AllowGlobalUpdate: false,
		// 日志优化：如果是生产环境，建议设为 Error 或 Silent
		Logger: logger.Default.LogMode(logger.Warn),
		// 缓存预编译语句，提高查询性能
		PrepareStmt: true,
	}

	// 2. 建立连接
	db, err := gorm.Open(mysql.Open(dsn), gormConfig)
	if err != nil {
		log.Fatalf("❌ [NewDBStorage] 数据库连接失败: %v", err)
	}

	// 3. 配置底层连接池 (sql.DB)
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("❌ [NewDBStorage] 获取 sql.DB 失败: %v", err)
	}

	// 合理配置连接池参数
	sqlDB.SetMaxIdleConns(20)                  // 最大空闲连接
	sqlDB.SetMaxOpenConns(200)                 // 最大打开连接，API 建议比后台脚本略大
	sqlDB.SetConnMaxLifetime(30 * time.Minute) // 连接最大生存时间
	sqlDB.SetConnMaxIdleTime(10 * time.Minute) // 空闲连接回收时间

	// 验证连接是否真正通畅
	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("❌ [NewDBStorage] 数据库 Ping 失败: %v", err)
	}

	log.Println("✅ [MySQL] 连接成功，处于只读/生产运行模式")
	return &DBStorage{db: db}
}

// 核心组装函数 (Helper)
// 首先定义一个通用的转换函数，将 FixtureDB 转换为 model.Fixture，并处理反范式字段（Participants）。
func (r *FixtureRepo) ConvertToAPI(f *model.FixtureDB, locale string) model.Fixture {
	// 多语言支持：根据 locale 翻译赛事名称
	// 1. 获取翻译后的赛事名称（兜底中文）
	transFixtureName := GetFixtureLangName(f.Name, locale)
	// 2. 按 " vs " 分割赛事名 → 主队、客队（核心逻辑）
	teamNames := strings.Split(transFixtureName, " vs ")
	var homeName, awayName string
	if len(teamNames) == 2 {
		homeName = strings.TrimSpace(teamNames[0]) // 主队
		awayName = strings.TrimSpace(teamNames[1]) // 客队
	} else {
		// 分割失败兜底：使用原始数据库名称
		homeName = f.HomeTeamName
		awayName = f.AwayTeamName
	}

	return model.Fixture{
		ID:               int(f.ID),
		LeagueID:         f.LeagueID,
		StageID:          int(f.StageID),
		Name:             transFixtureName,
		StartingAt:       f.StartingAt.Format("2006-01-02 15:04:05"),
		StartAtTimeStamp: f.StartingAtTimestamp,
		StateID:          f.StateID,
		HasOdds:          f.HasOdds,
		// 将拍平的数据库字段还原为 API 结构
		Participants: []model.APIParticipant{
			{
				ID:        f.HomeTeamID,
				Name:      homeName,
				ImagePath: f.HomeTeamLogo,
				CountryID: f.HomeTeamCountryID,
				Type:      f.HomeType,
				ShortCode: f.HomeTeamShortCode,
				Meta: struct {
					Location string `json:"location"`
					Winner   bool   `json:"winner"`
				}{Location: "home", Winner: f.HomeTeamMetaWinner},
			},
			{
				ID:        f.AwayTeamID,
				Name:      awayName,
				ImagePath: f.AwayTeamLogo,
				CountryID: f.AwayTeamCountryID,
				Type:      f.AwayType,
				ShortCode: f.AwayTeamShortCode,
				Meta: struct {
					Location string `json:"location"`
					Winner   bool   `json:"winner"`
				}{Location: "away", Winner: f.AwayTeamMetaWinner},
			},
		},
		Odds:       make([]model.APIOdd, 0),
		Statistics: make([]model.APIStatistics, 0),
	}
}

// I18nMap 定义单条数据的多语言字典
type I18nMap map[string]string

// TournamentDict 定义赛事的全局翻译字典
var TournamentDict = map[string]I18nMap{
	// 欧洲冠军联赛
	"champions_league": {
		"en": "Champions League",
		"zh": "欧冠",
		"pt": "Liga dos Campeões",
		"ja": "チャンピオンズリーグ",
		"es": "Liga de Campeones",
		"tr": "Şampiyonlar Ligi",
		"de": "Champions League",
		"fr": "Ligue des Champions",
		"hi": "चैंपियंस लीग",
	},
	// 世界杯
	"world_cup": {
		"en": "World Cup",
		"zh": "世界杯",
		"pt": "Copa do Mundo",
		"ja": "ワールドカップ",
		"es": "Copa del Mundo",
		"tr": "Dünya Kupası",
		"de": "Weltmeisterschaft",
		"fr": "Coupe du Monde",
		"hi": "विश्व कप",
	},
	// 比利时足球甲级联赛
	"pro_league": {
		"en": "Pro League",
		"zh": "比利时足球甲级联赛", // 也可以简写为 "比甲"
		"pt": "Pro League",
		"ja": "プロ・リーグ",
		"es": "Pro League",
		"tr": "Pro League",
		"de": "Pro League",
		"fr": "Pro League",
		"hi": "प्रो लीग",
	},
}

// GetTournamentName 提供一个转换函数，包含回退（Fallback）逻辑
func GetTournamentName(tournamentKey string, lang string) string {
	if translations, ok := TournamentDict[tournamentKey]; ok {
		// 如果找到了对应的语言，直接返回
		if name, exists := translations[lang]; exists {
			return name
		}
		// 降级策略：如果找不到请求的语言，默认返回英文
		return translations["en"]
	}
	// 找不到赛事时的默认返回值
	return tournamentKey
}

func (r *FixtureRepo) EnrichFixtures(ctx context.Context, fixtures []model.Fixture, isStatistics bool, locale string) ([]model.Fixture, error) {
	if len(fixtures) == 0 {
		return fixtures, nil
	}

	fixtureIDs := make([]int64, len(fixtures))
	leagueIDs := make([]int, 0)
	idMap := make(map[int]int) // ID -> slice index
	for i, f := range fixtures {
		fixtureIDs[i] = int64(f.ID)
		leagueIDs = append(leagueIDs, f.LeagueID)
		idMap[f.ID] = i
	}

	// 1. 批量查赔率
	var odds []model.OddDB
	r.db.WithContext(ctx).Where("fixture_id IN ?", fixtureIDs).Find(&odds)
	for _, o := range odds {
		if idx, ok := idMap[int(o.FixtureID)]; ok {
			fixtures[idx].Odds = append(fixtures[idx].Odds, model.APIOdd{
				ID: o.OddID, FixtureID: o.FixtureID, MarketID: o.MarketID, BookmakerID: o.BookmakerID,
				Label: o.Label, Value: o.Value, MarketDescription: o.MarketDescription,
				Handicap: o.Handicap, Total: o.Total, Winning: o.Winning, Stopped: o.Stopped, Selection: o.Selection,
			})
		}
	}

	if isStatistics {
		// 2. 批量查统计
		var stats []model.StatisticDB
		r.db.WithContext(ctx).Where("fixture_id IN ?", fixtureIDs).Find(&stats)
		log.Printf("✅ 成功获取 %d 条统计记录", len(stats))
		// 过滤出需要的统计类型（34, 41, 84, 85)
		for _, s := range stats {
			if idx, ok := idMap[int(s.FixtureID)]; ok {
				log.Printf("✅ 成功获取赛事 %d 的统计记录", s.FixtureID)
				if s.TypeID == 34 || s.TypeID == 41 || s.TypeID == 84 || s.TypeID == 85 {
					fixtures[idx].Statistics = append(fixtures[idx].Statistics, model.APIStatistics{
						TypeId: s.TypeID, Location: s.Location, Date: struct {
							Value int `json:"value"`
						}{Value: s.Value},
					})
					log.Printf("✅ 成功添加赛事 %d 的统计记录: %d, %s, %d", s.FixtureID, s.TypeID, s.Location, s.Value)
				} else {
					log.Printf("❌ 未找到赛事 %d 的统计记录: %d, %s, %d", s.FixtureID, s.TypeID, s.Location, s.Value)
				}
			}
		}
	}

	// 3. 批量查联赛信息
	// var leagues []model.LeagueDB
	// r.db.WithContext(ctx).Where("id IN ?", leagueIDs).Find(&leagues)
	// leagueMap := make(map[int]model.LeagueDB)
	// for _, l := range leagues {
	// 	leagueMap[l.ID] = l
	// }
	for i := range fixtures {
		if fixtures[i].LeagueID == TypeLeagueEU {
			fixtures[i].League = leagueEU
			fixtures[i].League.Name = GetTournamentName(TypeLeagueEUName, locale)
		} else if fixtures[i].LeagueID == TypeLeagueWC {
			fixtures[i].League = leagueWC
			fixtures[i].League.Name = GetTournamentName(TypeLeagueWCName, locale)
		} else if fixtures[i].LeagueID == TypeLeaguePro {
			fixtures[i].League = leaguePro
			fixtures[i].League.Name = GetTournamentName(TypeLeagueProName, locale)
		} else if fixtures[i].LeagueID == TypeLeague944 {
			fixtures[i].League = leaguePro944
			fixtures[i].League.Name = TypeLeague944Name
		} else if fixtures[i].LeagueID == TypeLeague8 {
			fixtures[i].League = league8
			fixtures[i].League.Name = TypeLeague8Name
		} else if fixtures[i].LeagueID == TypeLeague301 {
			fixtures[i].League = league301
			fixtures[i].League.Name = TypeLeague301Name
		} else if fixtures[i].LeagueID == TypeLeague384 {
			fixtures[i].League = league384
			fixtures[i].League.Name = TypeLeague384Name
		} else if fixtures[i].LeagueID == TypeLeague387 {
			fixtures[i].League = league387
			fixtures[i].League.Name = TypeLeague387Name
		} else if fixtures[i].LeagueID == TypeLeague444 {
			fixtures[i].League = league444
			fixtures[i].League.Name = TypeLeague444Name
		} else if fixtures[i].LeagueID == TypeLeague462 {
			fixtures[i].League = league462
			fixtures[i].League.Name = TypeLeague462Name
		} else if fixtures[i].LeagueID == TypeLeague564 {
			fixtures[i].League = league564
			fixtures[i].League.Name = TypeLeague564Name
		} else if fixtures[i].LeagueID == TypeLeague567 {
			fixtures[i].League = league567
			fixtures[i].League.Name = TypeLeague567Name
		} else if fixtures[i].LeagueID == TypeLeague573 {
			fixtures[i].League = league573
			fixtures[i].League.Name = TypeLeague573Name
		} else if fixtures[i].LeagueID == TypeLeague600 {
			fixtures[i].League = league600
			fixtures[i].League.Name = TypeLeague600Name
		} else if fixtures[i].LeagueID == TypeLeague72 {
			fixtures[i].League = league72
			fixtures[i].League.Name = TypeLeague72Name
		} else if fixtures[i].LeagueID == TypeLeague779 {
			fixtures[i].League = league779
			fixtures[i].League.Name = TypeLeague779Name
		} else if fixtures[i].LeagueID == TypeLeague301 {
			fixtures[i].League = league301
			fixtures[i].League.Name = TypeLeague301Name
		} else if fixtures[i].LeagueID == TypeLeague9 {
			fixtures[i].League = league9
			fixtures[i].League.Name = TypeLeague9Name
		} else if fixtures[i].LeagueID == TypeLeaguePro {
			fixtures[i].League = leaguePro208
			fixtures[i].League.Name = TypeLeagueProName
		}
	}

	return fixtures, nil
}

// GetFixtureByID 单条详情：MySQL 拿 fixture 行，再批量拉 odds / statistics / league，组装为 model.Fixture
func (r *FixtureRepo) GetFixtureByID(ctx context.Context, id int64, isStatistics bool, locale string, onlyLive bool) (*model.Fixture, error) {
	var f model.FixtureDB
	query := r.db.WithContext(ctx)
	if onlyLive {
		query = query.Where("state_id IN ?", liveFixtureStateIDs)
	}
	if err := query.Where("id = ?", id).First(&f).Error; err != nil {
		return nil, err
	}

	apiFixture := r.ConvertToAPI(&f, locale)
	result, err := r.EnrichFixtures(ctx, []model.Fixture{apiFixture}, isStatistics, locale)
	if err != nil || len(result) == 0 {
		return nil, err
	}
	return &result[0], nil
}

// GetFixturesByDate 按日期查询所有赛事：MySQL 拿 fixture 行，再批量拉 odds / statistics / league，组装为 model.Fixture
func (r *FixtureRepo) GetFixturesByDate(ctx context.Context, date string, locale string, onlyLive bool) ([]model.Fixture, error) {
	var dbFixtures []model.FixtureDB
	start, _ := time.Parse("2006-01-02", date)
	end := start.Add(24 * time.Hour)

	query := r.db.WithContext(ctx)
	if onlyLive {
		query = query.Where("state_id IN ?", liveFixtureStateIDs)
	}

	err := query.
		Where("starting_at >= ? AND starting_at < ?", start, end).
		Order("starting_at_timestamp ASC").
		Find(&dbFixtures).Error
	if err != nil {
		return nil, err
	}

	apiFixtures := make([]model.Fixture, len(dbFixtures))
	for i := range dbFixtures {
		apiFixtures[i] = r.ConvertToAPI(&dbFixtures[i], locale)
	}

	return r.EnrichFixtures(ctx, apiFixtures, false, locale)
}

var TypeLeagueEU = 2 // 欧洲联赛
var TypeLeagueEUName = "champions_league"

var TypeLeagueWC = 732 // 世界杯
var TypeLeagueWCName = "world_cup"

var TypeLeaguePro = 208 // 比利时足球联赛
var TypeLeagueProName = "pro_league"
var leaguePro208 = model.APILeague{
	ID:           208,
	SportID:      1,
	CountryID:    556,
	Name:         "Pro League",
	Active:       true,
	ShortCode:    "BEL FDA",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/16/208.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-21 18:30:00",
	Category:     1,
	HasJerseys:   false,
}
var TypeLeague944 = 944 // 比利时足球联赛
var TypeLeague944Name = "pro_league"
var leaguePro944 = model.APILeague{
	ID:           944,
	SportID:      1,
	CountryID:    35376,
	Name:         "Pro League",
	Active:       true,
	ShortCode:    "SAU PL",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/16/944.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-15 18:00:00",
	Category:     2,
	HasJerseys:   false,
}

var TypeLeague8 = 8 // 英格兰足球超级联赛
var TypeLeague8Name = "premier_league"
var league8 = model.APILeague{
	ID:           8,
	SportID:      1,
	CountryID:    462,
	Name:         "Premier League",
	Active:       true,
	ShortCode:    "UK PL",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/8/8.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-21 19:00:00",
	Category:     1,
	HasJerseys:   false,
}

var TypeLeague82 = 82 // 德国足球超级联赛
var TypeLeague82Name = "Bundesliga"
var league82 = model.APILeague{
	ID:           82,
	SportID:      1,
	CountryID:    11,
	Name:         "Bundesliga",
	Active:       true,
	ShortCode:    "GER BI",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/18/82.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-19 17:30:00",
	Category:     1,
	HasJerseys:   false,
}

var TypeLeague779 = 779 // 美国足球超级联赛
var TypeLeague779Name = "Major League Soccer"
var league779 = model.APILeague{
	ID:           779,
	SportID:      1,
	CountryID:    3483,
	Name:         "Major League Soccer",
	Active:       true,
	ShortCode:    "USA MLS",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/11/779.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-19 23:00:00",
	Category:     2,
	HasJerseys:   false,
}

var TypeLeague573 = 573 // 瑞典足球超级联赛
var TypeLeague573Name = "Allsvenskan"
var league573 = model.APILeague{
	ID:           573,
	SportID:      1,
	CountryID:    47,
	Name:         "Allsvenskan",
	Active:       true,
	ShortCode:    "SWE AL",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/29/573.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-19 14:30:00",
	Category:     2,
	HasJerseys:   false,
}
var TypeLeague444 = 444 // 挪威足球超级联赛
var TypeLeague444Name = "Eliteserien"
var league444 = model.APILeague{
	ID:           444,
	SportID:      1,
	CountryID:    1578,
	Name:         "Eliteserien",
	Active:       true,
	ShortCode:    "NOR TL",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/28/444.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-19 17:15:00",
	Category:     2,
	HasJerseys:   false,
}
var TypeLeague462 = 462 // 葡萄牙足球超级联赛
var TypeLeague462Name = "Liga Portugal"
var league462 = model.APILeague{
	ID:           462,
	SportID:      1,
	CountryID:    20,
	Name:         "Liga Portugal",
	Active:       true,
	ShortCode:    "PRT PL",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/14/462.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-20 19:15:00",
	Category:     1,
	HasJerseys:   false,
}
var TypeLeague600 = 600 // 土耳其足球超级联赛
var TypeLeague600Name = "Super Lig"
var league600 = model.APILeague{
	ID:           600,
	SportID:      1,
	CountryID:    404,
	Name:         "Super Lig",
	Active:       true,
	ShortCode:    "TUR SL",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/24/600.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-20 17:00:00",
	Category:     2,
	HasJerseys:   false,
}
var TypeLeague72 = 72 // 荷兰足球超级联赛
var TypeLeague72Name = "Eredivisie"
var league72 = model.APILeague{
	ID:           72,
	SportID:      1,
	CountryID:    38,
	Name:         "Eredivisie",
	Active:       true,
	ShortCode:    "NLD E",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/72.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-12 14:45:00",
	Category:     1,
	HasJerseys:   false,
}
var TypeLeague9 = 9 // 英格兰足球超级联赛
var TypeLeague9Name = "Championship"
var league9 = model.APILeague{
	ID:           9,
	SportID:      1,
	CountryID:    462,
	Name:         "Championship",
	Active:       true,
	ShortCode:    "UK CHAMP",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/9/9.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-21 18:45:00",
	Category:     2,
	HasJerseys:   false,
}

var TypeLeague387 = 387 // 意大利足球超级联赛
var TypeLeague387Name = "Serie B"
var league387 = model.APILeague{
	ID:           387,
	SportID:      1,
	CountryID:    251,
	Name:         "Serie B",
	Active:       true,
	ShortCode:    "ITA SB",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/3/387.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-19 17:30:00",
	Category:     2,
	HasJerseys:   false,
}
var TypeLeague384 = 384 // 意大利足球超级联赛
var TypeLeague384Name = "Serie A"
var league384 = model.APILeague{
	ID:           384,
	SportID:      1,
	CountryID:    251,
	Name:         "Serie A",
	Active:       true,
	ShortCode:    "ITA SA",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/0/384.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-20 18:45:00",
	Category:     1,
	HasJerseys:   false,
}
var TypeLeague564 = 564 // 西班牙足球足球超级联赛
var TypeLeague564Name = "La Liga"
var league564 = model.APILeague{
	ID:           564,
	SportID:      1,
	CountryID:    32,
	Name:         "La Liga",
	Active:       true,
	ShortCode:    "ESP PL",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/20/564.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-21 19:30:00",
	Category:     1,
	HasJerseys:   false,
}

var TypeLeague567 = 567 // 西班牙足球足球超级联赛
var TypeLeague567Name = "La Liga 2"
var league567 = model.APILeague{
	ID:           567,
	SportID:      1,
	CountryID:    32,
	Name:         "La Liga 2",
	Active:       true,
	ShortCode:    "ESP S",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/23/567.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-20 18:30:00",
	Category:     2,
	HasJerseys:   false,
}

var TypeLeague301 = 301 // 法国足球超级联赛
var TypeLeague301Name = "Ligue 1"
var league301 = model.APILeague{
	ID:           301,
	SportID:      1,
	CountryID:    17,
	Name:         "Ligue 1",
	Active:       true,
	ShortCode:    "FRA L1",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/13/301.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-19 18:45:00",
	Category:     1,
	HasJerseys:   false,
}

var leagueEU = model.APILeague{
	ID:           2,
	SportID:      1,
	CountryID:    41,
	Name:         "Champions League",
	Active:       true,
	ShortCode:    "UEFA CL",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/2.png",
	Type:         "league",
	SubType:      "cup_international",
	LastPlayedAt: "2026-04-14 19:00:00",
	Category:     1,
	HasJerseys:   false,
}

var leagueWC = model.APILeague{
	ID:           732,
	SportID:      1,
	CountryID:    99474,
	Name:         "世界杯",
	Active:       true,
	ShortCode:    "FIFA WC",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/28/732.png",
	Type:         "league",
	SubType:      "cup_international",
	LastPlayedAt: "2014-07-05 20:00:00",
	Category:     1,
	HasJerseys:   true,
}

var leaguePro = model.APILeague{
	ID:           208,
	SportID:      1,
	CountryID:    556,
	Name:         "Pro League",
	Active:       true,
	ShortCode:    "BEL FDA",
	ImagePath:    "https://cdn.sportmonks.com/images/soccer/leagues/16/208.png",
	Type:         "league",
	SubType:      "domestic",
	LastPlayedAt: "2026-04-19 17:15:00",
	Category:     1,
	HasJerseys:   false,
}

// // GetFixturesByRange (区间 + 权重排序)
// func (r *FixtureRepo) GetFixturesByRange(ctx context.Context, start, end string) ([]model.Fixture, error) {
// 	var dbFixtures []model.FixtureDB
// 	startTime, _ := time.Parse("2006-01-02", start)
// 	endTime, _ := time.Parse("2006-01-02", end)
// 	endTime = endTime.Add(24 * time.Hour)

// 	// 跨表查询：按联赛权重 category 升序，时间升序
// 	err := r.db.WithContext(ctx).
// 		Table("fixtures").
// 		Select("fixtures.*").
// 		Joins("JOIN leagues ON leagues.id = fixtures.league_id").
// 		Where("fixtures.starting_at >= ? AND fixtures.starting_at < ?", startTime, endTime).
// 		Order("leagues.category ASC, fixtures.starting_at_timestamp ASC").
// 		Find(&dbFixtures).Error

// 	if err != nil {
// 		return nil, err
// 	}

// 	apiFixtures := make([]model.Fixture, len(dbFixtures))
// 	for i := range dbFixtures {
// 		apiFixtures[i] = r.ConvertToAPI(&dbFixtures[i])
// 	}
// 	return r.EnrichFixtures(ctx, apiFixtures)
// }

// GetFixturesByRange 按区间查询（闭区间；按时间戳 ASC 排序）
func (r *FixtureRepo) GetFixturesByRange(ctx context.Context, start, end string, locale string, onlyLive bool) ([]model.Fixture, error) {
	var dbFixtures []model.FixtureDB

	// 1. 解析日期字符串为 time.Time
	// 假设输入格式为 "2006-01-02"
	startTime, err := time.ParseInLocation("2006-01-02", start, time.Local)
	if err != nil {
		return nil, fmt.Errorf("invalid start date: %v", err)
	}

	endTime, err := time.ParseInLocation("2006-01-02", end, time.Local)
	if err != nil {
		return nil, fmt.Errorf("invalid end date: %v", err)
	}

	// 为了覆盖结束日期的全天，将 endTime 设置为当天的 23:59:59
	endTime = endTime.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	// 2. 执行单表查询
	// 使用索引 idx_league_time (包含 StartingAt) 或直接按 StartingAt 过滤
	query := r.db.WithContext(ctx)
	if onlyLive {
		query = query.Where("state_id IN ?", liveFixtureStateIDs)
	}

	err = query.
		Where("starting_at >= ? AND starting_at <= ?", startTime, endTime).
		Order("starting_at_timestamp ASC").
		Find(&dbFixtures).Error

	if err != nil {
		log.Printf("❌ 查询 Fixtures 区间失败 [%s - %s]: %v", start, end, err)
		return nil, err
	}

	// 3. 转换为 API 模型结构
	apiFixtures := make([]model.Fixture, len(dbFixtures))
	for i := range dbFixtures {
		// 调用之前定义的转换函数，处理 Home/Away Team 的反范式组装
		apiFixtures[i] = r.ConvertToAPI(&dbFixtures[i], locale)
	}

	// 4. 批量填充关联数据（Odds, Statistics, League 信息）
	// 这个方法内部会执行 3 次批量查询（MGET 思想），避免 N+1 问题
	return r.EnrichFixtures(ctx, apiFixtures, false, locale)
}

func (r *FixtureRepo) GetFixturesByLeagueID(ctx context.Context, leagueID int, pageNum int, locale string, countryId string, onlyLive bool) ([]model.Fixture, error) {
	var dbFixtures []model.FixtureDB

	// 1. 分页兜底，防止出现负数 Offset 导致 SQL 报错
	if pageNum < 1 {
		pageNum = 1
	}

	// 2. 初始化干净的查询链
	query := r.db.WithContext(ctx)
	// 3. 根据条件追加 where
	if leagueID == 0 {
		// 特判：查询其他小国比赛
		query = query.Where("league_id NOT IN ?", []int{2, 732}) // GORM 支持直接传 slice
	} else {
		query = query.Where("league_id = ?", leagueID)
	}

	// 4. 追加只看滚球的条件
	if onlyLive {
		// 注意：确保 liveFixtureStateIDs 是一个 []int 或类似的 slice 类型
		query = query.Where("state_id IN ?", liveFixtureStateIDs)
	}

	//5. 筛选指定国家
	if countryId != "" {
		// 字符串转int
		countryIdNum, err := strconv.Atoi(countryId)
		if err == nil {
			query = query.Where("home_team_country_id = ?", countryIdNum)
		}
	}

	// 5. 执行查询
	err := query.Offset((pageNum - 1) * 25).
		Limit(25).
		Order("starting_at_timestamp ASC").
		Find(&dbFixtures).Error

	if err != nil {
		log.Printf("❌ GetFixturesByLeagueID Fixtures  [%d]: %v", leagueID, err)
		return nil, err
	}

	// 6. 数据转换
	apiFixtures := make([]model.Fixture, len(dbFixtures))
	for i := range dbFixtures {
		apiFixtures[i] = r.ConvertToAPI(&dbFixtures[i], locale)
	}

	return r.EnrichFixtures(ctx, apiFixtures, false, locale)
}

// func (r *FixtureRepo) GetFixturesByLeagueID(ctx context.Context, leagueID int, pageNum int, locale string, onlyLive bool) ([]model.Fixture, error) {
// 	var dbFixtures []model.FixtureDB

// 	query := r.db.WithContext(ctx).Where("league_id = ?", leagueID)
// 	if leagueID == 0 {
// 		//特判：查询其他小国比赛
// 		query = r.db.WithContext(ctx).Where("league_id not in ?", []int{2, 732})
// 	}

// 	if onlyLive {
// 		query = query.Where("state_id IN ?", liveFixtureStateIDs)
// 	}

// 	err := query.Offset((pageNum - 1) * 25).Limit(25).Order("starting_at_timestamp ASC").Find(&dbFixtures).Error
// 	// ... 转换逻辑同上 ...
// 	if err != nil {
// 		log.Printf("❌ GetFixturesByLeagueID Fixtures  [%d]: %v", leagueID, err)
// 		return nil, err
// 	}

// 	apiFixtures := make([]model.Fixture, len(dbFixtures))
// 	for i := range dbFixtures {
// 		apiFixtures[i] = r.ConvertToAPI(&dbFixtures[i], locale)
// 	}
// 	return r.EnrichFixtures(ctx, apiFixtures, false, locale)
// }

func (r *FixtureRepo) GetStageByID(ctx context.Context, stageID int, locale string, onlyLive bool) ([]model.Fixture, error) {
	var dbFixtures []model.FixtureDB

	query := r.db.WithContext(ctx).Where("stage_id = ?", stageID)
	if onlyLive {
		query = query.Where("state_id IN ?", liveFixtureStateIDs)
	}

	err := query.Order("starting_at_timestamp ASC").Find(&dbFixtures).Error

	if err != nil {
		log.Printf("❌ GetStageByID Fixtures  [%d]: %v", stageID, err)
		return nil, err
	}

	apiFixtures := make([]model.Fixture, len(dbFixtures))
	for i := range dbFixtures {
		apiFixtures[i] = r.ConvertToAPI(&dbFixtures[i], locale)
	}
	return r.EnrichFixtures(ctx, apiFixtures, false, locale)
}

// 1. 定义与Python生成的JSON完全匹配的结构体
type FixtureLangMapping map[string]map[string]string

// 2. 全局映射表（程序启动加载一次，常驻内存）
var (
	fixtureLangMap FixtureLangMapping
	loadMapOnce    sync.Once
)

// LoadFixtureLangMapping 程序初始化时调用：加载本地语言映射文件
func LoadFixtureLangMapping(filePath string) error {
	var loadErr error
	loadMapOnce.Do(func() {
		// 读取JSON文件
		data, err := os.ReadFile(filePath)
		if err != nil {
			loadErr = err
			return
		}
		// 反序列化到内存映射表
		err = json.Unmarshal(data, &fixtureLangMap)
		if err != nil {
			loadErr = err
			return
		}
	})
	return loadErr
}

// GetFixtureLangName 根据中文名称+语言获取翻译名称
func GetFixtureLangName(zhName string, locale string) string {
	// 未加载映射 / 无中文key / 无对应语言 → 兜底返回原始名称
	if fixtureLangMap == nil {
		log.Printf("❌ 未加载语言映射表")
		return zhName
	}
	langMap, ok := fixtureLangMap[zhName]
	if !ok {
		log.Printf("❌ 未找到中文名称 %s 的翻译", zhName)
		return zhName
	}
	name, ok := langMap[locale]
	if !ok {
		log.Printf("❌ 未找到语言 %s 的翻译", locale)
		return zhName
	}
	log.Printf("✅ 成功获取语言 %s 的翻译: %s", locale, name)
	return name
}
