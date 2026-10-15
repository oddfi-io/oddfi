package pushtypes

import (
	"fmt"
	"strings"
	"time"
)

// PushCard 与前端 components/agent/dock/tabs/PushPanel 的 DockPush 类型对齐。
// 关键字段：
//   - OriginalText  永远存在（推文原文）
//   - Title/Tag/AiAnalysis/Suggest  仅在 Grok 增强成功后才有
//   - EnrichStatus  EnrichStatusPending | OK | Skipped | Failed —— 替代 AiEnriched，区分 4 种状态
//   - IngestedAt    入库时间（unix ms），作为 cursor 排序键
//
// 兼容期：Time / AiEnriched 标 deprecated，下个版本删除；详见 DD-001 §4.4
type PushCard struct {
	ID           string      `json:"id"`
	Tag          string      `json:"tag,omitempty"`      // odds | match | market（增强后才有）
	TagLabel     string      `json:"tagLabel,omitempty"` // 赔率剧变 | 球赛变更 | 市场变化
	Time         string      `json:"time"`               // [deprecated, removed in vNext] 前端应用 createdAt 自算
	Title        string      `json:"title,omitempty"`    // Grok 给的中文标题（增强后才有）
	OriginalText string      `json:"originalText"`       // 推文原文（必有）
	Source       string      `json:"source"`             // "🐦 @Romano"
	SourceURL    string      `json:"sourceUrl"`
	AuthorName   string      `json:"authorName,omitempty"`
	Match        string      `json:"match,omitempty"`
	AiAnalysis   *AiAnalysis `json:"aiAnalysis,omitempty"`
	Suggest      *Suggest    `json:"suggest,omitempty"`
	Position     *Position   `json:"position,omitempty"`
	CreatedAt    int64       `json:"createdAt"`
	IngestedAt   int64       `json:"ingestedAt"`        // 入库时间，前端不展示，仅做 cursor
	EnrichStatus string      `json:"enrichStatus"`      // pending | ok | skipped | failed
	AiEnriched   bool        `json:"aiEnriched"`        // [deprecated, removed in vNext] 用 EnrichStatus == "ok" 替代

	// 持久化辅助字段（不参与 JSON 输出）
	SourceHandle string `json:"-"` // 订阅源 handle（区别于 AuthorName，用于 SQLite 列）
	AuthorHandle string `json:"-"` // 推文作者 handle
	UpdatedAt    int64  `json:"-"` // 行最后更新时间（含 enrich 完成）
	EnrichError  string `json:"-"` // failed 时的脱敏错误信息（仅落库）
}

// EnrichStatus 是 LLM 增强状态的四种合法值，前端按此决定 UI（解读中 / 解读完成 / 跳过 / 失败）。
// 任何写入 PushCard.EnrichStatus 的代码都应使用这些常量，禁止裸字符串散落。
const (
	EnrichStatusPending = "pending" // 刚入库，enrich worker 还没消费
	EnrichStatusOK      = "ok"      // LLM 调用成功，AiAnalysis/Tag/Title 已填充
	EnrichStatusSkipped = "skipped" // LLM 判定离题（如纯日常推文），保留基础卡
	EnrichStatusFailed  = "failed"  // LLM 调用失败（超时 / 限流 / 解析错误），保留基础卡 + EnrichError
)

type AiAnalysis struct {
	Change      string `json:"change"`
	PriceImpact string `json:"priceImpact"` // 允许 <b class="delta-up/down"> HTML
	ProbImpact  string `json:"probImpact"`
}

type Suggest struct {
	Text   string `json:"text"`
	Action string `json:"action"`
	Alt    string `json:"alt"`
}

type Position struct {
	Pick     string  `json:"pick"`
	EntryOdd float64 `json:"entryOdd"`
	Stake    int     `json:"stake"`
	NewOdd   float64 `json:"newOdd"`
	Pnl      float64 `json:"pnl"`
}

// BuildBaseCard 从一条 tweet 的原始信息生成"基础卡"，可立即入库。
// Grok 增强是异步的，未增强前前端展示原推文。
//
// IngestedAt 由本函数当场设置为入库时刻；EnrichStatus 默认 "pending"。
func BuildBaseCard(id, sourceHandle, authorHandle, authorName, text string, createdAtMs int64) *PushCard {
	if authorHandle == "" {
		authorHandle = sourceHandle
	}
	if createdAtMs == 0 {
		createdAtMs = time.Now().UnixMilli()
	}
	now := time.Now().UnixMilli()
	cleanHandle := strings.TrimPrefix(authorHandle, "@")
	return &PushCard{
		ID:           id,
		Time:         FormatRelativeTime(createdAtMs), // 兼容期保留
		OriginalText: text,
		Source:       "🐦 " + authorHandle,
		SourceURL:    fmt.Sprintf("x.com/%s/status/%s", cleanHandle, id),
		AuthorName:   authorName,
		CreatedAt:    createdAtMs,
		IngestedAt:   now,
		EnrichStatus: EnrichStatusPending,
		AiEnriched:   false, // 兼容期保留
		SourceHandle: sourceHandle,
		AuthorHandle: authorHandle,
		UpdatedAt:    now,
	}
}

// ApplyEnrichment 把 Grok 增强结果合并到现有卡上。空字段不覆盖。
// 状态翻转：EnrichStatus = "ok"；兼容期 AiEnriched = true。
func ApplyEnrichment(c *PushCard, tag, tagLabel, title, match string, ai *AiAnalysis, sug *Suggest) {
	if tag != "" {
		c.Tag = tag
	}
	if tagLabel != "" {
		c.TagLabel = tagLabel
	}
	if title != "" {
		c.Title = title
	}
	if match != "" {
		c.Match = match
	}
	if ai != nil {
		c.AiAnalysis = ai
	}
	if sug != nil {
		c.Suggest = sug
	}
	c.EnrichStatus = EnrichStatusOK
	c.AiEnriched = true // 兼容期保留
	c.UpdatedAt = time.Now().UnixMilli()
}

// MarkEnrichSkipped 标记本条 tweet 不需要 LLM 增强（如离题、纯日常）。
// 基础卡保留；前端按 enrichStatus=skipped 决定 UI 文案。
func MarkEnrichSkipped(c *PushCard) {
	c.EnrichStatus = EnrichStatusSkipped
	c.UpdatedAt = time.Now().UnixMilli()
}

// MarkEnrichFailed 标记 LLM 调用失败（超时/限流/解析错误）。
// 基础卡保留可见；前端展示"解读失败"。错误详情通过 EnrichError 落库（已脱敏）。
func MarkEnrichFailed(c *PushCard) {
	c.EnrichStatus = EnrichStatusFailed
	c.UpdatedAt = time.Now().UnixMilli()
}

func FormatRelativeTime(unixMs int64) string {
	t := time.Unix(unixMs/1000, 0)
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "刚刚"
	case d < time.Hour:
		return fmt.Sprintf("%d 分钟前", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%d 小时前", int(d.Hours()))
	default:
		return fmt.Sprintf("%d 天前", int(d.Hours()/24))
	}
}
