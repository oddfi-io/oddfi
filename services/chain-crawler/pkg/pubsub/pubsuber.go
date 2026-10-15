package pubsub

import (
	"chain_crawler/pkg/tracelog"
	"context"
	"runtime"
	"sync"
)

const (
	ChainCrawlerConfigUpdatedTopic = "ChainCrawlerConfigUpdated"
)

var defaultRegister = newSubscriberRegister()

func Register(topic string, subscriber *Subscriber) {
	defaultRegister.Register(topic, subscriber)
}

func Publish(topic string, data interface{}) {
	defaultRegister.OnEvent(topic, data)
}

type EventHandler func(data interface{})

type Subscriber struct {
	Handler EventHandler
}

func NewSubscriber(handler EventHandler) *Subscriber {
	return &Subscriber{Handler: handler}
}

type subscriberRegister struct {
	subscribers map[string][]*Subscriber
	lock        *sync.RWMutex
}

func newSubscriberRegister() *subscriberRegister {
	return &subscriberRegister{
		subscribers: make(map[string][]*Subscriber),
		lock:        &sync.RWMutex{},
	}
}

func (register *subscriberRegister) Register(topic string, subscriber *Subscriber) {
	register.lock.Lock()
	defer register.lock.Unlock()
	register.subscribers[topic] = append(register.subscribers[topic], subscriber)
}

func (register *subscriberRegister) OnEvent(topic string, data interface{}) {
	tl := tracelog.NewWithContext(context.Background())
	register.lock.RLock()
	defer register.lock.RUnlock()
	subscribers, ok := register.subscribers[topic]
	if !ok {
		return
	}
	for _, sub := range subscribers {
		go func(sub *Subscriber) {
			defer func() {
				if err := recover(); err != nil {
					buf := make([]byte, 4096)
					n := runtime.Stack(buf, false)
					tl.Errorw("subscriberRegister panic in event handler", "topic", topic, "data", data, "error", err, "stack", string(buf[:n]))
				}
			}()
			sub.Handler(data)
		}(sub)
	}
}
