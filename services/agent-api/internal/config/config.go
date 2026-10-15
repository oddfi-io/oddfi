package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	TweetCatcherToken string
	// LLM 配置 ── provider-agnostic（OpenAI 兼容协议）
	// 当前支持：Moonshot/Kimi、xAI/Grok、DeepSeek、OpenAI、OpenRouter 等
	AIAPIKey           string
	AIBaseURL          string
	AIModel            string
	ServerAddr         string
	CORSAllowedOrigins string

	// 持久化与推送（DD-001）
	DBPath          string // SQLite 路径，prod=/var/lib/oddfi-agent/prod/cards.db
	MaxSSEConns     int    // SSE 全局连接上限（默认 100，R-C2）
	DevAPIEnabled   bool   // /api/dev/* 是否开放（生产应 false，R1.C3）
	EnrichWorkers   int    // enrich worker pool 大小（默认 4）
	EnrichQueueCap  int    // enrich queue 容量（默认 100）

	// ENH-002 限流（任一为 0 时走 server.New 中的内置默认）
	SSEPerIPLimit    int // 单 IP 同时 SSE 连接上限（默认 3）
	SSESoftLimitPct  int // 全局 SSE 软上限百分比（默认 80）
	SSEMaxTrackedIPs int // SSE per-IP map 硬上限（默认 50000）
	PushRatePerIP    int // /api/push per-IP 每分钟（默认 60）
	PushRateBurst    int // /api/push 突发（默认 3）
	ChatRatePerIP    int // /api/chat per-IP 每分钟（默认 10）
	ChatRateBurst    int // /api/chat 突发（默认 2）
	RateLimitMaxIPs  int // REST IPLimiter map 硬上限（默认 50000）
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("note: no .env file loaded, using existing environment variables")
	}
	cfg := &Config{
		TweetCatcherToken:  os.Getenv("TWEET_CATCHER_TOKEN"),
		AIAPIKey:           os.Getenv("AI_API_KEY"),
		AIBaseURL:          getOrDefault("AI_BASE_URL", "https://api.moonshot.cn/v1"),
		AIModel:            getOrDefault("AI_MODEL", "moonshot-v1-8k"),
		ServerAddr:         getOrDefault("SERVER_ADDR", ":8080"),
		CORSAllowedOrigins: getOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),

		DBPath:         getOrDefault("DB_PATH", "./data/cards.db"),
		MaxSSEConns:    getIntOrDefault("MAX_SSE_CONNS", 100),
		DevAPIEnabled:  os.Getenv("DEV_API_ENABLED") == "true",
		EnrichWorkers:  getIntOrDefault("ENRICH_WORKERS", 4),
		EnrichQueueCap: getIntOrDefault("ENRICH_QUEUE_CAP", 100),

		// ENH-002 限流：env 不配则取默认（server.New 内置兜底）
		SSEPerIPLimit:    getIntOrDefault("SSE_PER_IP_LIMIT", 3),
		SSESoftLimitPct:  getIntOrDefault("SSE_SOFT_LIMIT_PCT", 80),
		SSEMaxTrackedIPs: getIntOrDefault("SSE_MAX_TRACKED_IPS", 50000),
		PushRatePerIP:    getIntOrDefault("REST_RATE_PER_IP", 60),
		PushRateBurst:    getIntOrDefault("REST_RATE_BURST", 3),
		ChatRatePerIP:    getIntOrDefault("CHAT_RATE_PER_IP", 10),
		ChatRateBurst:    getIntOrDefault("CHAT_RATE_BURST", 2),
		RateLimitMaxIPs:  getIntOrDefault("RATELIMIT_MAX_TRACKED_IPS", 50000),
	}
	if cfg.TweetCatcherToken == "" {
		log.Println("⚠ TWEET_CATCHER_TOKEN is empty (WS will be skipped)")
	}
	if cfg.AIAPIKey == "" {
		log.Println("⚠ AI_API_KEY is empty (LLM enrich will fail)")
	}
	if cfg.DevAPIEnabled {
		log.Println("[Config] DEV_API_ENABLED=true — /api/dev/* routes enabled (do NOT use in prod)")
	}
	return cfg
}

// getIntOrDefault 读取 int 环境变量并兜底默认。
//
// 旧实现把 n <= 0 视作非法 → 但合法的"严格配置"如 SSE_PER_IP_LIMIT=1 会被静默吞掉变默认 3，
// 运维查不到原因（critic review Major #1）。
//
// 修正后：n < 0 才退默认（明显非法）；n == 0 也走默认（保持"显式禁用"语义不变，
// 受影响的 server.go / ratelimit.go 在下游各有自己的 <= 0 兜底）；n >= 1 一律采纳。
// 解析失败打一条 WARNING 日志，避免拼写错误静默生效。
func getIntOrDefault(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		log.Printf("[Config] WARNING %s=%q is not a valid int — using default %d", key, v, def)
		return def
	}
	if n < 0 {
		log.Printf("[Config] WARNING %s=%d is negative — using default %d", key, n, def)
		return def
	}
	if n == 0 {
		// 显式 0 → 视为"不设置"，调用方自带 <= 0 兜底
		return def
	}
	return n
}

func getOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
