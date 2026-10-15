package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/samber/lo"
	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/plain"
)

var (
	kafkaWriterMap                     = make(map[string]*kafka.Writer)
	kafkaWriterMutex                   = &sync.Mutex{}
	kafkaLargeMessageWriterMap         = make(map[string]*kafka.Writer)
	kafkaLargeMessageWriterMutex       = &sync.Mutex{}
	kafkaHugeMessageWriterMap          = make(map[string]*kafka.Writer)
	kafkaHugeMessageWriterMutex        = &sync.Mutex{}
	kafkaCompressionMessageWriterMap   = make(map[string]*kafka.Writer)
	kafkaCompressionMessageWriterMutex = &sync.Mutex{}

	RequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "kafka",
		Name:      "request_duration",
		Help:      "Request duration",
	}, []string{
		"method",
	})

	// kafkaHeaderContextKey 用于在 context 中存储 Kafka 消息的自定义 header
	kafkaHeaderContextKey = struct{}{}
)

// WithKafkaHeaders 将自定义 header 添加到 context 中
// 输入: ctx - 上下文, headers - 自定义 header 映射
// 输出: context.Context - 包含 header 的新上下文
// 作用: 将自定义 header 存储到 context 中，以便在发送 Kafka 消息时使用
func WithKafkaHeaders(ctx context.Context, headers map[string]string) context.Context {
	if headers == nil || len(headers) == 0 {
		return ctx
	}
	return context.WithValue(ctx, kafkaHeaderContextKey, headers)
}

// GetKafkaHeaders 从 context 中获取自定义 header
// 输入: ctx - 上下文
// 输出: map[string]string - 自定义 header 映射，如果不存在则返回 nil
// 作用: 从 context 中提取自定义 header
func GetKafkaHeaders(ctx context.Context) map[string]string {
	if ctx == nil {
		return nil
	}
	headers, ok := ctx.Value(kafkaHeaderContextKey).(map[string]string)
	if !ok {
		return nil
	}
	return headers
}

type MessageType string

const (
	MessageTypeEvmLog        MessageType = "evm-log"
	MessageTypeEvmTx         MessageType = "evm-tx"
	MessageTypeEvmReceipt    MessageType = "evm-receipt"
	MessageTypeEvmBlockTrace MessageType = "evm-block-trace"
	MessageTypeEvmIncr       MessageType = "evm-incremental"
	MessageTypeSolanaTx      MessageType = "solana-transaction"
	MessageTypeSoonTx        MessageType = "soon-transaction"
	MessageTypeSolanaBlock   MessageType = "solana-block"
	MessageTypeAptosTx       MessageType = "aptos-transaction"
	MessageTypeTonToken      MessageType = "ton-token"
	MessageTypeSuiTx         MessageType = "sui-transaction"
	MessageTypeSui           MessageType = "sui-message"
	MessageTypeSuiPoolEvent  MessageType = "sui-pool-event"
	MessageTypeSuiSwapEvent  MessageType = "sui-swap-event"
	MessageTypeTonTx         MessageType = "ton-transaction"
	MessageTypeBtcTx         MessageType = "btc-transaction"
	MessageTypeGateTx        MessageType = "gate-transaction"
	MessageTypeCelestiaTx    MessageType = "celestia-transaction"
	MessageTypeCosmosHubTx   MessageType = "cosmoshub-transaction"
	MessageTypeCKBTx         MessageType = "ckb-transaction"
	MessageTypeDogecoinTx    MessageType = "dogecoin-transaction"
	MessageTypeSeiTx         MessageType = "sei-transaction"
	MessageTypeInjectiveTx   MessageType = "injective-transaction"
	MessageTypeNervosTx      MessageType = "nervos-transaction"
	MessageTypeVaraTx        MessageType = "vara-transaction"
	MessageTypeAstarSubTx    MessageType = "astar_sub-transaction"
	MessageTypeMantaAltTx    MessageType = "manta_alt-transaction"
	MessageTypeDeepbrainTx   MessageType = "deepbrain-transaction"
	MessagetypeFBTX          MessageType = "fb-transaction"
	MessageTypeLTCTX         MessageType = "ltc-transaction"
	MessageTypeBchTx         MessageType = "bch-transaction"
	MessageTypeNibiruTx      MessageType = "nibiru-transaction"
	MessageTypeSagaTx        MessageType = "saga-transaction"
	MessageTypeKaspaTx       MessageType = "kaspa-transaction"
	MessageTypeCardanoTx     MessageType = "ada-transaction"
	MessageTypeVenomTx       MessageType = "venom-transaction"
	MessageTypeXionTx        MessageType = "xion-transaction"
	MessageTypeMoveTx        MessageType = "move-transaction"

	MessageTypeCosmosSeriesTx MessageType = "cosmosSeries-transaction" // 适用于cosmos系列
)

