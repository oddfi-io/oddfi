package analysis

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/kimi"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

const systemPrompt = `你是 OddFi 体育博彩平台的赛前分析师。
聚焦：2026 UEFA 欧冠决赛（Champions League Final 2025-26）。

任务：基于提供的最近 Twitter 推送 + 你的足球知识，生成一份欧冠决赛赛前分析 JSON。

严格要求：
1. 简体中文输出
2. 只输出合法 JSON 对象，禁止 markdown 包裹，禁止任何额外说明
3. evidence 至少 3 条，每条尽量带可识别的来源（媒体名或推送 author）
4. unknown 必填（你不知道但会影响结果的关键变量）
5. 数字保守，不要绝对化表达（禁用"必赢""稳赢""一定"等）
6. pickOdds 合理范围 1.30 ~ 5.50
7. aiProb 和 marketProb 三项分别加起来都 = 100
8. 如果当前不确定具体决赛对阵，按你知识里最有可能的两支队伍生成
9. summary 一句话，包含 AI 估值 vs 市场对比

输出 JSON 结构（字段必须齐全）：
{
  "match": "Real Madrid vs PSG",
  "startTime": "2026-05-30 22:00 CET",
  "hoursToStart": 240,
  "aiProb": { "home": 48, "draw": 25, "away": 27 },
  "marketProb": { "home": 45, "draw": 27, "away": 28 },
  "evidence": [
    "皇马近 10 场 7 胜 2 平 1 负，主场优势明显（FBref · 高置信）",
    "PSG 主力中场 Vitinha 累黄停赛（L'Equipe · 来自推送）",
    "..."
  ],
  "unknown": "皇马主帅是否首发 Bellingham 待官宣，影响中场创造力",
  "suggestionRange": "1000 - 1500 ODD",
  "pickLabel": "主胜",
  "pickOdds": 2.20,
  "summary": "AI 估皇马胜率 48% vs 市场 45%，有 +3pp 边际价值。"
}`

// Generate 用最近的 Twitter 推送 + 模型自身知识，生成赛前分析。
func Generate(ctx context.Context, kc *kimi.Client, recentPushes []*pushtypes.PushCard) (*Analysis, error) {
	var sb strings.Builder
	sb.WriteString("最近监控的 Twitter 推送（最新在前）：\n\n")

	count := 0
	for _, p := range recentPushes {
		if count >= 20 {
			break
		}
		sb.WriteString(fmt.Sprintf("[#%d] 来源 %s · %s\n", count+1, p.Source, p.Time))
		if p.OriginalText != "" {
			sb.WriteString(fmt.Sprintf("原文：%s\n", p.OriginalText))
		}
		if p.Title != "" {
			sb.WriteString(fmt.Sprintf("中文标题：%s\n", p.Title))
		}
		if p.AiAnalysis != nil && p.AiAnalysis.Change != "" {
			sb.WriteString(fmt.Sprintf("要点：%s\n", p.AiAnalysis.Change))
		}
		sb.WriteString("\n")
		count++
	}

	if count == 0 {
		sb.WriteString("（暂无监控推送 — 请只基于你的欧冠知识生成）\n\n")
	}

	sb.WriteString("请基于以上推送 + 你的 2025-2026 欧冠赛季知识，生成欧冠决赛赛前分析 JSON。")

	raw, err := kc.CompleteJSON(ctx, systemPrompt, sb.String())
	if err != nil {
		return nil, err
	}

	var a Analysis
	if err := json.Unmarshal([]byte(raw), &a); err != nil {
		return nil, fmt.Errorf("analysis unmarshal: %w (raw=%s)", err, raw)
	}
	a.UpdatedAt = time.Now().UnixMilli()
	a.BasedOnTweets = count
	return &a, nil
}
