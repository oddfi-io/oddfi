// Package integration_test runs end-to-end tests of magic-signer:
//
//	httptest "Magic TEE"  ←  magic-signer service (in-process http server)  ←  client/ SDK
//
// Tests in this package are tagged so they don't run during normal `go test ./...`.
// Run with:  go test ./integration_test/... -tags=integration -v
package integration_test

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	jwtlib "github.com/golang-jwt/jwt/v5"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/addrcache"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/config"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/handler"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/jwt"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/magicapi"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/metrics"
)

// testServer encapsulates a running magic-signer instance + the fake Magic
// TEE it talks to + the client token used to call it.
type testServer struct {
	BaseURL    string
	AuthToken  string
	Env        string
	fakeMagic  *httptest.Server
	srv        *http.Server
	listener   net.Listener
}

func (s *testServer) Shutdown() {
	if s.srv != nil {
		_ = s.srv.Shutdown(context.Background())
	}
	if s.fakeMagic != nil {
		s.fakeMagic.Close()
	}
}

// startTestServer launches a magic-signer instance for the given env
// ("prod" or "test"), backed by a fake Magic TEE that derives addresses
// and signatures deterministically from (env, userID).
//
// The returned BaseURL points at the service; AuthToken is the plaintext
// token to put in the client config.
func startTestServer(t *testing.T, env string) *testServer {
	t.Helper()

	// 1. Start fake Magic TEE.
	fakeMagic := newFakeMagicServer(t, env)

	// 2. Generate an OIDC RSA key for this test instance.
	rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA: %v", err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(rsaKey)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})

	// 3. Configure env vars for config.LoadFromEnv.
	apiKey := "pk_test_integration"
	if env == "prod" {
		apiKey = "pk_live_integration"
	}
	rawToken := "integration-token-" + env
	tokenSHA := hexSHA256(rawToken)

	envVars := map[string]string{
		"APP_ENV":                env,
		"LISTEN_ADDR":            "127.0.0.1:0",
		"MAGIC_API_KEY":          apiKey,
		"MAGIC_OIDC_PROVIDER_ID": "11111111-1111-1111-1111-111111111111",
		"MAGIC_REFERRER":         "https://www.oddfi.io",
		"MAGIC_ENDPOINT":         fakeMagic.URL,
		"MAGIC_TIMEOUT":          "2s",
		"MAGIC_MAX_RETRIES":      "2",
		"MAGIC_RETRY_BASE_DELAY": "10ms",
		"OIDC_PRIVATE_KEY_PEM":   string(pemBytes),
		"OIDC_KID":               "integration-test-kid",
		"OIDC_ISSUER":            "https://" + env + ".oddfi.io/",
		"OIDC_AUDIENCE":          "oddfi-app",
		"JWT_LIFETIME":           "5m",
		"JWT_REFRESH_SAFETY":     "30s",
		"ADDR_CACHE_TTL":         "1m",
		"ADDR_CACHE_MAX":         "100",
		"HEALTH_CHECK_INTERVAL":  "0", // disable background probe
		"CALLER_TOKEN_INTEGRATION_TEST": tokenSHA,
	}
	for k, v := range envVars {
		t.Setenv(k, v)
	}

	cfg, err := config.LoadFromEnv()
	if err != nil {
		fakeMagic.Close()
		t.Fatalf("config: %v", err)
	}

	// 4. Build server.
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
	jwtMinter := jwt.NewMinter(jwt.MintConfig{
		PrivateKey: cfg.OIDC.PrivateKey,
		Kid:        cfg.OIDC.Kid,
		Issuer:     cfg.OIDC.Issuer,
		Audience:   cfg.OIDC.Audience,
		Lifetime:   cfg.JWTLifetime,
	})
	jwtCache := jwt.NewCache(string(cfg.Env), jwtMinter, cfg.JWTRefreshSafety)
	magicCli := magicapi.New(magicapi.ClientConfig{
		APIKey: cfg.MagicAPI.APIKey, OIDCProviderID: cfg.MagicAPI.OIDCProviderID,
		Referrer: cfg.MagicAPI.Referrer, Chain: cfg.MagicAPI.Chain,
		Endpoint: cfg.MagicAPI.Endpoint, Timeout: cfg.MagicAPI.Timeout,
		MaxRetries: cfg.MagicAPI.MaxRetries, RetryBaseDelay: cfg.MagicAPI.RetryBaseDelay,
	})
	addrCache := addrcache.New(string(cfg.Env), cfg.AddressCacheTTL, cfg.AddressCacheMax)
	metricsReg := metrics.NewRegistry(string(cfg.Env))

	mux := handler.NewRouter(handler.Deps{
		Env:       string(cfg.Env),
		AuthTable: cfg.AuthTable,
		JWTCache:  jwtCache,
		MagicCli:  magicCli,
		AddrCache: addrCache,
		Metrics:   metricsReg,
		Log:       log,
		GitSHA:    "test",
		BuildTime: "test",
		StartedAt: time.Now(),
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fakeMagic.Close()
		t.Fatalf("listen: %v", err)
	}
	srv := &http.Server{Handler: mux}
	go func() { _ = srv.Serve(listener) }()

	// Wait briefly until listener accepts.
	if !waitUntilReachable(listener.Addr().String(), 2*time.Second) {
		_ = srv.Close()
		fakeMagic.Close()
		t.Fatalf("server did not become reachable")
	}

	ts := &testServer{
		BaseURL:   "http://" + listener.Addr().String(),
		AuthToken: rawToken,
		Env:       env,
		fakeMagic: fakeMagic,
		srv:       srv,
		listener:  listener,
	}
	t.Cleanup(ts.Shutdown)
	return ts
}

// newFakeMagicServer creates an httptest.Server that pretends to be Magic TEE.
//
//   - POST /v1/wallet           : derive a deterministic ECDSA key from
//                                 keccak256(env || ":" || sub) and return that
//                                 key's address as public_address.
//                                 → guarantees different addresses for the same
//                                 sub across different envs.
//
//   - POST /v1/wallet/sign/data : derive the same key, sign the digest with
//                                 crypto.Sign, return {r, s, v} where v is the
//                                 parity ("0" or "1").
func newFakeMagicServer(t *testing.T, env string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sub, err := parseSubFromAuthHeader(r.Header.Get("Authorization"))
		if err != nil {
			w.WriteHeader(401)
			_, _ = w.Write([]byte(`{"error":"bad jwt"}`))
			return
		}

		key := deriveKey(env, sub)
		switch r.URL.Path {
		case "/v1/wallet":
			addr := crypto.PubkeyToAddress(key.PublicKey)
			_ = json.NewEncoder(w).Encode(map[string]string{"public_address": addr.Hex()})

		case "/v1/wallet/sign/data":
			var req struct {
				RawDataHash string `json:"raw_data_hash"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				w.WriteHeader(400)
				return
			}
			digestBytes := common.FromHex(req.RawDataHash)
			if len(digestBytes) != 32 {
				w.WriteHeader(400)
				return
			}
			sig, err := crypto.Sign(digestBytes, key)
			if err != nil {
				w.WriteHeader(500)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{
				"r": "0x" + hex.EncodeToString(sig[0:32]),
				"s": "0x" + hex.EncodeToString(sig[32:64]),
				"v": fmt.Sprintf("%d", sig[64]),
			})

		default:
			w.WriteHeader(404)
		}
	}))
}

// deriveKey produces a deterministic ECDSA key from (env, sub).
// Different env → different keys → different addresses.
func deriveKey(env, sub string) *ecdsa.PrivateKey {
	seed := crypto.Keccak256([]byte("magic-fake:" + env + ":" + sub))
	// secp256k1 requires the key to be in [1, N-1]; use ToECDSA which handles
	// reduction. If the seed happens to be invalid (extremely unlikely), the
	// test will fail visibly.
	key, err := crypto.ToECDSA(seed)
	if err != nil {
		// Fall back: hash again to randomize. Tests fail loudly if both fail.
		seed2 := crypto.Keccak256(seed)
		key, _ = crypto.ToECDSA(seed2)
	}
	return key
}

// parseSubFromAuthHeader extracts the `sub` claim from a Bearer JWT without
// verifying signature (we trust the JWT we just signed ourselves in the test).
func parseSubFromAuthHeader(auth string) (string, error) {
	token, ok := strings.CutPrefix(auth, "Bearer ")
	if !ok {
		return "", errors.New("missing bearer prefix")
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", errors.New("malformed jwt")
	}
	parser := jwtlib.NewParser(jwtlib.WithoutClaimsValidation())
	parsed, _, err := parser.ParseUnverified(token, jwtlib.MapClaims{})
	if err != nil {
		return "", err
	}
	claims, ok := parsed.Claims.(jwtlib.MapClaims)
	if !ok {
		return "", errors.New("bad claims")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return "", errors.New("no sub")
	}
	return sub, nil
}

func waitUntilReachable(addr string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		c, err := net.Dial("tcp", addr)
		if err == nil {
			_ = c.Close()
			return true
		}
		time.Sleep(20 * time.Millisecond)
	}
	return false
}

func hexSHA256(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
