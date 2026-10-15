package integration_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/Crypto-Barrett/oddfi-magic-client/client"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/config"
)

// TestEnvIsolation_ProdAndTestProduceDifferentAddresses is the central
// environment isolation check.
//
// Two services are started: one with APP_ENV=prod, one with APP_ENV=test.
// For the SAME user_id, they must return DIFFERENT addresses. Otherwise
// production users would clash with test users at the address level — a
// serious security issue.
//
// (The fake Magic in helpers.go derives addresses from keccak256(env || sub),
// so this test verifies both the fake's behavior and the env wiring.)
func TestEnvIsolation_ProdAndTestProduceDifferentAddresses(t *testing.T) {
	// IMPORTANT: each startTestServer call uses t.Setenv to set env vars.
	// t.Setenv stacks correctly only within the same test scope, so we start
	// both servers within this single test function.

	// We need separate t.Setenv namespaces — workaround: start them serially
	// and rely on each call overwriting env vars before LoadFromEnv.
	prodTS := startTestServer(t, "prod")
	testTS := startTestServer(t, "test")

	prodCli, err := client.New(client.Config{
		BaseURL: prodTS.BaseURL, AuthToken: prodTS.AuthToken, Timeout: 5 * time.Second,
	})
	require.NoError(t, err)
	testCli, err := client.New(client.Config{
		BaseURL: testTS.BaseURL, AuthToken: testTS.AuthToken, Timeout: 5 * time.Second,
	})
	require.NoError(t, err)

	const sameUserID = "user-99999-shared-across-envs"

	prodAddr, err := prodCli.WalletAddress(context.Background(), sameUserID)
	require.NoError(t, err)

	testAddr, err := testCli.WalletAddress(context.Background(), sameUserID)
	require.NoError(t, err)

	require.NotEqual(t, prodAddr, testAddr,
		"CRITICAL: same user_id %q produced same address in prod and test envs (%s vs %s). "+
			"Environment isolation broken — do not ship.",
		sameUserID, prodAddr.Hex(), testAddr.Hex())
}

// TestEnvIsolation_RefuseWrongAPIKey verifies the config layer rejects
// prod env + pk_test_* key. (test 侧已放宽，允许 pk_live_*，所以不再覆盖反向用例。)
func TestEnvIsolation_RefuseWrongAPIKey(t *testing.T) {
	cases := []struct {
		env    string
		apiKey string
	}{
		{"prod", "pk_test_should_be_refused"},
	}
	for _, c := range cases {
		t.Run(c.env+"_with_"+c.apiKey[:7], func(t *testing.T) {
			setupBadEnv(t, c.env, c.apiKey)
			_, err := config.LoadFromEnv()
			require.Error(t, err)
		})
	}
}

// setupBadEnv configures the minimal env vars but with deliberately wrong
// env/api key combo.
func setupBadEnv(t *testing.T, env, apiKey string) {
	t.Helper()
	k, _ := rsa.GenerateKey(rand.Reader, 2048)
	der, _ := x509.MarshalPKCS8PrivateKey(k)
	pemStr := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))

	t.Setenv("APP_ENV", env)
	t.Setenv("MAGIC_API_KEY", apiKey)
	t.Setenv("MAGIC_OIDC_PROVIDER_ID", "11111111-1111-1111-1111-111111111111")
	t.Setenv("MAGIC_REFERRER", "https://x")
	t.Setenv("OIDC_PRIVATE_KEY_PEM", pemStr)
	t.Setenv("OIDC_KID", "k")
	t.Setenv("OIDC_ISSUER", "https://x/")
	t.Setenv("OIDC_AUDIENCE", "a")
	t.Setenv("LISTEN_ADDR", "127.0.0.1:0")
	t.Setenv("CALLER_TOKEN_T", "0000000000000000000000000000000000000000000000000000000000000000")
}
