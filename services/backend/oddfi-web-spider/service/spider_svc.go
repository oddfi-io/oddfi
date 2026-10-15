// package service

// import (
// 	"log"
// 	"oddfi-web-spider/internal/client"
// 	"oddfi-web-spider/internal/model"
// 	"oddfi-web-spider/internal/storage"
// 	"time"
// )

// type SpiderService struct {
// 	restClient *client.RestClient
// 	db         *storage.DBStorage
// }

// func NewSpiderService(rc *client.RestClient, db *storage.DBStorage) *SpiderService {
// 	return &SpiderService{restClient: rc, db: db}
// }

// // SyncFixturesByDate 拉取指定日期的比赛，扁平化后入库
// func (s *SpiderService) SyncFixturesByDate(date string) {
// 	log.Printf("开始同步日期赛程: %s", date)

// 	// 1. 调用 API Client 获取原始数据 (假设封装好了带限流的 GetFixtures)
// 	rawFixtures, err := s.restClient.GetFixturesByDate(date)
// 	if err != nil {
// 		log.Printf("Fetch error: %v", err)
// 		return
// 	}

// 	var dbFixtures []model.Fixture

// 	// 2. 数据清洗与反范式拍平
// 	for _, raw := range rawFixtures {
// 		fix := model.Fixture{
// 			ID:       raw.ID,
// 			LeagueID: raw.LeagueID,
// 			Name:     raw.Name,
// 			StateID:  raw.StateID,
// 		}

// 		// 解析时间
// 		if t, err := time.Parse("2006-01-02 15:04:05", raw.StartingAt); err == nil {
// 			fix.StartingAt = t
// 			fix.StartingAtTimestamp = t.Unix()
// 		}

// 		// 核心：拍平 Participants 数组
// 		for _, p := range raw.Participants {
// 			if p.Meta.Location == "home" {
// 				fix.HomeTeamID = p.ID
// 				fix.HomeTeamName = p.Name
// 				fix.HomeTeamLogo = p.ImagePath
// 			} else if p.Meta.Location == "away" {
// 				fix.AwayTeamID = p.ID
// 				fix.AwayTeamName = p.Name
// 				fix.AwayTeamLogo = p.ImagePath
// 			}
// 		}
// 		dbFixtures = append(dbFixtures, fix)
// 	}

// 	// 3. 落库
// 	if err := s.db.UpsertFixtures(dbFixtures); err != nil {
// 		log.Printf("DB Upsert Error: %v", err)
// 	} else {
// 		log.Printf("✅ 成功同步 %d 条赛程数据", len(dbFixtures))
// 	}
// }

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"oddfi-web-spider/client"
	"oddfi-web-spider/model"
	"oddfi-web-spider/storage"
	"oddfi-web-spider/utils"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"
)

type SpiderService struct {
	restClient   *client.RestClient
	db           *storage.DBStorage
	moneylineSvc *MoneylineService
}

func NewSpiderService(rc *client.RestClient, db *storage.DBStorage) *SpiderService {
	return &SpiderService{restClient: rc, db: db}
}

func (s *SpiderService) AttachMoneylineService(moneylineSvc *MoneylineService) {
	s.moneylineSvc = moneylineSvc
}

// // SyncLeagues 定期同步所有联赛元数据
// func (s *SpiderService) SyncLeagues(ctx context.Context) {
// 	log.Println("[SyncLeagues] 开始同步全量联赛数据...")

// 	// 假设 client 已经封装了处理分页并返回 []model.LeagueData 的方法
// 	rawLeagues, err := s.restClient.GetAllLeagues(ctx)
// 	if err != nil {
// 		log.Printf("[SyncLeagues] 同步联赛失败: %v", err)
// 		return
// 	}

