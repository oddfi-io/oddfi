package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/events"
)

// sendSSERetryAndClose 在限流场景下建立最简 SSE 流，写 retry 指令后立即关闭——
// 让 EventSource 遵守等待时间而非默认 3 秒重连（W3C EventSource 规范 §9.2.6）。
//
// 为何返回 200 而非 429/503：浏览器原生 EventSource 忽略 Retry-After HTTP 头，
// 只遵守 SSE 流内的 retry: 字段。HTTP 错误码会让 EventSource 用默认 3s 重连，造成风暴。
//
// CORS：复用正常 SSE 路径的条件逻辑（BUG-019 review C1/C2）：
//   - origins["*"] 模式：withCORS 已设 ACAO:*，此处不覆盖，不设 Vary。
//   - 白名单模式：回显具体 origin + Vary:Origin（告知缓存层响应随 Origin 变化）。
func (s *Server) sendSSERetryAndClose(w http.ResponseWriter, origin string, retryMs int) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		// 不支持 flush（非流式连接，极少见）→ 退化 429；
		// 注：httptest.NewRecorder 实现了 Flusher，此分支需 noFlushWriter mock 才能覆盖（T4）。
		http.Error(w, "rate limited", http.StatusTooManyRequests)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	if s.originAllowed(origin) && !s.origins["*"] {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "retry: %d\n\n", retryMs)
	flusher.Flush()
}

