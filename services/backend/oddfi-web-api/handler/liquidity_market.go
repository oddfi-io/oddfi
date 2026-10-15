package handler

import (
	"context"
	"fmt"
	"net/http"
	"oddfi-web-api/model"
	"oddfi-web-api/storage"
	"sort"
	"strconv"
	"strings"

	"github.com/cloudflare/cfssl/log"
	"github.com/gin-gonic/gin"
)

const (
	defaultLiquidityPage     = 1
	defaultLiquidityPageSize = 25
	maxLiquidityPageSize     = 100

	liquidityFixtureBetCountKeyPrefix = "liquidity:fixture:bet_count:"
)

type liquidityMarketListResponse struct {
	Fixtures   []model.Fixture  `json:"fixtures"`
	Pagination model.Pagination `json:"pagination"`
}

type liquidityPageQuery struct {
	Page     int
	PageSize int
	Locale   string
}

// GetLiquidityMarketAll 返回流动池精选未开赛赛事。
func GetLiquidityMarketAll(c *gin.Context) {
	handleLiquidityMarketList(c, "")
}

// GetLiquidityMarketSearch 按当前 locale 下的队伍名称搜索未开赛赛事。
func GetLiquidityMarketSearch(c *gin.Context) {
	name := strings.TrimSpace(c.Query("name"))
	if name == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "name 参数缺少", Data: nil})
		return
	}
	handleLiquidityMarketList(c, name)
}

func handleLiquidityMarketList(c *gin.Context, name string) {
	query, ok := parseLiquidityPageQuery(c)
	if !ok {
		return
	}

	fixtures, err := fixtureRepo.GetLiquidityUpcomingFixtures(c.Request.Context(), query.Locale)
	if err != nil {
		log.Errorf("[handleLiquidityMarketList] get liquidity fixtures failed: %v", err)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Msg: "failed to fetch liquidity market fixtures", Data: nil})
		return
	}

	if name != "" {
		fixtures = filterLiquidityFixturesByName(fixtures, name)
	}

	betCounts := getLiquidityFixtureBetCounts(c.Request.Context(), redisClient, fixtures)
	sortLiquidityFixtures(fixtures, betCounts)

	pageFixtures, pagination := paginateLiquidityFixtures(fixtures, query.Page, query.PageSize)
	applyFixturesEnableBet(pageFixtures)

	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Msg:  "success",
		Data: liquidityMarketListResponse{
			Fixtures:   pageFixtures,
			Pagination: pagination,
		},
	})
}

func parseLiquidityPageQuery(c *gin.Context) (liquidityPageQuery, bool) {
	page, err := strconv.Atoi(strings.TrimSpace(c.DefaultQuery("page", strconv.Itoa(defaultLiquidityPage))))
	if err != nil || page < 1 {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "page 参数非法", Data: nil})
		return liquidityPageQuery{}, false
	}

	pageSize, err := strconv.Atoi(strings.TrimSpace(c.DefaultQuery("page_size", strconv.Itoa(defaultLiquidityPageSize))))
	if err != nil || pageSize < 1 || pageSize > maxLiquidityPageSize {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "page_size 参数非法", Data: nil})
		return liquidityPageQuery{}, false
	}

	locale := strings.TrimSpace(c.DefaultQuery("locale", "zh"))
	if locale == "" {
		locale = "zh"
	}

	return liquidityPageQuery{
		Page:     page,
		PageSize: pageSize,
		Locale:   locale,
	}, true
}

func filterLiquidityFixturesByName(fixtures []model.Fixture, name string) []model.Fixture {
	keyword := strings.ToLower(strings.TrimSpace(name))
	if keyword == "" {
		return fixtures
	}

	filtered := make([]model.Fixture, 0, len(fixtures))
	for _, fixture := range fixtures {
		if liquidityFixtureMatchesName(fixture, keyword) {
			filtered = append(filtered, fixture)
		}
	}
	return filtered
}

func liquidityFixtureMatchesName(fixture model.Fixture, keyword string) bool {
	// 搜索发生在 ConvertToAPI 之后，fixture.Name 已经是当前 locale；按顶层 name 匹配可以和前端列表展示文案保持一致。
	return strings.Contains(strings.ToLower(fixture.Name), keyword)
}

func getLiquidityFixtureBetCounts(ctx context.Context, rdb *storage.RedisClient, fixtures []model.Fixture) map[int]int64 {
	counts := make(map[int]int64, len(fixtures))
	if rdb == nil || len(fixtures) == 0 {
		return counts
	}

	keys := make([]string, len(fixtures))
	for i, fixture := range fixtures {
		keys[i] = liquidityFixtureBetCountKey(fixture.ID)
	}

	values, err := rdb.MGet(ctx, keys...)
	if err != nil {
		// 下注热度只影响排序，Redis 异常时降级为 0 热度，避免流动池页面整体不可用。
		log.Errorf("[getLiquidityFixtureBetCounts] redis mget failed: %v", err)
		return counts
	}

	for i, value := range values {
		if value == nil {
			continue
		}
		count, ok := parseRedisInt64(value)
		if !ok || count < 0 {
			continue
		}
		counts[fixtures[i].ID] = count
	}
	return counts
}

func parseRedisInt64(value interface{}) (int64, bool) {
	switch v := value.(type) {
	case int64:
		return v, true
	case int:
		return int64(v), true
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		return n, err == nil
	case []byte:
		n, err := strconv.ParseInt(strings.TrimSpace(string(v)), 10, 64)
		return n, err == nil
	default:
		// Redis 客户端正常返回 string；兜底 fmt.Sprint 是为了避免未来封装类型变化导致排序全量失效。
		n, err := strconv.ParseInt(strings.TrimSpace(fmt.Sprint(v)), 10, 64)
		return n, err == nil
	}
}

func sortLiquidityFixtures(fixtures []model.Fixture, betCounts map[int]int64) {
	sort.SliceStable(fixtures, func(i, j int) bool {
		leftCount := betCounts[fixtures[i].ID]
		rightCount := betCounts[fixtures[j].ID]
		if leftCount != rightCount {
			return leftCount > rightCount
		}
		if fixtures[i].StartAtTimeStamp != fixtures[j].StartAtTimeStamp {
			return fixtures[i].StartAtTimeStamp < fixtures[j].StartAtTimeStamp
		}
		return fixtures[i].ID < fixtures[j].ID
	})
}

func paginateLiquidityFixtures(fixtures []model.Fixture, page int, pageSize int) ([]model.Fixture, model.Pagination) {
	total := len(fixtures)
	start := (page - 1) * pageSize
	if start >= total {
		return []model.Fixture{}, model.Pagination{
			Count:       0,
			PerPage:     pageSize,
			CurrentPage: page,
			HasMore:     false,
		}
	}

	end := start + pageSize
	if end > total {
		end = total
	}

	pageFixtures := fixtures[start:end]
	return pageFixtures, model.Pagination{
		Count:       len(pageFixtures),
		PerPage:     pageSize,
		CurrentPage: page,
		HasMore:     end < total,
	}
}

func liquidityFixtureBetCountKey(fixtureID int) string {
	return liquidityFixtureBetCountKeyPrefix + strconv.Itoa(fixtureID)
}