// 	var dbLeagues []model.League
// 	for _, l := range rawLeagues {
// 		dbLeagues = append(dbLeagues, model.League{
// 			ID:           l.ID,
// 			Name:         l.Name,
// 			SportID:      l.SportID,
// 			CountryID:    l.CountryID,
// 			ImagePath:    l.ImagePath,
// 			Active:       l.Active,
// 			Category:     l.Category,
// 			Type:         l.Type,
// 			SubType:      l.SubType,
// 			ShortCode:    l.ShortCode,
// 			LastPlayedAt: utils.ParseStrToTime(&l.LastPlayedAt),
// 		})
// 	}

// 	if err := s.db.UpsertLeagues(dbLeagues); err != nil {
// 		log.Printf("[SyncLeagues] 联赛入库失败: %v", err)
// 	}
// 	log.Printf("✅ [SyncLeagues] 联赛同步完成，共 %d 条", len(dbLeagues))
// }

// SyncFixturesRange 同步一个日期范围内的赛程（用于首页 7 天滚动）
func (s *SpiderService) SyncFixturesRange(ctx context.Context, start, end string) {
	log.Printf("开始同步赛程范围: %s -> %s", start, end)

	// 调用 API 接口 2: GET /v3/football/fixtures/between/{start}/{end}
	rawFixtures, err := s.restClient.GetFixturesBetween(ctx,
		start,
		end,
	)
	if err != nil {
		log.Printf("范围同步失败: %v", err)
		return
	}

	s.processAndSaveFixtures(ctx, rawFixtures)
}

func (s *SpiderService) SyncFixturesByDate(ctx context.Context, date string) {
	log.Printf("开始同步日期赛程: %s", date)

	//补全 restClient.GetFixturesByDate(date)
	rawFixtures, err := s.restClient.GetFixturesByDate(ctx, date)
	if err != nil {
		log.Printf("Fetch error: %v", err)
		return
	}
	s.processAndSaveFixtures(ctx, rawFixtures)
}

// SyncFixturesRange 同步一个日期范围内的赛程（用于首页 7 天滚动）
func (s *SpiderService) SyncFixturesAll(ctx context.Context) {
	log.Printf("=========开始定时同步所有赛程========")

	// 调用 API 接口 2: GET /v3/football/fixtures/{id}
	rawFixturesAll := make([]model.APIFixture, 0)

	// 定时采集指定所有的世界杯数据
	for _, id := range utils.FixtureWorldCupAllIDs {
		rawFixtures, err := s.restClient.GetWCFixtureByID(ctx, id)
		if err != nil {
			log.Printf("[GetWCFixtureByID] 同步 %s 失败，失败: %v", id, err)
			continue
		}
		rawFixturesAll = append(rawFixturesAll, rawFixtures)
		log.Printf("✅ GetWCFixtureByID 成功同步 %s", id)
		time.Sleep(1 * time.Second)
	}
	log.Printf("✅ [GetWCFixtureByID] 成功同步 %d 条世界杯赛程数据", len(rawFixturesAll))

	// 定时采集指定所有的欧洲联赛数据
	for _, id := range utils.FixtureEuAllIDs {
		rawFixtures, err := s.restClient.GetEUFixtureByID(ctx, id)
		if err != nil {
			log.Printf("[GetEUFixtureByID] 同步 %s 失败，失败: %v", id, err)
			continue
		}
		rawFixturesAll = append(rawFixturesAll, rawFixtures)
		log.Printf("✅ GetEUFixtureByID 成功同步 %s", id)
		time.Sleep(1 * time.Second)
	}
	log.Printf("✅ GetEUFixtureByID 成功同步 %d 条欧洲联赛赛程数据", len(rawFixturesAll))

	// 定时采集指定所有的其他联赛数据
	for _, id := range utils.FixtureOtherAllIDs {
		rawFixtures, err := s.restClient.GetOtherFixtureByID(ctx, id)
		if err != nil {
			log.Printf("[GetOtherFixtureByID] 同步 %s 失败，失败: %v", id, err)
			continue
		}
		//state=5 已经完赛的比赛 需要正常更新 不能阻碍正常结算
		if rawFixtures.StateID == 5 {
			log.Printf("[GetOtherFixtureByID] 已完赛的比赛 %s ", id)
		}
		rawFixturesAll = append(rawFixturesAll, rawFixtures)
		log.Printf("✅ GetOtherFixtureByID 成功同步 %s", id)
		time.Sleep(1 * time.Second)
	}
	log.Printf("✅ GetOtherFixtureByID 成功同步 %d 条其他联赛赛程数据", len(rawFixturesAll))

	//统一入库数据
	s.processAndSaveFixtures(ctx, rawFixturesAll)
}

