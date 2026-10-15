package tracelog

import (
	"context"
	"testing"
)

func TestLog(t *testing.T) {
	InitLogger("dev")
	InitTrace("test_service_namespace", "test_service_name")
	ctx, _ := StartSpan(context.Background(), "trace_name", "span_name1")
	sl := NewWithContext(ctx)
	sl.Infow("test", "key", "value")

	ctx1, _ := StartSpan(ctx, "trace_name", "span_name1")
	sl1 := NewWithContext(ctx1)
	sl1.Info("test", "key", "value")

	sl.Info("test", "key", "value")
	sl.Infof("test %+v=%+v", "key", "value")
}
