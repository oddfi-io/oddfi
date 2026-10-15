package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"chain_crawler/pkg/tracelog"

	"github.com/samber/lo"
	"github.com/segmentio/kafka-go"
)

type TonMessage struct {
	Data           json.RawMessage `json:"data"`
	Timestamp      int64           `json:"timestamp"`
	Seqno          uint64          `json:"seqno"`
	TxIndex        uint            `json:"tx_index,omitempty"`
	Shard          string          `json:"shard,omitempty"`
	DelayFlag      bool            `json:"delay_flag,omitempty"` // 是否延迟处理
	KafkaTimestamp int64           `json:"-"`
}

// WriteTonMessages 发送 TON Kafka 消息
// 输入: ctx - 上下文（用于传递 trace 信息）, msgs - TON 消息列表
// 输出: error - 错误信息
// 作用: 发送 TON Kafka 消息，并在消息头中注入 trace 信息
func (s Producer) WriteTonMessages(ctx context.Context, msgs ...TonMessage) error {
	writeTonMessagesSpanCtx, writeTonMessagesSpan := tracelog.StartSpan(ctx, "kafka", "WriteTonMessages")
	defer writeTonMessagesSpan.End()
	tl := tracelog.NewWithContext(writeTonMessagesSpanCtx)
	tl.Infow("WriteTonMessages", "count", len(msgs))
	if len(msgs) == 0 {
		return nil
	}

	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("WriteMessages").Observe(time.Since(now).Seconds())
	}()

	return s.kafkaWriter.WriteMessages(writeTonMessagesSpanCtx, lo.Map(msgs, func(msg TonMessage, _ int) kafka.Message {
		value, _ := json.Marshal(msg)
		// value, _ := utils.CompressJsonWithSnappy(msg)
		headers := make([]kafka.Header, 0)
		// 注入 trace 信息到消息头中
		tracelog.InjectKafkaHeaders(writeTonMessagesSpanCtx, &headers)
		return kafka.Message{
			Key:     []byte(fmt.Sprintf("seqno-%d:time-%+v:tx-index-%+v", msg.Seqno, msg.Timestamp, msg.TxIndex)),
			Topic:   s.topic,
			Value:   value,
			Headers: headers,
		}
	})...)
}
