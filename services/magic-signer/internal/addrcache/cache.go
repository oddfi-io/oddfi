// Package addrcache implements an LRU+TTL in-memory cache for user_id → Magic EOA address.
//
// Keys are namespaced by env to prevent any cross-env collision. The cache is
// purely in-process; multiple service replicas each maintain their own.
//
// Addresses returned by Magic are deterministic per (env, user_id), so cache
// inconsistency across replicas is not a correctness issue — only a minor
// efficiency one.
package addrcache

import (
	"container/list"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
)

// Cache is a thread-safe LRU cache with TTL.
type Cache struct {
	env  string
	ttl  time.Duration
	max  int

	mu      sync.Mutex
	items   map[string]*list.Element
	lruList *list.List
}

type entry struct {
	key       string
	addr      common.Address
	expiresAt time.Time
}

// New constructs a Cache.
//   - env: prefixed to keys for defense in depth
//   - ttl: how long an entry remains valid
//   - max: maximum number of entries; oldest is evicted when full
func New(env string, ttl time.Duration, max int) *Cache {
	if max <= 0 {
		max = 100000
	}
	return &Cache{
		env:     env,
		ttl:     ttl,
		max:     max,
		items:   make(map[string]*list.Element, max),
		lruList: list.New(),
	}
}

// Get returns the cached address for userID if present and not expired.
// On expiry, the entry is evicted and (Address{}, false) is returned.
func (c *Cache) Get(userID string) (common.Address, bool) {
	key := c.env + ":" + userID

	c.mu.Lock()
	defer c.mu.Unlock()

	el, ok := c.items[key]
	if !ok {
		return common.Address{}, false
	}
	e := el.Value.(*entry)
	if time.Now().After(e.expiresAt) {
		c.lruList.Remove(el)
		delete(c.items, key)
		return common.Address{}, false
	}
	c.lruList.MoveToFront(el)
	return e.addr, true
}

// Put inserts/updates an entry.
func (c *Cache) Put(userID string, addr common.Address) {
	key := c.env + ":" + userID

	c.mu.Lock()
	defer c.mu.Unlock()

	if el, ok := c.items[key]; ok {
		e := el.Value.(*entry)
		e.addr = addr
		e.expiresAt = time.Now().Add(c.ttl)
		c.lruList.MoveToFront(el)
		return
	}

	// Evict oldest if at capacity.
	if c.lruList.Len() >= c.max {
		oldest := c.lruList.Back()
		if oldest != nil {
			oe := oldest.Value.(*entry)
			c.lruList.Remove(oldest)
			delete(c.items, oe.key)
		}
	}

	e := &entry{key: key, addr: addr, expiresAt: time.Now().Add(c.ttl)}
	el := c.lruList.PushFront(e)
	c.items[key] = el
}

// Size returns the current number of entries (for /metrics).
func (c *Cache) Size() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lruList.Len()
}
