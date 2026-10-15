package relay

import (
	"context"
	"errors"
	"math/big"
	"sync"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// newResolverClient builds a minimal *Client carrying only what resolveUserAddr
// touches (cfg.ChainID, signer, addrCache, log). It deliberately bypasses New()
// so the unit test needs no RPC / SDK / DB.
func newResolverClient(chainID int64, ms *mockSigner) *Client {
	return &Client{
		cfg:       Config{ChainID: big.NewInt(chainID)},
		signer:    ms,
		addrCache: &userAddrCache{},
		log:       zap.NewNop(),
	}
}

// ─── addrCacheKey: chain_id MUST be part of the key ──────────────────────────

func TestAddrCacheKey_IncludesChainID(t *testing.T) {
	k56 := addrCacheKey(big.NewInt(56), "user-1")
	k97 := addrCacheKey(big.NewInt(97), "user-1")

	if k56 == k97 {
		t.Fatalf("key must differ per chain_id: both = %q", k56)
	}
	if want := "56:user-1"; k56 != want {
		t.Errorf("k56 = %q, want %q", k56, want)
	}
	if want := "97:user-1"; k97 != want {
		t.Errorf("k97 = %q, want %q", k97, want)
	}
}

// ─── empty userID is a param error ───────────────────────────────────────────

func TestResolveUserAddr_EmptyUserID(t *testing.T) {
	ms := &mockSigner{addr: common.HexToAddress("0xBB")}
	c := newResolverClient(97, ms)

	_, err := c.resolveUserAddr(context.Background(), "PlaceBet", "")
	if err == nil {
		t.Fatal("expected error for empty UserID")
	}
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Errorf("want ErrParamInvalid, got %v", err)
	}
}

// ─── miss resolves via magic and caches; hit skips magic ─────────────────────

func TestResolveUserAddr_MissThenHit(t *testing.T) {
	want := common.HexToAddress("0x00000000000000000000000000000000000000CC")
	ms := &mockSigner{addr: want}
	c := newResolverClient(97, ms)
	ctx := context.Background()

	// First call: cache miss → one WalletAddress call → cached.
	got1, err := c.resolveUserAddr(ctx, "PlaceBet", "user-1")
	if err != nil {
		t.Fatalf("first call error: %v", err)
	}
	if got1 != want {
		t.Errorf("first call got %s, want %s", got1.Hex(), want.Hex())
	}
	if len(ms.gotWalletID) != 1 {
		t.Fatalf("first call must hit magic exactly once; calls = %v", ms.gotWalletID)
	}

	// Second call: cache hit → NO further WalletAddress call.
	got2, err := c.resolveUserAddr(ctx, "PlaceBet", "user-1")
	if err != nil {
		t.Fatalf("second call error: %v", err)
	}
	if got2 != want {
		t.Errorf("second call got %s, want %s", got2.Hex(), want.Hex())
	}
	if len(ms.gotWalletID) != 1 {
		t.Errorf("second call must be served from cache; total magic calls = %d, want 1", len(ms.gotWalletID))
	}
}

// ─── magic failure is NOT cached: next call retries ──────────────────────────

func TestResolveUserAddr_ErrorNotCached(t *testing.T) {
	ms := &mockSigner{walletErr: errors.New("magic down")}
	c := newResolverClient(97, ms)
	ctx := context.Background()

	if _, err := c.resolveUserAddr(ctx, "PlaceBet", "user-1"); err == nil {
		t.Fatal("expected error on magic failure")
	}
	if _, ok := c.addrCache.load(addrCacheKey(c.cfg.ChainID, "user-1")); ok {
		t.Fatal("failed resolution must not be cached")
	}

	// Recover: magic now works → second call retries and succeeds.
	want := common.HexToAddress("0xDD")
	ms.walletErr = nil
	ms.addr = want
	got, err := c.resolveUserAddr(ctx, "PlaceBet", "user-1")
	if err != nil {
		t.Fatalf("retry after recovery error: %v", err)
	}
	if got != want {
		t.Errorf("retry got %s, want %s", got.Hex(), want.Hex())
	}
	if len(ms.gotWalletID) != 2 {
		t.Errorf("expected 2 magic calls (fail + retry), got %d", len(ms.gotWalletID))
	}
}

// ─── every resolution logs method → user_id → resolved address ──────────────

func TestResolveUserAddr_LogsMethodAndAddr(t *testing.T) {
	core, recorded := observer.New(zapcore.InfoLevel)
	want := common.HexToAddress("0x00000000000000000000000000000000000000FE")
	ms := &mockSigner{addr: want}
	c := &Client{
		cfg:       Config{ChainID: big.NewInt(97)},
		signer:    ms,
		addrCache: &userAddrCache{},
		log:       zap.New(core),
	}

	// Cache miss → resolved via magic → must log method, user_id, addr, cached=false.
	if _, err := c.resolveUserAddr(context.Background(), "Stake", "user-1"); err != nil {
		t.Fatalf("resolve (miss): %v", err)
	}
	entries := recorded.All()
	if len(entries) != 1 {
		t.Fatalf("expected 1 log entry after miss, got %d: %+v", len(entries), entries)
	}
	f := entries[0].ContextMap()
	if f["method"] != "Stake" {
		t.Errorf("method = %v, want Stake", f["method"])
	}
	if f["user_id"] != "user-1" {
		t.Errorf("user_id = %v, want user-1", f["user_id"])
	}
	if f["user_addr"] != want.Hex() {
		t.Errorf("user_addr = %v, want %s", f["user_addr"], want.Hex())
	}
	if f["cached"] != false {
		t.Errorf("cached = %v, want false on first lookup", f["cached"])
	}

	// Cache hit → still logs, this time cached=true, same method label preserved.
	if _, err := c.resolveUserAddr(context.Background(), "Approve", "user-1"); err != nil {
		t.Fatalf("resolve (hit): %v", err)
	}
	entries = recorded.All()
	if len(entries) != 2 {
		t.Fatalf("expected 2 log entries after hit, got %d", len(entries))
	}
	f = entries[1].ContextMap()
	if f["method"] != "Approve" {
		t.Errorf("method = %v, want Approve", f["method"])
	}
	if f["cached"] != true {
		t.Errorf("cached = %v, want true on second lookup", f["cached"])
	}
}

// ─── concurrent access is race-free (run with -race) ─────────────────────────

func TestResolveUserAddr_ConcurrentSafe(t *testing.T) {
	ms := &mockSigner{addr: common.HexToAddress("0xEE")}
	c := newResolverClient(97, ms)
	ctx := context.Background()

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := c.resolveUserAddr(ctx, "PlaceBet", "user-1"); err != nil {
				t.Errorf("concurrent resolve error: %v", err)
			}
		}()
	}
	wg.Wait()
}
