package handler

import (
	"context"
	"net/http"
	"net/url"
	"oddfi-web-api/client"
	"oddfi-web-api/model"
	"oddfi-web-api/storage"
	"oddfi-web-api/utils"

	"github.com/cloudflare/cfssl/log"
	"github.com/gin-gonic/gin"
)

// 全局 restClient 实例
var restClient *client.RestClient
var redisClient *storage.RedisClient
var fixtureRepo *storage.FixtureRepo
var moneylineRepo *storage.MoneylineRepo

// oddsCache 存储格式: map[string]OddsAPIData (Key: "主队+客队")

func RootApis(r *gin.Engine) {
	r.GET("/health_check", HealthCheckHandle)
}

func HealthCheckHandle(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Msg:  "success",
	})
}

func BuildMarket(group *gin.RouterGroup, client *client.RestClient, rdb *storage.RedisClient, fixRepo *storage.FixtureRepo, mlRepo *storage.MoneylineRepo) {
	// 初始化全局 restClient
	restClient = client
	redisClient = rdb
	fixtureRepo = fixRepo
	moneylineRepo = mlRepo

	group.GET("/market/banners/:banner_id", GetMarketBannerDetail)                        // 获取指定 Banner 的详情【测试✅】
	group.GET("/market/banners", GetMarketBanners)                                        // 首页 / Market 顶部 Banner mock 数据
	group.GET("/liquidity/details/market_all", GetLiquidityMarketAll)                     // 流动池精选未开赛赛事列表
	group.GET("/liquidity/details/market_search", GetLiquidityMarketSearch)               // 流动池按当前语言队名搜索未开赛赛事
	group.GET("/detail/sports_all", GetSportsAll)                                         // 获取所有联赛【测试✅】
	group.GET("/detail/stages_all/:stage_id", GetStageByID)                               // 获取指定联赛的所有阶段 【测试✅】
	group.GET("/detail/fixture/:fixture_id", GetMarketFixture)                            // 获取指定 fixture 的详情【测试✅】
	group.GET("/detail/fixture_date/:date", GetMarketFixtureByDate)                       // 获取指定日期的所有 fixture【测试✅】
	group.GET("/detail/fixture_between/:start_date/:end_date", GetMarketFixtureByBetween) // 获取指定日期范围内的 fixture【测试✅】
	group.GET("/moneyline/history/:fixtureId", GetMoneylineHistory)                       // Moneyline Home/Draw/Away 历史概率曲线
	group.GET("/detail/ws", WSHub.ServeWS)                                                // 获取 K 线数据
	group.GET("/token/price", GetTokenPriceHandler)                                       // 查询代币价格单个
	group.POST("/token/batch_price", GetBatchTokenPriceHandler)                           // 查询代币价格批量
}

func UpdateOddsFromAPI(client *client.RestClient, ctx context.Context) {
	log.Info("Starting to update Odds-API data...")
	var apiResponse []model.OddsAPIData
	// &regions=eu&markets=h2h,spreads,totals&bookmakers=pinnacle&oddsFormat=decimal
	query := url.Values{
		"regions":    {"eu"},
		"markets":    {"h2h,spreads,totals"},
		"bookmakers": {"pinnacle"},
		"oddsFormat": {"decimal"},
	}
	err := restClient.GetOddsApi(ctx, query, &apiResponse)
	if err != nil {
		log.Errorf("Fetch Odds-API failed: %v", err)
		return
	}

	for _, item := range apiResponse {
		// 1. 将英文队名翻译成中文，用于生成和 SportMonks 一致的 Key
		homeZh := utils.GlobalMapping[item.HomeTeam]
		if homeZh == "" {
			homeZh = item.HomeTeam
		}
		awayZh := utils.GlobalMapping[item.AwayTeam]
		if awayZh == "" {
			awayZh = item.AwayTeam
		}

		// 2. 生成 Cache Key (主队+客队)
		cacheKey := homeZh + "_" + awayZh
		setOddsCachedData(cacheKey, item)
	}
	log.Infof("Odds-API cache updated succ. Count: %d", len(apiResponse))
}
