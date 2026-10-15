package addrcache

import (
	"strconv"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
)

func TestCache_GetMiss(t *testing.T) {
	c := New("test", time.Hour, 100)
	_, ok := c.Get("nobody")
	require.False(t, ok)
}

func TestCache_PutGet(t *testing.T) {
	c := New("test", time.Hour, 100)
	want := common.HexToAddress("0x1234567890123456789012345678901234567890")
	c.Put("u1", want)
	got, ok := c.Get("u1")
	require.True(t, ok)
	require.Equal(t, want, got)
}

func TestCache_TTLExpiry(t *testing.T) {
	c := New("test", 50*time.Millisecond, 100)
	addr := common.HexToAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")
	c.Put("u", addr)
	got, ok := c.Get("u")
	require.True(t, ok)
	require.Equal(t, addr, got)

	time.Sleep(80 * time.Millisecond)
	_, ok = c.Get("u")
	require.False(t, ok, "entry should have expired")
}

func TestCache_LRUEviction(t *testing.T) {
	c := New("test", time.Hour, 3) // max 3 entries
	addrs := []common.Address{
		common.HexToAddress("0x1111111111111111111111111111111111111111"),
		common.HexToAddress("0x2222222222222222222222222222222222222222"),
		common.HexToAddress("0x3333333333333333333333333333333333333333"),
		common.HexToAddress("0x4444444444444444444444444444444444444444"),
	}
	for i, a := range addrs[:3] {
		c.Put(strconv.Itoa(i), a)
	}
	// Touch the oldest (id "0") to move it to front.
	got, ok := c.Get("0")
	require.True(t, ok)
	require.Equal(t, addrs[0], got)

	// Insert one more — should evict the new oldest, which is "1".
	c.Put("3", addrs[3])

	_, ok = c.Get("1")
	require.False(t, ok, "user 1 should have been evicted")
	_, ok = c.Get("0")
	require.True(t, ok)
	_, ok = c.Get("2")
	require.True(t, ok)
	_, ok = c.Get("3")
	require.True(t, ok)
}

func TestCache_EnvNamespacing(t *testing.T) {
	prodCache := New("prod", time.Hour, 100)
	testCache := New("test", time.Hour, 100)

	prodAddr := common.HexToAddress("0x1111111111111111111111111111111111111111")
	testAddr := common.HexToAddress("0x2222222222222222222222222222222222222222")
	prodCache.Put("user-99", prodAddr)
	testCache.Put("user-99", testAddr)

	got1, _ := prodCache.Get("user-99")
	got2, _ := testCache.Get("user-99")
	require.Equal(t, prodAddr, got1)
	require.Equal(t, testAddr, got2)
}
