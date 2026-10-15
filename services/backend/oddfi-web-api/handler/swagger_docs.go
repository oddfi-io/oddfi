package handler

import "oddfi-web-api/model"

type swaggerMarketResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}

type swaggerFixturesResponse struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data []model.Fixture `json:"data"`
}

type swaggerLiquidityMarketListResponse struct {
	Fixtures   []model.Fixture  `json:"fixtures"`
	Pagination model.Pagination `json:"pagination"`
}

type swaggerLiquidityResponse struct {
	Code int                                `json:"code"`
	Msg  string                             `json:"msg"`
	Data swaggerLiquidityMarketListResponse `json:"data"`
}

type swaggerMarketBannerResponse struct {
	Code int                   `json:"code"`
	Data []swaggerMarketBanner `json:"data"`
}

type swaggerMarketBanner struct {
	BannerID      string                    `json:"banner_id"`
	TemplateID    string                    `json:"template_id"`
	SortOrder     int                       `json:"sort_order"`
	IsActive      bool                      `json:"is_active"`
	TagText       string                    `json:"tag_text"`
	TagColor      string                    `json:"tag_color"`
	Title         string                    `json:"title"`
	Subtitle      *string                   `json:"subtitle"`
	DecorationKey string                    `json:"decoration_key"`
	EndTime       string                    `json:"end_time"`
	Items         []swaggerMarketBannerItem `json:"items"`
}

type swaggerMarketBannerItem struct {
	Name               string         `json:"name"`
	CountryCode        string         `json:"country_code,omitempty"`
	PlayerID           string         `json:"player_id,omitempty"`
	Odds               float64        `json:"odds"`
	ImpliedProbability float64        `json:"implied_probability"`
	MarketID           int64          `json:"market_id"`
	SelectionID        int64          `json:"selection_id"`
	BetMode            []string       `json:"bet_mode"`
	Extra              map[string]any `json:"extra"`
	ImageURL           string         `json:"image_url"`
}

type swaggerMarketBannerDetailResponse struct {
	Code int                       `json:"code"`
	Msg  string                    `json:"msg"`
	Data []swaggerMarketBannerItem `json:"data"`
}

type swaggerBatchTokenPriceRequest struct {
	Tokens []TokenIdentifier `json:"tokens"`
}

type swaggerBatchTokenPriceResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	// token price 是链上行情数据，价格保持字符串，避免前端用浮点数造成精度和展示误差。
	Data []TokenPriceData `json:"data"`
}

type swaggerTokenPriceData struct {
	Price  string `json:"price"`
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
	Chain  string `json:"chain"`
}

type swaggerTokenPriceResponse struct {
	Code int                   `json:"code"`
	Msg  string                `json:"msg"`
	Data swaggerTokenPriceData `json:"data"`
}

type swaggerErrorResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}

// @Summary 健康检查
// @Tags health
// @Produce json
// @Success 200 {object} swaggerMarketResponse
// @Router /health_check [get]
func swaggerHealthCheckDoc() {}

// @Summary 获取 Market Banner 列表
// @Description 返回首页/Market 顶部 Banner 配置和可下注选项。
// @Tags banner
// @Produce json
// @Param lang query string false "语言，默认 en；支持 en/zh/pt/ja/es/tr/de/fr/hi"
// @Success 200 {object} swaggerMarketBannerResponse
// @Router /api/v1/market/banners [get]
func swaggerGetMarketBannersDoc() {}

// @Summary 获取指定 Banner 详情
// @Tags banner
// @Produce json
// @Param banner_id path string true "Banner 模板 ID"
// @Param lang query string false "语言，默认 en"
// @Success 200 {object} swaggerMarketBannerDetailResponse
// @Failure 400 {object} swaggerErrorResponse
// @Router /api/v1/market/banners/{banner_id} [get]
func swaggerGetMarketBannerDetailDoc() {}

// @Summary 获取流动池精选赛事
// @Description 按下注热度和开赛时间排序未开赛赛事，Redis 热度异常时降级为 0，不影响列表可用性。
// @Tags liquidity
// @Produce json
// @Param page query int false "页码，默认 1"
// @Param page_size query int false "每页条数，默认 25，最大 100"
// @Param locale query string false "语言，默认 zh"
// @Success 200 {object} swaggerLiquidityResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/liquidity/details/market_all [get]
func swaggerGetLiquidityMarketAllDoc() {}

