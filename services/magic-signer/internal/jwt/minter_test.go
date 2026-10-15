package jwt

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

func newTestKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return k
}

func TestMint_ClaimsAndHeader(t *testing.T) {
	key := newTestKey(t)
	m := NewMinter(MintConfig{
		PrivateKey: key,
		Kid:        "kid-test-1",
		Issuer:     "https://example.com/",
		Audience:   "test-aud",
		Lifetime:   30 * time.Minute,
	})

	tok, exp, err := m.Mint("user-123")
	require.NoError(t, err)
	require.NotEmpty(t, tok)
	require.WithinDuration(t, time.Now().Add(30*time.Minute), exp, 5*time.Second)

	// Parse and verify with the public key.
	parsed, err := jwtlib.Parse(tok, func(tk *jwtlib.Token) (interface{}, error) {
		require.Equal(t, "RS256", tk.Method.Alg())
		require.Equal(t, "kid-test-1", tk.Header["kid"])
		return &key.PublicKey, nil
	})
	require.NoError(t, err)
	require.True(t, parsed.Valid)

	claims := parsed.Claims.(jwtlib.MapClaims)
	require.Equal(t, "user-123", claims["sub"])
	require.Equal(t, "https://example.com/", claims["iss"])
	require.Equal(t, "test-aud", claims["aud"])
	require.NotNil(t, claims["iat"])
	require.NotNil(t, claims["exp"])
}

func TestMint_EmptyUserIDFails(t *testing.T) {
	m := NewMinter(MintConfig{
		PrivateKey: newTestKey(t),
		Kid:        "k", Issuer: "https://i/", Audience: "a", Lifetime: time.Minute,
	})
	_, _, err := m.Mint("")
	require.Error(t, err)
}
