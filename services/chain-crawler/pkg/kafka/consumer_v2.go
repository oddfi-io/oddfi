package kafka

import (
	"context"
	"errors"
	"strings"
	"sync"

	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"

	"github.com/IBM/sarama"
)

type ConsumerV2 struct {
	kafkaConsumer sarama.ConsumerGroup
	ready         chan bool
	topicChans    map[string]chan *sarama.ConsumerMessage
	closeOnce     *sync.Once
}

func NewConsumerV2(group, host string) *ConsumerV2 {
	config := sarama.NewConfig()
	config.Metadata.AllowAutoTopicCreation = true
	config.Producer.MaxMessageBytes = 100e6
	client, err := sarama.NewConsumerGroup(strings.Split(host, ","), group, config)
	if err != nil {
		panic(err)
	}
	return &ConsumerV2{kafkaConsumer: client, topicChans: make(map[string]chan *sarama.ConsumerMessage), ready: make(chan bool), closeOnce: &sync.Once{}}
}

func (c *ConsumerV2) Subscribe(ctx context.Context, topics []string) {
	subscribeSpanCtx, subscribeSpan := tracelog.StartSpan(ctx, "kafka", "Subscribe")
	defer subscribeSpan.End()
	tl := tracelog.NewWithContext(subscribeSpanCtx)
	for _, topic := range topics {
		c.topicChans[topic] = make(chan *sarama.ConsumerMessage)
	}
	go func() {
		for {
			// `Consume` should be called inside an infinite loop, when a
			// server-side rebalance happens, the consumer session will need to be
			// recreated to get the new claims
			if err := c.kafkaConsumer.Consume(subscribeSpanCtx, topics, c); err != nil {
				if errors.Is(err, sarama.ErrClosedConsumerGroup) {
					return
				}
				tl.Errorw("Error from consumer", "error", err.Error())
			}
			// check if context was cancelled, signaling that the consumer should stop
			if ctx.Err() != nil {
				return
			}
		}
	}()
	<-c.ready // Await till the consumer has been set up
}

// Setup is run at the beginning of a new session, before ConsumeClaim
func (c *ConsumerV2) Setup(sarama.ConsumerGroupSession) error {
	// Mark the consumer as ready
	close(c.ready)
	return nil
}

// Cleanup is run at the end of a session, once all ConsumeClaim goroutines have exited
func (c *ConsumerV2) Cleanup(sarama.ConsumerGroupSession) error {
	return nil
}

// ConsumeClaim must start a consumer loop of ConsumerGroupClaim's Messages().
// Once the Messages() channel is closed, the Handler must finish its processing
// loop and exit.
func (c *ConsumerV2) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	// NOTE:
	// Do not move the code below to a goroutine.
	// The `ConsumeClaim` itself is called within a goroutine, see:
	// https://github.com/IBM/sarama/blob/main/consumer_group.go#L27-L29
	for {
		select {
		case message, ok := <-claim.Messages():
			if !ok {
				return nil
			}
			session.MarkMessage(message, "")
			c.topicChans[message.Topic] <- message
		case <-session.Context().Done():
			return nil
		}
	}
}

func (c *ConsumerV2) ReadMessage(ctx context.Context, topic string) (Message, error) {
	readMessageSpanCtx, readMessageSpan := tracelog.StartSpan(ctx, "kafka", "ReadMessage")
	defer readMessageSpan.End()
	tl := tracelog.NewWithContext(readMessageSpanCtx)
	msg := c.ReadRawMessage(ctx, topic)
	var ret Message
	if err := utils.JsonDecode(msg.Value, &ret); err != nil {
		tl.Errorw("utils.JsonDecode failed", "error", err.Error())
		return Message{}, err
	}
	return ret, nil
}

func (c *ConsumerV2) ReadRawMessage(ctx context.Context, topic string) *sarama.ConsumerMessage {
	readRawMessageSpanCtx, readRawMessageSpan := tracelog.StartSpan(ctx, "kafka", "ReadRawMessage")
	defer readRawMessageSpan.End()
	tl := tracelog.NewWithContext(readRawMessageSpanCtx)
	tl.Infow("ReadRawMessage", "topic", topic)
	return <-c.topicChans[topic]
}

func (c *ConsumerV2) Close() error {
	c.closeOnce.Do(func() {
		c.kafkaConsumer.PauseAll()
		c.kafkaConsumer.Close()
	})
	return nil
}