// SyncFixturesRange 同步一个日期范围内的赛程（用于首页 7 天滚动）
func (s *SpiderService) SyncFixturesAllLocal(ctx context.Context) {
	log.Printf("=========开始定时同步所有欧洲联赛赛程数据========")

	// 调用 API 接口 2: GET /v3/football/fixtures/{id}
	rawFixturesAll := make([]model.APIFixture, 0)
	// 定时采集指定所有的欧洲联赛数据
	for _, id := range utils.FixtureEuAllIDs {
		rawFixtures, err := s.restClient.GetEUFixtureByID(ctx, id)
		if err != nil {
			log.Printf("[GetEUFixtureByID] 同步 %s 失败，失败: %v", id, err)
			continue
		}
		rawFixturesAll = append(rawFixturesAll, rawFixtures)
		log.Printf("✅ GetEUFixtureByID 成功同步 %s", id)
		time.Sleep(1 * time.Second)
	}
	log.Printf("✅ GetEUFixtureByID 成功同步 %d 条欧洲联赛赛程数据", len(rawFixturesAll))
	//统一入库数据
	s.processAndSaveFixtures(ctx, rawFixturesAll)
}

// 通用的数据清洗与保存逻辑
// 这里只采集 locale=en ，多语言在 oddfi-web-api 服务里面查询的时候映射好 name 直接返回适配
func (s *SpiderService) processAndSaveFixtures(ctx context.Context, rawItems []model.APIFixture) {
	var dbFixtures []model.Fixture             // 基础赛程数据
	var fixtureResults []model.FixtureResultDB // 赛果底表数据
	var allOdds []model.OddDB                  // 收集所有过滤后的赔率
	var allStatistics []model.StatisticDB      // 收集所有统计信息

	for _, raw := range rawItems {
		f := model.Fixture{
			ID:                  raw.ID,
			LeagueID:            raw.LeagueID,
			Name:                raw.Name,
			StateID:             raw.StateID,
			StartingAtTimestamp: 0, // 下面解析
			StageID:             raw.StageID,
			SeasonID:            raw.SeasonID,
		}

		// 1. 解析时间
		if t, err := time.Parse("2006-01-02 15:04:05", raw.StartingAt); err == nil {
			f.StartingAt = t
			f.StartingAtTimestamp = t.Unix()
		}

		if len(raw.Participants) < 2 {
			log.Printf("skip fixture %d: only %d participants", raw.ID, len(raw.Participants))
			continue
		}

		// 2. 识别主客队 (反范式扁平化)
		for _, p := range raw.Participants {
			if p.Meta.Location == "home" {
				f.HomeTeamID = p.ID
				f.HomeTeamName = p.Name
				f.HomeTeamLogo = p.ImagePath
				f.HomeTeamCountryID = p.CountryID
				f.HomeTeamMetaLocation = p.Meta.Location
				f.HomeType = p.Type
				f.HomeTeamMetaWinner = p.Meta.Winner
				f.HomeTeamShortCode = p.ShortCode
			} else if p.Meta.Location == "away" {
				f.AwayTeamID = p.ID
				f.AwayTeamName = p.Name
				f.AwayTeamLogo = p.ImagePath
				f.AwayTeamCountryID = p.CountryID
				f.AwayTeamMetaLocation = p.Meta.Location
				f.AwayType = p.Type
				f.AwayTeamMetaWinner = p.Meta.Winner
				f.AwayTeamShortCode = p.ShortCode
			}
		}

		f.HasOdds = raw.HasOdds

		// 补全 odds 数据补充，在过滤世界杯和欧冠的数据
		//  bookmaker_id:2; 为世界杯
		//  bookmaker_id:20; 为欧冠
		//  market_id:1,6,7  盘口分组（1=1X2, 6=亚让, 7=亚大小）
		//  并行更新 odds 表
		var oddsOdds []model.OddDB
		for _, o := range raw.Odds {
			if o.ID == 0 {
				continue
			}
			if (o.BookmakerID == 2 || o.BookmakerID == 20) && (o.MarketID == 1 || o.MarketID == 6 || o.MarketID == 7) {
				o.FixtureID = f.ID
				var oSelection string
				if o.Total != nil {
					oSelection = fmt.Sprintf("%s %s", o.Name, *o.Total)
				} else {
					oSelection = fmt.Sprintf("%s %s", o.Name, o.Value)
				}
				odd := model.OddDB{
					OddID:             o.ID,
					FixtureID:         o.FixtureID,
					MarketID:          o.MarketID,
					BookmakerID:       o.BookmakerID,
					FixtureName:       f.Name,
					FixtureTime:       raw.StartingAt,
					Value:             o.Value,
					MarketDescription: o.MarketDescription,
					Selection:         oSelection,
					Label:             o.Label,
					UpdatedAt:         time.Now().Unix(), // 毫秒级时间戳
				}
				if o.Handicap != nil {
					odd.Handicap = *o.Handicap
				}
				if o.Total != nil {
					odd.Total = *o.Total
				}
				oddsOdds = append(oddsOdds, odd)
			}
		}
		allOdds = append(allOdds, oddsOdds...)
		var statis []model.StatisticDB
		for _, s := range raw.Statistics {
			statis = append(statis, model.StatisticDB{
				ID:            s.ID,
				FixtureID:     f.ID,
				TypeID:        s.TypeID,
				ParticipantID: s.ParticipantID,
				Value:         s.Data.Value,
				Location:      s.Location,
			})
		}
		allStatistics = append(allStatistics, statis...)
		dbFixtures = append(dbFixtures, f)
		if fixtureResult, ok := buildFixtureResult(raw); ok {
			fixtureResults = append(fixtureResults, fixtureResult)
		}
	}

	// 基础赛程先落库，再更新赛果表；赔率和统计信息并行刷新。
	eg := errgroup.Group{}
	log.Printf("[processAndSaveFixtures] 开始更新 fixtures=%d fixture_results=%d odds=%d statistics=%d", len(dbFixtures), len(fixtureResults), len(allOdds), len(allStatistics))

	eg.Go(func() error {
		if err := s.db.UpsertFixtures(ctx, dbFixtures); err != nil {
			return err
		}
		return s.db.UpsertFixtureResults(ctx, fixtureResults)
	})
	eg.Go(func() error {
		return s.db.UpsertOdds(allOdds)
	})
	eg.Go(func() error {
		return s.db.UpsertStatistics(allStatistics)
	})
	if err := eg.Wait(); err != nil {
		log.Printf("并行更新 fixtures/fixture_results/odds/statistics 表失败: %v", err)
	}
	if s.moneylineSvc != nil {
		for i := range rawItems {
			if !utils.IsMoneylineFixtureWhitelisted(rawItems[i].ID) {
				continue
			}
			// 全量 spider 已经拿到了同一份 SportMonks odds 响应，顺手推进 moneyline 状态机可以减少额外回源次数。
			if err := s.moneylineSvc.OnFixtureUpdate(ctx, &rawItems[i]); err != nil {
				log.Printf("[Moneyline] 复用全量同步快照失败 fixture=%d err=%v", rawItems[i].ID, err)
			}
		}
	}
	log.Printf("✅ [processAndSaveFixtures] 赛程同步完成，共 %d 条", len(dbFixtures))
}

