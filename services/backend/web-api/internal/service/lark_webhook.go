package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/repository"
)

// ===========================
// AnomalyAlerter 接口（供 presaleDepositService 依赖注入）
// ===========================

// AnomalyAlerter 预售异常告警接口，定义向 Lark 群推送异常告警的最小方法集。
// presaleDepositService 依赖此接口而非具体实现，便于测试时注入 mock 或 nil（降级 noop）。
// 注意：与 referral.go 中的 LarkAlerter（基础文本告警接口）不同，
// 本接口专门用于预售 anomaly 事件的结构化推送。
type AnomalyAlerter interface {
	// SendAnomalyAlert 在 anomaly 落库后异步推送告警到 Lark 运营群。
	// 实现必须异步（goroutine）且 recover panic，不能阻塞调用方事务。
	SendAnomalyAlert(event LarkEvent)
}

// noopAnomalyAlerter 空实现，用于未配置 LarkWebhookUrl 时降级静默处理
type noopAnomalyAlerter struct{}

func (noopAnomalyAlerter) SendAnomalyAlert(_ LarkEvent) {}

// NewNoopAnomalyAlerter 返回 noop 实现（不推送任何消息）
func NewNoopAnomalyAlerter() AnomalyAlerter { return noopAnomalyAlerter{} }

// ===========================
// LarkEvent — 统一推送事件结构
// ===========================

// LarkEvent 统一推送事件，包含所有场景所需字段（字段按场景选填）。
// 触发场景（EventType 枚举）：
//   - "overflow"          超额到账异常（B2 worker 触发；红色告警）
//   - "unclaimed"         无主转账异常（worker 触发；橙色告警）
//   - "paused_arrival"    paused 期间入账（信息流；蓝色）
//   - "round_mismatch"    边界切轮异常（worker 触发；橙色告警）
//   - "deposit_confirmed" 认购成功（ConfirmDeposit 成功路径触发；绿色正向通知）
//   - "admin_op"          高敏 admin 操作（admin HTTP handler 触发；绿色审计）
//   - "script_op"         脚本执行完成（预案脚本 Commit 后触发；绿色审计）
type LarkEvent struct {
	EventType  string // 事件类型（见上方枚举）
	TxHash     string // 链上 tx hash
	EOA        string // tx.from EOA 地址
	AmountUsdt string // 金额（字符串，decimal 精度）
	RoundID    string // 所属轮次 ID
	SharesOdd  string // 获得 ODD 份额（deposit_confirmed 用，字符串 decimal）
	Referrer    string // 邀请人信息（deposit_confirmed 用，形如 "uid=1024" 或 ""）
	ReferrerEoa string // 邀请人 EOA 地址（deposit_confirmed 用，REQ-001）
	Reason     string // anomaly_reason 枚举值
	Suggestion string // 建议处理方式（前端文案）
	OncallAt   string // @oncall 的 Lark user_id（空表示不 @）
	Operator   string // admin 用户 ID 或 "script:filename"
	Note       string // 操作原因 / 补充说明
}

// ===========================
// LarkWebhookService 实现
// ===========================

// defaultLarkURLCacheTTL DB lazy fetch 的默认缓存窗口
// 设置 30s 平衡：运营 admin 改 URL 后最坏 30s 生效；DB 查询频率 ≤ 1/30s/进程
const defaultLarkURLCacheTTL = 30 * time.Second

// defaultLarkURLFetchTimeout DB 拉 webhook URL 的 SELECT 超时
// 设置 1s：避免 DB 慢拖累 Notify 内的 goroutine，超时则降级 fallback URL，
// 触发下次发推时 cacheTTL 过期再试一次（不会永久退化）
const defaultLarkURLFetchTimeout = 1 * time.Second

