package kafka

import (
	"context"
	"errors"
	"strings"
	"time"

	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
)

type Consumer struct {
	kafkaReader *kafka.Reader
}

func NewConsumer(ctx context.Context, group, host, topic, username, password string) Consumer {
	kafkaConfig := kafka.ReaderConfig{
		Brokers:        strings.Split(host, ","),
		GroupID:        group,
		Topic:          strings.ToLower(topic), // topic 强制小写
		ErrorLogger:    kafka.LoggerFunc(logf),
		MaxBytes:       100e6, // 100MB
		MinBytes:       1e5,   // 100KB
		MaxWait:        5 * time.Second,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	}
	if username != "" && password != "" {
		mechanism, err := scram.Mechanism(scram.SHA512, username, password)
		if err != nil {
			panic(err)
		}
		kafkaConfig.Dialer = &kafka.Dialer{
			Timeout:       10 * time.Second,
			DualStack:     true,
			SASLMechanism: mechanism,
		}
	}
	kafkaReader := kafka.NewReader(kafkaConfig)
	return Consumer{kafkaReader: kafkaReader}
}

func (s Consumer) Valid(ctx context.Context) bool {
	validSpanCtx, validSpan := tracelog.StartSpan(ctx, "kafka", "Valid")
	defer validSpan.End()
	tl := tracelog.NewWithContext(validSpanCtx)
	tl.Infow("Valid")
	return s.kafkaReader.Offset() > 0 || s.kafkaReader.Lag() > 0
}

func (s Consumer) ReadMessage(ctx context.Context) (Message, error) {
	readMessageSpanCtx, readMessageSpan := tracelog.StartSpan(ctx, "kafka", "ReadMessage")
	defer readMessageSpan.End()
	tl := tracelog.NewWithContext(readMessageSpanCtx)
	msg, err := s.ReadRawMessage(readMessageSpanCtx)
	if err != nil {
		return Message{}, err
	}
	var ret Message
	if err = utils.JsonDecode(msg.Value, &ret); err != nil {
		tl.Errorw("utils.JsonDecode failed", "error", err.Error())
		return Message{}, err
	}
	ret.KafkaTimestamp = msg.Time.Unix()
	return ret, nil
}

func (s Consumer) ReadRawMessage(ctx context.Context) (kafka.Message, error) {
	readRawMessageSpanCtx, readRawMessageSpan := tracelog.StartSpan(ctx, "kafka", "ReadRawMessage")
	defer readRawMessageSpan.End()
	tl := tracelog.NewWithContext(readRawMessageSpanCtx)
	tl.Infow("ReadRawMessage")
	msg, err := s.kafkaReader.ReadMessage(readRawMessageSpanCtx)
	if err != nil {
		return msg, errors.Join(errors.New("read message failed"), err)
	}
	return msg, nil
}

func (s Consumer) Close() error {
	return s.kafkaReader.Close()
}
