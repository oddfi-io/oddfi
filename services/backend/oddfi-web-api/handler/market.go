package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"oddfi-web-api/client"
	"oddfi-web-api/model"
	"oddfi-web-api/storage"
	"oddfi-web-api/utils"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cloudflare/cfssl/log"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"golang.org/x/time/rate"
	"gorm.io/gorm"
)

// ===================== 全局配置（直接修改为你的配置） =====================
const (
	WorldCupLeagueID       = "732,720,726,717,714,711,723,729" // 2026世界杯固定联赛ID
	EuroLeagueID           = "2"                               // 欧冠联赛ID
	CacheExpireSeconds     = 86400                             // 缓存1天（实时比分+防限流平衡）
	CacheOddsExpireSeconds = 7200                              // 缓存2h（实时比分+防限流平衡）

	MockUCLActivityID = "UCL_MOCK_5MIN"
	MockUCLFixtureID  = 99200001
	MockUCLPeriodSec  = 300
	MockUCLBetOpenSec = 240
)

// 内存缓存（线程安全，Gin高并发可用）
var (
	sportCache     sync.Map
	cacheKeyPrefix = "2026_key_fixtures_"
	oddsCache      sync.Map
)

var liveStateIDSet = map[int]struct{}{
	2: {},
	3: {},
	4: {},
	6: {},
	9: {},
}

// enableBetStateIDSet 只维护业务允许下注的比赛状态；最终是否开放下注还需要同时校验是否存在赔率。
var enableBetStateIDSet = map[int]struct{}{
	1:  {},
	13: {},
}

func applyFixturesEnableBet(fixtures []model.Fixture) {
	now := time.Now()
	for i := range fixtures {
		// model.Fixture 是值类型，必须按下标写回原切片，避免 range 副本导致 EnableBet 赋值失效。
		applyMockActivity(&fixtures[i], now)
		fixtures[i].EnableBet = isFixtureBettingEnabled(fixtures[i], now)
	}
}

func isFixtureBettingEnabled(fixture model.Fixture, now time.Time) bool {
	_, stateEnabled := enableBetStateIDSet[fixture.StateID]
	// 状态允许但赔率为空或全部 stopped 时也不能开放下注，避免前端展示无法落单的下注入口。
	if !stateEnabled || !hasOpenOdds(fixture) {
		return false
	}
	closeAt, ok := fixtureCloseAt(fixture)
	// mock 盘用 starting_at 表示本轮封盘时间；真实赛事也不应在开赛后继续下注。
	return !ok || now.Before(closeAt)
}

func hasOpenOdds(fixture model.Fixture) bool {
	for _, odd := range fixture.Odds {
		if !odd.Stopped {
			return true
		}
	}
	return false
}

func applyMockActivity(fixture *model.Fixture, now time.Time) {
	if fixture == nil || fixture.ID != MockUCLFixtureID {
		return
	}
	closeAt, ok := fixtureCloseAt(*fixture)
	if !ok {
		return
	}
	settleAt := closeAt.Add(time.Duration(MockUCLPeriodSec-MockUCLBetOpenSec) * time.Second)
	phase := "settling"
	remainingSec := int64(0)
	if now.Before(closeAt) {
		phase = "open"
		remainingSec = positiveSecondsUntil(now, closeAt)
	} else if now.Before(settleAt) {
		phase = "sealed"
		remainingSec = positiveSecondsUntil(now, settleAt)
	}
	// mock_activity 严格按文档下发给前端；worker 内部叫 bet_open_sec，但对用户而言第 240 秒就是封盘点。
	// 资金侧仍以后端停盘和下注校验为准，不能只信这个只读倒计时字段。
	fixture.MockActivity = &model.MockActivity{
		ActivityID:   MockUCLActivityID,
		PeriodSec:    MockUCLPeriodSec,
		BetCloseSec:  MockUCLBetOpenSec,
		SettleAtSec:  MockUCLPeriodSec,
		Phase:        phase,
		RemainingSec: remainingSec,
		BetCloseAt:   closeAt.Format(time.DateTime),
		SettleAt:     settleAt.Format(time.DateTime),
	}
}

func fixtureCloseAt(fixture model.Fixture) (time.Time, bool) {
	if fixture.StartAtTimeStamp > 0 {
		if fixture.StartAtTimeStamp > 1_000_000_000_000 {
			return time.UnixMilli(fixture.StartAtTimeStamp), true
		}
		return time.Unix(fixture.StartAtTimeStamp, 0), true
	}
	if strings.TrimSpace(fixture.StartingAt) == "" {
		return time.Time{}, false
	}
	closeAt, err := time.ParseInLocation(time.DateTime, fixture.StartingAt, time.Local)
	if err != nil {
		return time.Time{}, false
	}
	return closeAt, true
}

func positiveSecondsUntil(now time.Time, target time.Time) int64 {
	if !target.After(now) {
		return 0
	}
	return int64(target.Sub(now).Seconds())
}

func GetMarket(c *gin.Context) {
	//只 返回 空数据
	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Msg:  "success",
		Data: nil,
	})
}

func isLiveTypeParam(c *gin.Context) bool {
	return strings.EqualFold(strings.TrimSpace(c.DefaultQuery("type", "")), "live")
}