type Message struct {
	Type           MessageType     `json:"type"`
	Chain          consts.Chain    `json:"chain"`
	Data           json.RawMessage `json:"data"`
	Timestamp      int64           `json:"timestamp"`
	BlockNumber    uint64          `json:"block_number"`
	TxIndex        uint            `json:"tx_index,omitempty"`
	EventTopic     string          `json:"event_topic,omitempty"`
	DelayFlag      bool            `json:"delay_flag,omitempty"` // 是否延迟处理
	KafkaTimestamp int64           `json:"-"`
}

type Producer struct {
	topic       string
	kafkaWriter *kafka.Writer
}

func logf(msg string, a ...interface{}) {
	fmt.Printf(msg, a...)
	fmt.Println()
}

func NewProducer(host, topic, username, password string) Producer {
	kafkaWriterMutex.Lock()
	defer kafkaWriterMutex.Unlock()
	adjustTopic := strings.ToLower(topic)
	if _, ok := kafkaWriterMap[host]; !ok {
		kafkaWriter := &kafka.Writer{
			Addr:                   kafka.TCP(strings.Split(host, ",")...),
			Balancer:               &kafka.Hash{},
			AllowAutoTopicCreation: true,
			BatchTimeout:           5 * time.Millisecond, // 等价于 linger.ms=5
			BatchSize:              20,
			BatchBytes:             8 * 1048576, // 83886080
			ErrorLogger:            kafka.LoggerFunc(logf),
		}
		if username != "" && password != "" {
			mechanism := plain.Mechanism{
				Username: username,
				Password: password,
			}
			kafkaWriter.Transport = &kafka.Transport{
				SASL: mechanism,
			}
		}
		kafkaWriterMap[host] = kafkaWriter
	}
	return Producer{kafkaWriter: kafkaWriterMap[host], topic: adjustTopic}
}

func NewLargeMessageProducer(host, topic, username, password string) Producer {
	kafkaLargeMessageWriterMutex.Lock()
	defer kafkaLargeMessageWriterMutex.Unlock()
	adjustTopic := strings.ToLower(topic)
	if _, ok := kafkaLargeMessageWriterMap[host]; !ok {
		kafkaWriter := &kafka.Writer{
			Addr:                   kafka.TCP(strings.Split(host, ",")...),
			Balancer:               &kafka.Hash{},
			AllowAutoTopicCreation: true,
			BatchTimeout:           5 * time.Millisecond, // 等价于 linger.ms=5
			BatchSize:              10,
			BatchBytes:             8 * 1048576,
			ErrorLogger:            kafka.LoggerFunc(logf),
		}
		if username != "" && password != "" {
			mechanism := plain.Mechanism{
				Username: username,
				Password: password,
			}
			kafkaWriter.Transport = &kafka.Transport{
				SASL: mechanism,
			}
		}
		kafkaLargeMessageWriterMap[host] = kafkaWriter
	}
	return Producer{kafkaWriter: kafkaLargeMessageWriterMap[host], topic: adjustTopic}
}

