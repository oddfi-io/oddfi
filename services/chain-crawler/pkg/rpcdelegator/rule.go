package rpcdelegator

import (
	"math/rand/v2"
	"sync/atomic"
)

type IRpcRobin[T any] interface {
	SelectStub(clt *RpcDelegator[T]) int
}

type RoundRobin[T any] struct {
	idx int32
}

func (o *RoundRobin[T]) SelectStub(clt *RpcDelegator[T]) int {
	if len(clt.stubs) == 0 {
		return -1
	} else {
		idx := atomic.LoadInt32(&o.idx)
		atomic.StoreInt32(&o.idx, int32((int(idx)+1)%len(clt.stubs)))
		return int(idx)
	}
}

type RandomRobin[T any] struct {
}

func (o *RandomRobin[T]) SelectStub(clt *RpcDelegator[T]) int {
	if len(clt.stubs) == 0 {
		return -1
	} else {
		return rand.IntN(len(clt.stubs))
	}
}
