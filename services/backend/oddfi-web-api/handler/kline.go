package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// 1. 数据结构
type Kline struct {
	Time   int64  `json:"time"`   // 时间戳，单位：毫秒
	Open   string `json:"open"`   // 开盘价
	High   string `json:"high"`   // 最高价
	Low    string `json:"low"`    // 最低价
	Close  string `json:"close"`  // 收盘价
	Volume string `json:"volume"` // 成交量
}

// 2. WebSocket Hub
type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan interface{}
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.RWMutex

	// 内存缓存：保留历史数据，新用户连接时直接下发
	historyCache []Kline
}

var WSHub = &Hub{
	broadcast:  make(chan interface{}),
	register:   make(chan *websocket.Conn),
	unregister: make(chan *websocket.Conn),
	clients:    make(map[*websocket.Conn]bool),
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // 允许跨域
}

// 3. Hub 运行引擎
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			// 新用户一连进来，立刻把 30 天的历史数据发给他
			history := h.historyCache
			h.mu.Unlock()
			if len(history) > 0 {
				client.WriteJSON(map[string]interface{}{"type": "history", "data": history})
			}
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				// 给所有在线用户推最新数据
				err := client.WriteJSON(map[string]interface{}{"type": "update", "data": message})
				if err != nil {
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// WS 接入方法 (供 Gin 路由调用)
func (h *Hub) ServeWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WS 升级失败:", err)
		return
	}
	h.register <- conn

	// 保持连接不断开（简单读循环）
	go func() {
		defer func() { h.unregister <- conn }()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}

// 4. 币安数据抓取模块
// fetchKlines 拉取历史 K 线。days 为天数 (1, 7, 30)
func fetchKlines(symbol, interval string, days int) ([]Kline, error) {
	limit := days * 24 // 1 小时粒度，1 天 24 条
	if limit > 1000 {
		limit = 1000 // 币安单次最大限制
	}

	url := fmt.Sprintf("https://api.binance.com/api/v3/klines?symbol=%s&interval=%s&limit=%d", symbol, interval, limit)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rawData [][]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rawData); err != nil {
		return nil, err
	}

	var klines []Kline
	for _, item := range rawData {
		// 币安的数据格式：[开盘时间, 开盘价, 最高价, 最低价, 收盘价, 成交量, ...]
		klines = append(klines, Kline{
			Time:   int64(item[0].(float64)),
			Open:   item[1].(string),
			High:   item[2].(string),
			Low:    item[3].(string),
			Close:  item[4].(string),
			Volume: item[5].(string),
		})
	}
	return klines, nil
}

// 5. 后台轮询任务
func StartPriceFetcher() {
	// 启动时先拉取一次 30 天历史数据填充缓存
	history, err := fetchKlines("BNBUSDT", "1h", 30)
	if err == nil {
		WSHub.mu.Lock()
		WSHub.historyCache = history
		WSHub.mu.Unlock()
		log.Println("✅ 成功加载 BNBUSDT 30天历史 K 线数据")
	} else {
		log.Println("⚠️ 初始拉取 K 线失败:", err)
	}

	// 每 1 分钟轮询一次最新的那 1 根 1h K线，然后广播给前端
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for range ticker.C {
			fmt.Printf("[StartPriceFetcher] 轮询最新 K 线...\n")
			latest, err := fetchKlines("BNBUSDT", "1h", 1) // 只要最新 1 根
			if err != nil || len(latest) == 0 {
				continue
			}
			// 广播最新数据
			WSHub.broadcast <- latest[0]

			// （可选）更新本地历史缓存的最后一根 K 线
			WSHub.mu.Lock()
			if len(WSHub.historyCache) > 0 {
				lastIdx := len(WSHub.historyCache) - 1
				if WSHub.historyCache[lastIdx].Time == latest[0].Time {
					// 同一个小时内，更新这根 K 线
					WSHub.historyCache[lastIdx] = latest[0]
				} else {
					// 跨小时了，追加新 K 线，并保持缓存大小（丢弃最早的）
					WSHub.historyCache = append(WSHub.historyCache, latest[0])
					if len(WSHub.historyCache) > 720 {
						WSHub.historyCache = WSHub.historyCache[1:]
					}
				}
			}
			WSHub.mu.Unlock()
		}
	}()
}
