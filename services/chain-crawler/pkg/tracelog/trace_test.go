package tracelog

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContext(t *testing.T) {
	InitTrace("test_service_namespace", "test_service_name")
	ctx1, _ := StartSpan(context.Background(), "trace_name", "span_name1")
	span1 := SpanFromContext(ctx1)
	ctx2, _ := StartSpan(ctx1, "trace_name", "span_name2")
	span2 := SpanFromContext(ctx2)
	assert.Equal(t, span1.SpanContext().TraceID().String(), span2.SpanContext().TraceID().String())
	assert.NotEqual(t, span1.SpanContext().SpanID().String(), span2.SpanContext().SpanID().String())
}
