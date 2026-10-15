// Package store 进程内热点卡缓存。
//
// 定位（DD-001）：SQLite 是源真值，本 store 仅做热缓存（最近 1000 条）。
//   - 首屏 / SSE 实时推送打内存
//   - 翻页超出 OldestIngestedAt 时调用方走 persist.Repo.QueryCardsBefore（冷路径）
package store

import (
	"sort"
	"sync"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

// MaxCards 内存热缓存容量（DD-001 §4.3）。
const MaxCards = 1000

// MemoryStore 线程安全的 FIFO 卡池。
//
// ⚠️ ListRecent / ListBefore 返回的 *PushCard 是内部指针（性能考量），
// 调用方 **必须只读**。如需修改请通过 Update（mutator）拿独占锁。
type MemoryStore struct {
	mu    sync.RWMutex
	byID  map[string]*pushtypes.PushCard
	order []string // 按 Add 顺序，最老在 [0]，最新在 [n-1]
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{byID: make(map[string]*pushtypes.PushCard, MaxCards)}
}

// Add 新增推送卡，去重（同 ID 已存在则忽略）。返回 true 表示是新卡。
//
// 满容时 FIFO 淘汰最老一条；不会无限增长（修复 R1.M7 slice 切片底层数组泄漏）。
func (s *MemoryStore) Add(c *pushtypes.PushCard) bool {
	if c == nil || c.ID == "" {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byID[c.ID]; ok {
		return false
	}
	s.byID[c.ID] = c
	s.order = append(s.order, c.ID)
	if len(s.order) > MaxCards {
		s.evictOldest(len(s.order) - MaxCards)
	}
	return true
}

// evictOldest 淘汰最老 n 条；必须在持锁状态下调用。
// 用拷贝而非 reslice，避免底层数组持续持有被淘汰 ID 的引用。
func (s *MemoryStore) evictOldest(n int) {
	if n <= 0 || n > len(s.order) {
		return
	}
	for i := 0; i < n; i++ {
		delete(s.byID, s.order[i])
	}
	newOrder := make([]string, len(s.order)-n)
	copy(newOrder, s.order[n:])
	s.order = newOrder
}

// SeedFromDB 从已加载的卡列表填充热缓存（启动时一次性调用）。
// cards 应按 ingested_at DESC 排序（persist.Repo.LoadRecent 的输出）；
// 本函数会逆序入库，使内部 order 保持"最老在 [0]"的不变量。
func (s *MemoryStore) SeedFromDB(cards []*pushtypes.PushCard) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	added := 0
	// 倒着遍历：cards[0] 最新 → 最后 Add；cards[n-1] 最老 → 最早 Add
	for i := len(cards) - 1; i >= 0; i-- {
		c := cards[i]
		if c == nil || c.ID == "" {
			continue
		}
		if _, exists := s.byID[c.ID]; exists {
			continue
		}
		s.byID[c.ID] = c
		s.order = append(s.order, c.ID)
		added++
	}
	if len(s.order) > MaxCards {
		s.evictOldest(len(s.order) - MaxCards)
	}
	return added
}

// Update 用 mutator 函数原地修改一张已存在的卡。返回 true 表示成功修改。
// 用于 enrich：基础卡先 Add，增强结果 Update 同 ID。
func (s *MemoryStore) Update(id string, mutator func(*pushtypes.PushCard)) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.byID[id]
	if !ok {
		return false
	}
	mutator(c)
	return true
}

// Get 取单条；不存在返回 nil。
func (s *MemoryStore) Get(id string) *pushtypes.PushCard {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.byID[id]
}

// ListRecent 返回最新 limit 条（DESC，最新在前）。
func (s *MemoryStore) ListRecent(limit int) []*pushtypes.PushCard {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := len(s.order)
	if limit <= 0 || limit > n {
		limit = n
	}
	out := make([]*pushtypes.PushCard, 0, limit)
	for i := n - 1; i >= 0 && len(out) < limit; i-- {
		if c, ok := s.byID[s.order[i]]; ok {
			out = append(out, c)
		}
	}
	return out
}

// ListBefore 返回 IngestedAt < before 的最新 limit 条（DESC）。
// 调用方应先用 OldestIngestedAt 判断是否需要走 DB 冷路径。
//
// 实现：从最新往前扫，跳过 IngestedAt >= before 的，收集 limit 条。
func (s *MemoryStore) ListBefore(before int64, limit int) []*pushtypes.PushCard {
	if limit <= 0 {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*pushtypes.PushCard, 0, limit)
	for i := len(s.order) - 1; i >= 0 && len(out) < limit; i-- {
		c, ok := s.byID[s.order[i]]
		if !ok {
			continue
		}
		if c.IngestedAt < before {
			out = append(out, c)
		}
	}
	// out 已是 DESC，但前面 skip 阶段可能不连续；显式按 IngestedAt 排序兜底
	sort.Slice(out, func(i, j int) bool { return out[i].IngestedAt > out[j].IngestedAt })
	return out
}

// OldestIngestedAt 返回内存中最老卡的 IngestedAt（ms）。
// ok=false 表示空池；caller 据此判断是否走 DB 冷路径。
func (s *MemoryStore) OldestIngestedAt() (int64, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := 0; i < len(s.order); i++ {
		if c, ok := s.byID[s.order[i]]; ok {
			return c.IngestedAt, true
		}
	}
	return 0, false
}

func (s *MemoryStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.order)
}