// @Summary 搜索流动池赛事
// @Description 按当前 locale 下的队伍名称搜索未开赛赛事。
// @Tags liquidity
// @Produce json
// @Param name query string true "队伍名称关键词"
// @Param page query int false "页码，默认 1"
// @Param page_size query int false "每页条数，默认 25，最大 100"
// @Param locale query string false "语言，默认 zh"
// @Success 200 {object} swaggerLiquidityResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/liquidity/details/market_search [get]
func swaggerGetLiquidityMarketSearchDoc() {}

// @Summary 按联赛获取赛事
// @Tags detail
// @Produce json
// @Param league query int false "联赛 ID，默认 2；0 表示其他小国比赛"
// @Param page query int false "页码，默认 1"
// @Param type query string false "live 表示只返回进行中赛事"
// @Param country_id query string false "国家/地区筛选"
// @Param locale query string false "语言，默认 zh"
// @Success 200 {object} swaggerFixturesResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/detail/sports_all [get]
func swaggerGetSportsAllDoc() {}

// @Summary 按阶段获取赛事
// @Tags detail
// @Produce json
// @Param stage_id path int true "阶段 ID"
// @Param type query string false "live 表示只返回进行中赛事"
// @Param locale query string false "语言，默认 zh"
// @Success 200 {object} swaggerFixturesResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/detail/stages_all/{stage_id} [get]
func swaggerGetStageByIDDoc() {}

// @Summary 获取指定 fixture 详情
// @Description type=preview 返回预览数据，type=statis 返回统计数据，type=live 只查进行中赛事。
// @Tags detail
// @Produce json
// @Param fixture_id path int true "Fixture ID"
// @Param type query string true "statis / preview / live"
// @Param locale query string false "语言，默认 zh"
// @Success 200 {object} swaggerFixturesResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/detail/fixture/{fixture_id} [get]
func swaggerGetMarketFixtureDoc() {}

// @Summary 按日期获取 fixture
// @Tags detail
// @Produce json
// @Param date path string true "日期，格式 YYYY-MM-DD"
// @Param type query string false "live 表示只返回进行中赛事"
// @Param locale query string false "语言，默认 zh"
// @Success 200 {object} swaggerFixturesResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/detail/fixture_date/{date} [get]
func swaggerGetMarketFixtureByDateDoc() {}

// @Summary 按日期区间获取 fixture
// @Tags detail
// @Produce json
// @Param start_date path string true "开始日期，格式 YYYY-MM-DD"
// @Param end_date path string true "结束日期，格式 YYYY-MM-DD"
// @Param type query string false "live 表示只返回进行中赛事"
// @Param locale query string false "语言，默认 zh"
// @Success 200 {object} swaggerFixturesResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/detail/fixture_between/{start_date}/{end_date} [get]
func swaggerGetMarketFixtureByBetweenDoc() {}

// @Summary K 线 WebSocket
// @Description 升级为 WebSocket 后推送详情页 K 线数据。
// @Tags detail
// @Produce json
// @Success 101 {string} string "Switching Protocols"
// @Router /api/v1/detail/ws [get]
func swaggerServeWSDoc() {}

// @Summary 查询单个 token 价格
// @Description 通过 GeckoTerminal 查询 token price，价格以字符串返回，避免链上价格精度损失。
// @Tags token
// @Produce json
// @Param chain_id query string true "链 ID/网络名，例如 bsc、polygon_pos、base、eth、arbitrum"
// @Param address query string true "token 合约地址"
// @Success 200 {object} swaggerTokenPriceResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/token/price [get]
func swaggerGetTokenPriceDoc() {}

// @Summary 批量查询 token 价格
// @Description 单次最多 100 个 token；服务端会按链分组并发查询并写入 Redis 缓存。
// @Tags token
// @Accept json
// @Produce json
// @Param request body swaggerBatchTokenPriceRequest true "批量 token 查询请求"
// @Success 200 {object} swaggerBatchTokenPriceResponse
// @Failure 400 {object} swaggerErrorResponse
// @Failure 500 {object} swaggerErrorResponse
// @Router /api/v1/token/batch_price [post]
func swaggerGetBatchTokenPriceDoc() {}
