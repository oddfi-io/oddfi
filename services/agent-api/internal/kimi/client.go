package kimi

import (
	"context"
	"fmt"

	openai "github.com/sashabaranov/go-openai"
)

// Client 包装 OpenAI SDK，指向 Kimi (Moonshot) base URL
type Client struct {
	client *openai.Client
	model  string
}

func NewClient(apiKey, baseURL, model string) *Client {
	cfg := openai.DefaultConfig(apiKey)
	cfg.BaseURL = baseURL
	return &Client{
		client: openai.NewClientWithConfig(cfg),
		model:  model,
	}
}

// CompleteJSON 强制返回 JSON 格式
func (c *Client) CompleteJSON(ctx context.Context, system, user string) (string, error) {
	resp, err := c.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: c.model,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: system},
			{Role: openai.ChatMessageRoleUser, Content: user},
		},
		Temperature: 0.3,
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
	})
	if err != nil {
		return "", err
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("kimi returned empty choices")
	}
	return resp.Choices[0].Message.Content, nil
}
