package kafka

import (
	"chain-consumer/global"
	"chain-consumer/internal/logc"
	"chain-consumer/internal/tracelog"
	"context"
	"runtime/debug"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/IBM/sarama"
)

type KafkaConsumer struct {
	brokers        []string
	processHandler func(ctx context.Context, message *sarama.ConsumerMessage) error
	config         *sarama.Config
	topic          string
	backwardTopic  string
	consumerGroup  string
	shutdownChan   chan struct{}
	closed         atomic.Bool
	wg             sync.WaitGroup
}

// kafkaHeaderCarrier 实现 TextMapCarrier 接口，用于从 sarama.ConsumerMessage.Headers 提取 header
type kafkaConsumerHandler struct {
	handler func(ctx context.Context, message *sarama.ConsumerMessage) error
	closing chan struct{}
	ctx     context.Context
	topics  []string
}

func (k *kafkaConsumerHandler) wrapHandler(ctx context.Context, message *sarama.ConsumerMessage) error {
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			logc.Error(ctx, "Kafka consumer handler panic", logc.Field("error", r), logc.Field("stack", string(stack)))
		}
	}()
	defer KafkaMsgDur(message.Topic)()
	KafkaMsgCount(message.Topic)
	KafkaMsgSize(message.Topic, len(message.Value))
	KafkaMsgTotal(message.Topic)
	KafkaOffsetMap.Store(message.Topic, message.Offset)

	err := k.handler(ctx, message)
	if err != nil {
		KafkaMsgError(message.Topic)
	}
	return err
}

func (h *kafkaConsumerHandler) Setup(session sarama.ConsumerGroupSession) error {
	return nil
}

func (h *kafkaConsumerHandler) Cleanup(session sarama.ConsumerGroupSession) error {
	// 结束时rebalance计数
	for _, topic := range h.topics {
		KafkaRebalance(topic)
	}
	return nil
}

func (h *kafkaConsumerHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for kafkaMsg := range claim.Messages() {
		result := h.wrapHandler(session.Context(), kafkaMsg)
		if result != nil {
			time.Sleep(200 * time.Millisecond)
		} else {
			// slow down the consumer
			// time.Sleep(20 * time.Millisecond)
			session.MarkMessage(kafkaMsg, "")
		}
		select {
		case <-h.closing:
			logc.Info(session.Context(), "Consumer is closing, stopping group.Consume loop")
			return nil
		case <-h.ctx.Done():
			logc.Info(h.ctx, "Ctx was cancelled, stopping consumer")
			return nil
		default:
			continue
		}
	}
	return nil
}

func NewKafkaConsumer(consumerGroup string, kafkaConfig global.KafkaConfig, handler func(ctx context.Context, message *sarama.ConsumerMessage) error) (*KafkaConsumer, error) {
	brokers := strings.Split(kafkaConfig.Brokers, ",")
	conf := sarama.NewConfig()
	conf.Consumer.Return.Errors = true
	switch kafkaConfig.InitialOffset {
	case global.InitialOffsetOldest:
		conf.Consumer.Offsets.Initial = sarama.OffsetOldest
	case global.InitialOffsetNewest:
		conf.Consumer.Offsets.Initial = sarama.OffsetNewest
	default:
		conf.Consumer.Offsets.Initial = sarama.OffsetOldest
	}

	return &KafkaConsumer{
		brokers:        brokers,
		topic:          kafkaConfig.Topic,
		backwardTopic:  kafkaConfig.BackwardTopic,
		consumerGroup:  consumerGroup,
		config:         conf,
		processHandler: handler,
		shutdownChan:   make(chan struct{}),
		closed:         atomic.Bool{},
	}, nil
}

