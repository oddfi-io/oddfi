package httpclient

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"time"

	"chain_crawler/pkg/tracelog"
	"gopkg.in/h2non/gentleman.v2/plugins/transport"

	"chain_crawler/pkg/utils"

	"github.com/prometheus/client_golang/prometheus"
	"gopkg.in/h2non/gentleman.v2"
	"gopkg.in/h2non/gentleman.v2/plugin"
	"gopkg.in/h2non/gentleman.v2/plugins/body"
	"gopkg.in/h2non/gentleman.v2/plugins/timeout"
)

const (
	ContentTypeJSON = "application/json"
	ContentTypeForm = "application/x-www-form-urlencoded"
)

var (
	HttpRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "httpclient",
		Name:      "request_duration",
		Help:      "Request duration",
	}, []string{
		"url",
	})

	HttpResponseStatus = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "web3",
		Subsystem: "httpclient",
		Name:      "http_status_count",
	}, []string{
		"url",
		"status",
	})
)

type ErrorDetail struct {
	Status     string
	StatusCode int
	Body       []byte
}

func (s *ErrorDetail) Error() string {
	return fmt.Sprintf("httpclient.doRequest failed, statusCode: %d, status: %s", s.StatusCode, s.Status)
}

// component
type InjectHttpClient interface {
	SetHttpClient(client HttpClient)
}

type HttpClientComponent struct{}

type HttpClientOpts func(*httpClientImpl)

// client
type HttpClient interface {
	Get(ctx context.Context, url string, headers map[string]string, params map[string]string, ret interface{}, plugins ...plugin.Plugin) error
	Post(ctx context.Context, url string, headers map[string]string, params interface{}, ret interface{}, plugins ...plugin.Plugin) error
	PostRaw(ctx context.Context, url string, headers map[string]string, params []byte, ret interface{}, plugins ...plugin.Plugin) error
	PostWithQuery(ctx context.Context, url string, headers map[string]string, queryParams map[string]string, params interface{}, ret interface{}, plugins ...plugin.Plugin) error
	SetRateLimiter(qps int) error
}

func NewHttpClient(plugins ...plugin.Plugin) HttpClient {
	cli := gentleman.New()
	cli.Use(timeout.All(timeout.Timeouts{
		Request:   15 * time.Second,
		TLS:       15 * time.Second,
		Dial:      15 * time.Second,
		KeepAlive: 15 * time.Second,
	}))
	cli.Use(transport.Set(&http.Transport{
		MaxIdleConns:        1000,
		MaxIdleConnsPerHost: 500,
		IdleConnTimeout:     30 * time.Second,
	}))
	for _, item := range plugins {
		cli = cli.Use(item)
	}
	return &httpClientImpl{
		client: cli,
	}
}

func (s *httpClientImpl) SetRateLimiter(qps int) error {
	rateLimiter, err := utils.NewRateLimiter(qps)
	if err != nil {
		return err
	}
	s.rateLimiter = rateLimiter
	return nil
}

func NewHttpClientWithOpts(opts []HttpClientOpts, plugins ...plugin.Plugin) HttpClient {
	httpClient := NewHttpClient(plugins...)
	for _, opt := range opts {
		opt(httpClient.(*httpClientImpl))
	}
	return httpClient
}

func WithRateLimiter(qps int) HttpClientOpts {
	return func(n *httpClientImpl) {
		rateLimiter, _ := utils.NewRateLimiter(qps)
		n.rateLimiter = rateLimiter
	}
}

func NewHttpClientWithoutTimeout(plugins ...plugin.Plugin) HttpClient {
	cli := gentleman.New()
	for _, item := range plugins {
		cli = cli.Use(item)
	}
	return &httpClientImpl{
		client: cli,
	}
}

type httpClientImpl struct {
	client      *gentleman.Client
	rateLimiter *utils.RateLimiter
}

func (s *httpClientImpl) usePlugins(req *gentleman.Request, plugins ...plugin.Plugin) *gentleman.Request {
	for _, item := range plugins {
		req = req.Use(item)
	}
	return req
}

func (s *httpClientImpl) Get(ctx context.Context, url string, headers map[string]string, params map[string]string, ret interface{}, plugins ...plugin.Plugin) error {
	getSpanCtx, getSpan := tracelog.StartSpan(ctx, "httpclient", "Get")
	defer getSpan.End()
	tl := tracelog.NewWithContext(getSpanCtx)
	tl.Infow("Get", "url", url)
	return utils.DoRateLimiterLogic(s.rateLimiter, func() error {
		req := s.usePlugins(s.client.Get().BaseURL(url), plugins...).SetHeaders(headers).SetQueryParams(params)
		return s.doRequest(getSpanCtx, req, ret)
	})
}

