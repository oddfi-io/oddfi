// Package client provides Connection — the single entry point that holds the
// RPC client, chain id, contract addresses (loaded from embedded per-environment
// config), and the result of startup-time consistency checks against on-chain
// admin/multisig roles.
//
// Role packages (admin, multisig, reader) are constructed from a *Connection
// plus role-specific options.
package client

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/url"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/config"
)

// ErrRPCRequired is returned when ConnectionConfig.RPC is empty.
// No default RPC is shipped — mainnet must explicitly choose its endpoint.
var ErrRPCRequired = errors.New("client: ConnectionConfig.RPC is required (no default)")

// ErrChainIDMismatch is returned when the RPC reports a chain id that does
// not match the embedded config for the requested env.
type ErrChainIDMismatch struct {
	Want int64
	Got  int64
	Env  Env
}

func (e *ErrChainIDMismatch) Error() string {
	return fmt.Sprintf("client: rpc chain id %d != expected %d for env %s", e.Got, e.Want, e.Env)
}

// ErrRoleMismatch is returned (mainnet by default) when the on-chain admin or
// multisig differs from the SDK's expectedRoles entry. Pass the corresponding
// AllowXxxMismatch option to downgrade to a WARN log.
type ErrRoleMismatch struct {
	Role     string         // "admin" or "multisig"
	Expected common.Address
	Onchain  common.Address
	Env      Env
}

func (e *ErrRoleMismatch) Error() string {
	return fmt.Sprintf("client: on-chain %s = %s differs from expected %s (env %s)",
		e.Role, e.Onchain.Hex(), e.Expected.Hex(), e.Env)
}

// ConnectionConfig holds runtime parameters for building a Connection.
type ConnectionConfig struct {
	// Env selects which embedded config file to load. Required.
	Env Env

	// RPC is the JSON-RPC endpoint URL. Required, no default.
	RPC string

	// AllowAdminMismatch downgrades a mainnet admin mismatch from ERROR to WARN.
	// Useful only during admin rotation; leave false in normal operation.
	AllowAdminMismatch bool

	// AllowMultisigMismatch is the multisig counterpart.
	AllowMultisigMismatch bool

	// AddressOverride lets a caller substitute contract addresses without
	// changing the embedded config. Currently recognised keys: "bettingPool".
	// Use sparingly — every override is logged with a WARN audit line.
	AddressOverride map[string]common.Address

	// Logger receives startup INFO/WARN lines. Defaults to slog.Default().
	Logger *slog.Logger

	// HTTPTimeout caps each RPC call. Defaults to 30s.
	HTTPTimeout time.Duration
}

// Connection is the immutable per-process root holding RPC + addresses +
// startup checks. Safe for concurrent use.
type Connection struct {
	env             Env
	envCfg          *config.EnvConfig
	rpcURL          string
	eth             *ethclient.Client
	chainID         *big.Int
	bp              *bettingpool.BettingPool
	bpAddr          common.Address
	usdtAddr        common.Address
	onchainAdmin    common.Address
	onchainMultisig common.Address
	logger          *slog.Logger
	httpTimeout     time.Duration
}

