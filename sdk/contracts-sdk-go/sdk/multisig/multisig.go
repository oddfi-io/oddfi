// Package multisig exposes the BettingPool methods callable by the Gnosis
// Safe multisig role: settle, cancelMatch, batchCancelMatch,
// releaseOrForfeiture, withdrawPlatform, setMaxMarketsPerMatch,
// setRedLightThreshold, setAdmin, setLpShareBps, pause, unpause,
// reopenMarket, executeLargeWithdrawal, rejectLargeWithdrawal.
//
// Three execution modes are supported per call:
//
//   - Calldata: pack {to, value, data} client-side and return — no RPC,
//     no signer, no risk. Hand to ops to paste into Safe UI.
//   - Execute:  build Safe execTransaction(...), sign with a Safe-owner key,
//     and broadcast. Only allowed on testnet 1-of-1; mainnet is rejected.
//   - Propose:  compute safeTxHash, sign it with the proposer key, POST to
//     Safe Transaction Service. Returns a Proposal with the SafeTxHash + UI
//     link; remaining owners sign through the Safe UI.
//
// All methods additionally expose Simulate (eth_call dry-run with typed
// error parsing) so callers can check feasibility before committing to a
// mode.
//
// Construction example:
//
//	msCli, _ := multisig.New(conn,
//	    multisig.WithProposer(propSigner),
//	    multisig.WithSafeTxServiceURL(multisig.SafeTxServiceBSCMainnet),
//	)
//	prop, _ := msCli.Settle(args).Propose(ctx)
package multisig

import (
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/client"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/errs"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/multisig/safetx"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/signer"
)

// ── Errors & known URLs ──────────────────────────────────────────────────────

// SafeTxServiceBSCMainnet is the official Safe Transaction Service for
// BNB Smart Chain Mainnet. Override with WithSafeTxServiceURL if you run a
// private deployment.
const SafeTxServiceBSCMainnet = "https://safe-transaction-bsc.safe.global"

// SafeTxServiceBSCTestnet is the official Safe Transaction Service for
// BNB Smart Chain Testnet (commonly used for smoke tests; some Safe app
// versions point to mainnet only).
const SafeTxServiceBSCTestnet = "https://safe-transaction-bsc-testnet.safe.global"

// ErrModeNotConfigured is returned when a mode-specific method (Execute /
// Propose) is called without the corresponding option attached at New time.
type ErrModeNotConfigured struct{ Mode string }

func (e *ErrModeNotConfigured) Error() string {
	switch e.Mode {
	case "execute":
		return "multisig: Execute requires WithSafeOwner + WithDirectExecute(true) at New (testnet only)"
	case "propose":
		return "multisig: Propose requires WithProposer + WithSafeTxServiceURL at New"
	default:
		return fmt.Sprintf("multisig: mode %q not configured", e.Mode)
	}
}

// ErrDirectExecuteForbiddenOnMainnet is returned by New if WithDirectExecute
// is set on a Mainnet Connection.
var ErrDirectExecuteForbiddenOnMainnet = errors.New(
	"multisig: WithDirectExecute is forbidden on mainnet (use Propose or Calldata)")

// ErrProposeNotYetImplemented is retained for source compatibility with
// pre-3b callers that switched on it. Phase 3b ships the full Propose
// flow; this sentinel is no longer returned by the SDK itself.
//
// Deprecated: kept so callers can still errors.Is against it without a
// build break; nothing in the SDK now returns it.
var ErrProposeNotYetImplemented = errors.New("multisig: Propose flow not implemented (deprecated sentinel)")

// ── Client ───────────────────────────────────────────────────────────────────

// Client wraps the BettingPool binding with multisig-role helpers in three
// execution modes. Construct with New + options.
type Client struct {
	conn   *client.Connection
	bp     *bettingpool.BettingPool
	parsed *abi.ABI
	parser errs.ErrorParser

	// Execute mode
	safeOwner     signer.Signer
	directExecute bool

	// Propose mode
	proposer  signer.Signer
	safeTxURL string

	// Common
	calldataOnly bool
	txTimeout    time.Duration
	httpClient   *http.Client

	// txService is built lazily from safeTxURL + httpClient when the first
	// Propose call needs it.
	txService *safetx.Client
}