func NewHugeMessageProducer(host, topic, username, password string) Producer {
	kafkaHugeMessageWriterMutex.Lock()
	defer kafkaHugeMessageWriterMutex.Unlock()
	adjustTopic := strings.ToLower(topic)
	if _, ok := kafkaHugeMessageWriterMap[host]; !ok {
		kafkaWriter := &kafka.Writer{
			Addr:                   kafka.TCP(strings.Split(host, ",")...),
			Balancer:               &kafka.Hash{},
			AllowAutoTopicCreation: true,
			BatchTimeout:           5 * time.Millisecond, // 等价于 linger.ms=5
			BatchSize:              4,
			BatchBytes:             10 * 1048576,
			ErrorLogger:            kafka.LoggerFunc(logf),
		}
		if username != "" && password != "" {
			mechanism := plain.Mechanism{
				Username: username,
				Password: password,
			}
			kafkaWriter.Transport = &kafka.Transport{
				SASL: mechanism,
			}
		}
		kafkaHugeMessageWriterMap[host] = kafkaWriter
	}
	return Producer{kafkaWriter: kafkaHugeMessageWriterMap[host], topic: adjustTopic}
}

func NewCompressionProducer(host, topic, username, password string) Producer {
	kafkaCompressionMessageWriterMutex.Lock()
	defer kafkaCompressionMessageWriterMutex.Unlock()
	if _, ok := kafkaCompressionMessageWriterMap[topic]; !ok {
		kafkaWriter := &kafka.Writer{
			Addr:                   kafka.TCP(strings.Split(host, ",")...),
			Balancer:               &kafka.Hash{},
			AllowAutoTopicCreation: true,
			BatchTimeout:           5 * time.Millisecond, // 等价于 linger.ms=5
			BatchSize:              16,
			BatchBytes:             80 * 1048576,
			ErrorLogger:            kafka.LoggerFunc(logf),
			Compression:            kafka.Snappy,
		}
		if username != "" && password != "" {
			mechanism := plain.Mechanism{
				Username: username,
				Password: password,
			}
			kafkaWriter.Transport = &kafka.Transport{
				SASL: mechanism,
			}
		}
		kafkaCompressionMessageWriterMap[host] = kafkaWriter
	}
	return Producer{kafkaWriter: kafkaCompressionMessageWriterMap[host], topic: topic}
}

func NewCompressionProducerZstd(host, topic, username, password string) Producer {
	kafkaCompressionMessageWriterMutex.Lock()
	defer kafkaCompressionMessageWriterMutex.Unlock()
	if _, ok := kafkaCompressionMessageWriterMap[topic]; !ok {
		kafkaWriter := &kafka.Writer{
			Addr:                   kafka.TCP(strings.Split(host, ",")...),
			Balancer:               &kafka.Hash{},
			AllowAutoTopicCreation: true,
			BatchTimeout:           5 * time.Millisecond, // 等价于 linger.ms=5
			BatchSize:              16,
			BatchBytes:             80 * 1048576,
			ErrorLogger:            kafka.LoggerFunc(logf),
			Compression:            kafka.Zstd,
		}
		if username != "" && password != "" {
			mechanism := plain.Mechanism{
				Username: username,
				Password: password,
			}
			kafkaWriter.Transport = &kafka.Transport{
				SASL: mechanism,
			}
		}
		kafkaCompressionMessageWriterMap[host] = kafkaWriter
	}
	return Producer{kafkaWriter: kafkaCompressionMessageWriterMap[host], topic: topic}
}

// WriteRawMessages 发送原始 Kafka 消息
// 输入: ctx - 上下文（用于传递 trace 信息）, msgs - Kafka 消息列表
// 输出: error - 错误信息
// 作用: 发送原始 Kafka 消息，并在消息头中注入 trace 信息
func (s Producer) WriteRawMessages(ctx context.Context, msgs ...kafka.Message) error {
	writeRawMessagesSpanCtx, writeRawMessagesSpan := tracelog.StartSpan(ctx, "kafka", "WriteRawMessages")
	defer writeRawMessagesSpan.End()
	tl := tracelog.NewWithContext(writeRawMessagesSpanCtx)
	tl.Infow("WriteRawMessages", "count", len(msgs))
	if len(msgs) == 0 {
		return nil
	}

	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("WriteRawMessages").Observe(time.Since(now).Seconds())
	}()

	// 为每个消息注入 trace 信息
	for i := range msgs {
		msgs[i].Topic = s.topic
		// 注入 trace 信息到消息头中
		if msgs[i].Headers == nil {
			msgs[i].Headers = make([]kafka.Header, 0)
		}
		tracelog.InjectKafkaHeaders(writeRawMessagesSpanCtx, &msgs[i].Headers)
		// 添加自定义 header（如果存在）
		customHeaders := GetKafkaHeaders(writeRawMessagesSpanCtx)
		if customHeaders != nil {
			for k, v := range customHeaders {
				msgs[i].Headers = append(msgs[i].Headers, kafka.Header{
					Key:   k,
					Value: []byte(v),
				})
			}
		}
	}
	return s.kafkaWriter.WriteMessages(writeRawMessagesSpanCtx, msgs...)
}

