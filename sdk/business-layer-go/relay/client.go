// Package relay exposes user-side write operations that are submitted on-chain
// via a sponsored-gas pathway: the end user (A) signs an intent with their own
// private key, while a library-owned sponsor account (B) pays gas and
// broadcasts the transaction. Users of this package never see EIP-7702 details.
//
// Two surfaces per method:
//
//   - relay.X(ctx, req)             — submit and return tx hash immediately (default).
//   - relay.XWithReceipt(ctx, req)  — submit and block until the receipt is mined.
//
// See docs/usage-examples.md for end-to-end examples.
package relay

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"

	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/multicall"
	"github.com/Crypto-Barrett/contracts-business-layer/watcher"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// Config wires the relay client.
type Config struct {
	// SponsorPrivateKey is B's key: pays gas, broadcasts SetCodeTx.
	// SHOULD be loaded via HSM / KMS / vault, not stored on disk.
	SponsorPrivateKey *ecdsa.PrivateKey

	// UserSigner signs the user-side 7702 authorization + EIP-712 execute
	// digests on behalf of the user identified by UserID. Required. In
	// production this is *magicclient.Client (the Magic Signer SDK).
	UserSigner Signer

	// Logger is optional. When nil, a no-op logger is used. The relay submit
	// pipeline logs method + user_id on entry and tx_hash on broadcast.
	Logger *zap.Logger

	// ImplAddress is the BatchCallAndSponsor v2 implementation contract.
	ImplAddress common.Address

	// SignatureDeadline is how long an A-signature is valid (typed-data deadline).
	// Default: 5 minutes.
	SignatureDeadline time.Duration

	// ChainID is the EVM chain ID (BSC mainnet 56, BSC testnet 97).
	ChainID *big.Int

	// Confirmations is how many blocks to wait in WithReceipt variants.
	// Default: 2 (mirrors watcher.Config default).
	Confirmations int

	// MulticallAddress overrides multicall3 deployment address.
	// Leave zero to use the canonical 0xcA11bde05977b3631167028862bE2a173976CA11.
	MulticallAddress common.Address

	// Addresses are the 4 proxy contract addresses. Must mirror the values
	// passed to oddfi.NewClient(). Used by the multicall pre-flight to encode
	// raw read calldata (SDK doesn't expose getters for these).
	Addresses Addresses

	// USDT is the stablecoin token used by the TierSale public sale. It is the
	// on-chain target of ApproveUsdt's inner approve(spender,value) call.
	// Optional: the core relay methods (bet/stake/liquidity/transfer) never touch
	// it. REQUIRED only when calling ApproveUsdt — that method errors if USDT is
	// the zero address. Not part of Addresses because it is not an oddfi proxy
	// (and Addresses is type-converted to admin.Addresses, which must stay aligned).
	USDT common.Address

	// EcosystemRewards is the EcosystemRewards proxy. It is the on-chain target of
	// ClaimEcosystemReward's inner claim(claimId) call (DD-148 referral payout).
	// Optional: the core relay methods never touch it. REQUIRED only when calling
	// ClaimEcosystemReward — that method errors if EcosystemRewards is the zero
	// address. Not part of Addresses for the same reason as USDT: it is not one of
	// the four core proxies that mirror admin.Addresses.
	EcosystemRewards common.Address
}

// Addresses holds the 4 deployed proxies. Mirror oddfi.Config when constructing.
type Addresses struct {
	ODDToken      common.Address
	BettingPool   common.Address
	StakingPool   common.Address
	LiquidityPool common.Address
}

// Client is the relay handle. Methods are safe for concurrent use.
type Client struct {
	cfg       Config
	eth       *ethclient.Client
	sdk       *oddfi.Client
	mc        *multicall.Client
	actions   *action.Repo
	watcher   *watcher.Watcher // optional; nil = caller polls action status themselves
	sponsorAt common.Address   // derived from SponsorPrivateKey
	signer    Signer           // = cfg.UserSigner; signs user-side digests via Magic
	addrCache *userAddrCache   // permanent user_id → EOA cache (see addr_cache.go)
	log       *zap.Logger      // never nil after New (no-op if cfg.Logger == nil)
}

// New constructs a relay.Client. `eth` is the raw RPC client (the same one
// passed to the SDK), `sdk` is the new oddfi-ODD-SDK Client, `actions` is the
// chain_actions repository (kept from the old codebase).
//
// `w` is optional: pass nil and you must run a Watcher elsewhere to drive
// chain_actions row transitions, or call WithReceipt variants exclusively.
func New(eth *ethclient.Client, sdk *oddfi.Client, actions *action.Repo, w *watcher.Watcher, cfg Config) (*Client, error) {
	if eth == nil {
		return nil, errors.New("relay: nil ethclient")
	}
	if sdk == nil {
		return nil, errors.New("relay: nil sdk")
	}
	if actions == nil {
		return nil, errors.New("relay: nil action repo")
	}
	if cfg.SponsorPrivateKey == nil {
		return nil, errors.New("relay: missing SponsorPrivateKey")
	}
	if cfg.UserSigner == nil {
		return nil, errors.New("relay: missing UserSigner")
	}
	if cfg.ImplAddress == (common.Address{}) {
		return nil, errors.New("relay: missing ImplAddress")
	}
	if cfg.ChainID == nil || cfg.ChainID.Sign() == 0 {
		return nil, errors.New("relay: missing ChainID")
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
	mc, err := multicall.New(eth, cfg.MulticallAddress)
	if err != nil {
		return nil, fmt.Errorf("relay: build multicall: %w", err)
	}
	sponsorAt := crypto_pubToAddr(cfg.SponsorPrivateKey)
	return &Client{
		cfg:       cfg,
		eth:       eth,
		sdk:       sdk,
		mc:        mc,
		actions:   actions,
		watcher:   w,
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
// Method-specific extra fields (e.g. PlaceBetResult.BetID) wrap this.
type ReceiptResult struct {
	TxHash      coretypes.TxHash
	BlockNumber uint64
	GasUsed     uint64
}
