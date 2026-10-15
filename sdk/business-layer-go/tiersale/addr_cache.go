// addr_cache.go — in-process user_id → Magic EOA resolution with a permanent
// cache. Self-contained copy of the relay equivalent (this package does not
// depend on relay).
//
// Magic EOAs are deterministic and immutable per (chain, user_id), so once
// resolved an address never changes — that makes an unbounded, never-expiring
// in-process cache both safe and simple. The key is namespaced by chain_id to
// prevent cross-chain collision if a single process drives more than one chain.

package tiersale

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
// before falling back to a magic WalletAddress lookup. Lookup failures are
// surfaced via the standard magic error taxonomy and are NOT cached.
func (c *Client) resolveUserAddr(ctx context.Context, op, userID string) (common.Address, error) {
	if userID == "" {
		return common.Address{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("empty UserID"))
	}

	chainID, err := c.getChainID(ctx)
	if err != nil {
		return common.Address{}, err
	}
	key := addrCacheKey(chainID, userID)
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

func (c *Client) logResolved(op, userID string, addr common.Address, cached bool) {
	c.log.Info("tiersale.resolve user addr",
		zap.String("method", op),
		zap.String("user_id", userID),
		zap.String("user_addr", addr.Hex()),
		zap.Bool("cached", cached),
	)
}
