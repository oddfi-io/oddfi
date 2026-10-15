package server

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/events"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/persist"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/store"
)

func TestSSE_ForbiddenOrigin(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/push/stream", nil)
	req.Header.Set("Origin", "http://evil.com")
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("非白名单 Origin 应 403, got %d", w.Code)
	}
}

func TestSSE_AllowedOrigin(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil, nil)

	server := httptest.NewServer(srv.Routes())
	defer server.Close()

	req, _ := http.NewRequest(http.MethodGet, server.URL+"/api/push/stream", nil)
	req.Header.Set("Origin", "http://localhost:3000")

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		// ctx 超时也算"成功打开" — 我们关心的是 status
		if !strings.Contains(err.Error(), "deadline") && !strings.Contains(err.Error(), "context") {
			t.Fatalf("err=%v", err)
		}
	}
	if resp != nil {
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("code=%d", resp.StatusCode)
		}
		if resp.Header.Get("Content-Type") != "text/event-stream" {
			t.Errorf("Content-Type=%q", resp.Header.Get("Content-Type"))
		}
	}
}

func TestSSE_MaxConnsLimit(t *testing.T) {
	// MaxSSEConns=3，3 个挂着 + 第 4 个应 503
	srv, _, _, _ := mkServerWith(t, nil, nil)
	httpsrv := httptest.NewServer(srv.Routes())
	defer httpsrv.Close()

	open := func() *http.Response {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		t.Cleanup(cancel)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, httpsrv.URL+"/api/push/stream", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("open: %v", err)
		}
		return resp
	}

	// 占满 3 个
	var resps []*http.Response
	for i := 0; i < 3; i++ {
		resps = append(resps, open())
	}
	defer func() {
		for _, r := range resps {
			_ = r.Body.Close()
		}
	}()

	// 等一下让 activeSSE 计数器完成 Add
	time.Sleep(50 * time.Millisecond)

	// 第 4 个应被拒：现在返回 200 + retry: 帧（而非 503），让 EventSource 等待后重连
	resp := open()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("超出硬上限应 200+retry, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), "retry:") {
		t.Errorf("body 应含 retry: 帧, got %q", string(body))
	}
}

func TestSSE_BacklogFromRepo(t *testing.T) {
	srv, _, repo, _ := mkServerWith(t,
		func(s *store.MemoryStore) {
			s.Add(mkCard("c500", 500))
		},
		func(r *persist.Repo) {
			now := time.Now().UnixMilli()
			// 在最近 1 小时内（避免 72h clamp 把它们过滤掉）
			_ = r.InsertCard(context.Background(), mkCard("c1", now-3000))
			_ = r.InsertCard(context.Background(), mkCard("c2", now-2000))
			_ = r.InsertCard(context.Background(), mkCard("c3", now-1000))
		},
	)
	_ = repo

	httpsrv := httptest.NewServer(srv.Routes())
	defer httpsrv.Close()

	now := time.Now().UnixMilli()
	url := fmt.Sprintf("%s/api/push/stream?since=%d", httpsrv.URL, now-5000)

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	defer resp.Body.Close()

	// 读 backlog 帧 —— 短读一段就停
	body, _ := readUntil(resp.Body, 800*time.Millisecond)
	for _, want := range []string{"c1", "c2", "c3", "event: card.new"} {
		if !strings.Contains(body, want) {
			t.Errorf("backlog 缺 %q\n--body--\n%s", want, body)
		}
	}
}

func TestSSE_LastEventIDPriorityOverSince(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil,
		func(r *persist.Repo) {
			now := time.Now().UnixMilli()
			_ = r.InsertCard(context.Background(), mkCard("a", now-3000))
			_ = r.InsertCard(context.Background(), mkCard("b", now-1500))
		},
	)
	httpsrv := httptest.NewServer(srv.Routes())
	defer httpsrv.Close()

	now := time.Now().UnixMilli()
	url := fmt.Sprintf("%s/api/push/stream?since=%d", httpsrv.URL, now-5000)

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("Origin", "http://localhost:3000")
	// Last-Event-ID 远比 since 大 → 应取 LEI（仅返回 b）
	req.Header.Set("Last-Event-ID", fmt.Sprintf("%d", now-2000))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	defer resp.Body.Close()
	body, _ := readUntil(resp.Body, 600*time.Millisecond)

	if !strings.Contains(body, `"b"`) {
		t.Errorf("应包含 b\n--body--\n%s", body)
	}
	if strings.Contains(body, `"a"`) {
		t.Errorf("不应包含 a (LEI 应优先)\n--body--\n%s", body)
	}
}

func TestSSE_RealtimeEventViaBus(t *testing.T) {
	srv, _, _, bus := mkServerWith(t, nil, nil)
	httpsrv := httptest.NewServer(srv.Routes())
	defer httpsrv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, httpsrv.URL+"/api/push/stream", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	defer resp.Body.Close()

	// 给 handler 时间挂上 sub
	time.Sleep(50 * time.Millisecond)

	bus.Publish(events.CardNew{Card: mkCard("live1", time.Now().UnixMilli())})

	body, _ := readUntil(resp.Body, 500*time.Millisecond)
	if !strings.Contains(body, "live1") || !strings.Contains(body, "card.new") {
		t.Errorf("实时事件未收到\n--body--\n%s", body)
	}
}

