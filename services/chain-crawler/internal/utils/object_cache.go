package utils

import (
	"sync"
	"time"
)

const DefaultExpiredTime = time.Minute * 5

type ObjectLoader[T any] func() (T, error)

type ObjectCache[T any] struct {
	obj         T
	loader      ObjectLoader[T]
	expiredTime time.Duration
	lastUpdated *time.Time
	lock        *sync.RWMutex
}

func NewObjectCache[T any](loader ObjectLoader[T], expiredTime ...time.Duration) *ObjectCache[T] {
	et := DefaultExpiredTime
	if len(expiredTime) > 0 && expiredTime[0] > 0 {
		et = expiredTime[0]
	}
	return &ObjectCache[T]{
		expiredTime: et,
		lock:        &sync.RWMutex{},
		loader:      loader,
	}
}

func (cache *ObjectCache[T]) Get() (T, error) {
	obj, ok := cache.get()
	if ok {
		return obj, nil
	}
	return cache.set()
}

func (cache *ObjectCache[T]) MarkExpired() {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	cache.lastUpdated = nil
}

func (cache *ObjectCache[T]) isExpired() bool {
	if cache.lastUpdated == nil {
		return true
	}
	return time.Since(*cache.lastUpdated) > cache.expiredTime
}

func (cache *ObjectCache[T]) get() (T, bool) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isExpired() {
		var zero T
		return zero, false
	}
	return cache.obj, true
}

func (cache *ObjectCache[T]) set() (T, error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	if !cache.isExpired() {
		return cache.obj, nil
	}
	obj, err := cache.loader()
	if err != nil {
		var zero T
		return zero, err
	}
	now := time.Now()
	cache.obj = obj
	cache.lastUpdated = &now
	return obj, nil
}