// MaskLarkWebhookURL 截断 Lark webhook URL 的 secret-uuid 段，仅保留 `/hook/` 前缀。
// 用于装配日志 / 错误日志，避免完整 webhook URL（含 token）被打到 prod log。
// 与 presale_admin_config.go 内 maskLarkWebhookURL 同语义但参数类型不同（string vs *string）。
func MaskLarkWebhookURL(u string) string {
	if u == "" {
		return ""
	}
	idx := strings.LastIndex(u, "/hook/")
	if idx < 0 {
		return u
	}
	return u[:idx+len("/hook/")] + "****"
}

// LarkWebhookService 向 Lark 群发送异常告警和操作通知。
// worker（presale-worker）和预案脚本（scripts/presale-ops/shared/lark.go）
// 都通过此 service 发送消息，保证消息格式统一。
//
// URL 解析三层兜底（TODO-016 双轨脱节根治）：
//  1. 优先从 DB presale_config.lark_webhook_url 拉（带 30s cache）
//  2. DB 拉失败 / 字段为空 / cfgRepo==nil → 回退构造时传入的 fallbackURL（yaml/env）
//  3. 都为空时仍构造 service 但 Notify 会 warn skip，不 panic
type LarkWebhookService struct {
	// fallbackURL 来自 config_prod.yaml / env，DB 拉失败时兜底
	fallbackURL string
	// cfgRepo 可选；nil 时纯 fallbackURL 模式，不查 DB（向后兼容旧构造）
	cfgRepo repository.PresaleConfigRepository
	// cacheTTL DB 拉取的缓存窗口
	cacheTTL time.Duration

	client *http.Client

	// URL cache + 上次拉取时间（含失败时间，避免狂打 DB）
	mu       sync.RWMutex
	cachedURL string
	cachedAt  time.Time
}

// NewLarkWebhookService 构造仅用 yaml/env URL 的 service（向后兼容老调用方）。
// 推荐新代码用 NewLarkWebhookServiceWithRepo 启用 DB 动态加载。
func NewLarkWebhookService(webhookURL string) *LarkWebhookService {
	return &LarkWebhookService{
		fallbackURL: webhookURL,
		cfgRepo:     nil,
		cacheTTL:    defaultLarkURLCacheTTL,
		client:      &http.Client{Timeout: 5 * time.Second},
	}
}

// NewLarkWebhookServiceWithRepo 构造启用 DB lazy fetch + 30s cache 的 service。
// admin 后台 PATCH /admin/presale/config 改 lark_webhook_url 后最坏 30s 内生效。
// fallbackURL 来自 yaml/env，DB 拉失败时兜底（保留旧链路完全可用）。
//
// 注意：cfgRepo 可为 nil；nil 时退化为 NewLarkWebhookService 等效行为，避免空指针。
func NewLarkWebhookServiceWithRepo(fallbackURL string, cfgRepo repository.PresaleConfigRepository) *LarkWebhookService {
	return &LarkWebhookService{
		fallbackURL: fallbackURL,
		cfgRepo:     cfgRepo,
		cacheTTL:    defaultLarkURLCacheTTL,
		client:      &http.Client{Timeout: 5 * time.Second},
	}
}

// NewLarkWebhookServiceWithClient 注入自定义 http.Client（测试专用）
func NewLarkWebhookServiceWithClient(webhookURL string, client *http.Client) *LarkWebhookService {
	return &LarkWebhookService{
		fallbackURL: webhookURL,
		cfgRepo:     nil,
		cacheTTL:    defaultLarkURLCacheTTL,
		client:      client,
	}
}

