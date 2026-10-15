package rpcdelegator

import (
	"chain_crawler/pkg/consts"
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"golang.org/x/time/rate"
)

func TestRpcDelegator_Robin(t *testing.T) {
	rd := NewRpcDelegator[string](WithRpcName("srv1", "methodA"))
	stubs := []string{"stub1", "stub2", "stub3"}
	rd.AddStubs(&stubs[0], &stubs[1], &stubs[2])
	for i := 0; i < 10; i++ {
		ret := rd.Invoke(func(ctx context.Context, stub *string) int {
			t.Logf("call %v", *stub)
			return 0
		})
		t.Logf("retcode %v", ret)
	}
}

func TestRpcDelegator_Limiter(t *testing.T) {
	li := rate.NewLimiter(1, 1)
	rd := NewRpcDelegator[string](WithLimiter(li))

	stubs := []string{"stub1", "stub2", "stub3"}
	rd.AddStubs(&stubs[0], &stubs[1], &stubs[2])
	rd.SetRobin(&RoundRobin[string]{})

	ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
	//cancel()
	for i := 0; i < 10; i++ {
		ret := rd.Invoke(func(ctx context.Context, stub *string) int {
			t.Logf("call %v", *stub)
			return 0
		}, WithContext(ctx))
		t.Logf("retcode %v", ret)
		if i < 5 {
			assert.Equal(t, 0, ret)
		} else {
			assert.Equal(t, consts.ERR_LIMITER_CTX_EXCEED, ret)
		}
	}
}

func TestRpcDelegator_Attempt(t *testing.T) {
	rd := NewRpcDelegator[string](WithAttempt(2))

	stubs := []string{"stub1", "stub2", "stub3"}
	rd.AddStubs(&stubs[0], &stubs[1], &stubs[2])

	n := 1
	ret := rd.Invoke(func(ctx context.Context, stub *string) int {
		t.Logf("call %v n=%v", *stub, n)
		defer func() { n++ }()
		if n != 3 {
			return -n
		} else {
			return 0
		}
	},
	)
	t.Logf("retcode %v", ret)
	assert.Equal(t, -2, ret)

	m := 1
	ret = rd.Invoke(func(ctx context.Context, stub *string) int {
		t.Logf("call %v m=%v", *stub, m)
		defer func() { m++ }()
		if m != 3 {
			return -m
		} else {
			return 0
		}
	},
		WithAttempt(3),
	)
	t.Logf("retcode %v", ret)
	assert.Equal(t, 0, ret)
}
