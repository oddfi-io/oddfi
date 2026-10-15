// addr_cache.go — in-process user_id → Magic EOA resolution with a permanent
// cache.
//
// Why this exists: relay methods identify the user by their Magic user_id, but
// the on-chain pathway needs the user's EOA address. Magic EOAs are
// deterministic and immutable per (chain, user_id), so once resolved an address
// never changes — that makes an unbounded, never-expiring in-process cache both
// safe and simple. The cache key is namespaced by chain_id to prevent any
// cross-chain collision if a single process ever drives more than one chain.
//
// Resolution order (cache-aside):
//   1. process cache hit;
//   2. magic WalletAddress lookup → cached on success only.
//
// A failed lookup is never cached, so the next call retries cleanly.

package relay

import (
	"context"
	"math/big"
	"sync"

	"github.com/ethereum/go-ethereum/common"
	"go.uber.org/zap"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// userAddrCache is a thread-safe, unbounded, never-expiring map of
// chain-namespaced user_id → EOA. Safe for concurrent use.
type userAddrCache struct {
	m sync.Map // key string (see addrCacheKey) → common.Address
}

// addrCacheKey namespaces the cache entry by chain_id so the same user_id on
// two different chains can never collide.
func addrCacheKey(chainID *big.Int, userID string) string {
	return chainID.String() + ":" + userID
}

func (u *userAddrCache) load(key string) (common.Address, bool) {
	v, ok := u.m.Load(key)
	if !ok {
		return common.Address{}, false
	}
	return v.(common.Address), true
}

func (u *userAddrCache) store(key string, addr common.Address) {
	u.m.Store(key, addr)
}

// resolveUserAddr returns the EOA for userID, consulting the process cache
// before falling back to a magic WalletAddress lookup.
//
//   - cache hit   → returned from memory (no network call);
//   - cache miss  → signer.WalletAddress(userID), cached on success.
//
// userID is required; an empty userID is a param error. Lookup failures are
// surfaced via the standard magic error taxonomy and are NOT cached.
func (c *Client) resolveUserAddr(ctx context.Context, op, userID string) (common.Address, error) {
	if userID == "" {
		return common.Address{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("empty UserID"))
	}

	key := addrCacheKey(c.cfg.ChainID, userID)
	if addr, ok := c.addrCache.load(key); ok {
		c.logResolved(op, userID, addr, true)
		return addr, nil
	}

	addr, err := c.signer.WalletAddress(ctx, userID)
	if err != nil {
		return common.Address{}, wrapMagicErr(op+".WalletAddress", err)
	}
	c.addrCache.store(key, addr)
	c.logResolved(op, userID, addr, false)
	return addr, nil
}

// logResolved emits one line per relay method call recording which method
// resolved which user_id to which EOA, and whether it was served from the
// process cache. Silent when no logger is configured (c.log is a no-op).
func (c *Client) logResolved(op, userID string, addr common.Address, cached bool) {
	c.log.Info("relay.resolve user addr",
		zap.String("method", op),
		zap.String("user_id", userID),
		zap.String("user_addr", addr.Hex()),
		zap.Bool("cached", cached),
	)
}
