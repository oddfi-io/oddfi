package service_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"everything_finance/org/web-api/internal/service"
)

// capturedRequest 捕获 mock HTTP server 收到的请求体
type capturedRequest struct {
	body []byte
	ct   string
}

// setupMockLarkServer 启动本地 HTTP 测试服务器，捕获 Lark webhook 请求。
// 返回 server、channel（每个请求推一次）
func setupMockLarkServer(t *testing.T) (*httptest.Server, <-chan capturedRequest) {
	t.Helper()
	ch := make(chan capturedRequest, 10)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		ch <- capturedRequest{body: body, ct: r.Header.Get("Content-Type")}
		// 返回 Lark webhook 成功响应格式
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"code":0,"msg":"success","data":{"message_id":"om_test123"}}`))
	}))
	t.Cleanup(srv.Close)
	return srv, ch
}

// drainWithTimeout 等待 channel 收到消息（带超时）
func drainWithTimeout(t *testing.T, ch <-chan capturedRequest, timeout time.Duration) capturedRequest {
	t.Helper()
	select {
	case req := <-ch:
		return req
	case <-time.After(timeout):
		t.Fatal("timed out waiting for Lark webhook request")
		return capturedRequest{}
	}
}

// assertPayloadField 检查 Lark Card payload 包含特定字符串
func assertPayloadField(t *testing.T, payload []byte, field string) {
	t.Helper()
	if !strings.Contains(string(payload), field) {
		t.Errorf("payload missing field %q\npayload: %s", field, string(payload))
	}
}

// assertCardTemplate 检查 Lark Card header template 颜色
func assertCardTemplate(t *testing.T, payload []byte, wantTemplate string) {
	t.Helper()
	var msg map[string]interface{}
	if err := json.Unmarshal(payload, &msg); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	card, ok := msg["card"].(map[string]interface{})
	if !ok {
		t.Fatal("payload.card not found")
	}
	header, ok := card["header"].(map[string]interface{})
	if !ok {
		t.Fatal("payload.card.header not found")
	}
	got, _ := header["template"].(string)
	if got != wantTemplate {
		t.Errorf("card template = %q, want %q", got, wantTemplate)
	}
}

// TestLarkWebhookService_Overflow 验证 overflow 事件 payload 字段完整 + 红色模板
func TestLarkWebhookService_Overflow(t *testing.T) {
	srv, ch := setupMockLarkServer(t)
	svc := service.NewLarkWebhookServiceWithClient(srv.URL, srv.Client())

	svc.Notify(service.LarkEvent{
		EventType:  "overflow",
		TxHash:     "0xabc123",
		EOA:        "0xuser456",
		AmountUsdt: "50000",
		RoundID:    "public_a",
		Reason:     "overflow",
	})

	req := drainWithTimeout(t, ch, 3*time.Second)

	assertPayloadField(t, req.body, "overflow")
	assertPayloadField(t, req.body, "0xabc123")
	assertPayloadField(t, req.body, "0xuser456")
	assertPayloadField(t, req.body, "50000")
	assertPayloadField(t, req.body, "public_a")
	assertPayloadField(t, req.body, "overflow-handle.go") // 建议处理方式
	assertCardTemplate(t, req.body, "red")
}

// TestLarkWebhookService_Unclaimed 验证 unclaimed 事件 payload 字段完整 + 橙色模板
func TestLarkWebhookService_Unclaimed(t *testing.T) {
	srv, ch := setupMockLarkServer(t)
	svc := service.NewLarkWebhookServiceWithClient(srv.URL, srv.Client())

	svc.Notify(service.LarkEvent{
		EventType:  "unclaimed",
		TxHash:     "0xdeadbeef",
		EOA:        "0xnouser",
		AmountUsdt: "1000",
	})

	req := drainWithTimeout(t, ch, 3*time.Second)

	assertPayloadField(t, req.body, "unclaimed")
	assertPayloadField(t, req.body, "0xdeadbeef")
	assertPayloadField(t, req.body, "0xnouser")
	assertPayloadField(t, req.body, "unclaimed-credit.go")
	assertCardTemplate(t, req.body, "orange")
}

// TestLarkWebhookService_DepositConfirmed 验证有主认购成功事件 payload + 绿色模板 + BscScan CTA
func TestLarkWebhookService_DepositConfirmed(t *testing.T) {
	srv, ch := setupMockLarkServer(t)
	svc := service.NewLarkWebhookServiceWithClient(srv.URL, srv.Client())

	svc.Notify(service.LarkEvent{
		EventType:  "deposit_confirmed",
		TxHash:     "0xfeedbeef",
		EOA:        "0xbuyer1",
		AmountUsdt: "1200",
		RoundID:    "round-2026Q2-A",
		SharesOdd:  "24000",
		Referrer:   "uid=1024",
	})

	req := drainWithTimeout(t, ch, 3*time.Second)

	assertPayloadField(t, req.body, "认购到账")
	assertPayloadField(t, req.body, "0xfeedbeef")
	assertPayloadField(t, req.body, "0xbuyer1")
	assertPayloadField(t, req.body, "1200")
	assertPayloadField(t, req.body, "24000")
	assertPayloadField(t, req.body, "round-2026Q2-A")
	assertPayloadField(t, req.body, "uid=1024")
	// CTA 跳 BscScan 而非 admin 后台（正向事件无需运营介入）
	assertPayloadField(t, req.body, "bscscan.com/tx/0xfeedbeef")
	assertCardTemplate(t, req.body, "green")
}

// TestLarkWebhookService_PausedArrival 验证 paused_arrival 事件 payload 字段完整 + 蓝色模板
func TestLarkWebhookService_PausedArrival(t *testing.T) {
	srv, ch := setupMockLarkServer(t)
	svc := service.NewLarkWebhookServiceWithClient(srv.URL, srv.Client())

	svc.Notify(service.LarkEvent{
		EventType:  "paused_arrival",
		TxHash:     "0xpaused01",
		EOA:        "0xpausedeoa",
		AmountUsdt: "2000",
		RoundID:    "strategic",
	})

	req := drainWithTimeout(t, ch, 3*time.Second)

	assertPayloadField(t, req.body, "paused_arrival")
	assertPayloadField(t, req.body, "0xpaused01")
	assertPayloadField(t, req.body, "strategic")
	assertCardTemplate(t, req.body, "blue")
}

// TestLarkWebhookService_RoundMismatch 验证 round_mismatch 事件 payload 字段完整 + 橙色模板
func TestLarkWebhookService_RoundMismatch(t *testing.T) {
	srv, ch := setupMockLarkServer(t)
	svc := service.NewLarkWebhookServiceWithClient(srv.URL, srv.Client())

	svc.Notify(service.LarkEvent{
		EventType:  "round_mismatch",
		TxHash:     "0xmismatch1",
		EOA:        "0xmisuser",
		AmountUsdt: "5000",
		Note:       "用户在种子轮 end_ts 前30s 付款，被错分到战略轮",
	})

	req := drainWithTimeout(t, ch, 3*time.Second)

	assertPayloadField(t, req.body, "round_mismatch")
	assertPayloadField(t, req.body, "late-arrival.go")
	assertCardTemplate(t, req.body, "orange")
}

// TestLarkWebhookService_AdminOp 验证 admin_op 事件 payload 字段完整 + 绿色模板
func TestLarkWebhookService_AdminOp(t *testing.T) {
	srv, ch := setupMockLarkServer(t)
	svc := service.NewLarkWebhookServiceWithClient(srv.URL, srv.Client())

	svc.Notify(service.LarkEvent{
		EventType: "admin_op",
		Operator:  "admin@oddfi.io",
		Reason:    "migrate_round_id",
		Note:      "手动迁移 deposit 到种子轮",
	})

	req := drainWithTimeout(t, ch, 3*time.Second)

	// admin_op 事件：header 标题包含"admin"，body 包含 operator 和 reason 字段值
	assertPayloadField(t, req.body, "admin")              // 标题中含 "admin"
	assertPayloadField(t, req.body, "admin@oddfi.io")     // operator 字段值
	assertPayloadField(t, req.body, "migrate_round_id")   // reason 字段值
	assertPayloadField(t, req.body, "手动迁移 deposit 到种子轮") // note 字段值
	assertCardTemplate(t, req.body, "green")
}

// TestLarkWebhookService_ContentType 验证请求 Content-Type 为 application/json
func TestLarkWebhookService_ContentType(t *testing.T) {
	srv, ch := setupMockLarkServer(t)
	svc := service.NewLarkWebhookServiceWithClient(srv.URL, srv.Client())

	svc.Notify(service.LarkEvent{EventType: "admin_op", Operator: "test"})

	req := drainWithTimeout(t, ch, 3*time.Second)
	if !strings.HasPrefix(req.ct, "application/json") {
		t.Errorf("Content-Type = %q, want application/json", req.ct)
	}
}

// TestLarkWebhookService_MsgTypeInteractive 验证 msg_type 为 interactive（Lark Card）
func TestLarkWebhookService_MsgTypeInteractive(t *testing.T) {
	srv, ch := setupMockLarkServer(t)
	svc := service.NewLarkWebhookServiceWithClient(srv.URL, srv.Client())

	svc.Notify(service.LarkEvent{EventType: "overflow", TxHash: "0x1"})

	req := drainWithTimeout(t, ch, 3*time.Second)

	var msg map[string]interface{}
	if err := json.Unmarshal(req.body, &msg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if msg["msg_type"] != "interactive" {
		t.Errorf("msg_type = %v, want interactive", msg["msg_type"])
	}
}

// TestNoopAnomalyAlerter_NoPanic 验证 noop 实现不 panic 且实现 AnomalyAlerter 接口
func TestNoopAnomalyAlerter_NoPanic(t *testing.T) {
	var alerter service.AnomalyAlerter = service.NewNoopAnomalyAlerter()
	// 不应 panic
	alerter.SendAnomalyAlert(service.LarkEvent{EventType: "overflow"})
}
