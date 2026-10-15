package utils

import (
	"chain_crawler/pkg/consts"
	"sync"
	"time"
)

type RateLimiter struct {
	mu            sync.Mutex
	reqChan       chan struct{}
	queueCapacity int
	requests      []time.Time
	head          int
	tail          int
	count         int
}

func NewRateLimiter(capacity int) (*RateLimiter, error) {
	if capacity <= 0 {
		return nil, consts.ErrInvalidParam
	}
	return &RateLimiter{
		head:          0,
		tail:          0,
		count:         0,
		reqChan:       make(chan struct{}, capacity),
		queueCapacity: capacity - 1, // 队列容量，防止 1s 的边缘，这里减 1
		requests:      make([]time.Time, capacity-1),
	}, nil
}

func (rl *RateLimiter) GetReqSlot() {
	rl.reqChan <- struct{}{}
}

func (rl *RateLimiter) PopReqSlot() {
	<-rl.reqChan
}

func (rl *RateLimiter) Allow(now time.Time) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	// 如果队列头部的时间戳距离现在已经超过1秒，则可以处理新的请求
	if rl.count > 0 && now.Sub(rl.requests[rl.head]) >= time.Second {
		rl.head = (rl.head + 1) % rl.queueCapacity
		rl.count--
	}
	// 如果队列满了，拒绝新的请求
	if rl.count == rl.queueCapacity {
		return false
	}
	// 将当前请求时间戳添加到队列尾部
	rl.requests[rl.tail] = now
	rl.tail = (rl.tail + 1) % rl.queueCapacity
	rl.count++

	return true
}

func DoRateLimiterLogicWithRet[T interface{}](rl *RateLimiter, handle func() (T, error)) (T, error) {
	if rl == nil {
		return handle()
	}
	rl.GetReqSlot()
	defer func() {
		rl.PopReqSlot()
	}()
	for !rl.Allow(time.Now()) {
		time.Sleep(100 * time.Millisecond)
	}
	return handle()
}

func DoRateLimiterLogic(rl *RateLimiter, reqFunc func() error) error {
	if rl == nil {
		return reqFunc()
	}
	rl.GetReqSlot()
	defer func() {
		rl.PopReqSlot()
	}()
	for !rl.Allow(time.Now()) {
		time.Sleep(100 * time.Millisecond)
	}
	return reqFunc()
}
