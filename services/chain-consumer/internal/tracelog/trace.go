package tracelog

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/IBM/sarama"
	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdk_trace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
)

// InitTrace 初始化 OpenTelemetry 追踪系统
// 输入: serviceNamespace - 服务命名空间, serviceName - 服务名称
// 输出: 无
// 作用: 配置 TracerProvider、Propagator 和 Exporter，确保 traceID 和 spanID 能正确生成
func InitTrace(serviceNamespace, serviceName string) {
	// 创建资源信息
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceNamespaceKey.String(serviceNamespace),
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		panic(err)
	}

	// 创建 TracerProvider
	traceProvider := sdk_trace.NewTracerProvider(
		sdk_trace.WithResource(res),
		// 添加采样器，确保所有 span 都被采样
		sdk_trace.WithSampler(sdk_trace.AlwaysSample()),
	)

	// 设置全局 TracerProvider
	otel.SetTracerProvider(traceProvider)

	// 设置全局 Propagator，用于在 HTTP 请求中传播 tracelog 信息
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
}

func StartSpan(ctx context.Context, tracerName, spanName string) (context.Context, trace.Span) {
	ctx, span := otel.Tracer(tracerName).Start(ctx, spanName)
	return ctx, span
}

func StartSpanWithRequest(r *http.Request, tracerName, spanName string) (context.Context, trace.Span) {
	ctx, span := otel.Tracer(tracerName).Start(GetContextWithRequest(r), spanName)
	if r != nil {
		span.SetAttributes(
			semconv.HTTPMethodKey.String(r.Method),
			semconv.HTTPURLKey.String(r.URL.Path),
		)
	}
	return ctx, span
}

func GetContextWithRequest(r *http.Request) context.Context {
	return otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))
}

// InjectHttpHeader 将 tracelog 信息注入到 HTTP 请求头中
// 输入: ctx - 上下文（如果为 nil 则跳过注入）, r - HTTP 请求
// 输出: 无
// 作用: 将当前 context 中的 tracelog 信息注入到 HTTP 请求头中，以便在下游服务中能够提取 tracelog 信息
func InjectHttpHeader(ctx context.Context, r *http.Request) {
	// 如果 context 为 nil，跳过注入，避免空指针解引用
	if ctx == nil || r == nil {
		return
	}
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(r.Header))
}

func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// StartSpanWithServiceName 手动创建新的trace span，使用配置中的service_name
// 输入: ctx - 上下文, spanName - span名称
// 输出: context.Context - 新的上下文, tracelog.Span - span对象
// 作用: 创建新的span用于手动埋点
func StartSpanWithServiceName(ctx context.Context, serviceName, spanName string) (context.Context, trace.Span) {
	ctx, span := otel.Tracer(serviceName).Start(ctx, spanName)
	return ctx, span
}

// KafkaHeaderCarrier 实现 TextMapCarrier 接口，用于在 Kafka 消息头中传播 tracelog 信息
type KafkaHeaderCarrier []kafka.Header

// Get 从 Kafka 消息头中获取指定 key 的值
func (c *KafkaHeaderCarrier) Get(key string) string {
	for _, h := range *c {
		if h.Key == key {
			return string(h.Value)
		}
	}
	return ""
}

// Set 在 Kafka 消息头中设置指定 key 的值
func (c *KafkaHeaderCarrier) Set(key, value string) {
	for i := range *c {
		if (*c)[i].Key == key {
			(*c)[i].Value = []byte(value)
			return
		}
	}
	*c = append(*c, kafka.Header{
		Key:   key,
		Value: []byte(value),
	})
}

// Keys 返回所有 header 的 key
func (c *KafkaHeaderCarrier) Keys() []string {
	keys := make([]string, 0, len(*c))
	for _, h := range *c {
		keys = append(keys, h.Key)
	}
	return keys
}