func buildFixtureResult(raw model.APIFixture) (model.FixtureResultDB, bool) {
	if !hasFixtureResultPayload(raw) {
		return model.FixtureResultDB{}, false
	}

	result := model.FixtureResultDB{
		FixtureID:        raw.ID,
		StateID:          raw.StateID,
		StateCode:        raw.State.State,
		StateName:        raw.State.Name,
		RawScoreData:     "[]",
		RawStateDate:     "{}",
		SettlementStatus: "PENDING",
	}

	if raw.State.ID != 0 {
		result.StateID = raw.State.ID
	}

	statePayload := raw.State
	if statePayload.ID == 0 && raw.StateID != 0 {
		statePayload.ID = raw.StateID
	}
	if rawStateJSON, err := json.Marshal(statePayload); err == nil && hasStatePayload(raw) {
		result.RawStateDate = string(rawStateJSON)
	}

	if len(raw.Scores) > 0 {
		if rawScoresJSON, err := json.Marshal(raw.Scores); err == nil {
			result.RawScoreData = string(rawScoresJSON)
		}
		populateFixtureResultScores(&result, raw)
	}

	return result, true
}

func hasFixtureResultPayload(raw model.APIFixture) bool {
	return len(raw.Scores) > 0 || hasStatePayload(raw)
}

