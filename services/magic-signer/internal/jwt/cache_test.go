package jwt

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCache_HitMissAndRefresh(t *testing.T) {
	key := newTestKey(t)
	m := NewMinter(MintConfig{
		PrivateKey: key,
		Kid:        "k", Issuer: "https://i/", Audience: "a",
		Lifetime: 150 * time.Millisecond, // short so we can test refresh
	})
	c := NewCache("test", m, 80*time.Millisecond /* safety */)

	// First call mints.
	t1, err := c.Get("u1")
	require.NoError(t, err)
	require.NotEmpty(t, t1)

	c.mu.RLock()
	exp1 := c.items["test:u1"].expiresAt
	c.mu.RUnlock()

	// Second call within freshness window returns same token.
	t2, err := c.Get("u1")
	require.NoError(t, err)
	require.Equal(t, t1, t2)

	// Wait past safety window → mint again.
	time.Sleep(100 * time.Millisecond)
	_, err = c.Get("u1")
	require.NoError(t, err)

	c.mu.RLock()
	exp3 := c.items["test:u1"].expiresAt
	c.mu.RUnlock()
	require.True(t, exp3.After(exp1), "expected refreshed expiry after safety window")
}

func TestCache_DifferentUsersDifferentTokens(t *testing.T) {
	c := NewCache("test", NewMinter(MintConfig{
		PrivateKey: newTestKey(t),
		Kid: "k", Issuer: "https://i/", Audience: "a", Lifetime: 1 * time.Minute,
	}), 10*time.Second)

	a, _ := c.Get("user-A")
	b, _ := c.Get("user-B")
	require.NotEmpty(t, a)
	require.NotEmpty(t, b)
	require.NotEqual(t, a, b)
}

func TestCache_ConcurrentSameUserSafe(t *testing.T) {
	c := NewCache("test", NewMinter(MintConfig{
		PrivateKey: newTestKey(t),
		Kid: "k", Issuer: "https://i/", Audience: "a", Lifetime: 1 * time.Minute,
	}), 10*time.Second)

	const N = 50
	var wg sync.WaitGroup
	wg.Add(N)
	tokens := make([]string, N)
	for i := 0; i < N; i++ {
		i := i
		go func() {
			defer wg.Done()
			tok, err := c.Get("hot-user")
			require.NoError(t, err)
			tokens[i] = tok
		}()
	}
	wg.Wait()

	// All concurrent calls should return the same token (singleflight).
	for i := 1; i < N; i++ {
		require.Equal(t, tokens[0], tokens[i])
	}
}

func TestCache_Invalidate(t *testing.T) {
	c := NewCache("test", NewMinter(MintConfig{
		PrivateKey: newTestKey(t),
		Kid: "k", Issuer: "https://i/", Audience: "a", Lifetime: 1 * time.Minute,
	}), 10*time.Second)

	_, err := c.Get("u")
	require.NoError(t, err)
	require.Equal(t, 1, c.Size())

	c.Invalidate("u")
	require.Equal(t, 0, c.Size(), "entry should be removed after Invalidate")

	_, err = c.Get("u")
	require.NoError(t, err)
	require.Equal(t, 1, c.Size(), "entry should be re-minted after Invalidate")
}