func TestSSE_HeartbeatPing(t *testing.T) {
	// 把心跳改快加快测试
	old := SSEHeartbeatInterval
	defer func() { _ = old }() // 常量不能改 — 仅作占位说明
	// 跳过：心跳 15s 测试代价高，依赖 e2e 验证
	t.Skip("心跳 15s — 集成测试覆盖")
}

func TestSSE_DedupBacklogVsRealtime(t *testing.T) {
	// backlog 里有 c1；之后 bus 又 publish c1 → 应去重，浏览器只收一次
	srv, _, _, bus := mkServerWith(t, nil,
		func(r *persist.Repo) {
			now := time.Now().UnixMilli()
			_ = r.InsertCard(context.Background(), mkCard("c1", now-1000))
		},
	)
	httpsrv := httptest.NewServer(srv.Routes())
	defer httpsrv.Close()

	now := time.Now().UnixMilli()
	url := fmt.Sprintf("%s/api/push/stream?since=%d", httpsrv.URL, now-5000)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("Origin", "http://localhost:3000")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	defer resp.Body.Close()

	time.Sleep(100 * time.Millisecond)
	// 同 ID 再 publish
	bus.Publish(events.CardNew{Card: mkCard("c1", now-1000)})

	body, _ := readUntil(resp.Body, 400*time.Millisecond)
	count := strings.Count(body, `"c1"`)
	if count != 1 {
		t.Errorf("c1 应只出现 1 次 (dedup), got %d\n%s", count, body)
	}
}

func TestSSE_FrameFormat(t *testing.T) {
	// 直接调用 writeSSE 验帧格式
	buf := &strings.Builder{}
	if err := writeSSE(buf, 1700000000000, "card.new", map[string]string{"id": "x"}); err != nil {
		t.Fatal(err)
	}
	s := buf.String()
	if !strings.HasPrefix(s, "id: 1700000000000\nevent: card.new\ndata: ") {
		t.Errorf("帧前缀错: %q", s)
	}
	if !strings.HasSuffix(s, "\n\n") {
		t.Errorf("帧结尾应是双换行: %q", s[len(s)-5:])
	}
}

func TestSSE_FrameFormat_NoIDForPing(t *testing.T) {
	buf := &strings.Builder{}
	_ = writeSSE(buf, 0, "ping", map[string]int{"t": 1})
	if strings.Contains(buf.String(), "id: ") {
		t.Errorf("id=0 应省略 id: 行: %q", buf.String())
	}
}

func TestSSE_ActiveCounterReleased(t *testing.T) {
	// 验证 defer s.activeSSE.Add(-1) 在 ctx 取消时正确执行
	srv, _, _, _ := mkServerWith(t, nil, nil)
	httpsrv := httptest.NewServer(srv.Routes())
	defer httpsrv.Close()

	for i := 0; i < 5; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, httpsrv.URL+"/api/push/stream", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}
		cancel()
	}
	// 给 server 时间清理
	time.Sleep(100 * time.Millisecond)

	if got := srv.activeSSE.Load(); got != 0 {
		t.Errorf("activeSSE 未归零, got=%d", got)
	}
}

// readUntil 在指定时长内读 body，返回累计文本。
func readUntil(r io.Reader, d time.Duration) (string, error) {
	deadline := time.Now().Add(d)
	var sb strings.Builder
	buf := make([]byte, 4096)
	for time.Now().Before(deadline) {
		// 用 deadline-aware 读取：用 goroutine + select
		done := make(chan struct{})
		var n int
		var err error
		go func() {
			n, err = r.Read(buf)
			close(done)
		}()
		select {
		case <-done:
			if n > 0 {
				sb.Write(buf[:n])
			}
			if err != nil {
				return sb.String(), err
			}
		case <-time.After(time.Until(deadline)):
			return sb.String(), nil
		}
	}
	return sb.String(), nil
}

// 占位防止 unused warning（atomic 用于跨测试同步） —— 实际未在此文件直接使用
var _ atomic.Int64

// ── BUG-019 测试：SSE 限流路径返回 retry: 帧而非 HTTP 错误 ──────────────────

// noFlushWriter 不实现 http.Flusher，用于覆盖 sendSSERetryAndClose 的退化分支（T4）。
// httptest.ResponseRecorder 实现了 Flusher，因此必须用独立结构体而非嵌套 Recorder。
type noFlushWriter struct {
	h    http.Header
	body strings.Builder
	code int
}

func newNoFlushWriter() *noFlushWriter { return &noFlushWriter{h: make(http.Header)} }
func (w *noFlushWriter) Header() http.Header  { return w.h }
func (w *noFlushWriter) WriteHeader(code int) { w.code = code }
func (w *noFlushWriter) Write(b []byte) (int, error) {
	if w.code == 0 {
		w.code = 200
	}
	return w.body.Write(b)
}

