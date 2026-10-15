// Package reader exposes BettingPool view methods and the three-layer event
// surface:
//
//   - Layer 0: BettingPool() and Filterer() return the abigen objects for
//     full control.
//   - Layer 1: FilterEvents(ctx, FilterOpts) runs eth_getLogs against the
//     configured BettingPool address and returns a slice of decoded *Event.
//     Hides bind.FilterOpts pitfalls.
//   - Layer 2: Stream(ctx, StreamOpts) returns an EventStream that handles
//     historical backfill (paginated eth_getLogs) and live polling
//     transparently. Surfaces non-fatal errors on a side channel.
package reader

import (
	"context"
	"errors"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/erc20"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/client"
)

var errNilConn = errors.New("reader: nil Connection")

// Client is the read-only view onto the BettingPool + USDT contracts.
// All methods take a context.Context as their first argument.
type Client struct {
	conn     *client.Connection
	bp       *bettingpool.BettingPool
	usdt     *erc20.ERC20
	filterer *bettingpool.BettingPoolFilterer
}

// New returns a Reader bound to the given Connection.
func New(conn *client.Connection) (*Client, error) {
	if conn == nil {
		return nil, errNilConn
	}
	usdt, err := erc20.NewERC20(conn.USDTAddr(), conn.EthClient())
	if err != nil {
		return nil, err
	}
	filterer, err := bettingpool.NewBettingPoolFilterer(conn.BettingPoolAddr(), conn.EthClient())
	if err != nil {
		return nil, err
	}
	return &Client{
		conn:     conn,
		bp:       conn.BettingPool(),
		usdt:     usdt,
		filterer: filterer,
	}, nil
}

// Filterer exposes the abigen-generated event filter object for Layer 0
// access (callers can use raw FilterXxx / WatchXxx / ParseXxx methods).
func (c *Client) Filterer() *bettingpool.BettingPoolFilterer { return c.filterer }

// BettingPool exposes the abigen binding for callers that need to use
// methods this Reader has not yet wrapped (Layer 0 escape hatch).
func (c *Client) BettingPool() *bettingpool.BettingPool { return c.bp }

// USDT exposes the underlying ERC20 binding.
func (c *Client) USDT() *erc20.ERC20 { return c.usdt }

// Connection returns the underlying connection.
func (c *Client) Connection() *client.Connection { return c.conn }

// callOpts builds a CallOpts honouring ctx.
func callOpts(ctx context.Context) *bind.CallOpts {
	return &bind.CallOpts{Context: ctx}
}

// ── Convenience wrappers (BettingPool reads) ─────────────────────────────────

// Admin returns the on-chain admin address right now (live; differs from
// Connection.OnchainAdmin which is the snapshot at startup).
func (c *Client) Admin(ctx context.Context) (common.Address, error) {
	return c.bp.Admin(callOpts(ctx))
}

// Multisig returns the on-chain multisig address right now.
func (c *Client) Multisig(ctx context.Context) (common.Address, error) {
	return c.bp.Multisig(callOpts(ctx))
}

// Paused reports whether the contract is currently paused.
func (c *Client) Paused(ctx context.Context) (bool, error) {
	return c.bp.Paused(callOpts(ctx))
}

// PlatformBalance returns the platform's accumulated USDT balance held
// by the contract (un-withdrawn fees / cuts).
func (c *Client) PlatformBalance(ctx context.Context) (*big.Int, error) {
	return c.bp.PlatformBalance(callOpts(ctx))
}

// LockedBalance returns the amount of `user`'s USDT currently locked in
// pending bets (cannot withdraw).
func (c *Client) LockedBalance(ctx context.Context, user common.Address) (*big.Int, error) {
	return c.bp.LockedBalances(callOpts(ctx), user)
}

// LpShares returns the LP shares held by `provider`.
func (c *Client) LpShares(ctx context.Context, provider common.Address) (*big.Int, error) {
	return c.bp.LpShares(callOpts(ctx), provider)
}

// IsAccepting reports whether the (matchId, market, line, outcome) bucket
// is open for new bets.
func (c *Client) IsAccepting(ctx context.Context, matchID [32]byte, market, line, outcome uint8) (bool, error) {
	return c.bp.IsAccepting(callOpts(ctx), matchID, market, line, outcome)
}

// ── Convenience wrappers (USDT reads) ────────────────────────────────────────

// USDTBalance returns the USDT balance of `holder` on the configured token.
func (c *Client) USDTBalance(ctx context.Context, holder common.Address) (*big.Int, error) {
	return c.usdt.BalanceOf(callOpts(ctx), holder)
}

// USDTAllowance returns the ERC-20 allowance from owner→spender.
func (c *Client) USDTAllowance(ctx context.Context, owner, spender common.Address) (*big.Int, error) {
	return c.usdt.Allowance(callOpts(ctx), owner, spender)
}