// getURL 解析当前 webhook URL，按"DB 缓存 → fallback"两级兜底。
//
// 缓存策略：
//   - cachedAt + cacheTTL 内：直接返回 cachedURL（即便上次是失败兜底的，避免狂打 DB）
//   - 过期 → 同步 fetch DB（context timeout 1s 保护）
//   - DB 拉失败 / 字段空 → cachedURL 更新成 fallback，cachedAt 推前
//   - cfgRepo==nil → 永远返回 fallbackURL，不进 DB 路径
func (s *LarkWebhookService) getURL() string {
	if s.cfgRepo == nil {
		return s.fallbackURL
	}

	// 读 cache 快路径
	s.mu.RLock()
	if !s.cachedAt.IsZero() && time.Since(s.cachedAt) < s.cacheTTL {
		url := s.cachedURL
		s.mu.RUnlock()
		return url
	}
	s.mu.RUnlock()

	// REV-007 M1：double-check + 持锁 fetch（防 thundering herd）
	// 必须在 Lock 内 fetch DB（而非 Lock 前），否则 N 个 goroutine 都各自调一次 Get 后才排队，
	// 双重检查只能省掉重复赋值但 DB 已经被打 N 次。
	// 单 leader / 单进程并发量低，持锁 fetch 串行化无性能问题；防 herd 优先。
	s.mu.Lock()
	defer s.mu.Unlock()

	// 排在第二个及之后的 goroutine：第一个 fetch 完后 cachedAt 已新鲜，直接返回
	if !s.cachedAt.IsZero() && time.Since(s.cachedAt) < s.cacheTTL {
		return s.cachedURL
	}

	// REV-007 M3：超时常量化（避免 magic number），1s 保护 Notify goroutine 不被 DB 慢拖累
	ctx, cancel := context.WithTimeout(context.Background(), defaultLarkURLFetchTimeout)
	defer cancel()

	cfg, err := s.cfgRepo.Get(ctx)
	// 标记本次拉取时间（无论成败），下个 cacheTTL 窗口不再 fetch
	s.cachedAt = time.Now()

	if err != nil {
		logger.Warnf("[LarkWebhookService] fetch lark_webhook_url from DB failed, fallback to yaml/env: %v", err)
		if s.cachedURL == "" {
			s.cachedURL = s.fallbackURL
		}
		return s.cachedURL
	}

	if cfg == nil || cfg.LarkWebhookUrl == nil || *cfg.LarkWebhookUrl == "" {
		// DB 字段空 — 用 fallback；下次 cacheTTL 过期后会再试一次 DB
		s.cachedURL = s.fallbackURL
		return s.cachedURL
	}

	s.cachedURL = *cfg.LarkWebhookUrl
	return s.cachedURL
}

// SendAnomalyAlert 实现 LarkAlerter 接口，委托给 Notify。
func (s *LarkWebhookService) SendAnomalyAlert(event LarkEvent) {
	s.Notify(event)
}

// Notify 异步推送 Lark 消息（goroutine 内执行，recover panic）。
// 不阻塞业务事务；webhook 失败仅 warn 日志，不返回错误。
func (s *LarkWebhookService) Notify(event LarkEvent) {
	go func() {
		// recover 防止 goroutine 内 panic 传播到 runtime
		defer func() {
			if r := recover(); r != nil {
				logger.Warnf("[LarkWebhookService] recovered panic in Notify event_type=%s: %v",
					event.EventType, r)
			}
		}()

		payload, err := s.buildPayload(event)
		if err != nil {
			logger.Warnf("[LarkWebhookService] build payload failed event_type=%s: %v",
				event.EventType, err)
			return
		}

		// TODO-016：每次发推前 lazy resolve URL（带 30s cache），让 admin 改 DB 后秒级生效
		webhookURL := s.getURL()
		if webhookURL == "" {
			logger.Warnf("[LarkWebhookService] empty webhook URL (DB + fallback both empty), skip event_type=%s",
				event.EventType)
			return
		}

		resp, err := s.client.Post(webhookURL, "application/json", bytes.NewReader(payload))
		if err != nil {
			logger.Warnf("[LarkWebhookService] POST failed event_type=%s: %v",
				event.EventType, err)
			return
		}
		defer resp.Body.Close()

		// 解析 Lark 返回的 message_id，便于后续在群里回帖或追踪
		var larkResp struct {
			Code int    `json:"code"`
			Msg  string `json:"msg"`
			Data struct {
				MessageID string `json:"message_id"`
			} `json:"data"`
		}
		if decErr := json.NewDecoder(resp.Body).Decode(&larkResp); decErr != nil {
			logger.Warnf("[LarkWebhookService] decode response failed event_type=%s: %v",
				event.EventType, decErr)
			return
		}

		if larkResp.Code != 0 {
			logger.Warnf("[LarkWebhookService] Lark returned error code=%d msg=%s event_type=%s",
				larkResp.Code, larkResp.Msg, event.EventType)
			return
		}

		logger.Infof("[LarkWebhookService] sent event_type=%s lark_msg_id=%s",
			event.EventType, larkResp.Data.MessageID)
	}()
}