// GET /api/push/stream?since=<ingestedAt>
//
// 流程（DD-001 §6.4）：
//
//	(a) Origin 白名单（EventSource 不发 preflight，仅 withCORS 不够 — R-m6）
//	(b) 全局连接上限 activeSSE （超出 503 — R-C2）
//	(c) Last-Event-ID 优先于 ?since，clamp 到 now - 72h（R-C3 / R-m2）
//	(d) ★ 先 sub := bus.Subscribe() 再查 backlog（R-C1）★
//	(e) backlog 一律 card.new + dedup map（R-m1）
//	(f) 实时事件循环：ticker(ping) + sub.Ch + ctx.Done
func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	// (a) Origin 白名单 —— 复用 originAllowed（cors.go）保证与 withCORS 决策一致
	origin := r.Header.Get("Origin")
	if !s.originAllowed(origin) {
		http.Error(w, "forbidden origin", http.StatusForbidden)
		return
	}

	// (a.5) ENH-002：全局软上限熔断（默认 80% maxSSE）
	// 高于此阈值后**新连接**被拒，已建连接不受影响。
	// 让正常用户在到达硬上限前就被劝退，给业务连接留余量。
	//
	// ⚠ best-effort 语义（review H2）：此检查与下方 CAS 之间存在短窗口期，
	// 高并发下少量连接可能略微超过 soft cap 才被硬上限拦下。这是故意的：
	// 设计目标是"平滑降级"而非"精确熔断"，引入额外锁会增加 SSE 主路径开销。
	if s.sseSoftCap > 0 && s.activeSSE.Load() >= s.sseSoftCap {
		log.Printf("[Server] SSE rejected (soft cap) active=%d cap=%d", s.activeSSE.Load(), s.sseSoftCap)
		s.sendSSERetryAndClose(w, origin, 30_000)
		return
	}

	// (a.6) ENH-002：per-IP 连接计数（默认单 IP ≤ 3 个 SSE）
	// 注意此 acquire 必须在全局 CAS 之前 —— 若先 CAS 再 acquire 失败，活跃计数会泡涨。
	ip := realIP(r)
	if s.sseTracker != nil {
		if err := s.sseTracker.Acquire(ip); err != nil {
			log.Printf("[Server] SSE rejected (per-IP limit) ip=%s", ip)
			s.sendSSERetryAndClose(w, origin, 60_000)
			return
		}
		defer s.sseTracker.Release(ip)
	}

	// (b) 全局连接上限 —— CAS loop 避免 "Add(1) 后 Add(-1) 回退" 在并发竞争下抬高瞬时计数、误判合法连接。
	// 注：到达此处时 sseTracker.Acquire 已成功，defer Release 已注册，
	// sendSSERetryAndClose 后 return 时 defer 正常执行，per-IP 计数不泄漏。
	for {
		cur := s.activeSSE.Load()
		if cur >= s.maxSSE {
			log.Printf("[Server] SSE rejected (hard cap) active=%d max=%d", cur, s.maxSSE)
			s.sendSSERetryAndClose(w, origin, 30_000)
			return
		}
		if s.activeSSE.CompareAndSwap(cur, cur+1) {
			break
		}
	}
	defer s.activeSSE.Add(-1)

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // 防 nginx 缓冲
	if s.originAllowed(origin) {
		// 仅在白名单 origin 上回显 ACAO；"*" 走 withCORS 路径，此处不重复设置
		if !s.origins["*"] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			// 回显具体 origin 时必须设 Vary，告知缓存层响应随 Origin 变化（BUG-019 review C2）
			w.Header().Set("Vary", "Origin")
		}
	}

	// (c) Last-Event-ID 优先 ?since，clamp 72h
	var sinceMs int64
	if v := r.Header.Get("Last-Event-ID"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			sinceMs = n
		}
	} else if v := r.URL.Query().Get("since"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			sinceMs = n
		}
	}
	now := time.Now().UnixMilli()
	if floor := now - MaxLookbackMs; sinceMs < floor {
		sinceMs = floor
	}

	// 没有 bus → 直接 204 退出（仅单测时可能）
	if s.bus == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// (d) ★ 先订阅再查 backlog，避免 race window（R-C1）
	sub := s.bus.Subscribe(SubBufSize)
	defer s.bus.Unsubscribe(sub)

	// 立即 flush headers，让客户端感知 200 OK
	flusher.Flush()

	// (e) 查 backlog 并发送（dedup map 预设 MaxBacklogPerSSE 避免运行期多次扩容 rehash）
	seen := make(map[string]struct{}, MaxBacklogPerSSE)
	if s.repo != nil {
		backlogCtx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		backlog, err := s.repo.QueryCardsSince(backlogCtx, sinceMs-PersistLagBufferMs, MaxBacklogPerSSE)
		cancel()
		if err != nil {
			log.Printf("[Server] SSE backlog query err=%v", err)
		}
		for _, c := range backlog {
			if err := writeSSE(w, c.IngestedAt, "card.new", c); err != nil {
				return
			}
			seen[c.ID] = struct{}{}
		}
		flusher.Flush()
	}

	// (f) 实时循环
	ticker := time.NewTicker(SSEHeartbeatInterval)
	defer ticker.Stop()

	clientGone := r.Context().Done()
	for {
		select {
		case <-clientGone:
			return
		case <-ticker.C:
			if err := writeSSE(w, 0, "ping", map[string]int64{"t": time.Now().UnixMilli()}); err != nil {
				return
			}
			flusher.Flush()
		case ev, ok := <-sub.Ch:
			if !ok {
				// 被 bus 踢出（slow consumer）
				log.Printf("[Server] SSE slow consumer evicted origin=%s", origin)
				return
			}
			if err := s.dispatchEvent(w, ev, seen); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

// dispatchEvent 把 bus 事件写成 SSE 帧。
// 对 backlog 中已发出的 card.new 做 dedup（仅对 card.new 起作用）。
func (s *Server) dispatchEvent(w io.Writer, ev any, seen map[string]struct{}) error {
	switch e := ev.(type) {
	case events.CardNew:
		if e.Card == nil {
			return nil
		}
		if _, dup := seen[e.Card.ID]; dup {
			return nil
		}
		seen[e.Card.ID] = struct{}{}
		return writeSSE(w, e.Card.IngestedAt, "card.new", e.Card)
	case events.CardUpdate:
		if e.Card == nil {
			return nil
		}
		return writeSSE(w, e.Card.IngestedAt, "card.update", e.Card)
	default:
		// 未知事件忽略
		return nil
	}
}

// writeSSE 写一帧 SSE。id=0 时省略 id: 行（用于 ping）。
func writeSSE(w io.Writer, id int64, event string, data any) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if id > 0 {
		if _, err := fmt.Fprintf(w, "id: %d\n", id); err != nil {
			return err
		}
	}
	if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b); err != nil {
		return err
	}
	return nil
}
