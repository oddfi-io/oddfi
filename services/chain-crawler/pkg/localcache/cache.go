package localcache

import (
	"sync"
	"time"

	lc "github.com/patrickmn/go-cache"
	"golang.org/x/sync/singleflight"
)

var (
	localCache *cache    = nil
	initOnce   sync.Once = sync.Once{}
)

type cache struct {
	localCache   *lc.Cache
	singleFlight singleflight.Group
}

func GetLocalCache() *cache {
	initOnce.Do(func() {
		localCache = &cache{localCache: lc.New(5*time.Minute, 10*time.Minute), singleFlight: singleflight.Group{}}
	})
	return localCache
}

func (c *cache) Set(key string, value interface{}, d time.Duration) {
	c.localCache.Set(key, value, d)
}

func (c *cache) Get(key string) (interface{}, bool) {
	return c.localCache.Get(key)
}

// singleflight + localcache,
func (c *cache) AsyncInitCache(key LocalCacheKey, f func() (interface{}, error), d time.Duration) (interface{}, error) {
	// 使用 singleflight 防止缓存击穿
	keyStr := string(key)
	result, err, _ := c.singleFlight.Do(keyStr, func() (interface{}, error) {
		// 先检查缓存
		if v, ok := c.localCache.Get(keyStr); ok {
			return v, nil
		}

		// 调用初始化函数
		result, err := f()
		if err != nil {
			return nil, err
		}

		// 设置缓存
		c.localCache.Set(keyStr, result, d)
		return result, nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}
