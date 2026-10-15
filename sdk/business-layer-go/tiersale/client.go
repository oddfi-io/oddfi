// Package tiersale exposes the ODD public-sale (TierSale) operations as a
// self-contained client:
//
//   - user-side writes (Buy / RefundPurchase) submitted via the sponsored
//     EIP-7702 pathway — the user (A) signs an intent with their Magic-managed
//     proxy wallet, while a library-owned sponsor account (B) pays gas and
//     broadcasts the SetCodeTx;
//   - a read-only USDT→ODD budget estimator (EstimateOddForUsdt) that mirrors
//     the contract's per-tier pricing.
//
// This package is deliberately independent of the relay package: it carries its
// OWN sponsored-submit pipeline (see service.go) so the public-sale flow can be
// deployed and reasoned about on its own. It reuses only the shared low-level
// primitives (internal/eip7702, action, coretypes, watcher).
//
// Two surfaces per write method:
//
//   - tiersale.X(ctx, req)             — submit and return tx hash immediately (default).
//   - tiersale.XWithReceipt(ctx, req)  — submit and block until the receipt is mined.
//
// NOTE: USDT.approve(TierSale) is NOT handled here — buy requires the proxy
// wallet to have approved USDT to the TierSale contract beforehand; that
// allowance is established by a separate component.
package tiersale

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"

	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/watcher"

	magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// Signer is the user-side signing capability injected into Client. The submit
// pipeline calls WalletAddress to resolve the user's EOA from their UserID
// (process-cached; see addr_cache.go) and SignDigest to sign on their behalf.
//
// In production this is *magicclient.Client; tests inject a mock.
type Signer = magicclient.Signer

// Config wires the tiersale client.
type Config struct {
	// SponsorPrivateKey is B's key: pays gas, broadcasts the SetCodeTx.
	// SHOULD be loaded via HSM / KMS / vault, not stored on disk.
	SponsorPrivateKey *ecdsa.PrivateKey

	// UserSigner signs the user-side 7702 authorization + EIP-712 execute
	// digests on behalf of the user identified by UserID. Required. In
	// production this is *magicclient.Client (the Magic Signer SDK).
	UserSigner Signer

	// TierSale is the TierSale proxy address — the on-chain target of every
	// Buy / RefundPurchase inner call. Required.
	TierSale common.Address

	// ImplAddress is the BatchCallAndSponsor v2 / SponsoredDelegator implementation.
	ImplAddress common.Address

	// Actions is the chain_actions repository. Required: TierSale writes
	// (Buy / RefundPurchase) are deduped by IdempotencyKey and tracked for async
	// status through it.
	Actions *action.Repo

	// Watcher optionally drives chain_actions row transitions for A-form
	// (hash-only) submits. Nil = use WithReceipt variants or run a watcher elsewhere.
	Watcher *watcher.Watcher

	// SignatureDeadline is how long an A-signature is valid (typed-data deadline).
	// Default: 5 minutes.
	SignatureDeadline time.Duration

	// Confirmations is how many blocks to wait in WithReceipt variants.
	// Default: 2 (mirrors watcher.Config default).
	Confirmations int

	// Logger is optional. When nil, a no-op logger is used.
	Logger *zap.Logger
}

// Client is the tiersale handle. Methods are safe for concurrent use.
type Client struct {
	cfg       Config
	eth       *ethclient.Client
	sdk       *oddfi.Client
	actions   *action.Repo
	watcher   *watcher.Watcher // optional; nil = caller polls action status themselves
	sponsorAt common.Address   // derived from SponsorPrivateKey
	signer    Signer           // = cfg.UserSigner; signs user-side digests via Magic
	addrCache *userAddrCache   // permanent user_id → EOA cache (see addr_cache.go)
	log       *zap.Logger      // never nil after New (no-op if cfg.Logger == nil)

	mu      sync.Mutex
	chainID *big.Int // derived from eth on first use, then cached (see getChainID)
}

// New constructs a tiersale.Client. `eth` is the raw RPC client used to send the
// sponsored SetCodeTx; `sdk` is the oddfi-ODD-SDK Client, which only needs to be
// built with TierSaleProxy set (other proxy addresses are optional since SDK
// v0.0.15) so TierSale reads/calldata resolve.
//
// The chain ID is derived from `eth` on first use — no need to pass it. Required
// Config: SponsorPrivateKey, UserSigner, TierSale, ImplAddress, Actions. Optional:
// Watcher, SignatureDeadline (default 5m), Confirmations (default 2), Logger.
func New(eth *ethclient.Client, sdk *oddfi.Client, cfg Config) (*Client, error) {
	if eth == nil {
		return nil, errors.New("tiersale: nil ethclient")
	}
	if sdk == nil {
		return nil, errors.New("tiersale: nil sdk")
	}
	if cfg.Actions == nil {
		return nil, errors.New("tiersale: missing Actions (chain_actions repo; required for idempotency)")
	}
	if cfg.SponsorPrivateKey == nil {
		return nil, errors.New("tiersale: missing SponsorPrivateKey")
	}
	if cfg.UserSigner == nil {
		return nil, errors.New("tiersale: missing UserSigner")
	}
	if cfg.TierSale == (common.Address{}) {
		return nil, errors.New("tiersale: missing TierSale address")
	}
	if cfg.ImplAddress == (common.Address{}) {
		return nil, errors.New("tiersale: missing ImplAddress")
	}
	if cfg.SignatureDeadline == 0 {
		cfg.SignatureDeadline = 5 * time.Minute
	}
	if cfg.Confirmations == 0 {
		cfg.Confirmations = 2
	}
	logger := cfg.Logger
	if logger == nil {
		logger = zap.NewNop()
	}
	sponsorAt := crypto.PubkeyToAddress(cfg.SponsorPrivateKey.PublicKey)
	return &Client{
		cfg:       cfg,
		eth:       eth,
		sdk:       sdk,
		actions:   cfg.Actions,
		watcher:   cfg.Watcher,
		sponsorAt: sponsorAt,
		signer:    cfg.UserSigner,
		addrCache: &userAddrCache{},
		log:       logger,
	}, nil
}

// Close releases resources. (Currently a no-op; reserved for future use.)
func (c *Client) Close(ctx context.Context) error { return nil }

// SponsorAddress returns B's address — the gas payer.
func (c *Client) SponsorAddress() common.Address { return c.sponsorAt }

// AsyncResult is the common return type of A-form (non-blocking) methods.
type AsyncResult struct {
	TxHash         coretypes.TxHash
	ActionID       coretypes.ActionID
	IdempotencyKey string
}

// ReceiptResult is the common return type of B-form (WithReceipt) methods.
// Method-specific extra fields wrap this.
type ReceiptResult struct {
	TxHash      coretypes.TxHash
	BlockNumber uint64
	GasUsed     uint64
}
