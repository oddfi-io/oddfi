package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"oddfi-web-api/model"
	"strings"
	"time"
)

// 通用客户端
type RestClient struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

// 价格客户端
type RestPriceClient struct {
	baseURL string
	client  *http.Client
}

func NewRestClient(apiKey string) *RestClient {
	return &RestClient{
		apiKey:  apiKey,
		baseURL: "https://api.sportmonks.com/v3/football",
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func NewRestPriceClient() *RestPriceClient {
	return &RestPriceClient{
		baseURL: "https://api.geckoterminal.com/api/v2",
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// -- 核心公共请求逻辑 --

func (c *RestClient) Get(ctx context.Context, path string, query url.Values, target interface{}) (*model.RateLimit, *model.Pagination, error) {
	// 1. 拼装 URL 和 Token
	query.Set("api_token", c.apiKey)
	fullURL := fmt.Sprintf("%s/%s?%s", c.baseURL, path, query.Encode())
	log.Printf("[RestClient]===== Requesting GET fullURL=====: %s", fullURL)

	maxRetries := 3
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		// 优化 1: 每次重试前先检查父级 Context 是否已经玩完
		if err := ctx.Err(); err != nil {
			fmt.Printf("Context 取消，重试失败：%v\n", err)
			return nil, nil, err
		}
		// 使用匿名函数包裹单次请求逻辑，确保 defer 能及时释放资源
		rateLimit, pagination, retryable, err := func() (*model.RateLimit, *model.Pagination, bool, error) {
			reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			defer cancel() // 只要这一层匿名函数结束，立即释放计时器资源

			req, err := http.NewRequestWithContext(reqCtx, "GET", fullURL, nil)
			if err != nil {
				return nil, nil, false, fmt.Errorf("构造请求失败: %w", err)
			}

			resp, err := c.client.Do(req)
			if err != nil {
				// 优化 2: 如果是 Context 取消（比如父级 ctx 取消了），不需要重试，直接退出
				if errors.Is(err, context.Canceled) {
					return nil, nil, false, err
				}
				return nil, nil, true, err // 网络错误，标记为可重试
			}
			defer resp.Body.Close() // 关键：现在它会在匿名函数结束时立即关闭

			// 检查状态码
			if resp.StatusCode != http.StatusOK {
				body, _ := io.ReadAll(resp.Body)
				errResp := fmt.Errorf("API状态异常: %d, body: %s", resp.StatusCode, string(body))

				// 只有限流或 5xx 值得重试
				isRetryable := resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500
				return nil, nil, isRetryable, errResp
			}

			// 解析 JSON
			var wrapper struct {
				Data       json.RawMessage   `json:"data"`
				Pagination *model.Pagination `json:"pagination"`
				RateLimit  *model.RateLimit  `json:"rate_limit"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&wrapper); err != nil {
				return nil, nil, false, fmt.Errorf("JSON解析失败: %w", err)
			}
			// 解析 Data 到目标对象
			if err := json.Unmarshal(wrapper.Data, target); err != nil {
				return wrapper.RateLimit, wrapper.Pagination, false, fmt.Errorf("Data解析失败: %w", err)
			}
			return wrapper.RateLimit, wrapper.Pagination, false, nil
		}()

		// 处理结果
		if err == nil {
			// 优化 3: 成功的路径也需要感知 Context 的限流等待
			if rateLimit != nil && rateLimit.Remaining < 20 {
				wait := time.Duration(rateLimit.ResetsInSeconds+1) * time.Second
				log.Printf("⚠️ 限流预警: 剩余 %d, 阻塞等待 %v", rateLimit.Remaining, wait)
				if waitErr := c.waitWithContext(ctx, wait); waitErr != nil {
					return rateLimit, pagination, waitErr
				}
			}
			return rateLimit, pagination, nil
		}
		// 出现错误，记录并判断是否重试
		lastErr = err
		if !retryable {
			return rateLimit, pagination, err
		}

		log.Printf("⚠️ [get] 第%d次请求失败(可重试): %v", i+1, err)
		// 优化 4: 这里的 backoff 必须是可中断的
		if waitErr := c.waitWithContext(ctx, c.getBackoffDuration(i)); waitErr != nil {
			return nil, nil, waitErr
		}
	}
	return nil, nil, fmt.Errorf("重试 %d 次后失败: %w", maxRetries, lastErr)
}

// 辅助工具：可被 Context 取消的休眠
func (c *RestClient) waitWithContext(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err() // 进程关闭或请求取消，立即停止休眠
	case <-t.C:
		return nil // 时间到，继续
	}
}

// getBackoffDuration 计算重试等待时间
// i: 当前重试次数（从 0 开始）
func (c *RestClient) getBackoffDuration(i int) time.Duration {
	// 1. 基础指数退避：2^i 秒 (1s, 2s, 4s, ...)
	backoff := math.Pow(2, float64(i))

	// 2. 加入随机抖动 (Jitter)
	// 产生一个 0 到 1000 毫秒之间的随机偏移
	// 避免多个客户端在同一秒集体“复活”重试
	jitter := time.Duration(rand.Intn(1000)) * time.Millisecond

	// 3. 组合结果
	duration := time.Duration(backoff)*time.Second + jitter

	// 4. 设置一个上限（例如最大等待 10 秒），防止无限等下去
	maxWait := 10 * time.Second
	if duration > maxWait {
		return maxWait
	}

	return duration
}

// backoff 简单的指数退避
func (c *RestClient) backoff(attempt int) {
	// 第一次重试等 1s, 第二次 2s, 第三次 4s
	waitTime := time.Duration(1<<attempt) * time.Second
	time.Sleep(waitTime)
}

// -- 业务接口实现 --

// GetFixturesByDate 接口 1: 按日期拉取
func (c *RestClient) GetFixturesByDate(ctx context.Context, date string) ([]model.Fixture, error) {
	var data []model.Fixture
	query := url.Values{}
	// 重点：在这里注入 include 参数，实现数据扁平化所需的所有字段
	// API 初始化盘，后续通过 WS 增量更新赔率
	query.Set("include", "participants;odds")
	_, _, err := c.Get(ctx, "fixtures/date/"+date, query, &data)
	return data, err
}

// GetFixturesBetween 接口 2: 时间段拉取 (未来 7 天滚动)
func (c *RestClient) GetFixturesBetween(ctx context.Context, start, end string) ([]model.Fixture, error) {
	var data []model.Fixture
	query := url.Values{}
	query.Set("include", "participants")

	_, _, err := c.Get(ctx, fmt.Sprintf("fixtures/between/%s/%s", start, end), query, &data)
	return data, err
}

// GetFixtureByID 接口 3: 单场详情
func (c *RestClient) GetFixtureByID(ctx context.Context, id int64) (*model.Fixture, error) {
	var data model.Fixture
	query := url.Values{}
	query.Set("include", "participants;odds;league;statistics")

	_, _, err := c.Get(ctx, fmt.Sprintf("fixtures/%d", id), query, &data)
	return &data, err
}

func (c *RestClient) GetTokenPrice(ctx context.Context, path string, query url.Values, target interface{}) error {
	// 2. 拼装完整 URL
	fullURL := fmt.Sprintf("%s/%s", strings.TrimSuffix(c.baseURL, "/"), strings.TrimPrefix(path, "/"))
	if len(query) > 0 {
		fullURL = fmt.Sprintf("%s?%s", fullURL, query.Encode())
	}

	log.Printf("[NewRestPriceClient] Requesting GET: %s", fullURL)

	// 3. 构建 Request
	req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "oddfi-api-agent/1.0")

	// 4. 执行请求
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("http_status_%d: %s", resp.StatusCode, string(body))
	}

	return json.NewDecoder(resp.Body).Decode(target)
}

func (c *RestPriceClient) GetTokenPrice(ctx context.Context, path string, query url.Values, target interface{}) error {
	// 2. 拼装完整 URL
	fullURL := fmt.Sprintf("%s/%s", strings.TrimSuffix(c.baseURL, "/"), strings.TrimPrefix(path, "/"))
	if len(query) > 0 {
		fullURL = fmt.Sprintf("%s?%s", fullURL, query.Encode())
	}

	log.Printf("[NewRestPriceClient] Requesting GET: %s", fullURL)

	// 3. 构建 Request
	req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "oddfi-api-agent/1.0")

	// 4. 执行请求
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("http_status_%d: %s", resp.StatusCode, string(body))
	}

	return json.NewDecoder(resp.Body).Decode(target)
}

func (c *RestClient) GetOddsApi(ctx context.Context, query url.Values, target interface{}) error {
	// 1. 拼装 URL 和 Token

	keyList := []string{"177ef84f5e0deeb6f97b410f017e3f0c", "2a0d69d32839f2a23934111b113ab8a8", "5e64ed38c692b0878da15f90ac83527b", "177ef84f5e0deeb6f97b410f017e3f0c"}
	query.Set("apiKey", keyList[rand.Intn(len(keyList))])

	// 注意：此处移除了硬编码的 path，建议作为参数传入或保持灵活性
	baseURL := "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds"
	fullURL := fmt.Sprintf("%s?%s", baseURL, query.Encode())

	maxRetries := 3
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		// 检查 Context
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
		if err != nil {
			// 修正：严禁在工具类函数中使用 log.Fatalf，这会导致主进程直接退出
			return fmt.Errorf("构造请求失败: %w", err)
		}

		resp, err := c.client.Do(req)
		if err != nil {
			log.Printf("⚠️ [GetOddsApi] 网络请求失败 (第%d次): %v", i+1, err)
			lastErr = err
			c.backoff(i) // 这里的 backoff 内部应有 time.Sleep
			continue
		}

		// 处理响应体
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("API 响应异常: status=%d, body=%s", resp.StatusCode, string(body))

			if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
				log.Printf("⚠️ [GetOddsApi] 触发重试: %v", lastErr)
				c.backoff(i)
				continue
			}
			return lastErr // 4xx 错误直接返回
		}

		// 成功路径：解析数据
		// 修正：不需要双重解析（又用 Decoder 又用 Unmarshal）
		err = json.NewDecoder(resp.Body).Decode(target)
		resp.Body.Close() // 必须在解析完立即关闭，或使用 defer
		if err != nil {
			return fmt.Errorf("解析响应 JSON 失败: %w", err)
		}

		log.Printf("[GetOddsApi] 成功解析数据, url=%s", fullURL)
		return nil // 成功退出
	}

	return fmt.Errorf("在重试 %d 次后失败: %w", maxRetries, lastErr)
}