func hasStatePayload(raw model.APIFixture) bool {
	return raw.StateID != 0 || raw.State.ID != 0 || raw.State.State != "" || raw.State.Name != ""
}

func populateFixtureResultScores(result *model.FixtureResultDB, raw model.APIFixture) {
	scoreMap := make(map[string]map[string]int, len(raw.Scores))
	for _, score := range raw.Scores {
		description := strings.ToUpper(score.Description)
		participant := strings.ToLower(score.Score.Participant)
		if participant != "home" && participant != "away" {
			continue
		}
		if _, ok := scoreMap[description]; !ok {
			scoreMap[description] = make(map[string]int, 2)
		}
		scoreMap[description][participant] = score.Score.Goals
	}

	if home, away, ok := lookupScorePair(scoreMap, "CURRENT"); ok {
		result.HomeScoreFull = home
		result.AwayScoreFull = away
	}
	if isExtraTimeFinalState(raw) {
		if home, away, ok := lookupScorePair(scoreMap, "2ND_HALF"); ok {
			result.HomeScoreFull = home
			result.AwayScoreFull = away
		}
	}
	if home, away, ok := lookupScorePair(scoreMap, "1ST_HALF"); ok {
		result.HomeScoreHalf = home
		result.AwayScoreHalf = away
	}
	if home, away, ok := lookupScorePair(scoreMap, "EXTRA_TIME"); ok {
		result.HomeScoreExtra = intPtr(home)
		result.AwayScoreExtra = intPtr(away)
	} else if isExtraTimeFinalState(raw) {
		if home, away, ok := lookupScorePair(scoreMap, "CURRENT"); ok {
			result.HomeScoreExtra = intPtr(home)
			result.AwayScoreExtra = intPtr(away)
		}
	}
	if home, away, ok := lookupScorePair(scoreMap, "PENALTIES"); ok {
		result.HomeScorePenalty = intPtr(home)
		result.AwayScorePenalty = intPtr(away)
	}
}

func lookupScorePair(scoreMap map[string]map[string]int, description string) (int, int, bool) {
	participants, ok := scoreMap[description]
	if !ok {
		return 0, 0, false
	}
	home, homeOK := participants["home"]
	away, awayOK := participants["away"]
	if !homeOK || !awayOK {
		return 0, 0, false
	}
	return home, away, true
}

func isExtraTimeFinalState(raw model.APIFixture) bool {
	stateID := raw.State.ID
	if stateID == 0 {
		stateID = raw.StateID
	}
	stateCode := strings.ToUpper(raw.State.State)
	return stateID == 7 || stateID == 8 || stateCode == "AET" || stateCode == "FT_PEN"
}

func intPtr(v int) *int {
	return &v
}