// ===========================
// buildPayload — Lark Card Message 格式
// ===========================

// larkCardMessage Lark interactive card 顶层结构
type larkCardMessage struct {
	MsgType string    `json:"msg_type"`
	Card    *larkCard `json:"card"`
}

type larkCard struct {
	Header   *larkCardHeader   `json:"header"`
	Elements []larkCardElement `json:"elements"`
}

type larkCardHeader struct {
	Title    larkText `json:"title"`
	Template string   `json:"template"` // red/orange/green/blue
}

type larkCardElement struct {
	Tag     string      `json:"tag"`
	Text    *larkText   `json:"text,omitempty"`
	Actions []larkAction `json:"actions,omitempty"`
}

type larkText struct {
	Content string `json:"content"`
	Tag     string `json:"tag"` // plain_text / lark_md
}

type larkAction struct {
	Tag  string   `json:"tag"`
	Text larkText `json:"text"`
	URL  string   `json:"url,omitempty"`
	Type string   `json:"type,omitempty"`
}

// buildPayload 根据 LarkEvent 构造 Lark Card JSON payload。
// 5 种事件类型各有不同的 header 颜色和正文内容，但共享 Card 结构。
func (s *LarkWebhookService) buildPayload(event LarkEvent) ([]byte, error) {
	title, template, bodyMd := buildCardContent(event)

	msg := larkCardMessage{
		MsgType: "interactive",
		Card: &larkCard{
			Header: &larkCardHeader{
				Title:    larkText{Content: title, Tag: "plain_text"},
				Template: template,
			},
			Elements: []larkCardElement{
				{
					Tag:  "div",
					Text: &larkText{Content: bodyMd, Tag: "lark_md"},
				},
			},
		},
	}

	// CTA 按钮：
	//   - deposit_confirmed：跳 BscScan 看链上 tx（正向事件，不需要 admin 介入）
	//   - 其他带 tx_hash 的异常事件：跳 admin 后台 anomaly 详情页
	if event.EventType == "deposit_confirmed" && event.TxHash != "" {
		msg.Card.Elements = append(msg.Card.Elements, larkCardElement{
			Tag: "action",
			Actions: []larkAction{
				{
					Tag:  "button",
					Text: larkText{Content: "查看链上交易", Tag: "plain_text"},
					URL:  fmt.Sprintf("https://bscscan.com/tx/%s", event.TxHash),
					Type: "default",
				},
			},
		})
	} else if event.TxHash != "" {
		adminURL := fmt.Sprintf("https://admin.oddfi.io/presale/anomaly?tx=%s", event.TxHash)
		msg.Card.Elements = append(msg.Card.Elements, larkCardElement{
			Tag: "action",
			Actions: []larkAction{
				{
					Tag:  "button",
					Text: larkText{Content: "查看详情", Tag: "plain_text"},
					URL:  adminURL,
					Type: "primary",
				},
			},
		})
	}

	return json.Marshal(msg)
}