// InjectKafkaHeaders 将 tracelog 信息注入到 Kafka 消息头中
// 输入: ctx - 上下文, headers - Kafka 消息头（指针，会被修改）
// 输出: 无
// 作用: 将当前 context 中的 tracelog 信息注入到 Kafka 消息头中，以便在消费端能够提取 tracelog 信息
func InjectKafkaHeaders(ctx context.Context, headers *[]kafka.Header) {
	if headers == nil {
		return
	}
	carrier := (*KafkaHeaderCarrier)(headers)
	otel.GetTextMapPropagator().Inject(ctx, carrier)
}

// StartNewTraceWithTaskContext 为每次任务执行创建新的 tracelog，同时监听任务 context 的取消
// 输入: taskCtx - 任务上下文（用于监听取消）, serviceName - 服务名称, spanName - span名称
// 输出: context.Context - 新的上下文（包含新的 tracelog 信息）, tracelog.Span - span对象, context.CancelFunc - 取消函数
// 作用: 每次调用都会创建新的 traceId，确保每次执行都有独立的 tracelog，同时可以监听任务取消
func StartNewTraceWithTaskContext(taskCtx context.Context, serviceName, spanName string) (context.Context, trace.Span, context.CancelFunc) {
	// 从 background context 创建新的 tracelog，确保每次都有新的 traceId
	runCtx, span := StartSpan(context.Background(), serviceName, spanName)

	// 创建可取消的 context
	ctx, cancel := context.WithCancel(runCtx)

	// 监听任务 context 的取消，如果任务被关闭，也取消本次执行
	// 使用 goroutine 监听，确保不会阻塞
	go func() {
		select {
		case <-taskCtx.Done():
			// 任务被取消，取消本次执行
			cancel()
		case <-ctx.Done():
			// 本次执行已完成或被取消，退出 goroutine
			return
		}
	}()

	return ctx, span, cancel
}

func TransferCtxTrace(ctx context.Context, m *sarama.ConsumerMessage) context.Context {
	// 安全提取 trace 上下文
	var extractedCtx context.Context
	func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("Failed to extract trace context, using background context: %v", r)
				extractedCtx = ctx // 回退到原始 ctx
			}
		}()
		carrier := MessageHeaderCarrier{Headers: m.Headers}
		extractedCtx = propagation.TraceContext{}.Extract(ctx, carrier)
	}()

	if extractedCtx == nil {
		extractedCtx = ctx
	}
	return extractedCtx
}

// kafkaHeaderCarrier 实现 propagation.TextMapCarrier 接口，
// 用于从 sarama.ConsumerMessage.Headers 中读取 header。
type MessageHeaderCarrier struct {
	Headers []*sarama.RecordHeader
}

// Get 根据 key 获取 header 值（不区分大小写，符合 HTTP/Kafka 惯例）
func (k MessageHeaderCarrier) Get(key string) string {
	for _, h := range k.Headers {
		if h != nil && h.Key != nil && strings.EqualFold(string(h.Key), key) {
			// 注意：h.Value 可能为 nil，string(nil) 会 panic！
			if h.Value == nil {
				return ""
			}
			return string(h.Value)
		}
	}
	return ""
}

// Set 是 TextMapCarrier 要求的方法，但在 Extract 场景中不会被调用，
// 因此可以留空（或 panic if needed）。
func (k MessageHeaderCarrier) Set(key, value string) {
	// Extract 不会调用 Set，所以无需实现
	// 如果用于 Inject（注入到消息），则需要实现，但此处仅用于消费
}

// Keys 返回所有 header 的 key 列表（用于调试或遍历）
func (k MessageHeaderCarrier) Keys() []string {
	keys := make([]string, 0, len(k.Headers))
	for _, h := range k.Headers {
		if h != nil && h.Key != nil {
			keys = append(keys, string(h.Key))
		}
	}
	return keys
}

// Verify that kafkaHeaderCarrier implements propagation.TextMapCarrier at compile time.
var _ propagation.TextMapCarrier = (*KafkaHeaderCarrier)(nil)
