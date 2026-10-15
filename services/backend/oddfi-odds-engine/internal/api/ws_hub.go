package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"oddfi-odds-engine/internal/model"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // 开发阶段允许跨域
}

// WSHub 管理所有活动的 WebSocket 客户端
type WSHub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan model.MarketStateUpdate
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.Mutex
}

func NewWSHub() *WSHub {
	return &WSHub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan model.MarketStateUpdate, 100),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *WSHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Println("🔌 新前端已连接 WebSocket")

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			// 将赔率更新推送到所有在线用户
			msgBytes, _ := json.Marshal(message)
			h.mu.Lock()
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, msgBytes)
				if err != nil {
					log.Printf("⚠️ 推送失败，关闭连接: %v", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

// ServeWS 处理前端的 WS 连接请求
func (h *WSHub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ WS 升级失败: %v", err)
		return
	}
	h.register <- conn
}

// GetBroadcastChan 提供给 OddsWorker 的发送通道
func (h *WSHub) GetBroadcastChan() chan<- model.MarketStateUpdate {
	return h.broadcast
}