// NewConnection dials the RPC, loads the embedded env config, verifies the
// chain id, pulls the on-chain admin/multisig and compares them to the
// expected roles, then returns a ready Connection. Mismatches are ERROR on
// mainnet and WARN on testnet by default; the AllowXxxMismatch options can
// flip those individually.
func NewConnection(cfg ConnectionConfig) (*Connection, error) {
	if cfg.RPC == "" {
		return nil, ErrRPCRequired
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	timeout := cfg.HTTPTimeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	envCfg, err := config.Load(cfg.Env.String())
	if err != nil {
		return nil, err
	}

	dialCtx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	eth, err := ethclient.DialContext(dialCtx, cfg.RPC)
	if err != nil {
		return nil, fmt.Errorf("client: dial rpc: %w", err)
	}

	chainID, err := eth.ChainID(dialCtx)
	if err != nil {
		eth.Close()
		return nil, fmt.Errorf("client: query chain id: %w", err)
	}
	if chainID.Int64() != envCfg.ChainID {
		eth.Close()
		return nil, &ErrChainIDMismatch{Want: envCfg.ChainID, Got: chainID.Int64(), Env: cfg.Env}
	}

	// Resolve effective contract addresses (override > config).
	bpAddr := envCfg.BettingPoolAddress()
	if v, ok := cfg.AddressOverride["bettingPool"]; ok {
		logger.Warn("client: bettingPool address overridden, audit trail",
			"override", v.Hex(), "shipped", bpAddr.Hex(), "env", cfg.Env.String())
		bpAddr = v
	}
	usdtAddr := envCfg.USDTAddress()
	if v, ok := cfg.AddressOverride["usdt"]; ok {
		logger.Warn("client: usdt address overridden, audit trail",
			"override", v.Hex(), "shipped", usdtAddr.Hex(), "env", cfg.Env.String())
		usdtAddr = v
	}

	bp, err := bettingpool.NewBettingPool(bpAddr, eth)
	if err != nil {
		eth.Close()
		return nil, fmt.Errorf("client: bind BettingPool: %w", err)
	}

	callOpts := &bind.CallOpts{Context: dialCtx}
	onchainAdmin, err := bp.Admin(callOpts)
	if err != nil {
		eth.Close()
		return nil, fmt.Errorf("client: read on-chain admin: %w", err)
	}
	onchainMultisig, err := bp.Multisig(callOpts)
	if err != nil {
		eth.Close()
		return nil, fmt.Errorf("client: read on-chain multisig: %w", err)
	}

	if err := checkRole(cfg, "admin", envCfg.ExpectedAdmin(), onchainAdmin, cfg.AllowAdminMismatch, logger); err != nil {
		eth.Close()
		return nil, err
	}
	if err := checkRole(cfg, "multisig", envCfg.ExpectedMultisig(), onchainMultisig, cfg.AllowMultisigMismatch, logger); err != nil {
		eth.Close()
		return nil, err
	}

	logger.Info("oddfi-sdk connection ready",
		"env", cfg.Env.String(),
		"chainId", chainID.Int64(),
		"rpc", redactRPC(cfg.RPC),
		"bettingPool", bpAddr.Hex(),
		"usdt", usdtAddr.Hex(),
		"admin(onchain)", onchainAdmin.Hex(),
		"multisig(onchain)", onchainMultisig.Hex(),
	)

	return &Connection{
		env:             cfg.Env,
		envCfg:          envCfg,
		rpcURL:          cfg.RPC,
		eth:             eth,
		chainID:         chainID,
		bp:              bp,
		bpAddr:          bpAddr,
		usdtAddr:        usdtAddr,
		onchainAdmin:    onchainAdmin,
		onchainMultisig: onchainMultisig,
		logger:          logger,
		httpTimeout:     timeout,
	}, nil
}

// checkRole compares expected vs on-chain. expected==zero means the SDK has
// no opinion (e.g. mainnet config not yet filled): we always WARN, never ERROR.
// Mainnet otherwise ERRORs unless allow flag is set; Testnet always WARNs.
func checkRole(cfg ConnectionConfig, role string, expected, onchain common.Address, allow bool, logger *slog.Logger) error {
	if expected == (common.Address{}) {
		logger.Warn("client: expectedRoles entry is zero, skipping consistency check",
			"role", role, "onchain", onchain.Hex(), "env", cfg.Env.String())
		return nil
	}
	if expected == onchain {
		return nil
	}
	mismatch := &ErrRoleMismatch{Role: role, Expected: expected, Onchain: onchain, Env: cfg.Env}
	switch {
	case cfg.Env.IsMainnet() && !allow:
		return mismatch
	case cfg.Env.IsMainnet() && allow:
		logger.Warn("client: mainnet role mismatch (allowed by config)",
			"role", role, "expected", expected.Hex(), "onchain", onchain.Hex())
	default: // testnet
		logger.Warn("client: testnet role mismatch (default warn)",
			"role", role, "expected", expected.Hex(), "onchain", onchain.Hex())
	}
	return nil
}

// redactRPC strips userinfo and query string so an RPC URL with API keys does
// not leak into structured logs.
func redactRPC(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "<unparseable>"
	}
	host := u.Host
	if u.Path != "" && u.Path != "/" {
		// Keep the leading slash + first segment, redact rest as a single * marker.
		first := strings.SplitN(strings.TrimPrefix(u.Path, "/"), "/", 2)[0]
		host = host + "/" + first
		if strings.Count(u.Path, "/") > 1 {
			host += "/*"
		}
	}
	return u.Scheme + "://" + host
}

// ── accessors ────────────────────────────────────────────────────────────────

// Env returns the environment selector originally requested.
func (c *Connection) Env() Env { return c.env }

// ChainID returns the verified chain id (== envCfg.ChainID).
func (c *Connection) ChainID() *big.Int { return new(big.Int).Set(c.chainID) }

// EthClient exposes the underlying go-ethereum client. Role packages use this
// for ad-hoc raw calls (e.g. estimateGas, eth_call with state override).
func (c *Connection) EthClient() *ethclient.Client { return c.eth }

// BettingPool returns the typed binding bound to the configured address.
func (c *Connection) BettingPool() *bettingpool.BettingPool { return c.bp }

// BettingPoolAddr returns the resolved BettingPool address (override-aware).
func (c *Connection) BettingPoolAddr() common.Address { return c.bpAddr }

// USDTAddr returns the resolved USDT/MockUSDT address.
func (c *Connection) USDTAddr() common.Address { return c.usdtAddr }

// OnchainAdmin returns the admin address read at startup.
func (c *Connection) OnchainAdmin() common.Address { return c.onchainAdmin }

// OnchainMultisig returns the multisig address read at startup.
func (c *Connection) OnchainMultisig() common.Address { return c.onchainMultisig }

// EnvConfig exposes the loaded embedded config (read-only; do not mutate).
func (c *Connection) EnvConfig() *config.EnvConfig { return c.envCfg }

// Logger returns the structured logger threaded through this connection.
func (c *Connection) Logger() *slog.Logger { return c.logger }

// HTTPTimeout is the per-call deadline used for default contexts.
func (c *Connection) HTTPTimeout() time.Duration { return c.httpTimeout }

// Close releases the underlying RPC client. Safe to call multiple times.
func (c *Connection) Close() error {
	if c.eth != nil {
		c.eth.Close()
	}
	return nil
}