// Option configures a Client at construction time.
type Option func(*Client)

// WithSafeOwner attaches a Safe-owner key for Execute mode (1-of-1 testnet).
// Combine with WithDirectExecute(true).
func WithSafeOwner(s signer.Signer) Option { return func(c *Client) { c.safeOwner = s } }

// WithDirectExecute enables the Execute mode (Safe execTransaction broadcast).
// Mainnet rejects this at New time.
func WithDirectExecute(b bool) Option { return func(c *Client) { c.directExecute = b } }

// WithProposer attaches a key authorised to propose a SafeTx to the Safe
// Transaction Service. The proposer must be one of the Safe's owners (the
// service rejects proposals from non-owners).
func WithProposer(s signer.Signer) Option { return func(c *Client) { c.proposer = s } }

// WithSafeTxServiceURL sets the Safe Transaction Service base URL
// (no trailing slash). Defaults to "" — Propose returns ErrModeNotConfigured.
func WithSafeTxServiceURL(url string) Option { return func(c *Client) { c.safeTxURL = url } }

// WithCalldataOnly is an informational opt-in that disables Execute and
// Propose even if other options were attached. Useful as a guard against
// accidentally broadcasting in calldata-only deployments.
func WithCalldataOnly(b bool) Option { return func(c *Client) { c.calldataOnly = b } }

// WithTxTimeout caps each RPC / HTTP call. Defaults to 60s.
func WithTxTimeout(d time.Duration) Option { return func(c *Client) { c.txTimeout = d } }

// WithHTTPClient overrides the http.Client used for Propose mode.
// Defaults to a new client with the configured timeout.
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.httpClient = h } }

// New constructs a multisig Client bound to conn. Returns an error if the
// BettingPool ABI fails to parse, or if WithDirectExecute is set on a
// Mainnet Connection.
func New(conn *client.Connection, opts ...Option) (*Client, error) {
	if conn == nil {
		return nil, errors.New("multisig: nil Connection")
	}
	parsed, err := bettingpool.BettingPoolMetaData.GetAbi()
	if err != nil {
		return nil, fmt.Errorf("multisig: parse BettingPool ABI: %w", err)
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
	if c.directExecute && conn.Env().IsMainnet() {
		return nil, ErrDirectExecuteForbiddenOnMainnet
	}
	if c.httpClient == nil {
		c.httpClient = &http.Client{Timeout: c.txTimeout}
	}
	if c.safeTxURL != "" {
		c.txService = safetx.New(c.safeTxURL).
			WithHTTPClient(c.httpClient).
			WithTimeout(c.txTimeout)
	}
	return c, nil
}

// TxService exposes the underlying Safe Tx Service client (built when
// WithSafeTxServiceURL is set). Returns nil when Propose is not configured.
// Useful for callers polling proposal status with c.TxService().Get(...).
func (c *Client) TxService() *safetx.Client { return c.txService }

// SafeAddress returns the on-chain Safe address recorded in Connection's
// startup snapshot.
func (c *Client) SafeAddress() common.Address { return c.conn.OnchainMultisig() }

// ProposerAddress returns the proposer's address, or zero if no proposer
// was attached.
func (c *Client) ProposerAddress() common.Address {
	if c.proposer == nil {
		return common.Address{}
	}
	return c.proposer.Address()
}

// SafeOwnerAddress returns the Execute-mode signer's address, or zero.
func (c *Client) SafeOwnerAddress() common.Address {
	if c.safeOwner == nil {
		return common.Address{}
	}
	return c.safeOwner.Address()
}

// CalldataPacket is the {to, value, data} triple every multisig method can
// emit. Operation is always Call (=0) for our use.
type CalldataPacket struct {
	To        common.Address
	Value     *big.Int
	Data      []byte
	Operation uint8 // 0 = Call (Safe enum), kept for explicitness
}