// // GetMarketFixtureByBetween
// 获取区间日期数据【✅】
// curl http://localhost:8080/api/v1/detail/fixture_between/2026-06-11/2026-06-13?type=live
func GetMarketFixtureByBetween(c *gin.Context) {
	// 1. 解析路径参数：start_date 和 end_date
	startDateStr := c.Param("start_date")
	endDateStr := c.Param("end_date")

	// 2. 校验日期格式
	if !isValidDate(startDateStr) || !isValidDate(endDateStr) {
		c.JSON(http.StatusBadRequest, model.Response{
			Code: 400,
			Msg:  "日期格式错误，正确格式为 YYYY-MM-DD",
			Data: nil,
		})
		return
	}

	locale := c.DefaultQuery("locale", "zh")
	onlyLive := isLiveTypeParam(c)

	//读取 MySQL数据
	var fixtures []model.Fixture
	fixtures, err := fixtureRepo.GetFixturesByRange(c.Request.Context(), startDateStr, endDateStr, locale, onlyLive)
	if err != nil {
		log.Errorf("[⚠️⚠️⚠️][GetMarketFixtureByBetween] get fixtures failed: %v", err)
		c.JSON(http.StatusInternalServerError, model.Response{
			Code: 500,
			Msg:  "拉取 " + startDateStr + " 到 " + endDateStr + " 数据失败",
			Data: nil,
		})
		return
	}
	applyFixturesEnableBet(fixtures)
	// 兜底返回 API 拿到的数据
	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Msg:  "success",
		Data: fixtures,
	})
}

// 指定日期的请求
// curl http://localhost:8080/api/v1/detail/fixture_date/2026-05-01?type=live
func GetMarketFixtureByDate(c *gin.Context) {
	dateStr := c.Param("date")
	if dateStr == "" {
		c.JSON(http.StatusBadRequest, model.Response{
			Code: 400,
			Msg:  "dateStr 参数缺少",
			Data: nil,
		})
		return
	}

	//校验 date 格式是否为 YYYY-MM-DD
	if !isValidDate(dateStr) {
		c.JSON(http.StatusBadRequest, model.Response{
			Code: 400,
			Msg:  "dateStr 格式错误，应为 YYYY-MM-DD",
			Data: nil,
		})
		return
	}
	locale := c.DefaultQuery("locale", "zh")
	onlyLive := isLiveTypeParam(c)
	// 从MySQL 数据读取该日期的 fixture
	var fixtures []model.Fixture
	fixtures, err := fixtureRepo.GetFixturesByDate(c.Request.Context(), dateStr, locale, onlyLive)
	if err != nil {
		log.Errorf("[⚠️⚠️⚠️][GetMarketFixtureByDate] get fixtures failed: %v", err)
		c.JSON(http.StatusInternalServerError, model.Response{
			Code: 500,
			Msg:  "拉取 " + dateStr + " 数据失败",
			Data: nil,
		})
		return
	}
	applyFixturesEnableBet(fixtures)
	// 兜底返回 API 拿到的数据
	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Msg:  "success",
		Data: fixtures,
	})
}

//获取比赛预览
// curl http://localhost:8082/api/v1/detail/fixture/19609127?type=preview
//获取比赛详情页
// curl http://localhost:8080/api/v1/detail/fixture/19609127?type=statis

func GetMarketFixture(c *gin.Context) {
	fixIDStr := c.Param("fixture_id")
	if fixIDStr == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "fixture_id 参数缺少"})
		return
	}

	// 1. 严格校验转码错误，防止异常输入
	fixIDInt, err := strconv.Atoi(fixIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "fixture_id 参数格式错误，必须为数字"})
		return
	}

	// 2. 校验 type 参数并确定是否需要统计数据
	typeParam := strings.ToLower(strings.TrimSpace(c.DefaultQuery("type", "")))
	if typeParam == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "type 参数缺少"})
		return
	}

	isStatistics := false
	onlyLive := false
	switch typeParam {
	case "statis":
		isStatistics = true
	case "preview":
	case "live":
		onlyLive = true
	default:
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "type 参数错误 must be statis or preview or live"})
		return
	}

	locale := c.DefaultQuery("locale", "zh")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	id := int64(fixIDInt)
	fix, err := fixtureRepo.GetFixtureByID(ctx, id, isStatistics, locale, onlyLive)
	if err == nil && fix != nil {
		fixtures := []model.Fixture{*fix}
		filterFixturesStats(fixtures, isStatistics)
		applyFixturesEnableBet(fixtures)
		c.JSON(200, model.Response{Code: 200, Msg: "success", Data: fixtures})
		return
	}

	if onlyLive {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(200, model.Response{Code: 200, Msg: "success", Data: []model.Fixture{}})
			return
		}
		if err != nil {
			log.Errorf("[GetMarketFixture] DB error: %v", err)
		}
		c.JSON(500, model.Response{Code: 500, Msg: "拉取数据失败"})
		return
	}

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Errorf("[GetMarketFixture] DB error: %v", err)
		// 降级到回源，但记录指标
	}

	// 兜底回源 SportMonks（保留现有 fetchSportMonksDataByFixID 逻辑，不回填）
	include := "participants;odds;league"
	if isStatistics {
		include += ";statistics"
	}
	fixtures, err := fetchSportMonksDataByFixID(c.Request.Context(), strconv.FormatInt(id, 10), include)
	if err != nil {
		c.JSON(500, model.Response{Code: 500, Msg: "拉取失败"})
		return
	}
	filterFixturesStats(fixtures, isStatistics)
	applyFixturesEnableBet(fixtures)
	c.JSON(200, model.Response{Code: 200, Msg: "success", Data: fixtures})
}