// T1：per-IP 限制触发时应返回 200 + retry:60000 帧，而非 HTTP 429。
func TestSSE_PerIPLimit_ReturnsRetryFrame(t *testing.T) {
	srv := New(Options{
		Store:          store.NewMemoryStore(),
		Bus:            events.NewBus(),
		AllowedOrigins: "http://localhost:3000",
		MaxSSEConns:    10,
		SSEPerIPLimit:  1,
	})
	// 预占 httptest.NewRequest 默认 RemoteAddr "192.0.2.1" 的额度
	if err := srv.sseTracker.Acquire("192.0.2.1"); err != nil {
		t.Fatalf("pre-acquire: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/push/stream", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("per-IP limit 应返回 200+retry, got %d body=%q", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "retry: 60000") {
		t.Errorf("body 应含 retry:60000, got: %q", w.Body.String())
	}
}

// T2：全局软上限触发时应返回 200 + retry:30000 帧，而非 HTTP 503。
func TestSSE_SoftCap_ReturnsRetryFrame(t *testing.T) {
	srv := New(Options{
		Store:           store.NewMemoryStore(),
		Bus:             events.NewBus(),
		AllowedOrigins:  "http://localhost:3000",
		MaxSSEConns:     10,
		SSESoftLimitPct: 50, // sseSoftCap = 10 * 50/100 = 5
	})
	srv.activeSSE.Store(5) // 触发 activeSSE >= sseSoftCap(5)

	req := httptest.NewRequest(http.MethodGet, "/api/push/stream", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("软上限应返回 200+retry, got %d body=%q", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "retry: 30000") {
		t.Errorf("body 应含 retry:30000, got: %q", w.Body.String())
	}
}

// T3：SSEPerIPLimit=0 时默认值应为 10（BUG-019 Fix 2）。
func TestSSE_PerIPDefaultLimit(t *testing.T) {
	srv := New(Options{
		AllowedOrigins: "*",
		SSEPerIPLimit:  0,
	})
	if srv.sseTracker.perIPLimit != 10 {
		t.Errorf("perIPLimit 默认值应为 10, got %d", srv.sseTracker.perIPLimit)
	}
}

// T4：ResponseWriter 不支持 Flusher 时，sendSSERetryAndClose 应退化返回 429（BUG-019 review M2）。
func TestSSE_NoFlusher_Fallback429(t *testing.T) {
	srv := New(Options{
		Store:          store.NewMemoryStore(),
		Bus:            events.NewBus(),
		AllowedOrigins: "http://localhost:3000",
		MaxSSEConns:    10,
		SSEPerIPLimit:  1,
	})
	if err := srv.sseTracker.Acquire("192.0.2.1"); err != nil {
		t.Fatalf("pre-acquire: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/push/stream", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	nfw := newNoFlushWriter()
	srv.Routes().ServeHTTP(nfw, req)

	if nfw.code != http.StatusTooManyRequests {
		t.Errorf("无 Flusher 时应退化 429, got %d", nfw.code)
	}
}

// T5：限流路径的 CORS header 矩阵——确认 C1/C2 修复不被未来改动悄悄破坏。
func TestSSE_RateLimit_CORSHeaders(t *testing.T) {
	cases := []struct {
		name           string
		allowedOrigins string
		requestOrigin  string
		wantACO        string
		wantVary       bool
	}{
		{
			name:           "wildcard: ACAO 保持 * 不被覆盖为具体 origin",
			allowedOrigins: "*",
			requestOrigin:  "http://localhost:3000",
			wantACO:        "*",
			wantVary:       false,
		},
		{
			name:           "whitelist: 具体 origin 回显且附带 Vary:Origin",
			allowedOrigins: "http://localhost:3000",
			requestOrigin:  "http://localhost:3000",
			wantACO:        "http://localhost:3000",
			wantVary:       true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := New(Options{
				Store:          store.NewMemoryStore(),
				Bus:            events.NewBus(),
				AllowedOrigins: tc.allowedOrigins,
				MaxSSEConns:    10,
				SSEPerIPLimit:  1,
			})
			if err := srv.sseTracker.Acquire("192.0.2.1"); err != nil {
				t.Fatalf("pre-acquire: %v", err)
			}

			req := httptest.NewRequest(http.MethodGet, "/api/push/stream", nil)
			req.Header.Set("Origin", tc.requestOrigin)
			w := httptest.NewRecorder()
			srv.Routes().ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("应为 200 (retry frame), got %d", w.Code)
			}
			if got := w.Header().Get("Access-Control-Allow-Origin"); got != tc.wantACO {
				t.Errorf("ACAO: got %q, want %q", got, tc.wantACO)
			}
			hasVary := strings.Contains(w.Header().Get("Vary"), "Origin")
			if hasVary != tc.wantVary {
				t.Errorf("Vary 含 Origin: got %v, want %v (header=%q)", hasVary, tc.wantVary, w.Header().Get("Vary"))
			}
		})
	}
}
