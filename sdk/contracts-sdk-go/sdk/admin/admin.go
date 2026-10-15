// Package admin exposes the BettingPool methods callable by the admin role:
// creditDeposit, lockBet, lockCreditBet, lockParlay, unlockBet, unlockParlay,
// updateSignal, openMarket, closeMarket, batch variants.
//
// Each write method has a SimulateXxx counterpart that performs an eth_call
// dry-run, parses any revert into a typed *errs.ContractError, and never
// broadcasts. Recommended pattern:
//
//	if err := admin.SimulateLockBet(ctx, args); err != nil { return err }
//	tx, err := admin.LockBet(ctx, args)
package admin

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/client"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/errs"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/signer"
)

// ── Errors ───────────────────────────────────────────────────────────────────

// ErrNoSigner is returned when a write method is called without a signer
// configured. Use admin.WithSigner(...) when constructing the Client.
var ErrNoSigner = errors.New("admin: no signer configured (use WithSigner)")

// ── Client ───────────────────────────────────────────────────────────────────

// Client wraps the BettingPool binding with admin-role helpers.
//
// Concurrency: safe to share across goroutines for read paths and Simulate;
// write methods serialise themselves only as far as the underlying RPC nonce
// fetch + signer do. If you need stricter ordering, wrap calls in your own
// mutex or use distinct Clients per worker.
type Client struct {
	conn   *client.Connection
	bp     *bettingpool.BettingPool
	signer signer.Signer
	parsed *abi.ABI
	parser errs.ErrorParser

	gasLimit  uint64
	gasFeeCap *big.Int
	gasTipCap *big.Int
	txTimeout time.Duration

	// readerCli holds a lazily-created sdk/reader Client for the optional
	// adminCli.Reader() escape hatch. We don't import sdk/reader directly
	// to keep package boundaries clean; callers that want reads should
	// construct their own reader.New(conn).
}

// Option configures a Client at construction time.
type Option func(*Client)

// WithSigner attaches the signing identity. Required for any write method;
// Simulate works without one (uses zero-address From).
func WithSigner(s signer.Signer) Option { return func(c *Client) { c.signer = s } }

// WithGasLimit overrides the auto-estimated gas limit. Pass 0 to keep auto.
func WithGasLimit(g uint64) Option { return func(c *Client) { c.gasLimit = g } }

// WithGasFeeCap overrides the EIP-1559 max fee per gas. Pass nil for default.
func WithGasFeeCap(g *big.Int) Option { return func(c *Client) { c.gasFeeCap = g } }

// WithGasTipCap overrides the EIP-1559 priority fee. Pass nil for default.
func WithGasTipCap(g *big.Int) Option { return func(c *Client) { c.gasTipCap = g } }

// WithTxTimeout caps each write/simulate RPC call. Defaults to 60s.
func WithTxTimeout(d time.Duration) Option { return func(c *Client) { c.txTimeout = d } }

// New constructs an admin Client bound to conn. Returns an error if the
// BettingPool ABI fails to parse (should never happen with abigen-generated
// bindings).
func New(conn *client.Connection, opts ...Option) (*Client, error) {
	if conn == nil {
		return nil, errors.New("admin: nil Connection")
	}
	parsed, err := bettingpool.BettingPoolMetaData.GetAbi()
	if err != nil {
		return nil, fmt.Errorf("admin: parse BettingPool ABI: %w", err)
	}
	c := &Client{
		conn:      conn,
		bp:        conn.BettingPool(),
		parsed:    parsed,
		parser:    errs.NewABIParser(*parsed),
		txTimeout: 60 * time.Second,
	}
	for _, o := range opts {
		o(c)
	}
	return c, nil
}

// Address returns the signer's address, or zero if no signer is set.
func (c *Client) Address() common.Address {
	if c.signer == nil {
		return common.Address{}
	}
	return c.signer.Address()
}

// ── Internal helpers ─────────────────────────────────────────────────────────

// transactOpts builds bind.TransactOpts using the configured signer.
//
// Nonce is taken from PendingNonceAt; gas params honour Client overrides if
// set, otherwise are left nil so the binding falls back to the RPC's
// suggestion (eth_estimateGas / eth_gasPrice).
func (c *Client) transactOpts(ctx context.Context) (*bind.TransactOpts, error) {
	if c.signer == nil {
		return nil, ErrNoSigner
	}
	chainID := c.conn.ChainID()
	from := c.signer.Address()

	// Apply tx timeout if caller didn't set one.
	if _, hasDeadline := ctx.Deadline(); !hasDeadline && c.txTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.txTimeout)
		// We can't defer cancel here — opts.Context outlives this fn. Stash
		// the cancel by attaching it via the noCancel sentinel below.
		_ = cancel // intentionally not deferred; the binding will return when RPC returns
	}

	nonce, err := c.conn.EthClient().PendingNonceAt(ctx, from)
	if err != nil {
		return nil, fmt.Errorf("admin: pending nonce: %w", err)
	}

	opts := &bind.TransactOpts{
		From:    from,
		Nonce:   new(big.Int).SetUint64(nonce),
		Context: ctx,
		Signer: func(addr common.Address, tx *types.Transaction) (*types.Transaction, error) {
			if addr != from {
				return nil, fmt.Errorf("admin: signer address mismatch: tx.From=%s signer=%s",
					addr.Hex(), from.Hex())
			}
			return c.signer.SignTx(ctx, tx, chainID)
		},
	}
	if c.gasLimit > 0 {
		opts.GasLimit = c.gasLimit
	}
	if c.gasFeeCap != nil {
		opts.GasFeeCap = c.gasFeeCap
	}
	if c.gasTipCap != nil {
		opts.GasTipCap = c.gasTipCap
	}
	return opts, nil
}

// simulateCall packs (methodName, args...) against the BettingPool ABI, runs
// eth_call, and parses any revert into a typed error. Caller's ctx wins over
// the Client tx timeout (matches transactOpts behavior for symmetry).
func (c *Client) simulateCall(ctx context.Context, methodName string, args ...interface{}) error {
	method, ok := c.parsed.Methods[methodName]
	if !ok {
		return fmt.Errorf("admin: method %q not in BettingPool ABI", methodName)
	}
	tail, err := method.Inputs.Pack(args...)
	if err != nil {
		return fmt.Errorf("admin: pack %s args: %w", methodName, err)
	}
	data := append(append([]byte{}, method.ID...), tail...)

	var from common.Address
	if c.signer != nil {
		from = c.signer.Address()
	}
	to := c.conn.BettingPoolAddr()

	if _, hasDeadline := ctx.Deadline(); !hasDeadline && c.txTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.txTimeout)
		defer cancel()
	}

	if _, err := c.conn.EthClient().CallContract(ctx, ethereum.CallMsg{
		From: from,
		To:   &to,
		Data: data,
	}, nil); err != nil {
		return errs.Wrap(err, methodName, c.parser)
	}
	return nil
}

// wrapWriteErr converts a binding error into a typed ContractError when
// possible. Used by every write wrapper.
func (c *Client) wrapWriteErr(err error, methodName string) error {
	return errs.Wrap(err, methodName, c.parser)
}