var chainIDToNetwork = map[string]string{
	"1":      "eth",
	"56":     "bsc",
	"137":    "polygon",
	"42161":  "arbitrum",
	"10":     "optimism",
	"43114":  "base",
	"solana": "solana", // Solana 这种非 EVM 可以特殊处理
}

var chainToGeckoImageURL = map[string]string{
	"bsc":         "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
	"polygon_pos": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
	"base":        "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
	"eth":         "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
	"arbitrum":    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
}

// 适配 https://api.geckoterminal.com/api/v2/networks/polygon_pos/tokens/0xD6DF932A45C0f255f85145f286eA0b292B21C90B 接口
var evmChains = []string{"bsc", "polygon_pos", "base", "eth", "arbitrum"}

// 接收前端的结构
type TokenIdentifier struct {
	ChainID string `json:"chain_id"`
	Address string `json:"address"`
}

// 批量返回给前端的结构
type TokenPriceData struct {
	ChainID       string `json:"chain_id"`
	Address       string `json:"address"`
	Price         string `json:"price"`
	Symbol        string `json:"symbol"`
	ImageURL      string `json:"token_image_url"`
	ChainImageURL string `json:"chain_image_url"`
}

// GeckoTerminal 批量接口响应结构
type GeckoMultiTokenResponse struct {
	Data []struct {
		Attributes struct {
			Address  string `json:"address"`
			PriceUSD string `json:"price_usd"`
			Symbol   string `json:"symbol"`
			ImageURL string `json:"image_url"`
		} `json:"attributes"`
	} `json:"data"`
}