func (s *httpClientImpl) Post(ctx context.Context, url string, headers map[string]string, params interface{}, ret interface{}, plugins ...plugin.Plugin) error {

	// 为区块链查询创建 span，追踪查询时间
	postSpanCtx, postSpan := tracelog.StartSpan(ctx, "blockchain", "PostHttp")
	defer postSpan.End()


	return utils.DoRateLimiterLogic(s.rateLimiter, func() error {
		if headers == nil {
			headers = make(map[string]string)
		}
		headers["Content-Type"] = ContentTypeJSON
		req := s.usePlugins(s.client.Post().BaseURL(url), plugins...).SetHeaders(headers).Use(body.JSON(params))
		return s.doRequest(postSpanCtx, req, ret)
	})
}

func (s *httpClientImpl) PostWithQuery(ctx context.Context, url string, headers map[string]string, queryParams map[string]string, params interface{}, ret interface{}, plugins ...plugin.Plugin) error {
	
	postWithQuerySpanCtx, postWithQuerySpan := tracelog.StartSpan(ctx, "httpclient", "PostWithQuery")
	defer postWithQuerySpan.End()
	tl := tracelog.NewWithContext(postWithQuerySpanCtx)
	tl.Infow("PostWithQuery", "url", url)
	return utils.DoRateLimiterLogic(s.rateLimiter, func() error {
		if headers == nil {
			headers = make(map[string]string)
		}
		headers["Content-Type"] = ContentTypeJSON
		req := s.usePlugins(s.client.Post().BaseURL(url), plugins...).SetHeaders(headers).SetQueryParams(queryParams).Use(body.JSON(params))
		return s.doRequest(postWithQuerySpanCtx, req, ret)
	})
}

func (s *httpClientImpl) PostRaw(ctx context.Context, url string, headers map[string]string, params []byte, ret interface{}, plugins ...plugin.Plugin) error {
	
	postRawSpanCtx, postRawSpan := tracelog.StartSpan(ctx, "httpclient", "PostRaw")
	defer postRawSpan.End()
	tl := tracelog.NewWithContext(postRawSpanCtx)
	tl.Infow("PostRaw", "url", url)
	return utils.DoRateLimiterLogic(s.rateLimiter, func() error {
		if headers == nil {
			headers = make(map[string]string)
		}
		req := s.usePlugins(s.client.Post().BaseURL(url), plugins...).SetHeaders(headers).Use(body.Reader(bytes.NewBuffer(params)))
		return s.doRequest(postRawSpanCtx, req, ret)
	})
}

func (s *httpClientImpl) doRequest(ctx context.Context, req *gentleman.Request, ret interface{}) error {
	doRequestSpanCtx, doRequestSpan := tracelog.StartSpan(ctx, "httpclient", "DoRequest")
	defer doRequestSpan.End()
	tl := tracelog.NewWithContext(doRequestSpanCtx)
	tl.Infow("DoRequest", "url", req.Context.Request.URL.Host)
	// 注入trace信息到HTTP请求头中
	if req.Context != nil && req.Context.Request != nil {
		tracelog.InjectHttpHeader(doRequestSpanCtx, req.Context.Request)
	}
	
	now := time.Now()
	res, err := req.Send()
	if err != nil {
		HttpResponseStatus.WithLabelValues(req.Context.Request.URL.Host, "0").Inc()
		return err
	}
	HttpResponseStatus.WithLabelValues(req.Context.Request.URL.Host, fmt.Sprint(res.StatusCode)).Inc()
	if !res.Ok {
		return &ErrorDetail{
			Status:     res.RawResponse.Status,
			StatusCode: res.StatusCode,
			Body:       res.Bytes(),
		}
	}

	if _, ok := ret.(*string); ok {
		*ret.(*string) = string(res.Bytes())
		return nil
	}

	// 解析返回结果
	if err := utils.JsonDecode(res.Bytes(), ret); err != nil {
		return err
	}

	HttpRequestDuration.WithLabelValues(req.Context.Request.URL.Host).Observe(time.Since(now).Seconds())
	return nil
}

func IsTooManyRequestError(err error) bool {
	if detailsErr, ok := err.(*ErrorDetail); ok {
		return detailsErr.StatusCode == http.StatusTooManyRequests
	}
	return false
}
