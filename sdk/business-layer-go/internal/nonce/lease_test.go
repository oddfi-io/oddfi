package nonce_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/nonce"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/testdb"
)

type fakeEth struct{ next uint64 }

func (f *fakeEth) PendingNonceAt(ctx context.Context, addr common.Address) (uint64, error) {
	return atomic.AddUint64(&f.next, 1) - 1, nil
}

type errEth struct{ err error }

func (e *errEth) PendingNonceAt(ctx context.Context, addr common.Address) (uint64, error) {
	return 0, e.err
}

func TestLease_EnsureRow(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	l := nonce.New(db, &fakeEth{}, common.HexToAddress("0x1"))
	require.NoError(t, l.EnsureRow(context.Background()))
	require.NoError(t, l.EnsureRow(context.Background())) // idempotent
}

func TestLease_WithLockedNonce_Serializes(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	addr := common.HexToAddress("0xCAFE")
	eth := &fakeEth{}
	l := nonce.New(db, eth, addr)
	require.NoError(t, l.EnsureRow(context.Background()))

	const N = 10
	nonces := make([]uint64, N)
	var wg sync.WaitGroup
	wg.Add(N)
	for i := 0; i < N; i++ {
		i := i
		go func() {
			defer wg.Done()
			require.NoError(t, l.WithLockedNonce(context.Background(), func(tx *gorm.DB, nn uint64) error {
				nonces[i] = nn
				return nil
			}))
		}()
	}
	wg.Wait()

	seen := map[uint64]bool{}
	for _, n := range nonces {
		require.False(t, seen[n], "nonce %d seen twice", n)
		seen[n] = true
	}
}

func TestLease_RPCError_RollsBack(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	addr := common.HexToAddress("0xBEEF")
	rpcErr := errors.New("rpc dead")
	l := nonce.New(db, &errEth{err: rpcErr}, addr)
	require.NoError(t, l.EnsureRow(context.Background()))

	err := l.WithLockedNonce(context.Background(), func(tx *gorm.DB, nn uint64) error {
		t.Fatal("fn should not run when PendingNonceAt fails")
		return nil
	})
	var rpc *coretypes.ErrRPC
	require.True(t, errors.As(err, &rpc))
	require.ErrorIs(t, err, rpcErr)
}
