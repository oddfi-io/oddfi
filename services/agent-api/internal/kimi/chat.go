package kimi

import (
	"context"
	"fmt"

	openai "github.com/sashabaranov/go-openai"
)

const chatSystemPrompt = `你是 OddFi 体育博彩平台的 AI 助手。

身份：你叫 Cat（用户当前 AI 类型偏好：陪伴派 🌿）。

风格：
- 重聊天轻推荐，像朋友一样自然对话
- 用简体中文回复
- 单条回复不超过 200 字，简洁不啰嗦
- 不要 markdown 标题/列表/代码块

约束（红线）：
- 不能承诺任何下注结果、不能承诺盈利
- 不能编造具体比赛比分、不能编造赔率数字
- 不能主动鼓励加注；命中 Tilt 信号要主动劝阻
- 所有体育建议在末尾自然带一句"非投资建议"或类似免责
- 不知道的事情要说"我不确定"，不要瞎编`

type ChatMessage struct {
	Role    string // "user" | "assistant"
	Content string
}

func (c *Client) ChatComplete(ctx context.Context, msgs []ChatMessage) (string, error) {
	openaiMsgs := make([]openai.ChatCompletionMessage, 0, len(msgs)+1)
	openaiMsgs = append(openaiMsgs, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: chatSystemPrompt,
	})
	for _, m := range msgs {
		role := openai.ChatMessageRoleUser
		if m.Role == "assistant" {
			role = openai.ChatMessageRoleAssistant
		}
		openaiMsgs = append(openaiMsgs, openai.ChatCompletionMessage{
			Role:    role,
			Content: m.Content,
		})
	}

	resp, err := c.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:       c.model,
		Messages:    openaiMsgs,
		Temperature: 0.7,
	})
	if err != nil {
		return "", err
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("kimi/chat: empty choices")
	}
	return resp.Choices[0].Message.Content, nil
}
