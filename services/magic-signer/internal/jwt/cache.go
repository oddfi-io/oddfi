package jwt

import (
	"fmt"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// Cache memoizes minted JWTs per userID with a safety margin before expiry.
//
// Keys are namespaced by env to prevent any cross-env reuse if the same
// userID is processed under different deployments (defense in depth — should
// never happen given separate process per env).
type Cache struct {
	env     string
	minter  *Minter
	safety  time.Duration

	mu    sync.RWMutex
	items map[string]cachedJWT // key: env + ":" + userID

	sf singleflight.Group
}

type cachedJWT struct {
	token     string
	expiresAt time.Time
}

// NewCache constructs a Cache.
//   - env: deployment environment string ("prod" or "test"), prefixed to keys
//   - minter: the underlying JWT signer
//   - safety: refresh JWTs this long before they actually expire (e.g. 1m)
func NewCache(env string, minter *Minter, safety time.Duration) *Cache {
	return &Cache{
		env:    env,
		minter: minter,
		safety: safety,
		items:  make(map[string]cachedJWT),
	}
}

// Get returns a valid (non-expired-within-safety) JWT for userID, minting and
// caching one if necessary. Concurrent calls for the same userID coalesce via
// singleflight, so only one mint happens.
func (c *Cache) Get(userID string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("userID is empty")
	}
	key := c.env + ":" + userID

	c.mu.RLock()
	if entry, ok := c.items[key]; ok && time.Until(entry.expiresAt) > c.safety {
		c.mu.RUnlock()
		return entry.token, nil
	}
	c.mu.RUnlock()

	// Cache miss or expiring soon — mint via singleflight.
	v, err, _ := c.sf.Do(key, func() (interface{}, error) {
		// Re-check inside critical section.
		c.mu.RLock()
		if entry, ok := c.items[key]; ok && time.Until(entry.expiresAt) > c.safety {
			c.mu.RUnlock()
			return entry.token, nil
		}
		c.mu.RUnlock()

		token, expiresAt, err := c.minter.Mint(userID)
		if err != nil {
			return "", err
		}

		c.mu.Lock()
		c.items[key] = cachedJWT{token: token, expiresAt: expiresAt}
		c.mu.Unlock()

		return token, nil
	})
	if err != nil {
		return "", err
	}
	return v.(string), nil
}

// Invalidate forcibly removes a userID's cached JWT (useful for testing or
// admin override).
func (c *Cache) Invalidate(userID string) {
	c.mu.Lock()
	delete(c.items, c.env+":"+userID)
	c.mu.Unlock()
}

// Stats returns cache size (for /metrics).
func (c *Cache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.items)
}
