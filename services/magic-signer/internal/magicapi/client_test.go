package magicapi

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func newTestClient(t *testing.T, srv *httptest.Server) *Client {
	t.Helper()
	return New(ClientConfig{
		APIKey:         "pk_test_dummy",
		OIDCProviderID: "11111111-1111-1111-1111-111111111111",
		Referrer:       "https://test.local",
		Chain:          "ETH",
		Endpoint:       srv.URL,
		Timeout:        2 * time.Second,
		MaxRetries:     3,
		RetryBaseDelay: 10 * time.Millisecond,
	})
}

func TestGetOrCreateWallet_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "POST", r.Method)
		require.Equal(t, "/v1/wallet", r.URL.Path)
		require.True(t, strings.HasPrefix(r.Header.Get("Authorization"), "Bearer "))
		require.Equal(t, "pk_test_dummy", r.Header.Get("X-Magic-API-Key"))
		_ = json.NewEncoder(w).Encode(map[string]string{"public_address": "0x1234567890123456789012345678901234567890"})
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	addr, _, err := c.GetOrCreateWallet(context.Background(), "fake-jwt")
	require.NoError(t, err)
	require.Equal(t, "0x1234567890123456789012345678901234567890", strings.ToLower(addr.Hex()))
}

func TestSignData_VConversion(t *testing.T) {
	cases := []struct {
		vIn  string
		vOut byte
	}{
		{"0", 27},
		{"1", 28},
	}
	for _, tc := range cases {
		t.Run("v="+tc.vIn, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(map[string]string{
					"r": "0x" + strings.Repeat("ab", 32),
					"s": "0x" + strings.Repeat("cd", 32),
					"v": tc.vIn,
				})
			}))
			defer srv.Close()

			c := newTestClient(t, srv)
			var digest [32]byte
			sig, _, err := c.SignData(context.Background(), "jwt", digest)
			require.NoError(t, err)
			require.Equal(t, tc.vOut, sig[64])

			rHex := hex.EncodeToString(sig[0:32])
			sHex := hex.EncodeToString(sig[32:64])
			require.Equal(t, strings.Repeat("ab", 32), rHex)
			require.Equal(t, strings.Repeat("cd", 32), sHex)
		})
	}
}

func TestSignData_DecimalRS_EIP155V(t *testing.T) {
	// Real Magic response shape (observed 2026-06): r/s are decimal integer
	// strings, and v is already EIP-155 ("27"/"28"), not parity ("0"/"1").
	// Values taken verbatim from a production sign response.
	const (
		rDec = "49696531492149089681377213473407026754988330046256078637712663670384807075389"
		sDec = "19551331007193846292130340613546845867258108053456923321608683203538621103032"
		// Magic's own assembled "signature" field (0x stripped) for the same
		// r/s/v — our reconstruction from the decimal scalars must match it.
		wantSig = "6ddf3d72c8fcaaa966192c964153f7f2fa822ce874d617d680ad54c1ee9f5e3d2" +
			"b39a944429554e4c8267367f9d1571e64342948a73c5c851e97126153ecfbb81b"
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"r": rDec, "s": sDec, "v": "27"})
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	var digest [32]byte
	sig, _, err := c.SignData(context.Background(), "jwt", digest)
	require.NoError(t, err)
	require.Equal(t, wantSig, hex.EncodeToString(sig[:]))
}

func TestSignData_InvalidV(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{
			"r": "0x" + strings.Repeat("a", 64),
			"s": "0x" + strings.Repeat("b", 64),
			"v": "2", // invalid
		})
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	var digest [32]byte
	_, _, err := c.SignData(context.Background(), "jwt", digest)
	require.ErrorIs(t, err, ErrInvalidResponse)
}

func TestDoRequest_4xxNoRetry(t *testing.T) {
	calls := int32(0)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(401)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	_, _, err := c.GetOrCreateWallet(context.Background(), "jwt")
	require.Error(t, err)
	require.ErrorIs(t, err, ErrUnauthorized)
	require.Equal(t, int32(1), atomic.LoadInt32(&calls), "401 should not retry")
}

func TestDoRequest_5xxRetriesThenFails(t *testing.T) {
	calls := int32(0)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(503)
		_, _ = w.Write([]byte(`{"error":"unavailable"}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	_, _, err := c.GetOrCreateWallet(context.Background(), "jwt")
	require.Error(t, err)
	// 4 calls total: 1 initial + 3 retries
	require.Equal(t, int32(4), atomic.LoadInt32(&calls), "expected 4 total calls (1+3 retries)")
	// final error should be HTTPError with 503 → unwraps to ErrNetwork
	var herr *HTTPError
	require.True(t, errors.As(err, &herr))
	require.Equal(t, 503, herr.StatusCode)
}

func TestDoRequest_5xxThen200(t *testing.T) {
	calls := int32(0)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		if n <= 2 {
			w.WriteHeader(503)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"public_address": "0x" + strings.Repeat("a", 40)})
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	addr, _, err := c.GetOrCreateWallet(context.Background(), "jwt")
	require.NoError(t, err)
	require.Equal(t, int32(3), atomic.LoadInt32(&calls), "expected 3 calls (2 fails + 1 success)")
	require.NotEqual(t, "0x0000000000000000000000000000000000000000", addr.Hex())
}

func TestDoRequest_ContextCancel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(503)
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately
	_, _, err := c.GetOrCreateWallet(ctx, "jwt")
	require.Error(t, err)
}

func TestGetOrCreateWallet_InvalidAddress(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"public_address": "not-an-address"})
	}))
	defer srv.Close()
	c := newTestClient(t, srv)
	_, _, err := c.GetOrCreateWallet(context.Background(), "jwt")
	require.Error(t, err)
	require.ErrorIs(t, err, ErrInvalidResponse)
}

func TestBuildHeaders_HasAllSix(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		required := []string{
			"Authorization", "X-Magic-API-Key", "X-OIDC-Provider-ID",
			"X-Magic-Chain", "X-Magic-Referrer", "Content-Type",
		}
		for _, h := range required {
			require.NotEmpty(t, r.Header.Get(h), fmt.Sprintf("missing %s", h))
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"public_address": "0x" + strings.Repeat("a", 40)})
	}))
	defer srv.Close()
	c := newTestClient(t, srv)
	_, _, err := c.GetOrCreateWallet(context.Background(), "fake-jwt")
	require.NoError(t, err)
}
