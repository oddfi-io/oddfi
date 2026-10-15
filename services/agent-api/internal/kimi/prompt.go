package kimi

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/handles"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/tweetcatcher"
)

const systemPrompt = `你是 OddFi 体育博彩平台的 AI 推送助手。
任务：把一条来自体育账号的 Twitter 推文解析成中文增强信息。

严格要求：
1. 任何输入语言（中/英/西/意/德/法等）→ 输出必须统一使用简体中文
2. 只输出合法 JSON 对象，禁止任何额外说明、禁止 markdown 包裹

3. 默认应当生成结构化字段 —— 我们订阅的全部是体育账号，
   只有以下三类才返回 {"skip": true}：
   (a) 纯广告/促销/抽奖/带货
   (b) 明显与体育/球队/球员/赛事/转会/赔率毫无关系：
       例如纯政治评论、个人生日/纪念日、私人度假/旅行、宠物/家人、节假日祝福、
       天气/心情/食物等纯个人生活内容。即便是体育账号发布也必须 skip ——
       账号属性不能让"度假"变成"球赛变更"，硬塞会产生虚假分析卡污染前端。
   (c) 推文文本极短无意义（如只有 emoji、单一 URL）
   除以上三类外，**一律生成增强字段**。即便赛后感言、花絮、周边、赛程预告，都要生成。
   决策原则：推文文本里必须能识别出**至少一个体育要素**
   （球员名/球队名/赛事/转会/赔率/比分/伤病/俱乐部/赞助/规则/集训/媒体见面会等）
   才生成增强；否则即使作者是体育记者也要 skip。

4. **仅** priceImpact / probImpact 两个字段允许 HTML，且**仅允许** <b class="delta-up">+5%</b> 或 <b class="delta-down">-9%</b> 这一种标签。
   其他所有字段（title / change / suggest.text / suggest.action / suggest.alt / match / tag / tagLabel）禁止任何 HTML，纯文本。
   如果推文不涉及具体赔率事件，可以是 "暂无明显影响" 或 "<b class=\"delta-up\">轻微关注度上升</b>" 等弱描述。

5. 不要编造比赛名称——只从推文文本提取；如果推文没提到具体比赛，match 字段为空字符串

6. AI 推断的赔率/概率变动幅度必须在文案中标注"AI 估算"

7. tag 三选一：
   - odds（赔率/价格相关）
   - match（比赛/球员/转会/伤病/阵容/赛果 —— 大部分推文都归这里）
   - market（市场情绪/资金/链上信号）

8. tagLabel 对应：赔率剧变 / 球赛变更 / 市场变化

9. title 限 20 个汉字以内

10. suggest.action / suggest.alt 各限 8 个汉字以内`

const userPromptTpl = `推文作者: %s（%s · 分类: %s · 原语言: %s）
推文时间: %s
推文正文:
"""
%s
"""

%s

请输出一个 JSON 对象：
{
  "skip": false,
  "tag": "odds | match | market",
  "tagLabel": "赔率剧变 | 球赛变更 | 市场变化",
  "title": "20字内中文标题",
  "match": "比赛名（如 'Newcastle vs Tottenham'，没有则空字符串）",
  "aiAnalysis": {
    "change": "一句中文核心要点",
    "priceImpact": "AI 估算 · 含 <b class=\"delta-up\"> 或 <b class=\"delta-down\">",
    "probImpact": "AI 估算 · 命中概率变化"
  },
  "suggest": {
    "text": "一句中文建议（纯文本，无 HTML）",
    "action": "≤8字主按钮",
    "alt": "≤8字副按钮"
  }
}`

// EnrichmentResult 是 Kimi/Grok 解析推文后返回的增强字段。
// main.go / server.go 收到后用 store.Update 合并到现有基础卡上。
type EnrichmentResult struct {
	Tag        string
	TagLabel   string
	Title      string
	Match      string
	AiAnalysis *pushtypes.AiAnalysis
	Suggest    *pushtypes.Suggest
}

type kimiResponse struct {
	Skip       bool                  `json:"skip"`
	Tag        string                `json:"tag"`
	TagLabel   string                `json:"tagLabel"`
	Title      string                `json:"title"`
	Match      string                `json:"match"`
	AiAnalysis *pushtypes.AiAnalysis `json:"aiAnalysis"`
	Suggest    *pushtypes.Suggest    `json:"suggest"`
}

// EnrichTweet 调用 Grok 把推文解析为增强字段。返回 (nil, nil) 表示 skip（保留基础卡不增强）。
func EnrichTweet(ctx context.Context, c *Client, post *tweetcatcher.PostData, sourceHandle string) (*EnrichmentResult, error) {
	if post == nil {
		return nil, fmt.Errorf("nil post")
	}
	if post.Text == "" {
		return nil, nil
	}

	meta := handles.Lookup(sourceHandle)
	category := "媒体"
	language := "en"
	nameCn := post.Author.Name
	if meta != nil {
		category = meta.Category
		language = meta.Language
		if meta.NameCn != "" {
			nameCn = meta.NameCn
		}
	}

	contextHint := fmt.Sprintf(
		"账号背景: %s 类账号，主要语种 %s。该账号属于我们订阅的体育/足球信息源，请按默认应生成增强字段的原则处理。",
		category, language,
	)

	tsStr := time.Unix(post.CreatedAt/1000, 0).Format("2006-01-02 15:04")
	if post.CreatedAt == 0 {
		tsStr = time.Now().Format("2006-01-02 15:04")
	}

	user := fmt.Sprintf(userPromptTpl,
		post.Author.Handle,
		nameCn,
		category,
		language,
		tsStr,
		post.Text,
		contextHint,
	)

	raw, err := c.CompleteJSON(ctx, systemPrompt, user)
	if err != nil {
		return nil, err
	}

	var parsed kimiResponse
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, fmt.Errorf("kimi response unmarshal: %w (raw=%s)", err, raw)
	}
	if parsed.Skip {
		return nil, nil
	}

	return &EnrichmentResult{
		Tag:        parsed.Tag,
		TagLabel:   parsed.TagLabel,
		Title:      parsed.Title,
		Match:      parsed.Match,
		AiAnalysis: parsed.AiAnalysis,
		Suggest:    parsed.Suggest,
	}, nil
}