// buildCardContent 按事件类型返回（标题, 颜色模板, 正文 Markdown）
func buildCardContent(event LarkEvent) (title, template, bodyMd string) {
	switch event.EventType {
	case "overflow":
		// 超额到账：红色告警，运营需立即处理
		title = "⚠️ 预售异常：overflow 超额到账"
		template = "red"
		bodyMd = fmt.Sprintf(
			"**txHash**: %s\n**EOA**: %s\n**金额**: %s USDT\n**轮次**: %s\n**原因**: %s\n**建议**: %s",
			orDash(event.TxHash), orDash(event.EOA),
			orDash(event.AmountUsdt), orDash(event.RoundID),
			orDash(event.Reason),
			"运营跑 overflow-handle.go，选 partial_fill / next_round / hold",
		)

	case "unclaimed":
		// 无主转账：橙色告警，需客服联系用户
		title = "⚠️ 认购异常：unclaimed 无主转账"
		template = "orange"
		bodyMd = fmt.Sprintf(
			"**txHash**: %s\n**EOA**: %s\n**金额**: %s USDT\n**建议**: %s",
			orDash(event.TxHash), orDash(event.EOA),
			orDash(event.AmountUsdt),
			"客服联系用户确认，跑 unclaimed-credit.go",
		)

	case "deposit_confirmed":
		// 认购成功：绿色正向通知，有主转账落账后掌握成交情况
		title = "🎉 认购到账：用户成功入金"
		template = "green"
		// 邀请人同时展示 uid 和 EOA（REQ-001），两者均有时合并显示
		referrerLine := orDash(event.Referrer)
		if event.ReferrerEoa != "" && event.Referrer != "" {
			referrerLine = fmt.Sprintf("%s / %s", event.Referrer, event.ReferrerEoa)
		} else if event.ReferrerEoa != "" {
			referrerLine = event.ReferrerEoa
		}
		bodyMd = fmt.Sprintf(
			"**EOA**: %s\n**金额**: %s USDT\n**获得 ODD**: %s\n**轮次**: %s\n**邀请人**: %s\n**txHash**: %s",
			orDash(event.EOA), orDash(event.AmountUsdt),
			orDash(event.SharesOdd), orDash(event.RoundID),
			referrerLine, orDash(event.TxHash),
		)

	case "paused_arrival":
		// paused 期间入账：蓝色信息流，已正常入账只是提醒
		title = "ℹ️ 预售信息：paused_arrival 暂停期入账"
		template = "blue"
		bodyMd = fmt.Sprintf(
			"**txHash**: %s\n**EOA**: %s\n**金额**: %s USDT\n**轮次**: %s\n**说明**: %s",
			orDash(event.TxHash), orDash(event.EOA),
			orDash(event.AmountUsdt), orDash(event.RoundID),
			"轮次暂停中有入账，已正常记录，请确认是否需要特殊处理",
		)

	case "round_mismatch":
		// 边界切轮：橙色告警，可能需要迁移 round_id
		title = "⚠️ 预售异常：round_mismatch 边界切轮"
		template = "orange"
		suggestion := "跑 late-arrival.go 迁移到用户期望轮次"
		if event.Suggestion != "" {
			suggestion = event.Suggestion
		}
		bodyMd = fmt.Sprintf(
			"**txHash**: %s\n**EOA**: %s\n**金额**: %s USDT\n**建议**: %s\n**备注**: %s",
			orDash(event.TxHash), orDash(event.EOA),
			orDash(event.AmountUsdt), suggestion,
			orDash(event.Note),
		)

	case "admin_op":
		// 高敏 admin 操作：绿色通知
		title = "📋 预售审计：admin 操作通知"
		template = "green"
		bodyMd = fmt.Sprintf(
			"**操作者**: %s\n**操作**: %s\n**备注**: %s",
			orDash(event.Operator), orDash(event.Reason),
			orDash(event.Note),
		)

	case "script_op":
		// 脚本执行完成：绿色通知
		title = "✅ 预售脚本：操作执行完成"
		template = "green"
		bodyMd = fmt.Sprintf(
			"**脚本**: %s\n**说明**: %s",
			orDash(event.Operator), orDash(event.Note),
		)

	default:
		title = "📢 预售通知"
		template = "blue"
		bodyMd = fmt.Sprintf(
			"**事件类型**: %s\n**说明**: %s",
			event.EventType, orDash(event.Note),
		)
	}
	return title, template, bodyMd
}

// orDash 返回非空字符串，空时返回 "-"（Lark Markdown 不能有空字段）
func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}
