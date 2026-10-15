package lark

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"oddfi-cron-job/internal/logger"
)

// 全局飞书客户端单例
var client *LarkClient

// Init 初始化全局飞书客户端，webhook 为空则 panic
func Init(webhook string) {
	if webhook == "" {
		panic("lark webhook is required")
	}
	client = &LarkClient{
		webhook: webhook,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetClient 获取全局客户端实例
func GetClient() *LarkClient {
	if client == nil {
		panic("lark client not initialized")
	}
	return client
}

// MessageType 消息类型
const (
	MessageTypeText = "text"
	MessageTypeCard = "interactive"
)

// LarkClient 飞书客户端
type LarkClient struct {
	webhook string
	client  *http.Client
}

// TextMessage 文本消息结构
type TextMessage struct {
	MsgType string `json:"msg_type"`
	Content struct {
		Text string `json:"text"`
	} `json:"content"`
}

// CardMessage 卡片消息结构（用于风险提醒）
type CardMessage struct {
	MsgType string `json:"msg_type"`
	Content struct {
		Card struct {
			Header struct {
				Title struct {
					Content string `json:"content"`
					Tag     string `json:"tag"`
				} `json:"title"`
				Template string `json:"template"`
			} `json:"header"`
			Sections []struct {
				Fields []struct {
					Text string `json:"text"`
					Tag  string `json:"tag"`
				} `json:"fields"`
			} `json:"sections"`
		} `json:"card"`
	} `json:"content"`
}

// SendText 发送文本消息
func (c *LarkClient) SendText(text string) error {
	msg := TextMessage{
		MsgType: MessageTypeText,
	}
	msg.Content.Text = text

	return c.send(msg)
}

// SendWithdrawalNotification 发送提现通知（卡片消息）
func (c *LarkClient) SendWithdrawalNotification(userID string, amount float64, address string, status string) error {
	card := buildWithdrawalCard(userID, amount, address, status)
	return c.send(card)
}

// SendRiskAlert 发送风险提醒（红色卡片消息）
func (c *LarkClient) SendRiskAlert(withdrawalID uint, reason string) error {
	card := buildRiskCard(withdrawalID, reason)
	return c.send(card)
}

// buildWithdrawalCard 构建提现通知卡片
func buildWithdrawalCard(userID string, amount float64, address string, status string) CardMessage {
	card := CardMessage{
		MsgType: MessageTypeCard,
	}
	card.Content.Card.Header.Title.Content = "提现通知"
	card.Content.Card.Header.Title.Tag = "plain_text"
	card.Content.Card.Header.Template = "blue"
	card.Content.Card.Sections = []struct {
		Fields []struct {
			Text string `json:"text"`
			Tag  string `json:"tag"`
		} `json:"fields"`
	}{
		{
			Fields: []struct {
				Text string `json:"text"`
				Tag  string `json:"tag"`
			}{
				{Text: fmt.Sprintf("**用户ID:** %s", userID), Tag: "lark_md"},
				{Text: fmt.Sprintf("**金额:** %.6f", amount), Tag: "lark_md"},
				{Text: fmt.Sprintf("**地址:** %s", address), Tag: "lark_md"},
				{Text: fmt.Sprintf("**状态:** %s", status), Tag: "lark_md"},
				{Text: fmt.Sprintf("**时间:** %s", time.Now().Format("2006-01-02 15:04:05")), Tag: "lark_md"},
			},
		},
	}
	return card
}

// buildRiskCard 构建风险提醒卡片
func buildRiskCard(withdrawalID uint, reason string) CardMessage {
	card := CardMessage{
		MsgType: MessageTypeCard,
	}
	card.Content.Card.Header.Title.Content = "风险提醒"
	card.Content.Card.Header.Title.Tag = "plain_text"
	card.Content.Card.Header.Template = "red"
	card.Content.Card.Sections = []struct {
		Fields []struct {
			Text string `json:"text"`
			Tag  string `json:"tag"`
		} `json:"fields"`
	}{
		{
			Fields: []struct {
				Text string `json:"text"`
				Tag  string `json:"tag"`
			}{
				{Text: fmt.Sprintf("**提现ID:** %d", withdrawalID), Tag: "lark_md"},
				{Text: fmt.Sprintf("**风险原因:** %s", reason), Tag: "lark_md"},
				{Text: fmt.Sprintf("**检测时间:** %s", time.Now().Format("2006-01-02 15:04:05")), Tag: "lark_md"},
			},
		},
	}
	return card
}

// send 发送消息到飞书
func (c *LarkClient) send(msg interface{}) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message failed: %w", err)
	}

	req, err := http.NewRequest("POST", c.webhook, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("lark API returned status %d", resp.StatusCode)
	}

	var result struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode response failed: %w", err)
	}

	if result.Code != 0 {
		return fmt.Errorf("lark API error: %s", result.Msg)
	}

	logger.Infof("Lark message sent successfully")
	return nil
}

// GetWebhook 获取webhook地址（用于调试）
func (c *LarkClient) GetWebhook() string {
	return c.webhook
}
