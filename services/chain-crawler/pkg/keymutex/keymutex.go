package keymutex

import "sync"

var (
	impl *KeyMutex
	once = &sync.Once{}
)

type KeyMutex struct {
	sm sync.Map
}

func New() *KeyMutex {
	once.Do(func() {
		impl = &KeyMutex{
			sm: sync.Map{},
		}
	})
	return impl
}

func (km *KeyMutex) Lock(key string) {
	m, _ := km.sm.LoadOrStore(key, &sync.Mutex{})
	m.(*sync.Mutex).Lock()
}

func (km *KeyMutex) Unlock(key string) {
	if m, ok := km.sm.Load(key); ok {
		m.(*sync.Mutex).Unlock()
	}
}

func (km *KeyMutex) TryLock(key string) bool {
	m, _ := km.sm.LoadOrStore(key, &sync.Mutex{})
	return m.(*sync.Mutex).TryLock()
}