func (c *KafkaConsumer) checkOffset(ctx context.Context) {
	client, err := sarama.NewClient(c.brokers, c.config)
	if err != nil {
		logc.Errorf(ctx, "NewClient error, stop check_offset, err:%v", err)
		return
	}
	ticker := time.NewTicker(2 * time.Minute)

	for range ticker.C {
		select {
		case <-ctx.Done():
			logc.Info(ctx, "Context done, stop check_offset")
			return
		case <-c.shutdownChan:
			logc.Info(ctx, "Shutdown signal received, stop check_offset")
			return
		default:
			partitions, _ := client.Partitions(c.topic)
			for _, p := range partitions {
				latest, err := client.GetOffset(c.topic, p, sarama.OffsetNewest)
				if err != nil {
					continue
				}
				KafkaMsgWatermark(c.topic, latest, p)
			}
			if value, has := KafkaOffsetMap.Load(c.topic); has {
				if val, ok := value.(int64); ok {
					KafkaMsgOffset(c.topic, val)
				}
			}
		}
	}
}

func (c *KafkaConsumer) consumeMessages(ctx context.Context) (err error) {
	consumer, err := sarama.NewConsumerGroup(c.brokers, c.consumerGroup, c.config)
	if err != nil {
		return err
	}

	topics := []string{c.topic}
	if c.backwardTopic != "" {
		topics = append(topics, c.backwardTopic)
	}
	logc.Infow(ctx, "Starting consuming for topics", logc.Field("topics", topics))

	handler := &kafkaConsumerHandler{
		ctx:     ctx,
		handler: c.processHandler,
		closing: c.shutdownChan,
		topics:  topics,
	}

	go c.checkOffset(ctx)

	defer func() {
		if err := consumer.Close(); err != nil {
			logc.Error(ctx, "Error closing consumer", err)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			logc.Info(ctx, "Context done, stopping consumer")
			return nil
		case <-c.shutdownChan:
			logc.Info(ctx, "Shutdown signal received, stopping consumer")
			return nil
		default:
			err := consumer.Consume(ctx, topics, handler)
			if err != nil {
				return err
			}
		}
	}
}

func (c *KafkaConsumer) consume(ctx context.Context) {
	consumeSpanCtx, consumeSpan := tracelog.StartSpan(ctx, "kafka", "consume")
	defer consumeSpan.End()
	tl := tracelog.NewWithContext(consumeSpanCtx)

	reconnectDelay := time.Second
	maxReconnectDelay := 30 * time.Second
	for {
		select {
		case <-ctx.Done():
			tl.Infow("Context done, stopping consumer")
			return
		case <-c.shutdownChan:
			tl.Infow("Shutdown signal received, stopping consumer")
			return
		default:
			err := c.consumeMessages(ctx)
			if err != nil {
				tl.Errorw("Kafka consumer error", "topic", c.topic, "brokers", c.brokers, "error", err)
				if err == sarama.ErrClosedConsumerGroup {
					tl.Infow("Kafka consumer is closed, no need to consume")
					return
				}
				time.Sleep(reconnectDelay)
				reconnectDelay *= 2
				if reconnectDelay > maxReconnectDelay {
					reconnectDelay = maxReconnectDelay
				}
			}
		}
	}
}

func (c *KafkaConsumer) Start(ctx context.Context) {
	if c.closed.Load() {
		logc.Info(ctx, "Kafka consumer is closed, no need to start")
		return
	}

	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		c.consume(ctx)
	}()
	logc.Infof(ctx, "Kafka consumer started, topic = %s, backward topic = %s", c.topic, c.backwardTopic)
}

func (c *KafkaConsumer) Stop(ctx context.Context) error {
	if c.closed.Load() {
		logc.Info(ctx, "Kafka consumer is closed, no need to stop")
		return nil
	}
	c.closed.Store(true)

	logc.Info(ctx, "Starting graceful shutdown")

	close(c.shutdownChan)
	c.wg.Wait()
	logc.Infow(ctx, "Kafka consumer stopped", logc.Field("topic", c.topic), logc.Field("backward topic", c.backwardTopic))
	return nil
}
