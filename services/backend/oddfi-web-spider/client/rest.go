package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"oddfi-web-spider/model"
	"sync"
	"time"
)

const (
	sportMonksBaseRequestInterval = 1200 * time.Millisecond
	sportMonksRateLimitBuffer     = 0.10
	rateLimitLogInterval          = 30 * time.Second
)

type RestClient struct {
	apiKey             string
	baseURL            string
	client             *http.Client
	requestMu          sync.Mutex
	lastRequestAt      time.Time
	minRequestInterval time.Duration
	lastRateLimitLogAt time.Time
}

func NewRestClient(apiKey string) *RestClient {
	return &RestClient{
		apiKey:  apiKey,
		baseURL: "https://api.sportmonks.com/v3/football",
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		minRequestInterval: sportMonksBaseRequestInterval,
	}
}

// -- 核心公共请求逻辑 --

func (c *RestClient) get(ctx context.Context, path string, query url.Values, target interface{}) (*model.RateLimit, *model.Pagination, error) {
	// 1. 拼装 URL 和 Token
	query.Set("api_token", c.apiKey)
	fullURL := fmt.Sprintf("%s/%s?%s", c.baseURL, path, query.Encode())

	maxRetries := 3
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		// 1. 检查 Context 是否已取消
		select {
		case <-ctx.Done():
			log.Printf("[get] [Context] 取消请求: %v", ctx.Err())
			return nil, nil, ctx.Err()
		default:
		}

		if err := c.waitRateLimit(ctx); err != nil {
			return nil, nil, err
		}

		// 2. 构造 Request 并注入 Context
		req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
		if err != nil {
			log.Printf("[get] [NewRequestWithContext] 构造请求失败: %v, url=%s", err, fullURL)
			return nil, nil, err
		}

		resp, err := c.client.Do(req)
		if err != nil {
			log.Printf("[get] [Do] 发送请求失败: %v, url=%s", err, fullURL)
			lastErr = fmt.Errorf("网络请求失败 (第%d次): %w", i+1, err)
			// 网络波动，触发退避等待后重试
			c.backoff(i)
			continue
		}
		// 3. 处理 HTTP 状态码
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("API 响应异常: status=%d, body=%s", resp.StatusCode, string(body))

			// 只有 429 (限流) 或 5xx (服务器错误) 值得重试
			if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
				log.Printf("⚠️ [get] 触发重试逻辑 (第%d次): %v", i+1, lastErr)
				c.backoff(i)
				continue
			}
			// 4xx 业务错误（如 401 鉴权失败）直接退出，重试也没用
			return nil, nil, lastErr
		}

		// 4. 解析响应包体 (成功路径)
		defer resp.Body.Close()

		// 2. 定义临时结构体解析完整响应
		var wrapper struct {
			Data       json.RawMessage   `json:"data"`
			Pagination *model.Pagination `json:"pagination"`
			RateLimit  *model.RateLimit  `json:"rate_limit"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&wrapper); err != nil {
			log.Printf("[get] [NewDecoder] 解析响应失败: %v, url=%s", err, fullURL)
			return nil, nil, err
		}

		// 3. 将 Data 部分解析到业务模型
		if err := json.Unmarshal(wrapper.Data, target); err != nil {
			log.Printf("[get] [Unmarshal] 解析数据失败: %v, url=%s", err, fullURL)
			return wrapper.RateLimit, wrapper.Pagination, err
		}

		c.observeRateLimit(wrapper.RateLimit)

		return wrapper.RateLimit, wrapper.Pagination, nil
		// 成功则直接返回，跳出重试循环
	}
	log.Printf("[get] 重试 %d 次后依然失败: %v", maxRetries, lastErr)
	return nil, nil, fmt.Errorf("重试 %d 次后依然失败: %w", maxRetries, lastErr)
}

// observeRateLimit 根据 SportMonks 返回的 remaining/reset 动态调整全局请求节拍。
// 这里不再让 worker 原地睡完整 reset 窗口，而是把剩余额度按 90% 可消费、10% buffer 平滑摊到 reset 之前，避免采集线程全部阻塞导致一场都采不到。
func (c *RestClient) observeRateLimit(rateLimit *model.RateLimit) {
	if rateLimit == nil || rateLimit.Remaining < 0 || rateLimit.ResetsInSeconds <= 0 {
		return
	}

	nextInterval := calculateRequestInterval(rateLimit)

	c.requestMu.Lock()
	c.minRequestInterval = nextInterval
	shouldLog := nextInterval > sportMonksBaseRequestInterval && time.Since(c.lastRateLimitLogAt) >= rateLimitLogInterval
	if shouldLog {
		c.lastRateLimitLogAt = time.Now()
	}
	c.requestMu.Unlock()

	if shouldLog {
		log.Printf("⚠️ 限流节流: entity=%s remaining=%d reset=%ds interval=%v buffer=10%%",
			rateLimit.RequestedEntity,
			rateLimit.Remaining,
			rateLimit.ResetsInSeconds,
			nextInterval,
		)
	}
}

// calculateRequestInterval 把当前窗口剩余配额转换成下一次请求间隔。
// 使用 reset/可消费额度计算，而不是固定阈值睡眠，是为了在低额度时仍能低频采集，同时始终预留 10% 给其他采集链路。
func calculateRequestInterval(rateLimit *model.RateLimit) time.Duration {
	if rateLimit == nil || rateLimit.ResetsInSeconds <= 0 {
		return sportMonksBaseRequestInterval
	}
	if rateLimit.Remaining <= 1 {
		return time.Duration(rateLimit.ResetsInSeconds+2) * time.Second
	}

	// 按当前窗口剩余额度的 90% 继续采集，剩下 10% 给全量 spider、重试和上游计数误差做安全垫。
	spendable := int(math.Floor(float64(rateLimit.Remaining) * (1 - sportMonksRateLimitBuffer)))
	if spendable < 1 {
		spendable = 1
	}
	interval := time.Duration(rateLimit.ResetsInSeconds) * time.Second / time.Duration(spendable)
	if interval < sportMonksBaseRequestInterval {
		return sportMonksBaseRequestInterval
	}
	return interval
}

func (c *RestClient) waitRateLimit(ctx context.Context) error {
	c.requestMu.Lock()
	defer c.requestMu.Unlock()

	if c.minRequestInterval <= 0 {
		return nil
	}
	wait := c.minRequestInterval - time.Since(c.lastRequestAt)
	if wait > 0 {
		timer := time.NewTimer(wait)
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
		}
	}
	// SportMonks 按 token 计 Fixture entity 小时配额；这里把所有 goroutine 的请求串到同一节拍上，避免 moneyline worker pool 和全量 spider 同时突刺触发 429。
	c.lastRequestAt = time.Now()
	return nil
}

// backoff 简单的指数退避
func (c *RestClient) backoff(attempt int) {
	// 第一次重试等 1s, 第二次 2s, 第三次 4s
	waitTime := time.Duration(1<<attempt) * time.Second
	time.Sleep(waitTime)
}

// -- 业务接口实现 --

// GetAllLeagues 获取全量联赛 (自动处理分页)
func (c *RestClient) GetAllLeagues(ctx context.Context) ([]model.LeagueData, error) {
	var allLeagues []model.LeagueData
	page := 1

	for {
		var pageData []model.LeagueData
		query := url.Values{}
		query.Set("page", fmt.Sprintf("%d", page))

		_, pagin, err := c.get(ctx, "leagues", query, &pageData)
		if err != nil {
			log.Fatalf("[GetAllLeagues] 获取联赛数据失败: %v", err)
			return nil, err
		}

		allLeagues = append(allLeagues, pageData...)

		if pagin == nil || !pagin.HasMore {
			break
		}
		page++
		time.Sleep(200 * time.Millisecond) // 基础防抖
	}
	return allLeagues, nil
}

// GetFixturesByDate 接口 1: 按日期拉取
func (c *RestClient) GetFixturesByDate(ctx context.Context, date string) ([]model.APIFixture, error) {
	var data []model.APIFixture
	query := url.Values{}
	// 重点：在这里注入 include 参数，实现数据扁平化所需的所有字段
	// API 初始化盘，后续通过 WS 增量更新赔率
	query.Set("include", "participants;odds")
	_, _, err := c.get(ctx, "fixtures/date/"+date, query, &data)
	return data, err
}

// GetFixturesBetween 接口 2: 时间段拉取 (未来 7 天滚动)
func (c *RestClient) GetFixturesBetween(ctx context.Context, start, end string) ([]model.APIFixture, error) {
	var data []model.APIFixture
	query := url.Values{}
	query.Set("include", "participants") // 首页列表一般不需要赔率，节省流量

	_, _, err := c.get(ctx, fmt.Sprintf("fixtures/between/%s/%s", start, end), query, &data)
	return data, err
}

// GetWCFixtureByID 接口 3: 单场详情
func (c *RestClient) GetWCFixtureByID(ctx context.Context, id string) (model.APIFixture, error) {
	var data model.APIFixture
	query := url.Values{}
	query.Set("include", "participants;odds;league;statistics;state;scores")
	filters := "bookmakers:20;markets:1,6,7;fixtureLeagues:2,732,720,726,717,714,711,723,729"
	query.Set("filters", filters)
	query.Set("locale", "zh")
	_, _, err := c.get(ctx, fmt.Sprintf("fixtures/%s", id), query, &data)
	return data, err
}

// GetEUFixtureByID 接口 3: 单场详情
func (c *RestClient) GetEUFixtureByID(ctx context.Context, id string) (model.APIFixture, error) {
	var data model.APIFixture
	query := url.Values{}
	query.Set("include", "participants;odds;league;statistics;state;scores")
	filters := "bookmakers:20;markets:1,6,7;fixtureLeagues:2"
	query.Set("filters", filters)
	query.Set("locale", "zh")
	_, _, err := c.get(ctx, fmt.Sprintf("fixtures/%s", id), query, &data)
	return data, err
}

// GetOtherFixtureByID 接口 3: 单场详情
func (c *RestClient) GetOtherFixtureByID(ctx context.Context, id string) (model.APIFixture, error) {
	var data model.APIFixture
	query := url.Values{}
	query.Set("include", "participants;odds;league;statistics;state;scores")
	filters := "bookmakers:20;markets:1,6,7"
	query.Set("filters", filters)
	query.Set("locale", "zh")
	_, _, err := c.get(ctx, fmt.Sprintf("fixtures/%s", id), query, &data)
	return data, err
}

// GetMoneylineFixtureByID 拉取 Moneyline 采集所需的最小字段，减少精细调度对 SportMonks 响应体和 MySQL 入库压力。
func (c *RestClient) GetMoneylineFixtureByID(ctx context.Context, id string) (model.APIFixture, error) {
	var data model.APIFixture
	query := url.Values{}
	query.Set("include", "odds;state")
	query.Set("filters", "bookmakers:20;markets:1")
	query.Set("locale", "en")
	_, _, err := c.get(ctx, fmt.Sprintf("fixtures/%s", id), query, &data)
	return data, err
}

func (c *RestClient) GetFixtureScoreByID(ctx context.Context, id string) (model.APIFixture, error) {
	var data model.APIFixture
	query := url.Values{}
	query.Set("include", "scores;state")
	filters := "bookmakers:20;markets:1,6,7;fixtureLeagues:2"
	query.Set("filters", filters)
	_, _, err := c.get(ctx, fmt.Sprintf("fixtures/%s", id), query, &data)
	return data, err
}
