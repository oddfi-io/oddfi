package config

import "testing"

// TestEventsUpstream 验证 events 模块上游覆盖的回落语义（DD002 联调期机制）：
// 覆盖字段任一为空 → 必须回落主上游，保证"删 env 即合流"的切换路径可靠。
func TestEventsUpstream(t *testing.T) {
	cases := []struct {
		name      string
		cfg       WebapiConfig
		wantURL   string
		wantToken string
	}{
		{
			name: "覆盖齐全→走 events 专用上游",
			cfg: WebapiConfig{
				InternalURL: "https://prod.example", ServiceToken: "prod-token",
				EventsInternalURL: "http://dev.example:8082", EventsServiceToken: "dev-token",
			},
			wantURL: "http://dev.example:8082", wantToken: "dev-token",
		},
		{
			name: "覆盖全空→回落主上游（生产合流态）",
			cfg: WebapiConfig{
				InternalURL: "https://prod.example", ServiceToken: "prod-token",
			},
			wantURL: "https://prod.example", wantToken: "prod-token",
		},
		{
			name: "只有 URL 没有 token→视为未配置，回落主上游（防半配置打错鉴权）",
			cfg: WebapiConfig{
				InternalURL: "https://prod.example", ServiceToken: "prod-token",
				EventsInternalURL: "http://dev.example:8082",
			},
			wantURL: "https://prod.example", wantToken: "prod-token",
		},
		{
			name: "只有 token 没有 URL→同样回落主上游",
			cfg: WebapiConfig{
				InternalURL: "https://prod.example", ServiceToken: "prod-token",
				EventsServiceToken: "dev-token",
			},
			wantURL: "https://prod.example", wantToken: "prod-token",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			url, token := c.cfg.EventsUpstream()
			if url != c.wantURL || token != c.wantToken {
				t.Fatalf("EventsUpstream() = (%q, %q), want (%q, %q)", url, token, c.wantURL, c.wantToken)
			}
		})
	}
}

// TestEventsUpstreamEnvOverride 验证 WEBAPI_EVENTS_* env 注入生效。
func TestEventsUpstreamEnvOverride(t *testing.T) {
	t.Setenv("WEBAPI_EVENTS_INTERNAL_URL", "http://dev.example:8082")
	t.Setenv("WEBAPI_EVENTS_SERVICE_TOKEN", "dev-token")
	cfg := &Config{}
	applyEnvOverride(cfg)
	if cfg.Webapi.EventsInternalURL != "http://dev.example:8082" || cfg.Webapi.EventsServiceToken != "dev-token" {
		t.Fatalf("env override 未生效: %+v", cfg.Webapi)
	}
}
