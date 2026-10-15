package timelocker

import (
	"sync"
	"time"

	"chain_crawler/pkg/keymutex"

	"github.com/patrickmn/go-cache"
)

var (
	impl *timelocker
	once = &sync.Once{}
)

type Timelocker interface {
	TryLockTime(key string, d time.Duration) bool
	TryLock(key string) bool
	Lock(key string)
	UnLock(key string)
}

type timelocker struct {
	keyMutex *keymutex.KeyMutex
	cache    *cache.Cache
}

func NewTimeLocker() Timelocker {
	once.Do(func() {
		impl = &timelocker{
			keyMutex: keymutex.New(),
			cache:    cache.New(time.Minute, 10*time.Minute),
		}
	})
	return impl
}

func (t *timelocker) TryLockTime(key string, d time.Duration) bool {
	_, found := t.cache.Get(key)
	if found {
		return false
	}

	t.keyMutex.Lock(key)
	defer t.keyMutex.Unlock(key)

	// double check
	_, found = t.cache.Get(key)
	if found {
		return false
	}

	t.cache.Set(key, true, d)
	return true
}

func (t *timelocker) TryLock(key string) bool {
	return t.keyMutex.TryLock(key)
}

func (t *timelocker) Lock(key string) {
	t.keyMutex.Lock(key)
}

func (t *timelocker) UnLock(key string) {
	t.keyMutex.Unlock(key)
}
