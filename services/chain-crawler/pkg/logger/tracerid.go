package logger

import (
	"context"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
)

func init() {
	exporter, err := otlptracehttp.New(context.Background())
	if err != nil {
		panic(err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String("example-service"),
		)),
	)
	otel.SetTracerProvider(tp)
}

func GetTracerContext(ctx context.Context, serviceName, spanName string) context.Context {
	tracer := otel.Tracer(serviceName)
	tracectx, _ := tracer.Start(ctx, spanName)
	return tracectx
}

func InitTracerContext(ctx context.Context, tracerId, spanID string) (context.Context, error) {

	tid, err := trace.TraceIDFromHex(tracerId)
	if err != nil {
		return context.TODO(), err
	}

	sid, err := trace.SpanIDFromHex(spanID)
	if err != nil {
		return context.TODO(), err
	}

	cfg := trace.SpanContextConfig{
		TraceID: tid,
		SpanID:  sid,
	}
	sc := trace.NewSpanContext(cfg)
	return trace.ContextWithSpanContext(ctx, sc), nil
}
