package keymutex

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// TestKeyMutex_SingleKeySerial 测试单个键串行锁定
func TestKeyMutex(t *testing.T) {
	km := New()

	var wg sync.WaitGroup
	const numGoroutines = 1000
	const key = "testKey"

	total := 0
	// 测试多个 goroutine 同时锁定同一个 key
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			km.Lock(key)
			defer km.Unlock(key)
			total++
			time.Sleep(1 * time.Millisecond)
		}(i)
	}

	wg.Wait()

	assert.Equal(t, numGoroutines, total)
}

func TestUnlockWithoutLock(t *testing.T) {
	km := New()
	const key = "testKey"

	// 尝试解锁一个没有被锁定的 key
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("Unlock should not panic when called without Lock: %v", r)
		}
	}()
	km.Unlock(key) // 这里不应该引发 panic
}

func TestLockUnlock(t *testing.T) {
	km := New()
	const key = "testKey"

	km.Lock(key)
	// 这里可以添加一些逻辑来验证锁的行为
	km.Unlock(key)

	// 再次锁定和解锁
	km.Lock(key)
	km.Unlock(key)
}

func TestKeyMutex_DifferentKeys(t *testing.T) {
	km := New()

	// 不同的key应该可以同时获得锁
	done := make(chan bool)
	go func() {
		km.Lock("key1")
		time.Sleep(100 * time.Millisecond)
		km.Unlock("key1")
		t.Log("key1 unlocked")
		done <- true
	}()

	// 不需要等待key1解锁就可以获得key2的锁
	km.Lock("key2")
	km.Unlock("key2")
	t.Log("key2 unlocked")

	<-done
}

func TestKeyMutex_UnlockNonexistentKey(t *testing.T) {
	km := New()

	// 解锁一个不存在的key不应该导致panic
	km.Unlock("nonexistent")
}

func TestKeyMutex_MultipleLocksPerKey(t *testing.T) {
	km := New()
	const key = "test-key"

	// 测试锁重入
	done := make(chan bool)
	go func() {
		km.Lock(key)
		time.Sleep(100 * time.Millisecond)
		km.Unlock(key)
		done <- true
	}()

	// 等待一小段时间确保第一个goroutine已获得锁
	time.Sleep(50 * time.Millisecond)

	// 尝试获取同一个key的锁,应该会被阻塞直到第一个goroutine释放
	start := time.Now()
	km.Lock(key)
	elapsed := time.Since(start)

	// 验证是否确实被阻塞了足够长的时间
	if elapsed < 50*time.Millisecond {
		t.Errorf("Lock acquired too quickly, expected to be blocked for at least 50ms, got %v", elapsed)
	}

	km.Unlock(key)
	<-done
}