// WriteMessages 发送 Kafka 消息
// 输入: ctx - 上下文（用于传递 trace 信息）, msgs - 消息列表
// 输出: error - 错误信息
// 作用: 发送 Kafka 消息，并在消息头中注入 trace 信息
func (s Producer) WriteMessages(ctx context.Context, msgs ...Message) error {
	writeMessagesSpanCtx, writeMessagesSpan := tracelog.StartSpan(ctx, "kafka", "WriteMessages")
	defer writeMessagesSpan.End()
	tl := tracelog.NewWithContext(writeMessagesSpanCtx)
	tl.Infow("WriteMessages", "count", len(msgs))
	if len(msgs) == 0 {
		return nil
	}

	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("WriteMessages").Observe(time.Since(now).Seconds())
	}()

	return s.kafkaWriter.WriteMessages(writeMessagesSpanCtx, lo.Map(msgs, func(msg Message, _ int) kafka.Message {
		value, _ := json.Marshal(msg)
		headers := make([]kafka.Header, 0)
		// 注入 trace 信息到消息头中
		tracelog.InjectKafkaHeaders(writeMessagesSpanCtx, &headers)
		// 添加自定义 header（如果存在）
		customHeaders := GetKafkaHeaders(writeMessagesSpanCtx)
		if customHeaders != nil {
			for k, v := range customHeaders {
				headers = append(headers, kafka.Header{
					Key:   k,
					Value: []byte(v),
				})
			}
		}
		return kafka.Message{
			Key:     []byte(fmt.Sprintf("%+v:block-%d:time-%+v:tx-index-%+v", msg.Type, msg.BlockNumber, msg.Timestamp, msg.TxIndex)),
			Topic:   s.topic,
			Value:   value,
			Headers: headers,
		}
	})...)
}

// WriteCompactMessages 发送压缩的 Kafka 消息
// 输入: ctx - 上下文（用于传递 trace 信息）, msgs - 消息列表
// 输出: error - 错误信息
// 作用: 发送压缩的 Kafka 消息，并在消息头中注入 trace 信息
func (s Producer) WriteCompactMessages(ctx context.Context, msgs ...Message) error {
	writeCompactMessagesSpanCtx, writeCompactMessagesSpan := tracelog.StartSpan(ctx, "kafka", "WriteCompactMessages")
	defer writeCompactMessagesSpan.End()

	tl := tracelog.NewWithContext(writeCompactMessagesSpanCtx)
	tl = tl.With("topic", s.topic, "count", len(msgs))
	if len(msgs) == 0 {
		tl.Infow("WriteCompactMessages no messages to send")
		return nil
	}

	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("WriteMessages").Observe(time.Since(now).Seconds())
	}()

	return s.kafkaWriter.WriteMessages(writeCompactMessagesSpanCtx, lo.Map(msgs, func(msg Message, _ int) kafka.Message {
		value, _ := utils.CompressJsonWithSnappy(msg)
		headers := make([]kafka.Header, 0)
		// 注入 trace 信息到消息头中
		tracelog.InjectKafkaHeaders(writeCompactMessagesSpanCtx, &headers)
		// 添加自定义 header（如果存在）
		customHeaders := GetKafkaHeaders(writeCompactMessagesSpanCtx)
		if customHeaders != nil {
			for k, v := range customHeaders {
				headers = append(headers, kafka.Header{
					Key:   k,
					Value: []byte(v),
				})
			}
		}
		return kafka.Message{
			Key:     []byte(fmt.Sprintf("%+v:block-%d:time-%+v:tx-index-%+v", msg.Type, msg.BlockNumber, msg.Timestamp, msg.TxIndex)),
			Topic:   s.topic,
			Value:   value,
			Headers: headers,
		}
	})...)
}

func (s Producer) Close() error {
	return s.kafkaWriter.Close()
}
