package events

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

func TestSubscribePublishSingle(t *testing.T) {
	b := NewBus()
	sub := b.Subscribe(4)
	defer b.Unsubscribe(sub)

	card := &pushtypes.PushCard{ID: "x"}
	b.Publish(CardNew{Card: card})

	select {
	case ev := <-sub.Ch:
		cn, ok := ev.(CardNew)
		if !ok {
			t.Fatalf("type=%T", ev)
		}
		if cn.Card.ID != "x" {
			t.Errorf("card id=%q", cn.Card.ID)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("超时未收到 CardNew")
	}
}

func TestFanOutMultipleSubscribers(t *testing.T) {
	b := NewBus()
	subs := make([]*Subscription, 5)
	for i := range subs {
		subs[i] = b.Subscribe(4)
	}
	defer func() {
		for _, s := range subs {
			b.Unsubscribe(s)
		}
	}()

	b.Publish(CardNew{Card: &pushtypes.PushCard{ID: "fan"}})

	for i, s := range subs {
		select {
		case ev := <-s.Ch:
			cn := ev.(CardNew)
			if cn.Card.ID != "fan" {
				t.Errorf("sub %d got %q", i, cn.Card.ID)
			}
		case <-time.After(500 * time.Millisecond):
			t.Errorf("sub %d 超时", i)
		}
	}
}

func TestSlowConsumerEvicted(t *testing.T) {
	b := NewBus()
	fast := b.Subscribe(16)
	slow := b.Subscribe(2) // 故意小 buf
	defer b.Unsubscribe(fast)
	defer b.Unsubscribe(slow)

	// 不消费 slow，连续发 5 条 —— slow 应被踢
	for i := 0; i < 5; i++ {
		b.Publish(CardNew{Card: &pushtypes.PushCard{ID: "e"}})
	}

	// slow.Ch 应被关闭，drain 后 ok=false
	deadline := time.Now().Add(500 * time.Millisecond)
	closed := false
	for time.Now().Before(deadline) {
		select {
		case _, ok := <-slow.Ch:
			if !ok {
				closed = true
			}
		default:
			time.Sleep(10 * time.Millisecond)
		}
		if closed {
			break
		}
	}
	if !closed {
		t.Errorf("slow consumer 应被关闭")
	}

	if b.EvictedCount() < 1 {
		t.Errorf("EvictedCount=%d want ≥ 1", b.EvictedCount())
	}
	if b.Len() != 1 {
		t.Errorf("剩余订阅数=%d want 1（slow 已踢，fast 还在）", b.Len())
	}

	// fast 仍可继续收
	b.Publish(CardNew{Card: &pushtypes.PushCard{ID: "after"}})
	select {
	case ev := <-fast.Ch:
		if ev.(CardNew).Card.ID == "" {
			t.Errorf("fast 未收到 after")
		}
	case <-time.After(200 * time.Millisecond):
		t.Errorf("fast 超时")
	}
}

func TestUnsubscribeIdempotent(t *testing.T) {
	b := NewBus()
	sub := b.Subscribe(4)
	b.Unsubscribe(sub)
	b.Unsubscribe(sub) // 不应 panic / 不应重复 close

	if b.Len() != 0 {
		t.Errorf("Len=%d want 0", b.Len())
	}
}

func TestUnsubscribeNilSafe(t *testing.T) {
	b := NewBus()
	b.Unsubscribe(nil) // 不应 panic
}

func TestPublishAfterUnsubscribe(t *testing.T) {
	b := NewBus()
	sub := b.Subscribe(4)
	b.Unsubscribe(sub)

	// 已 Unsubscribe 的 sub，Publish 不应再写入（且不应 panic）
	b.Publish(CardNew{Card: &pushtypes.PushCard{ID: "after_unsub"}})
	select {
	case _, ok := <-sub.Ch:
		if ok {
			t.Errorf("不应收到事件，仅可能收到 zero value（closed）")
		}
	default:
		// ok, no value
	}
}

func TestConcurrentPublishAndSubscribe(t *testing.T) {
	b := NewBus()
	var wg sync.WaitGroup
	var received atomic.Int64

	// 10 个 subscriber 持续消费
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sub := b.Subscribe(32)
			defer b.Unsubscribe(sub)
			deadline := time.Now().Add(800 * time.Millisecond)
			for time.Now().Before(deadline) {
				select {
				case _, ok := <-sub.Ch:
					if !ok {
						return
					}
					received.Add(1)
				case <-time.After(50 * time.Millisecond):
				}
			}
		}()
	}

	// 给订阅者时间启动
	time.Sleep(50 * time.Millisecond)

	// 5 个 publisher 并发发布
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				b.Publish(CardNew{Card: &pushtypes.PushCard{ID: "c"}})
			}
		}()
	}

	wg.Wait()
	// 不要求精确数（slow consumer 会被踢），只要不死锁就行
	if received.Load() == 0 {
		t.Errorf("received=0，至少应有部分事件被消费")
	}
}

func TestCardUpdateType(t *testing.T) {
	b := NewBus()
	sub := b.Subscribe(4)
	defer b.Unsubscribe(sub)

	b.Publish(CardUpdate{Card: &pushtypes.PushCard{ID: "u", EnrichStatus: "ok"}})
	ev := <-sub.Ch
	cu, ok := ev.(CardUpdate)
	if !ok {
		t.Fatalf("type=%T want CardUpdate", ev)
	}
	if cu.Card.EnrichStatus != "ok" {
		t.Errorf("EnrichStatus=%q", cu.Card.EnrichStatus)
	}
}
