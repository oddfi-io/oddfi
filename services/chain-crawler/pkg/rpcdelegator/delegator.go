package rpcdelegator

import (
	"chain_crawler/pkg/consts"
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/avast/retry-go/v4"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/time/rate"
)

var rpcSummary *prometheus.SummaryVec

type Option func(*config)

type config struct {
	rpcName struct {
		ServiceName string
		MethodName  string
	}
	attempt    uint
	ctx        context.Context
	qpsLimiter *rate.Limiter
}

type stubSt[T any] struct {
	stub *T
	name string
}

type RpcDelegator[T any] struct {
	stubs      []stubSt[T]
	robinRule  IRpcRobin[T]
	defaultCfg config
}

func (o *RpcDelegator[T]) AddStub(s *T, stubName string) {
	o.stubs = append(o.stubs, stubSt[T]{s, stubName})
}

func (o *RpcDelegator[T]) AddStubs(stubs ...*T) {
	for _, s := range stubs {
		o.stubs = append(o.stubs, stubSt[T]{s, "noname"})
	}
}

func (o *RpcDelegator[T]) WithOptions(opts ...Option) {
	for _, opt := range opts {
		opt(&o.defaultCfg)
	}
}

func (o *RpcDelegator[T]) SetRobin(robin IRpcRobin[T]) {
	o.robinRule = robin
}

func (o *RpcDelegator[T]) Invoke(doFunc func(context.Context, *T) int, opts ...Option) int {
	if len(opts) == 0 {
		return o.invoke(&doFunc, &o.defaultCfg)
	} else {
		tmpOpt := o.defaultCfg
		for _, opt := range opts {
			opt(&tmpOpt)
		}
		return o.invoke(&doFunc, &tmpOpt)
	}
}

func (o *RpcDelegator[T]) invoke(pDoFunc *func(context.Context, *T) int, cfg *config) int {
	stubIdx := o.robinRule.SelectStub(o)
	if stubIdx == -1 {
		return consts.ERR_NO_STUB_AVAIL
	}

	if cfg.qpsLimiter != nil {
		var err error
		if cfg.ctx == nil {
			err = cfg.qpsLimiter.Wait(context.Background())
		} else {
			err = cfg.qpsLimiter.Wait(cfg.ctx)
		}
		if err != nil {
			return consts.ERR_LIMITER_CTX_EXCEED
		}
	}

	if cfg.attempt == 0 {
		startTm := time.Now()
		code := (*pDoFunc)(cfg.ctx, o.stubs[stubIdx].stub)
		if cfg.rpcName.ServiceName != "" {
			duration := float64(time.Since(startTm).Milliseconds())
			rpcSummary.WithLabelValues(cfg.rpcName.ServiceName, cfg.rpcName.MethodName,
				o.stubs[stubIdx].name, strconv.Itoa(code)).Observe(duration)
		}
		return code
	} else {
		var code int
		_ = retry.Do(func() error {
			startTm := time.Now()
			code = (*pDoFunc)(cfg.ctx, o.stubs[stubIdx].stub)
			if cfg.rpcName.ServiceName != "" {
				duration := float64(time.Since(startTm).Milliseconds())
				rpcSummary.WithLabelValues(cfg.rpcName.ServiceName, cfg.rpcName.MethodName,
					o.stubs[stubIdx].name, strconv.Itoa(code)).Observe(duration)
			}
			if code != 0 {
				return errors.New("")
			} else {
				return nil
			}
		},
			retry.Attempts(cfg.attempt),
			retry.LastErrorOnly(true),
		)
		return code
	}
}

func RegisterProm(reg *prometheus.Registry) {
	reg.MustRegister(rpcSummary)
}

func NewRpcDelegator[T any](opts ...Option) RpcDelegator[T] {
	r := RpcDelegator[T]{}
	r.robinRule = &RandomRobin[T]{}
	r.defaultCfg.rpcName.MethodName = "noname"
	r.WithOptions(opts...)
	return r
}

func WithContext(ctx context.Context) Option {
	return func(o *config) {
		o.ctx = ctx
	}
}

func WithAttempt(attempt uint) Option {
	return func(o *config) {
		o.attempt = attempt
	}
}

func WithLimiter(limiter *rate.Limiter) Option {
	return func(o *config) {
		o.qpsLimiter = limiter
	}
}

func WithRpcName(serviceName, methodName string) Option {
	return func(o *config) {
		o.rpcName.ServiceName = serviceName
		o.rpcName.MethodName = methodName
	}
}

func WithServiceName(serviceName string) Option {
	return func(o *config) {
		o.rpcName.ServiceName = serviceName
	}
}

func WithMethodName(methodName string) Option {
	return func(o *config) {
		o.rpcName.MethodName = methodName
	}
}

func init() {
	rpcSummary = promauto.NewSummaryVec(prometheus.SummaryOpts{
		Name: "rpc_request_cost",
		Help: "The rpc request cost(ms)",
		Objectives: map[float64]float64{
			0.5:  0.01,
			0.9:  0.01,
			0.99: 0.01},
	}, []string{"service", "method", "target", "code"})
}
