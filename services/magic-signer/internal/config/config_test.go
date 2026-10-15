package config

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"testing"

	"github.com/stretchr/testify/require"
)

// genPEM returns a fresh RSA 2048 private key encoded as PKCS8 PEM.
func genPEM(t *testing.T) string {
	t.Helper()
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	der, err := x509.MarshalPKCS8PrivateKey(k)
	require.NoError(t, err)
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
}

// setBaseEnv configures the minimal set of env vars needed for LoadFromEnv to pass.
func setBaseEnv(t *testing.T, env string, apiKey string) {
	t.Helper()
	t.Setenv("APP_ENV", env)
	t.Setenv("MAGIC_API_KEY", apiKey)
	t.Setenv("MAGIC_OIDC_PROVIDER_ID", "11111111-1111-1111-1111-111111111111")
	t.Setenv("MAGIC_REFERRER", "https://www.oddfi.io")
	t.Setenv("OIDC_PRIVATE_KEY_PEM", genPEM(t))
	t.Setenv("OIDC_KID", "kid-1")
	t.Setenv("OIDC_ISSUER", "https://www.oddfi.io/")
	t.Setenv("OIDC_AUDIENCE", "oddfi-app")
	t.Setenv("LISTEN_ADDR", "127.0.0.1:8443")
	// One caller token to satisfy validation.
	t.Setenv("CALLER_TOKEN_TEST", hex.EncodeToString(make([]byte, 32))) // 64-char hex (all zeros, valid format)
}

func TestLoadFromEnv_ProdHappyPath(t *testing.T) {
	setBaseEnv(t, "prod", "pk_live_abc123")
	cfg, err := LoadFromEnv()
	require.NoError(t, err)
	require.Equal(t, EnvProd, cfg.Env)
	require.Equal(t, "pk_live_abc123", cfg.MagicAPI.APIKey)
}

func TestLoadFromEnv_TestHappyPath(t *testing.T) {
	setBaseEnv(t, "test", "pk_test_xyz789")
	cfg, err := LoadFromEnv()
	require.NoError(t, err)
	require.Equal(t, EnvTest, cfg.Env)
}

func TestLoadFromEnv_MissingAppEnv(t *testing.T) {
	setBaseEnv(t, "prod", "pk_live_x")
	t.Setenv("APP_ENV", "")
	_, err := LoadFromEnv()
	require.Error(t, err)
	require.Contains(t, err.Error(), "APP_ENV")
}

func TestLoadFromEnv_InvalidAppEnv(t *testing.T) {
	setBaseEnv(t, "prod", "pk_live_x")
	t.Setenv("APP_ENV", "staging")
	_, err := LoadFromEnv()
	require.Error(t, err)
	require.Contains(t, err.Error(), "APP_ENV")
}

func TestLoadFromEnv_ProdWithTestKey_Rejected(t *testing.T) {
	setBaseEnv(t, "prod", "pk_test_should_not_be_accepted")
	_, err := LoadFromEnv()
	require.Error(t, err)
	require.Contains(t, err.Error(), "pk_live_")
}

func TestLoadFromEnv_TestWithLiveKey_Accepted(t *testing.T) {
	// test 部署允许 pk_live_*（用同一把 live key 跑测试网）
	setBaseEnv(t, "test", "pk_live_xyz789")
	cfg, err := LoadFromEnv()
	require.NoError(t, err)
	require.Equal(t, EnvTest, cfg.Env)
}

func TestLoadFromEnv_MissingMagicAPIKey(t *testing.T) {
	setBaseEnv(t, "test", "")
	_, err := LoadFromEnv()
	require.Error(t, err)
}

func TestLoadFromEnv_BadOIDCKey(t *testing.T) {
	setBaseEnv(t, "test", "pk_test_x")
	t.Setenv("OIDC_PRIVATE_KEY_PEM", "not a pem")
	_, err := LoadFromEnv()
	require.Error(t, err)
}

func TestLoadFromEnv_NoCallerTokens(t *testing.T) {
	setBaseEnv(t, "test", "pk_test_x")
	t.Setenv("CALLER_TOKEN_TEST", "")
	_, err := LoadFromEnv()
	require.Error(t, err)
	require.Contains(t, err.Error(), "CALLER_TOKEN_")
}

func TestLoadFromEnv_PublicListenBlocked(t *testing.T) {
	setBaseEnv(t, "test", "pk_test_x")
	t.Setenv("LISTEN_ADDR", "0.0.0.0:8443")
	t.Setenv("ALLOW_PUBLIC_LISTEN", "")
	_, err := LoadFromEnv()
	require.Error(t, err)
	require.Contains(t, err.Error(), "public interface")
}

func TestLoadFromEnv_PublicListenAllowedWithOverride(t *testing.T) {
	setBaseEnv(t, "test", "pk_test_x")
	t.Setenv("LISTEN_ADDR", "0.0.0.0:8443")
	t.Setenv("ALLOW_PUBLIC_LISTEN", "1")
	_, err := LoadFromEnv()
	require.NoError(t, err)
}

func TestAuthTable_LookupHit(t *testing.T) {
	setBaseEnv(t, "test", "pk_test_x")
	// Set a real token whose sha256 we know.
	rawToken := "my-secret-token-123"
	// Compute its sha256 hex manually:
	// sha256("my-secret-token-123") = e16e7e... (we just trust the impl)
	t.Setenv("CALLER_TOKEN_TEST", hexSHA256(rawToken))
	cfg, err := LoadFromEnv()
	require.NoError(t, err)
	caller, ok := cfg.AuthTable.Lookup(rawToken)
	require.True(t, ok)
	require.Equal(t, "test", caller.Name)
}

func TestAuthTable_LookupMiss(t *testing.T) {
	setBaseEnv(t, "test", "pk_test_x")
	cfg, err := LoadFromEnv()
	require.NoError(t, err)
	_, ok := cfg.AuthTable.Lookup("wrong-token")
	require.False(t, ok)
}

// hexSHA256 returns hex(sha256(s)).
func hexSHA256(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
