package client_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/Crypto-Barrett/oddfi-magic-client/client"
)

func newClient(t *testing.T, srv *httptest.Server) *client.Client {
	t.Helper()
	c, err := client.New(client.Config{
		BaseURL:   srv.URL,
		AuthToken: "test-token",
		Timeout:   2 * time.Second,
	})
	require.NoError(t, err)
	return c
}

func TestNew_RequiresBaseURL(t *testing.T) {
	_, err := client.New(client.Config{AuthToken: "x"})
	require.Error(t, err)
	require.ErrorIs(t, err, client.ErrInvalidConfig)
}

func TestNew_RequiresAuthToken(t *testing.T) {
	_, err := client.New(client.Config{BaseURL: "https://x"})
	require.Error(t, err)
	require.ErrorIs(t, err, client.ErrInvalidConfig)
}

func TestWalletAddress_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/wallet/address", r.URL.Path)
		require.Equal(t, "Bearer test-token", r.Header.Get("X-Service-Auth"))
		require.NotEmpty(t, r.Header.Get("X-Request-ID"))
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"address": "0x1234567890123456789012345678901234567890",
			"user_id": "u1",
			"env":     "test",
			"cached":  false,
		})
	}))
	defer srv.Close()

	c := newClient(t, srv)
	addr, err := c.WalletAddress(context.Background(), "u1")
	require.NoError(t, err)
	require.Equal(t, "0x1234567890123456789012345678901234567890", strings.ToLower(addr.Hex()))
}

func TestWalletAddress_Unauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error_code":    "UNAUTHORIZED",
			"error_message": "invalid token",
			"request_id":    "req_1",
			"env":           "test",
		})
	}))
	defer srv.Close()

	c := newClient(t, srv)
	_, err := c.WalletAddress(context.Background(), "u1")
	require.Error(t, err)
	require.ErrorIs(t, err, client.ErrUnauthorized)

	var svc *client.ServiceError
	require.True(t, errors.As(err, &svc))
	require.Equal(t, "UNAUTHORIZED", svc.ErrorCode)
	require.Equal(t, "test", svc.Env)
}

func TestWalletAddress_OpNotAllowed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(403)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error_code":    "OP_NOT_ALLOWED",
			"error_message": "no permission",
		})
	}))
	defer srv.Close()
	c := newClient(t, srv)
	_, err := c.WalletAddress(context.Background(), "u1")
	require.ErrorIs(t, err, client.ErrOpNotAllowed)
}

func TestWalletAddress_BadRequest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(400)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error_code":    "USER_ID_REQUIRED",
			"error_message": "no user_id",
		})
	}))
	defer srv.Close()
	c := newClient(t, srv)
	_, err := c.WalletAddress(context.Background(), "")
	require.ErrorIs(t, err, client.ErrBadRequest)
}

func TestWalletAddress_MagicUnavailable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(503)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error_code":    "MAGIC_NETWORK_ERROR",
			"error_message": "upstream down",
		})
	}))
	defer srv.Close()
	c := newClient(t, srv)
	_, err := c.WalletAddress(context.Background(), "u1")
	require.ErrorIs(t, err, client.ErrMagicNetwork)
}

func TestWalletAddress_NetworkFail(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	srv.Close() // Close immediately to simulate unreachable.

	c, err := client.New(client.Config{
		BaseURL:           srv.URL,
		AuthToken:         "x",
		Timeout:           500 * time.Millisecond,
		MaxNetworkRetries: 0,
	})
	require.NoError(t, err)
	_, err = c.WalletAddress(context.Background(), "u1")
	require.Error(t, err)
	require.ErrorIs(t, err, client.ErrNetwork)
}

func TestSignDigest_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/wallet/sign", r.URL.Path)
		var req map[string]string
		_ = json.NewDecoder(r.Body).Decode(&req)
		require.Equal(t, "u1", req["user_id"])
		require.True(t, strings.HasPrefix(req["digest"], "0x"))
		require.Equal(t, 66, len(req["digest"])) // 0x + 64 hex

		_ = json.NewEncoder(w).Encode(map[string]string{
			"signature": "0x" + strings.Repeat("aa", 32) + strings.Repeat("bb", 32) + "1b",
			"user_id":   "u1",
			"address":   "0x1234567890123456789012345678901234567890",
			"env":       "test",
		})
	}))
	defer srv.Close()

	c := newClient(t, srv)
	var digest [32]byte
	copy(digest[:], strings.Repeat("c", 32))
	sig, err := c.SignDigest(context.Background(), "u1", digest)
	require.NoError(t, err)
	require.Equal(t, byte(0x1b), sig[64])
}

func TestSignDigest_InvalidSigLength(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{
			"signature": "0x1234", // too short
		})
	}))
	defer srv.Close()

	c := newClient(t, srv)
	var digest [32]byte
	_, err := c.SignDigest(context.Background(), "u1", digest)
	require.Error(t, err)
}

func TestRequestID_Propagated(t *testing.T) {
	gotID := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotID = r.Header.Get("X-Request-ID")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"address": "0x1234567890123456789012345678901234567890",
			"env":     "test",
		})
	}))
	defer srv.Close()

	c := newClient(t, srv)
	ctx := client.WithRequestID(context.Background(), "custom-id-12345")
	_, err := c.WalletAddress(ctx, "u1")
	require.NoError(t, err)
	require.Equal(t, "custom-id-12345", gotID)
}

func TestSignerInterface_Compile(t *testing.T) {
	// Just ensure *Client satisfies Signer.
	var _ client.Signer = (*client.Client)(nil)
}
