package analysis

import "sync/atomic"

// Store 单 slot 原子存储（最新一份分析覆盖旧的）
type Store struct {
	val atomic.Pointer[Analysis]
}

func NewStore() *Store {
	return &Store{}
}

func (s *Store) Set(a *Analysis) {
	s.val.Store(a)
}

func (s *Store) Get() *Analysis {
	return s.val.Load()
}
