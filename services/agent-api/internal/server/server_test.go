package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/events"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/persist"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/store"
)

func nowMsHelper() int64 { return time.Now().UnixMilli() }

func mkServerWith(t *testing.T, populateStore func(*store.MemoryStore), populateRepo func(*persist.Repo)) (*Server, *store.MemoryStore, *persist.Repo, *events.Bus) {
	t.Helper()
	mem := store.NewMemoryStore()
	bus := events.NewBus()
	repoPath := filepath.Join(t.TempDir(), "t.db")
	repo, err := persist.Open(repoPath)
	if err != nil {
		t.Fatalf("open repo: %v", err)
	}
	t.Cleanup(func() { _ = repo.Close() })

	if populateStore != nil {
		populateStore(mem)
	}
	if populateRepo != nil {
		populateRepo(repo)
	}

	srv := New(Options{
		Store:          mem,
		Repo:           repo,
		Bus:            bus,
		AllowedOrigins: "http://localhost:3000",
		MaxSSEConns:    3,
		DevAPIEnabled:  true,
	})
	return srv, mem, repo, bus
}

func mkCard(id string, ingested int64) *pushtypes.PushCard {
	return &pushtypes.PushCard{
		ID:           id,
		CreatedAt:    ingested,
		IngestedAt:   ingested,
		OriginalText: "txt " + id,
		EnrichStatus: "ok",
		UpdatedAt:    ingested,
		AuthorHandle: "@a",
	}
}

func TestHandleHealth(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("code=%d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "ok") {
		t.Errorf("body=%q", w.Body.String())
	}
}

func TestHandleListPush_Empty(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/push", nil)
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("code=%d", w.Code)
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	if body["count"].(float64) != 0 {
		t.Errorf("count=%v", body["count"])
	}
}

func TestHandleListPush_LimitClampedTo100(t *testing.T) {
	srv, mem, _, _ := mkServerWith(t, func(s *store.MemoryStore) {
		for i := 0; i < 150; i++ {
			s.Add(mkCard(fmt.Sprintf("c%d", i), int64(i+1)))
		}
	}, nil)
	_ = mem
	req := httptest.NewRequest(http.MethodGet, "/api/push?limit=999", nil)
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	if body["count"].(float64) > 100 {
		t.Errorf("limit 应 clamp 到 100, got %v", body["count"])
	}
}

func TestHandleListPush_CursorAndOrder(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, func(s *store.MemoryStore) {
		for _, ms := range []int64{100, 200, 300, 400, 500} {
			s.Add(mkCard(fmt.Sprintf("c%d", ms), ms))
		}
	}, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/push?limit=3", nil)
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)

	items := body["items"].([]any)
	if len(items) != 3 {
		t.Fatalf("len=%d", len(items))
	}
	// DESC
	if items[0].(map[string]any)["id"].(string) != "c500" {
		t.Errorf("最新应 c500, got %v", items[0].(map[string]any)["id"])
	}
	cursor := body["cursor"].(map[string]any)
	if cursor["next"].(float64) != 300 {
		t.Errorf("next 应=300, got %v", cursor["next"])
	}
	if cursor["latest"].(float64) != 500 {
		t.Errorf("latest 应=500, got %v", cursor["latest"])
	}
	if body["hasMore"].(bool) != true {
		t.Errorf("hasMore 应 true")
	}
}

func TestHandleListPush_BeforeColdPath(t *testing.T) {
	// 使用真实时间戳（避免被 72h clamp 干掉）
	now := timeNowMs()
	srv, _, _, _ := mkServerWith(t,
		func(s *store.MemoryStore) {
			s.Add(mkCard("hot_a", now-2*hourMs))
			s.Add(mkCard("hot_b", now-1*hourMs))
		},
		func(r *persist.Repo) {
			_ = r.InsertCard(context.Background(), mkCard("cold_a", now-10*hourMs))
			_ = r.InsertCard(context.Background(), mkCard("cold_b", now-5*hourMs))
		},
	)
	// before = now-3h → 应只看到 cold_a / cold_b（两条 hot 都更新）
	url := fmt.Sprintf("/api/push?before=%d", now-3*hourMs)
	req := httptest.NewRequest(http.MethodGet, url, nil)
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("code=%d body=%s", w.Code, w.Body.String())
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	items := body["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("len=%d, want 2, body=%s", len(items), w.Body.String())
	}
	first := items[0].(map[string]any)["id"].(string)
	second := items[1].(map[string]any)["id"].(string)
	if first != "cold_b" {
		t.Errorf("first id=%v want cold_b (DESC)", first)
	}
	if second != "cold_a" {
		t.Errorf("second id=%v want cold_a", second)
	}
}

const hourMs = int64(3600 * 1000)

func timeNowMs() int64 { return int64(timeNowMsImpl()) }

// 单层 indirection 让 go vet 不报 unused
func timeNowMsImpl() int64 {
	return nowMsHelper()
}

func TestHandleListPush_TruncatedFlag(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil, nil)
	// before 在远古时间（72h 之前），应被 clamp + truncated=true
	req := httptest.NewRequest(http.MethodGet, "/api/push?before=1000", nil)
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	if body["truncated"].(bool) != true {
		t.Errorf("truncated 应 true")
	}
}

func TestCORS_Preflight(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil, nil)
	req := httptest.NewRequest(http.MethodOptions, "/api/push", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Errorf("preflight code=%d", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Origin") == "" {
		t.Errorf("缺少 CORS allow-origin")
	}
}

func TestDevAPI_GatedByConfig(t *testing.T) {
	// DevAPIEnabled=false 时 /api/dev/* 不挂载
	srv := New(Options{
		Store:          store.NewMemoryStore(),
		AllowedOrigins: "*",
		DevAPIEnabled:  false,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/dev/inject", strings.NewReader(`{}`))
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("dev API 关闭时应 404, got %d", w.Code)
	}
}

func TestHandleInjectCard_PublishesBus(t *testing.T) {
	srv, _, _, bus := mkServerWith(t, nil, nil)
	sub := bus.Subscribe(4)
	defer bus.Unsubscribe(sub)

	payload := `{"id":"injected1","originalText":"hi","createdAt":1234}`
	req := httptest.NewRequest(http.MethodPost, "/api/dev/inject", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("code=%d body=%s", w.Code, w.Body.String())
	}

	select {
	case ev := <-sub.Ch:
		cn, ok := ev.(events.CardNew)
		if !ok {
			t.Fatalf("type=%T", ev)
		}
		if cn.Card.ID != "injected1" {
			t.Errorf("card id=%q", cn.Card.ID)
		}
	default:
		t.Fatal("应收到 CardNew")
	}
}

func TestHandleChat_AIUnavailable(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/chat",
		strings.NewReader(`{"messages":[{"role":"user","content":"hi"}]}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("无 kimi 时应 503, got %d", w.Code)
	}
	if strings.Contains(w.Body.String(), "kimi") || strings.Contains(w.Body.String(), "api") {
		t.Errorf("不应透传内部细节: %q", w.Body.String())
	}
}

func TestHandleChat_EmptyMessages(t *testing.T) {
	srv, _, _, _ := mkServerWith(t, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/chat", strings.NewReader(`{"messages":[]}`))
	w := httptest.NewRecorder()
	srv.Routes().ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("code=%d want 400", w.Code)
	}
}
