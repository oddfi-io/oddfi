// Package events 提供进程内 pub/sub —— Tweet 摄入 → SSE fan-out 的桥梁。
//
// 设计要点（详见 DD-001 §6.4）：
//   1. Publish 非阻塞：subscriber channel 满 → 关闭该 sub（slow consumer 踢出），不阻塞 publisher
//   2. Unsubscribe 幂等：可重复调用、与 close 竞态安全
//   3. 关闭后 sub.Ch 接收到 ok=false，handler 自然退出，零 goroutine 泄漏
package events

import (
	"sync"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

// CardNew 新基础卡入库时发布。
type CardNew struct {
	Card *pushtypes.PushCard
}

// CardUpdate enrich 完成（ok/skipped/failed）时发布。
type CardUpdate struct {
	Card *pushtypes.PushCard
}

// Subscription 订阅句柄。
//
// 使用方式：
//
//	sub := bus.Subscribe(64)
//	defer bus.Unsubscribe(sub)
//	for {
//	    select {
//	    case ev, ok := <-sub.Ch:
//	        if !ok { return }   // slow consumer 被踢
//	        ...
//	    }
//	}
type Subscription struct {
	Ch   chan any
	once sync.Once
}

// close 内部专用，安全幂等关闭 Ch。
func (s *Subscription) close() {
	s.once.Do(func() { close(s.Ch) })
}

// Bus 进程内事件总线。
type Bus struct {
	mu      sync.RWMutex
	subs    map[*Subscription]struct{}
	evicted uint64 // slow consumer 踢出计数（指标）
}

// NewBus 构造新 Bus。
func NewBus() *Bus {
	return &Bus{subs: make(map[*Subscription]struct{})}
}

// Subscribe 创建新订阅，channel 容量为 buf（推荐 64）。
func (b *Bus) Subscribe(buf int) *Subscription {
	if buf <= 0 {
		buf = 64
	}
	s := &Subscription{Ch: make(chan any, buf)}
	b.mu.Lock()
	b.subs[s] = struct{}{}
	b.mu.Unlock()
	return s
}

// Unsubscribe 幂等。可重复调用、与 Bus 自动踢出竞态安全。
//
// close(Ch) 必须在 WLock 内完成 —— 与 Publish（RLock）互斥，
// 避免 race detector 报 send-on-closed channel。
func (b *Bus) Unsubscribe(s *Subscription) {
	if s == nil {
		return
	}
	b.mu.Lock()
	if _, ok := b.subs[s]; ok {
		delete(b.subs, s)
	}
	s.close()
	b.mu.Unlock()
}

// Publish 向所有 subscriber 非阻塞 fan-out。
// channel 满则关闭对应 sub（slow consumer 踢出 + 计数）。
//
// 并发安全：send 全程在 RLock 内（与 Unsubscribe 的 WLock 互斥），
// 因此不会出现 send-on-closed-channel panic。
// evict 阶段拿 WLock 重新校验 sub 是否仍在 map 中，与并发 Unsubscribe 兼容。
func (b *Bus) Publish(ev any) {
	b.mu.RLock()
	var toEvict []*Subscription
	for s := range b.subs {
		// select+default：非阻塞，RLock 持有时间 O(N subs)
		select {
		case s.Ch <- ev:
			// ok
		default:
			toEvict = append(toEvict, s)
		}
	}
	b.mu.RUnlock()

	if len(toEvict) == 0 {
		return
	}

	b.mu.Lock()
	for _, s := range toEvict {
		if _, ok := b.subs[s]; ok {
			delete(b.subs, s)
			b.evicted++
			s.close() // 在 WLock 内 close，与 Publish 的 RLock 互斥
		}
	}
	b.mu.Unlock()
}

// Len 当前订阅者数。
func (b *Bus) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subs)
}

// EvictedCount 历史累计 slow consumer 踢出数（指标）。
func (b *Bus) EvictedCount() uint64 {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.evicted
}
