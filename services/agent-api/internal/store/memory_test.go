package store

import (
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

func mkCard(id string, ingestedMs int64) *pushtypes.PushCard {
	return &pushtypes.PushCard{
		ID:           id,
		IngestedAt:   ingestedMs,
		CreatedAt:    ingestedMs,
		EnrichStatus: "pending",
		OriginalText: "t " + id,
	}
}

func TestAddAndDedup(t *testing.T) {
	s := NewMemoryStore()
	if !s.Add(mkCard("a", 1)) {
		t.Errorf("first add 应成功")
	}
	if s.Add(mkCard("a", 2)) {
		t.Errorf("重复 ID 应被去重")
	}
	if s.Count() != 1 {
		t.Errorf("Count=%d", s.Count())
	}
}

func TestAdd_NilOrEmptyID(t *testing.T) {
	s := NewMemoryStore()
	if s.Add(nil) {
		t.Errorf("nil 应拒绝")
	}
	if s.Add(&pushtypes.PushCard{}) {
		t.Errorf("空 ID 应拒绝")
	}
	if s.Count() != 0 {
		t.Errorf("Count=%d", s.Count())
	}
}

func TestFIFOEviction(t *testing.T) {
	s := NewMemoryStore()
	for i := 0; i < MaxCards+50; i++ {
		s.Add(mkCard("id"+strconv.Itoa(i), int64(i)))
	}
	if s.Count() != MaxCards {
		t.Errorf("Count=%d want %d", s.Count(), MaxCards)
	}
	// 最老的 50 个应被淘汰
	if s.Get("id0") != nil {
		t.Errorf("最老的 id0 应被 FIFO 淘汰")
	}
	if s.Get("id49") != nil {
		t.Errorf("id49 应被淘汰")
	}
	if s.Get("id50") == nil {
		t.Errorf("id50 应在缓存中")
	}
}

func TestFIFOEviction_OrderSliceDoesntGrowUnbounded(t *testing.T) {
	// R1.M7：旧实现 s.order = s.order[1:] 会让底层数组持续保留淘汰 ID 的引用。
	// 新实现用 copy，cap(order) 不应大于 MaxCards*某常数。
	s := NewMemoryStore()
	for i := 0; i < MaxCards*10; i++ {
		s.Add(mkCard("id"+strconv.Itoa(i), int64(i)))
	}
	if cap(s.order) > MaxCards*4 {
		t.Errorf("order cap=%d 远超 MaxCards=%d，可能仍在 leak", cap(s.order), MaxCards)
	}
}

func TestUpdate(t *testing.T) {
	s := NewMemoryStore()
	s.Add(mkCard("a", 1))
	ok := s.Update("a", func(c *pushtypes.PushCard) {
		c.Tag = "odds"
		c.EnrichStatus = "ok"
	})
	if !ok {
		t.Fatal("update 应成功")
	}
	c := s.Get("a")
	if c.Tag != "odds" || c.EnrichStatus != "ok" {
		t.Errorf("update 未生效: %+v", c)
	}
}

func TestUpdate_NonExistent(t *testing.T) {
	s := NewMemoryStore()
	if s.Update("ghost", func(*pushtypes.PushCard) {}) {
		t.Errorf("不存在的 ID Update 应返回 false")
	}
}

func TestUpdate_AfterEviction(t *testing.T) {
	s := NewMemoryStore()
	s.Add(mkCard("a", 1))
	for i := 0; i < MaxCards+10; i++ {
		s.Add(mkCard("x"+strconv.Itoa(i), int64(100+i)))
	}
	// "a" 已被淘汰
	if s.Update("a", func(*pushtypes.PushCard) {}) {
		t.Errorf("淘汰后的 ID Update 应返回 false")
	}
}

func TestListRecent_DescOrder(t *testing.T) {
	s := NewMemoryStore()
	for i := 0; i < 5; i++ {
		s.Add(mkCard("c"+strconv.Itoa(i), int64(i*100)))
	}
	got := s.ListRecent(3)
	if len(got) != 3 {
		t.Fatalf("len=%d", len(got))
	}
	if got[0].ID != "c4" || got[1].ID != "c3" || got[2].ID != "c2" {
		t.Errorf("非 DESC: %s,%s,%s", got[0].ID, got[1].ID, got[2].ID)
	}
}

func TestListRecent_LimitClamp(t *testing.T) {
	s := NewMemoryStore()
	for i := 0; i < 3; i++ {
		s.Add(mkCard("c"+strconv.Itoa(i), int64(i)))
	}
	if got := s.ListRecent(0); len(got) != 3 {
		t.Errorf("limit=0 应返回全部, len=%d", len(got))
	}
	if got := s.ListRecent(999); len(got) != 3 {
		t.Errorf("limit 超 Count 应返回全部, len=%d", len(got))
	}
}

func TestListBefore(t *testing.T) {
	s := NewMemoryStore()
	for _, ms := range []int64{100, 300, 500, 700, 900} {
		s.Add(mkCard("c"+strconv.Itoa(int(ms)), ms))
	}
	got := s.ListBefore(600, 10)
	if len(got) != 3 {
		t.Fatalf("len=%d, want 3 (100, 300, 500)", len(got))
	}
	if got[0].IngestedAt != 500 || got[2].IngestedAt != 100 {
		t.Errorf("应 DESC: %d, %d, %d", got[0].IngestedAt, got[1].IngestedAt, got[2].IngestedAt)
	}
}

func TestListBefore_EmptyPool(t *testing.T) {
	s := NewMemoryStore()
	if got := s.ListBefore(1000, 5); len(got) != 0 {
		t.Errorf("空池应返回空, len=%d", len(got))
	}
}

func TestListBefore_NegativeLimit(t *testing.T) {
	s := NewMemoryStore()
	s.Add(mkCard("a", 1))
	if got := s.ListBefore(10, 0); got != nil && len(got) != 0 {
		t.Errorf("limit≤0 应返回 nil/空, len=%d", len(got))
	}
}

func TestOldestIngestedAt(t *testing.T) {
	s := NewMemoryStore()
	if _, ok := s.OldestIngestedAt(); ok {
		t.Errorf("空池应 ok=false")
	}
	s.Add(mkCard("a", 500))
	s.Add(mkCard("b", 100))
	s.Add(mkCard("c", 900))
	got, ok := s.OldestIngestedAt()
	if !ok {
		t.Fatal("ok=false")
	}
	// 注意：order 按 Add 顺序，不按 IngestedAt 排序
	// "a" 最先 Add，IngestedAt=500
	if got != 500 {
		t.Errorf("OldestIngestedAt 返回最先 Add 的卡 IngestedAt, got=%d want 500", got)
	}
}

func TestSeedFromDB(t *testing.T) {
	// 模拟 persist.Repo.LoadRecent 返回（DESC）：500, 300, 100
	cards := []*pushtypes.PushCard{
		mkCard("c500", 500),
		mkCard("c300", 300),
		mkCard("c100", 100),
	}
	s := NewMemoryStore()
	added := s.SeedFromDB(cards)
	if added != 3 {
		t.Errorf("added=%d", added)
	}
	// ListRecent 应仍然 DESC
	got := s.ListRecent(10)
	if len(got) != 3 || got[0].ID != "c500" || got[2].ID != "c100" {
		t.Errorf("Seed 后 order 错: %v", []string{got[0].ID, got[1].ID, got[2].ID})
	}
	// OldestIngestedAt 应是 100
	if v, _ := s.OldestIngestedAt(); v != 100 {
		t.Errorf("Oldest=%d want 100", v)
	}
}

func TestSeedFromDB_Dedup(t *testing.T) {
	s := NewMemoryStore()
	s.Add(mkCard("x", 200))
	added := s.SeedFromDB([]*pushtypes.PushCard{mkCard("x", 100)})
	if added != 0 {
		t.Errorf("已存在 ID 应被去重, added=%d", added)
	}
}

func TestSeedFromDB_RespectsMaxCards(t *testing.T) {
	cards := make([]*pushtypes.PushCard, MaxCards+50)
	for i := range cards {
		cards[i] = mkCard("seed"+strconv.Itoa(i), int64(MaxCards+50-i))
	}
	s := NewMemoryStore()
	s.SeedFromDB(cards)
	if s.Count() != MaxCards {
		t.Errorf("Seed 后 Count=%d want %d", s.Count(), MaxCards)
	}
}

func TestConcurrentAddAndRead(t *testing.T) {
	s := NewMemoryStore()
	var wg sync.WaitGroup
	wg.Add(3)
	go func() {
		defer wg.Done()
		for i := 0; i < 500; i++ {
			s.Add(mkCard("w"+strconv.Itoa(i), int64(i)))
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 500; i++ {
			_ = s.ListRecent(20)
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 500; i++ {
			s.Update("w"+strconv.Itoa(i), func(c *pushtypes.PushCard) { c.Tag = "x" })
		}
	}()
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("并发死锁")
	}
}
