package config

import (
	"fmt"
	"net"
	"strings"
)

// validateEnvKeyInterlock enforces the prod/test API key prefix rule:
//   - APP_ENV=prod requires MAGIC_API_KEY to start with "pk_live_"
//   - APP_ENV=test requires MAGIC_API_KEY to start with "pk_test_"
//
// This is the last line of defense against deploying a test key to production
// (or vice versa). Magic's own SDK uses these prefixes consistently.
func validateEnvKeyInterlock(env Env, apiKey string) error {
	if apiKey == "" {
		return nil // separate check elsewhere
	}
	switch env {
	case EnvProd:
		if !strings.HasPrefix(apiKey, "pk_live_") {
			return fmt.Errorf("APP_ENV=prod requires MAGIC_API_KEY to start with 'pk_live_', got prefix %q",
				safePrefix(apiKey, 8))
		}
	case EnvTest:
		// test 部署允许 pk_live_*（用同一把 live key 跑测试网，靠 OIDC 配置差异隔离 JWT）
		// 或 pk_test_*（若未来注册了独立的 Magic test app）
		if !strings.HasPrefix(apiKey, "pk_test_") && !strings.HasPrefix(apiKey, "pk_live_") {
			return fmt.Errorf("APP_ENV=test requires MAGIC_API_KEY to start with 'pk_test_' or 'pk_live_', got prefix %q",
				safePrefix(apiKey, 8))
		}
	default:
		return fmt.Errorf("unknown env %q", env)
	}
	return nil
}

// safePrefix returns the first n characters of s without panicking on short strings.
func safePrefix(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// isPublicListenAddr returns true if the addr binds to a public interface
// (0.0.0.0 or :: or an externally routable IP).
//
// Loopback (127.0.0.1, [::1]) and unspecified host with K8s ClusterIP semantics
// (":<port>") are considered safe — K8s NetworkPolicy is the real gate.
func isPublicListenAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		// addr might be just ":8443" — SplitHostPort handles that
		return false
	}
	host = strings.TrimSpace(host)
	if host == "" || host == "127.0.0.1" || host == "localhost" || host == "::1" {
		return false
	}
	// 0.0.0.0 is the typical container "bind all" — flagged but allowed via opt-in
	if host == "0.0.0.0" || host == "::" {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	if ip.IsLoopback() || ip.IsPrivate() {
		return false
	}
	return true
}
