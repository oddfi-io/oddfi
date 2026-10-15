package tweetcatcher

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const wsURL = "wss://monitor-api.tweet-catcher.com/websocket"

type EventHandler func(*DispatchEvent)

type Client struct {
	token   string
	onEvent EventHandler
}

func NewClient(token string, onEvent EventHandler) *Client {
	return &Client{token: token, onEvent: onEvent}
}

// Run 长期运行，断线后指数退避重连，直到 ctx 取消
func (c *Client) Run(ctx context.Context) error {
	backoff := time.Second
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		err := c.connectOnce(ctx)
		if ctx.Err() != nil {
			return ctx.Err()
		}
		log.Printf("WS session ended: %v; reconnect in %s", err, backoff)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
		}
		if backoff < 30*time.Second {
			backoff *= 2
		} else {
			backoff = 30 * time.Second
		}
	}
}

func (c *Client) connectOnce(ctx context.Context) error {
	log.Printf("WS dialing %s", wsURL)
	conn, _, err := websocket.DefaultDialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	// 读第一帧（应是 Hello）
	_ = conn.SetReadDeadline(time.Now().Add(15 * time.Second))
	var first Envelope
	if err := conn.ReadJSON(&first); err != nil {
		return fmt.Errorf("read first frame: %w", err)
	}

	heartbeatInterval := 45 * time.Second
	if first.Op == OpHello && len(first.D) > 0 {
		var hello Hello
		if err := json.Unmarshal(first.D, &hello); err == nil && hello.HeartbeatInterval > 0 {
			heartbeatInterval = time.Duration(hello.HeartbeatInterval) * time.Millisecond
		}
	}
	log.Printf("WS hello received (op=%d), heartbeat=%s", first.Op, heartbeatInterval)

	// 发 Identify
	if err := conn.WriteJSON(map[string]any{
		"op":    OpIdentify,
		"token": c.token,
	}); err != nil {
		return fmt.Errorf("send identify: %w", err)
	}
	log.Println("WS identify sent")

	// 心跳 goroutine
	hbErr := make(chan error, 1)
	stop := make(chan struct{})
	defer close(stop)
	go func() {
		ticker := time.NewTicker(heartbeatInterval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				if err := conn.WriteJSON(map[string]int{"op": OpHeartbeat}); err != nil {
					select {
					case hbErr <- err:
					default:
					}
					return
				}
			}
		}
	}()

	// 主消息循环
	for {
		select {
		case err := <-hbErr:
			return fmt.Errorf("heartbeat: %w", err)
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		_ = conn.SetReadDeadline(time.Now().Add(2 * heartbeatInterval))
		var env Envelope
		if err := conn.ReadJSON(&env); err != nil {
			return fmt.Errorf("read: %w", err)
		}

		switch env.Op {
		case OpAck:
			// heartbeat ack
		case OpDispatch:
			var evt DispatchEvent
			if err := json.Unmarshal(env.D, &evt); err != nil {
				log.Printf("dispatch unmarshal error: %v (raw=%s)", err, string(env.D))
				continue
			}
			log.Printf("← event %s from %s", evt.Event, evt.TaskInfo.Handle)
			if c.onEvent != nil {
				c.onEvent(&evt)
			}
		default:
			log.Printf("WS unknown op=%d (raw=%s)", env.Op, string(env.D))
		}
	}
}