// GetBatchTokenPrices 批量获取价格
func (s *PriceService) GetBatchTokenPrices(ctx context.Context, tokens []TokenIdentifier) ([]TokenPriceData, error) {
	var finalResults []TokenPriceData
	missingTokens := make([]TokenIdentifier, 0)

	// 1. 第一层：Redis 批量查询 (MGET)
	keys := make([]string, len(tokens))
	for i, t := range tokens {
		keys[i] = fmt.Sprintf("price:%s:%s", t.ChainID, strings.ToLower(t.Address))
	}

	cachedValues, err := s.rdb.MGet(ctx, keys...)
	if err == nil {
		for i, val := range cachedValues {
			// go-redis 的 MGet 如果 key 不存在，val 是 nil
			if val != nil && val != "" {
				var item TokenPriceData
				// 注意：存储时如果是对象，这里需要反序列化
				if err := json.Unmarshal([]byte(val.(string)), &item); err == nil {
					finalResults = append(finalResults, item)
					continue
				}
			}
			// 缓存未命中或解析失败
			missingTokens = append(missingTokens, tokens[i])
		}
	} else {
		log.Errorf("[GetBatchTokenPrices] Redis MGet error: %v", err)
		missingTokens = tokens
	}

	// 如果全部命中了缓存，直接返回
	if len(missingTokens) == 0 {
		log.Infof("[GetBatchTokenPrices] 🍃🍃🍃 All tokens hit cache, len: %d", len(finalResults))
		return finalResults, nil
	}

	// 2. 第二层：对缺失的 Token 按链分组
	networkGroups := make(map[string][]string)
	for _, t := range missingTokens {
		// 使用 lo.Contains 过滤支持的 EVM 链
		if lo.Contains(evmChains, t.ChainID) {
			networkGroups[t.ChainID] = append(networkGroups[t.ChainID], strings.ToLower(t.Address))
		} else {
			log.Infof("[GetBatchTokenPrices] Unsupported chain_id: %s", t.ChainID)
		}
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var fetchErrs []error

	// 3. 遍历分组，并发请求 GeckoTerminal
	for network, addresses := range networkGroups {
		chunkSize := 30
		for i := 0; i < len(addresses); i += chunkSize {
			end := i + chunkSize
			if end > len(addresses) {
				end = len(addresses)
			}
			chunk := addresses[i:end]

			wg.Add(1)
			go func(net string, addrs []string) {
				defer wg.Done()

				// 令牌桶限流等待 (生产环境建议加上)
				if err := s.limiter.Wait(ctx); err != nil {
					return
				}

				path := fmt.Sprintf("networks/%s/tokens/multi/%s", net, strings.Join(addrs, ","))
				var res GeckoMultiTokenResponse
				if err := s.geckoClient.GetTokenPrice(ctx, path, url.Values{}, &res); err != nil {
					log.Errorf("[GetBatchTokenPrices] Request failed for %s: %v", net, err)
					mu.Lock()
					fetchErrs = append(fetchErrs, err)
					mu.Unlock()
					return
				}

				pipe := s.rdb.Pipeline()
				mu.Lock()
				defer mu.Unlock()

				for _, item := range res.Data {
					retAddr := strings.ToLower(item.Attributes.Address)
					priceData := TokenPriceData{
						ChainID:       net,
						Address:       retAddr,
						Price:         item.Attributes.PriceUSD,
						Symbol:        item.Attributes.Symbol,
						ImageURL:      item.Attributes.ImageURL,
						ChainImageURL: chainToGeckoImageURL[net],
					}

					// 【关键点 1】: 将新抓取的数据也加入 finalResults
					finalResults = append(finalResults, priceData)

					// 【关键点 2】: 序列化后存入 Redis
					data, _ := json.Marshal(priceData)
					pipe.Set(ctx, fmt.Sprintf("price:%s:%s", net, retAddr), data, 10*time.Minute)
				}
				_, _ = pipe.Exec(ctx)
			}(network, chunk)
		}
	}
	wg.Wait()

	if len(fetchErrs) > 0 {
		log.Errorf("[GetBatchTokenPrices] Completed with errors: %v", fetchErrs)
	}

	log.Infof("[GetBatchTokenPrices] Final results len: %d (Cache: %d, New: %d)",
		len(finalResults), len(finalResults)-len(missingTokens), len(missingTokens))

	// 【关键点 3】: 返回合并后的 finalResults
	return finalResults, nil
}

type PriceService struct {
	geckoClient *client.RestPriceClient
	rdb         *storage.RedisClient
	limiter     *rate.Limiter // 全局限流器
}

func NewPriceService(rdb *storage.RedisClient) *PriceService {
	if rdb == nil {
		log.Errorf("❌ PriceService 初始化失败：redisClient 为 nil")
		panic("======[NewPriceService] redis client is nil=======")
	}
	return &PriceService{
		geckoClient: client.NewRestPriceClient(),
		rdb:         rdb,
		// 30次/分钟 = 每 2 秒 1 个令牌，桶容量为 5 (允许小范围突发)
		limiter: rate.NewLimiter(rate.Every(2*time.Second), 5),
	}
}

func GetBatchTokenPriceHandler(c *gin.Context) {
	var req struct {
		Tokens []TokenIdentifier `json:"tokens"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": 400, "msg": "invalid json body"})
		return
	}

	if len(req.Tokens) == 0 {
		c.JSON(400, gin.H{"code": 400, "msg": "tokens list cannot be empty"})
		return
	}

	// 限制单次请求总量，防止恶意打满并发
	if len(req.Tokens) > 100 {
		c.JSON(400, gin.H{"code": 400, "msg": "max 100 tokens per request"})
		return
	}

	//校验链是否合法
	for _, t := range req.Tokens {
		if !lo.Contains(evmChains, t.ChainID) {
			c.JSON(400, gin.H{"code": 400, "msg": "unsupported chain_id"})
			return
		}
	}

	priceSvc := NewPriceService(redisClient)
	data, err := priceSvc.GetBatchTokenPrices(c.Request.Context(), req.Tokens)
	if err != nil {
		c.JSON(500, gin.H{"code": 500, "msg": "failed to fetch some or all prices"})
		return
	}

	c.JSON(200, gin.H{"code": 200, "data": data, "msg": "success"})
}

// GetTokenPriceHandler 查询代币价格
func GetTokenPriceHandler(c *gin.Context) {
	chainID := c.Query("chain_id")
	address := c.Query("address")

	if chainID == "" || address == "" {
		c.JSON(400, gin.H{"error": "missing parameters"})
		return
	}

	if !lo.Contains(evmChains, chainID) {
		c.JSON(400, gin.H{"error": "unsupported chain_id"})
		return
	}

	network := chainID
	var data model.PriceResponse
	path := fmt.Sprintf("networks/%s/tokens/%s", network, address)
	// 发起请求 (实际生产建议增加超时控制和 User-Agent)
	err := restClient.GetTokenPrice(c.Request.Context(), path, url.Values{}, &data)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch price"})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Msg:  "success",
		Data: gin.H{
			"price":  data.Data.Attributes.PriceUSD,
			"symbol": data.Data.Attributes.Symbol,
			"name":   data.Data.Attributes.Name,
			"chain":  network,
		},
	})
}

// ===================== 接口1：获取2026所有比赛 =====================
// GET http://localhost:8080/api/v1/detail/sports_all?league=2&page=1&type=live&country_id=xxx
func GetSportsAll(c *gin.Context) {
	// 1. 解析查询参数：live筛选
	onlyLive := isLiveTypeParam(c)
	if onlyLive {
		log.Infof("[GetSportsAll] type=live")
	}
	leagueParm := c.DefaultQuery("league", "")
	if leagueParm == "" {
		leagueParm = "2"
	}
	//可选字段
	countryId := c.DefaultQuery("country_id", "")
	// MVP 特判 如果leagueParm == 0 表示其他小国比赛 todo@remy
	page := c.DefaultQuery("page", "1")
	if page == "" {
		//返回报错 这个字段必须校验
		c.JSON(http.StatusBadRequest, model.Response{
			Code: 400,
			Msg:  "page 参数缺少",
			Data: nil,
		})
		return
	}

	locale := c.DefaultQuery("locale", "zh")
	log.Infof("[GetSportsAll] locale: %s", locale)
	pageNum, _ := strconv.Atoi(page)
	var fetchLeague int
	fetchLeague, _ = strconv.Atoi(leagueParm)

	var fixtures []model.Fixture
	var err error
	fixtures, err = fixtureRepo.GetFixturesByLeagueID(c.Request.Context(), fetchLeague, pageNum, locale, countryId, onlyLive)
	if err != nil {
		c.JSON(500, model.Response{
			Code: 500,
			Msg:  "failed to fetch fixtures",
			Data: nil,
		})
		return
	}
	// if fetchLeague == 0 {
	// 	// 加一个过滤 fixtures 小国比赛中 已经比完赛的数据 过滤掉 stateID = 5
	// 	fixtures = lo.Filter(fixtures, func(item model.Fixture, index int) bool {
	// 		return item.StateID != 5
	// 	})
	// }

	applyFixturesEnableBet(fixtures)

	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Msg:  "success",
		Data: fixtures,
	})
}

// ===================== 接口2：按阶段ID获取比赛 =====================
// GET /v1/detail/stage_all/:stage_id?type=live
func GetStageByID(c *gin.Context) {
	// 1. 解析路径参数：stage_id
	stageIDStr := c.Param("stage_id")
	stageID, err := strconv.Atoi(stageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{
			Code: 400,
			Msg:  "stage_id 参数非法",
			Data: nil,
		})
		return
	}
	log.Infof("[GetStageByID] stageID: %d", stageID)

	locale := c.DefaultQuery("locale", "zh")
	onlyLive := isLiveTypeParam(c)
	var fixtures []model.Fixture
	fixtures, err = fixtureRepo.GetStageByID(c.Request.Context(), stageID, locale, onlyLive)
	if err != nil {
		c.JSON(500, model.Response{
			Code: 500,
			Msg:  "failed to fetch fixtures",
			Data: nil,
		})
		return
	}
	applyFixturesEnableBet(fixtures)
	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Msg:  "success",
		Data: fixtures,
	})
}

func fetchSportMonksDataByDateBetween(ctx context.Context, dateStr1, dateStr2 string) ([]model.Fixture, error) {
	var allFixtures []model.Fixture
	{
		var pageData []model.Fixture
		query := url.Values{}
		filters := "bookmakers:20;markets:1,6,7"
		query.Set("filters", filters)
		query.Set("include", "participants;odds;league")
		query.Set("locale", "zh")
		path := fmt.Sprintf("fixtures/between/%s/%s", dateStr1, dateStr2)

		_, _, err := restClient.Get(ctx, path, query, &pageData)
		if err != nil {
			log.Errorf("[⚠️⚠️⚠️][fetchSportMonksDataByDateBetween] 获取数据失败: %v", err)
			return nil, err
		}
		log.Infof("[fetchSportMonksDataByDateBetween] get %d fixtures", len(pageData))

		allFixtures = append(allFixtures, pageData...)
		time.Sleep(100 * time.Millisecond)
	}
	log.Infof("[🍃🍃🍃][fetchSportMonksDataByDateBetween] get %d fixtures", len(allFixtures))
	return allFixtures, nil
}

// https://api.sportmonks.com/v3/football/fixtures/19683233?api_token=xxx&include=participants;odds;league&filters=bookmakers:20;markets:1,6,7&locale=zh&page=1
func fetchSportMonksDataByDate(ctx context.Context, dateStr string) ([]model.Fixture, error) {
	var allFixtures []model.Fixture
	{
		var pageData []model.Fixture
		query := url.Values{}
		filters := "bookmakers:20;markets:1,6,7"
		query.Set("filters", filters)
		query.Set("include", "participants;odds;league")
		query.Set("locale", "zh")
		path := fmt.Sprintf("date/%s", dateStr)

		_, _, err := restClient.Get(ctx, path, query, &pageData)
		if err != nil {
			log.Errorf("[⚠️⚠️⚠️][fetchSportMonksDataByDate] 获取数据失败: %v", err)
			return nil, err
		}
		log.Infof("[fetchSportMonksDataByDate] get %d fixtures", len(pageData))

		allFixtures = append(allFixtures, pageData...)
	}
	log.Infof("[🍃🍃🍃][fetchSportMonksDataByDate] get %d fixtures", len(allFixtures))
	return allFixtures, nil
}

// getAndFilterFromCache 从缓存中查找特定 ID 的比赛，并安全地过滤 Statistics 防止污染缓存
func getAndFilterFromCache(fixtures []model.Fixture, id int, isStatis bool) ([]model.Fixture, bool) {
	for _, f := range fixtures {
		if f.ID == id {
			// 浅拷贝结构体
			resultFix := f

			if !isStatis {
				resultFix.Statistics = nil // typeParam 为其他，不返回数据
			} else {
				// 核心优化：提前使用 make 初始化并分配 capacity，最大程度优化 append 性能
				// 长度为 0，容量为 len(f.Statistics)
				validStats := make([]model.APIStatistics, 0, len(f.Statistics))

				for _, stat := range f.Statistics {
					if stat.TypeId == 34 || stat.TypeId == 41 || stat.TypeId == 84 || stat.TypeId == 85 {
						validStats = append(validStats, stat)
					}
				}
				resultFix.Statistics = validStats
			}

			return []model.Fixture{resultFix}, true
		}
	}
	return nil, false
}

func filterFixturesStats(fixtures []model.Fixture, isStatis bool) {
	for i := range fixtures {
		if !isStatis {
			fixtures[i].Statistics = nil
			continue
		}

		// 同样使用 make 提前分配容量
		validStats := make([]model.APIStatistics, 0, len(fixtures[i].Statistics))
		for _, stat := range fixtures[i].Statistics {
			if stat.TypeId == 34 || stat.TypeId == 41 || stat.TypeId == 84 || stat.TypeId == 85 {
				validStats = append(validStats, stat)
			}
		}
		fixtures[i].Statistics = validStats
	}
}

// https://api.sportmonks.com/v3/football/fixtures/19683233?api_token=xxx&include=participants;odds;league&filters=bookmakers:20;markets:1,6,7&locale=zh&page=1
func fetchSportMonksDataByFixID(ctx context.Context, fixIDStr string, includeParam string) ([]model.Fixture, error) {
	var allFixtures []model.Fixture
	{
		var pageData model.Fixture
		query := url.Values{}
		filters := "bookmakers:20;markets:1,6,7"
		query.Set("filters", filters)
		query.Set("include", includeParam)
		query.Set("locale", "zh")
		path := fmt.Sprintf("fixtures/%s", fixIDStr)
		_, _, err := restClient.Get(ctx, path, query, &pageData)
		if err != nil {
			log.Errorf("[⚠️⚠️⚠️][fetchSportMonksDataByFixID] 获取数据失败: %v", err)
			return nil, err
		}
		log.Infof("[fetchSportMonksDataByFixID] get %d fixtures", fixIDStr)
		allFixtures = append(allFixtures, pageData)
	}
	log.Infof("[🍃🍃🍃][fetchSportMonksDataByFixID] get %d fixtures", len(allFixtures))
	return allFixtures, nil
}

func fetchSportMonksDataByStageID(ctx context.Context, stageIDStr string) ([]model.Fixture, error) {
	// https://api.sportmonks.com/v3/football/stages/77478590?api_token=xx&include=fixtures;league&filters=bookmakers:20;markets:1,6,7;fixtureLeagues:2,732,720,726,717,714,711,723,729&locale=zh
	var allFixtures []model.Fixture
	{
		var pageData model.StageStruct
		query := url.Values{}
		filters := "bookmakers:20;markets:1,6,7;fixtureLeagues:2,732,720,726,717,714,711,723,729"
		query.Set("filters", filters)
		query.Set("include", "fixtures;league")
		query.Set("locale", "zh")
		path := fmt.Sprintf("stages/%s", stageIDStr)

		_, _, err := restClient.Get(ctx, path, query, &pageData)
		if err != nil {
			log.Errorf("[⚠️⚠️⚠️][fetchSportMonksDataByStageID] 获取数据失败: %v", err)
			return nil, err
		}
		log.Infof("[fetchSportMonksDataByStageID] get %d fixtures", len(pageData.Fixtures))

		allFixtures = append(allFixtures, pageData.Fixtures...)
	}
	log.Infof("[🍃🍃🍃][fetchSportMonksDataByStageID] get %d fixtures", len(allFixtures))
	return allFixtures, nil
}

// ===================== 核心工具：拉取SportMonks原始数据  按页拉取 =====================
func fetchSportMonksData(ctx context.Context, fetchLeague string, page string) ([]model.Fixture, error) {
	var allFixtures []model.Fixture
	fmt.Printf("[fetchSportMonksData] fetchLeague: %s, page: %s\n", fetchLeague, page)
	// page := 1
	// API 示例: https://api.sportmonks.com/v3/football/fixtures/between/2026-06-10/2026-07-19?api_token=xxx&filters=bookmakers:20;markets:1,6,7;fixtureLeagues:732,720,726,717,714,711,723,729&include=participants;odds;league&locale=zh&page=1
	{
		// https://api.sportmonks.com/v3/football/fixtures/between/2026-06-10/2026-07-19?api_token=<SPORTMONKS_API_TOKEN>&include=participants;odds;league&filters=bookmakers:20;markets:1,6,7;fixtureLeagues:732,720,726,717,714,711,723,729&locale=zh&page=5
		var pageData []model.Fixture
		query := url.Values{}
		query.Set("page", page)
		filters := fmt.Sprintf("bookmakers:20;markets:1,6,7;fixtureLeagues:%s", fetchLeague)
		query.Set("filters", filters)
		query.Set("include", "participants;odds;league")
		query.Set("locale", "zh")

		path := "fixtures/between/2026-06-10/2026-07-19"
		if fetchLeague == EuroLeagueID {
			path = "fixtures/between/2026-04-01/2026-05-30"
		}

		_, _, err := restClient.Get(ctx, path, query, &pageData)
		if err != nil {
			log.Errorf("[⚠️⚠️⚠️][fetchSportMonksData] 获取数据失败: %v", err)
			return nil, err
		}
		log.Infof("[fetchSportMonksData] get %d fixtures", len(pageData))
		allFixtures = append(allFixtures, pageData...)
	}
	log.Infof("[🍃🍃🍃][fetchSportMonksData] get %d fixtures", len(allFixtures))
	return allFixtures, nil
}

// ===================== 核心工具：拉取SportMonks原始数据  全量拉取 =====================
func fetchSportMonksDataAll(ctx context.Context, fetchLeague string) ([]model.Fixture, error) {
	var allFixtures []model.Fixture
	page := 1
	// API 示例: https://api.sportmonks.com/v3/football/fixtures/between/2026-06-10/2026-07-19?api_token=xxx&filters=bookmakers:20;markets:1,6,7;fixtureLeagues:732,720,726,717,714,711,723,729&include=participants;odds;league&locale=zh&page=1
	for {
		var pageData []model.Fixture
		query := url.Values{}
		query.Set("page", fmt.Sprintf("%d", page))
		filters := fmt.Sprintf("bookmakers:20;markets:1,6,7;fixtureLeagues:%s", fetchLeague)
		query.Set("filters", filters)
		query.Set("include", "participants;odds;league;statistics")
		query.Set("locale", "zh")

		path := "fixtures/between/2026-06-10/2026-07-19"
		if fetchLeague == EuroLeagueID {
			path = "fixtures/between/2026-04-01/2026-05-30"
		}

		_, pagin, err := restClient.Get(ctx, path, query, &pageData)
		if err != nil {
			log.Errorf("[⚠️⚠️⚠️][fetchSportMonksDataAll] 获取数据失败: %v", err)
			return nil, err
		}
		log.Infof("[fetchSportMonksDataAll] get %d fixtures", len(pageData))

		// 填充 odds-api 的数据
		if fetchLeague == WorldCupLeagueID {
			// pageData = fillOddsData(pageData)
			// MVP 改为 MOCK 数据演示 2026/04/09 @remy
			pageData = fillOddsDataMock(pageData)
		}
		allFixtures = append(allFixtures, pageData...)
		if pagin == nil || !pagin.HasMore {
			break
		}
		page++
		time.Sleep(100 * time.Millisecond) // 基础防抖
	}
	log.Infof("[🍃🍃🍃][fetchSportMonksDataAll] get %d fixtures", len(allFixtures))
	return allFixtures, nil
}

// 填充 odds-api 的数据
func fillOddsData(pageData []model.Fixture) []model.Fixture {
	for i := range pageData {
		var smHome, smAway string
		// 1. 提取 SportMonks 的主客队名称 (已经过 locale=zh 翻译)
		for _, p := range pageData[i].Participants {
			if p.Meta.Location == "home" {
				smHome = p.Name
			} else if p.Meta.Location == "away" {
				smAway = p.Name
			}
		}

		// 2. 匹配缓存
		searchKey := smHome + "_" + smAway
		if oddsData, ok := getOddsCachedData(searchKey); ok {
			log.Infof("======= fillOddsData: found cache succ for ======== %s", searchKey)
			// 遍历 Bookmakers (以 Pinnacle 为例，或者取第一个)
			if len(oddsData.Bookmakers) > 0 {
				bm := oddsData.Bookmakers[0] // 示例取第一个 bookmaker
				for _, m := range bm.Markets {
					for _, o := range m.Outcomes {
						newOdd := model.APIOdd{
							FixtureID: int64(pageData[i].ID),
							Value:     fmt.Sprintf("%.2f", o.Price),
						}
						nameZh := utils.GlobalMapping[o.Name]
						switch m.Key {
						case "h2h":
							newOdd.MarketID = 1 // 1X2 市场
							if strings.ToLower(o.Name) == "draw" {
								newOdd.Label = "Draw"
							}
							if nameZh == smHome { // 如果名字等于主队中文名
								newOdd.Label = "Home"
							} else if nameZh == smAway { // 如果名字等于客队中文名
								newOdd.Label = "Away"
							}
							newOdd.MarketDescription = "Fulltime Result"
						case "spreads":
							newOdd.MarketID = 6 // 让球
							// 映射 Label 为 Home/Away 方便前端匹配
							if nameZh == smHome {
								newOdd.Label = "Home"
							} else if nameZh == smAway {
								newOdd.Label = "Away"
							}
							// AH 盘口：值放在 Handicap 字段
							newOdd.Handicap = fmt.Sprintf("%.1f", o.Point)
							newOdd.MarketDescription = "Asian Handicap"
						case "totals":
							newOdd.MarketID = 7   // 大小球
							newOdd.Label = o.Name // Over/Under
							newOdd.Total = fmt.Sprintf("%.1f", o.Point)
							newOdd.MarketDescription = "Asian Total"
						}

						if newOdd.Label != "" {
							pageData[i].Odds = append(pageData[i].Odds, newOdd)
							pageData[i].HasOdds = true
						}
					}
				}
			}
		} else {
			log.Infof("======= fillOddsData: found cache fail for ======== %s", searchKey)
			continue
		}
	}
	return pageData
	// --- 填充逻辑结束 ---
}

func fillOddsDataMock(pageData []model.Fixture) []model.Fixture {
	for i := range pageData {
		var smHome, smAway string
		// 1. 提取 SportMonks 的主客队名称 (已经过 locale=zh 翻译)
		for _, p := range pageData[i].Participants {
			if p.Meta.Location == "home" {
				smHome = p.Name
			} else if p.Meta.Location == "away" {
				smAway = p.Name
			}
		}
		// 2. 匹配缓存
		team := smHome + "_" + smAway
		odds := GetMockOddsByTeam(team, int64(pageData[i].ID))
		if len(odds) == 0 {
			continue
		}
		pageData[i].Odds = odds
		pageData[i].HasOdds = true
	}
	return pageData
}

func fillOddsDataByEuro(pageData []model.Fixture) []model.Fixture {
	return pageData
}
func fetchFromOddsAPIData(fixID int, searchKey string) []model.APIOdd {
	var odds []model.APIOdd
	if searchKey == "墨西哥_南非" {
		Odd1 := model.APIOdd{
			FixtureID: int64(fixID),
			Value:     "1.52",
			Label:     "Mexico",
		}
		odds = append(odds, Odd1)
		Odd2 := model.APIOdd{
			FixtureID: int64(fixID),
			Value:     "6.02",
			Label:     "South Africa",
		}
		odds = append(odds, Odd2)

		odd3 := model.APIOdd{
			FixtureID: int64(fixID),
			Value:     "4.09",
			Label:     "Draw",
		}
		odds = append(odds, odd3)
	}
	return odds
}

// 定义一个通用的本地缓存结构
type LocalCache[K any, V any] struct {
	data sync.Map
}

// Get 获取缓存（返回指针以减少拷贝）
func (c *LocalCache[K, V]) Get(key K) (V, bool) {
	val, ok := c.data.Load(key)
	if !ok {
		var zero V
		return zero, false
	}
	return val.(V), true
}

// Set 设置缓存
func (c *LocalCache[K, V]) Set(key K, value V) {
	c.data.Store(key, value)
}

// --- 业务层面的具体实现 ---

// 声明全局缓存对象（使用指针 *model.OddsAPIData）
var oddsMockCache = &LocalCache[string, *model.OddsAPIData]{}

func GetOddsMockCachedData(teamName string) (*model.OddsAPIData, bool) {
	return oddsMockCache.Get(teamName)
}

func SetOddsMockCachedData(teamName string, data *model.OddsAPIData) {
	oddsMockCache.Set(teamName, data)
}

// ===================== 缓存工具 =====================
func getCachedData(cacheKey string) ([]model.Fixture, bool) {
	data, ok := sportCache.Load(cacheKey)
	if !ok {
		return nil, false
	}
	return data.([]model.Fixture), true
}

func setCachedData(cacheKey string, data []model.Fixture) {
	sportCache.Store(cacheKey, data)
	// 自动过期
	time.AfterFunc(time.Second*CacheExpireSeconds, func() {
		sportCache.Delete(cacheKey)
	})
}

func getOddsCachedData(cacheKey string) (model.OddsAPIData, bool) {
	data, ok := oddsCache.Load(cacheKey)
	if !ok {
		return model.OddsAPIData{}, false
	}
	return data.(model.OddsAPIData), true
}

func setOddsCachedData(cacheKey string, data model.OddsAPIData) {
	oddsCache.Store(cacheKey, data)
	// 自动过期
	time.AfterFunc(time.Second*CacheOddsExpireSeconds, func() {
		oddsCache.Delete(cacheKey)
	})
}

// ===================== 过滤工具 =====================
// 按live状态过滤
func filterByLive(fixtures []model.Fixture, isLive bool) []model.Fixture {
	if !isLive {
		return fixtures
	}

	res := make([]model.Fixture, 0)
	for _, f := range fixtures {
		if _, ok := liveStateIDSet[f.StateID]; ok {
			res = append(res, f)
		}
	}
	return res
}

// 按stageID过滤
func filterByStageID(fixtures []model.Fixture, stageID int) []model.Fixture {
	res := make([]model.Fixture, 0)
	for _, f := range fixtures {
		if f.StageID == stageID {
			res = append(res, f)
		}
	}
	return res
}

// 按fixtureID过滤
func filterByDate(fixtures []model.Fixture, date string) []model.Fixture {
	res := make([]model.Fixture, 0)
	for _, f := range fixtures {
		if strings.Contains(f.StartingAt, date) {
			res = append(res, f)
		}
	}
	return res
}

// isValidDate 校验字符串是否为 YYYY-MM-DD 格式，且日期真实有效
func isValidDate(str string) bool {
	// 严格匹配日期格式：2006-01-02 是Go的固定参考日期
	const layout = "2006-01-02"

	// Parse 会同时校验 格式 + 日期合法性
	_, err := time.Parse(layout, str)
	return err == nil
}

// filterByDateBetween 筛选出 [startDate, endDate] 闭区间内的 fixture
// 日期格式必须是: YYYY-MM-DD 例如 2026-06-01
func filterByDateBetween(fixtures []model.Fixture, startDate, endDate string) []model.Fixture {
	var res []model.Fixture

	// 定义Go固定日期布局
	const dateLayout = "2006-01-02"
	// 解析开始/结束日期（只解析一次，提升性能）
	start, err1 := time.Parse(dateLayout, startDate)
	end, err2 := time.Parse(dateLayout, endDate)

	// 如果日期格式错误，直接返回空
	if err1 != nil || err2 != nil {
		return res
	}

	// 遍历筛选
	for _, f := range fixtures {
		if f.StartingAt == "" {
			continue
		}

		// 截取日期部分（兼容 2026-06-01 12:00:00 这种带时间的格式）
		dateStr := f.StartingAt[:10]

		// 解析当前 fixture 日期
		fixtureDate, err := time.Parse(dateLayout, dateStr)
		if err != nil {
			continue
		}

		// ✅ 核心：判断是否在区间内
		if (fixtureDate.After(start) || fixtureDate.Equal(start)) &&
			(fixtureDate.Before(end) || fixtureDate.Equal(end)) {
			res = append(res, f)
		}
	}

	return res
}
