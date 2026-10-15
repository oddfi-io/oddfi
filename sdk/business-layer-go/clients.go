// clients.go — top-level factory that wires the three exposed clients
// (admin / relay / read) plus the shared infrastructure (RPC, SDK, gorm DB,
// chain_actions repo, multicall3, optional cache + watcher).
//
// Most callers should construct exactly one Clients per process and reuse it.
//
// Example:
//
//	clients, err := business.NewClients(ctx, business.Config{
//	    RPCURL:          "https://bsc-testnet-rpc.publicnode.com",
//	    ChainID:         big.NewInt(97),
//	    AdminPrivateKey: adminKey,
//	    ODDToken:        common.HexToAddress("0x..."),
//	    BettingPool:     common.HexToAddress("0x..."),
//	    StakingPool:     common.HexToAddress("0x..."),
//	    LiquidityPool:   common.HexToAddress("0x..."),
//	    SponsorImpl:     common.HexToAddress("0x..."),
//	    DB:              db,
//	    Cache:           cache.NewInProcess(),
//	})
//	if err != nil { return err }
//	defer clients.Close(ctx)
//
//	clients.Admin.OpenMarketWithReceipt(...)
//	clients.Relay.PlaceBetWithReceipt(...)
//	clients.Read.GetMarket(...)

package business

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
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/admin"
	"github.com/Crypto-Barrett/contracts-business-layer/cache"
	"github.com/Crypto-Barrett/contracts-business-layer/read"
	"github.com/Crypto-Barrett/contracts-business-layer/relay"
	"github.com/Crypto-Barrett/contracts-business-layer/tiersale"
	"github.com/Crypto-Barrett/contracts-business-layer/watcher"

	magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// Config is the single input to NewClients. Required fields must be set;
// optional fields have sensible defaults documented inline.
type Config struct {
	// ─── RPC + chain ─────────────────────────────────────────────────────
	RPCURL  string   // required, e.g. "https://bsc-testnet-rpc.publicnode.com"
	ChainID *big.Int // required, BSC testnet = 97, mainnet = 56

	// ─── Keys ────────────────────────────────────────────────────────────
	// AdminPrivateKey is used for direct admin writes (OpenMarket / Settle /
	// GrantRole / AddPlatformReserve). Required.
	AdminPrivateKey *ecdsa.PrivateKey
	// SponsorPrivateKey is the B key that pays gas for relay (sponsored)
	// writes. If nil, defaults to AdminPrivateKey (admin doubles as sponsor).
	SponsorPrivateKey *ecdsa.PrivateKey

	// ─── Contract addresses ──────────────────────────────────────────────
	// 4 deployed proxies + the BatchCallAndSponsor v2 / SponsoredDelegator
	// implementation. All required (no zero address).
	ODDToken      common.Address
	BettingPool   common.Address
	StakingPool   common.Address
	LiquidityPool common.Address
	SponsorImpl   common.Address // EIP-7702 delegate impl

	// BettingParlayLens is the read-only parlay lens contract. Optional: needed
	// only for read.PreviewParlay / read.EstimateParlayValue. Zero = those reads
	// return an error.
	BettingParlayLens common.Address

	// TierSale is the public-sale (TierSale) proxy. Optional: needed only for the
	// TierSale client (Buy / RefundPurchase / EstimateOddForUsdt). Zero = the
	// TierSale client is not constructed (Clients.TierSale is nil).
	TierSale common.Address

	// USDT is the stablecoin token spent in the TierSale public sale. Optional:
	// needed only for relay.ApproveUsdt (USDT allowance → TierSale). Zero =
	// ApproveUsdt errors; the rest of the relay surface is unaffected.
	USDT common.Address

	// EcosystemRewards is the EcosystemRewards proxy. Optional: needed only for
	// relay.ClaimEcosystemReward (DD-148 referral payout) and for reading
	// EcosystemRewards state via SDK.EcosystemRewards(). Zero = ClaimEcosystemReward
	// errors; the rest of the surface is unaffected.
	EcosystemRewards common.Address

	// MulticallAddress is optional; zero = canonical
	// 0xcA11bde05977b3631167028862bE2a173976CA11 (deployed on all major chains).
	MulticallAddress common.Address

	// ─── Persistence ────────────────────────────────────────────────────
	// DB is the pre-opened gorm DB used for the chain_actions table.
	// Required.
	DB *gorm.DB

	// ─── Behavior knobs (optional, defaults applied if zero) ─────────────
	// Confirmations is how many extra blocks *WithReceipt waits after the tx
	// is mined. Default 2.
	Confirmations int
	// SignatureDeadline is the EIP-712 Execute typed-data validity window for
	// relay sponsored signatures. Default 5 minutes.
	SignatureDeadline time.Duration

	// Cache is optional; nil = read methods always hit the chain.
	// Use cache.NewInProcess() for single-pod deployments.
	Cache cache.Client

	// Watcher is optional; if nil, callers must use *WithReceipt variants
	// (which block until the receipt is mined). Production deployments that
	// rely on A-form (hash-only) submits should construct a watcher
	// separately and pass it here so chain_actions rows transition
	// pending → submitted → confirmed asynchronously.
	Watcher *watcher.Watcher

	// UserSigner signs user-side relay operations (7702 auth + EIP-712 execute)
	// on behalf of the user identified by UserID. Required. In production this
	// is *magicclient.Client pointed at the deployed magic-signer service.
	UserSigner magicclient.Signer

	// Logger is optional; nil = no-op. Passed to the relay client, which logs
	// method + user_id on submit and tx_hash on broadcast.
	Logger *zap.Logger
}

// Clients bundles the three exposed clients for one business deployment.
// All three share the same RPC connection, SDK instance, and chain_actions
// repository. Caller MUST call Close when done to release the RPC dial.
type Clients struct {
	Admin    *admin.Client
	Relay    *relay.Client
	Read     *read.Client
	TierSale *tiersale.Client // nil when Config.TierSale is the zero address

	// Shared infrastructure handles (advanced users may need direct access).
	Eth     *ethclient.Client
	SDK     *oddfi.Client
	Actions *action.Repo
}

// NewClients wires up RPC, SDK, chain_actions repo, multicall, and the three
// project clients (admin / relay / read) from a single Config. On error it
// rolls back any partially-opened resources (RPC connection / SDK client).
func NewClients(ctx context.Context, cfg Config) (*Clients, error) {
	// ─── Validate required fields ────────────────────────────────────────
	if cfg.RPCURL == "" {
		return nil, errors.New("business: Config.RPCURL is required")
	}
	if cfg.ChainID == nil || cfg.ChainID.Sign() == 0 {
		return nil, errors.New("business: Config.ChainID is required")
	}
	if cfg.AdminPrivateKey == nil {
		return nil, errors.New("business: Config.AdminPrivateKey is required")
	}
	if cfg.DB == nil {
		return nil, errors.New("business: Config.DB (gorm.DB for chain_actions) is required")
	}
	if cfg.UserSigner == nil {
		return nil, errors.New("business: Config.UserSigner is required")
	}
	for name, addr := range map[string]common.Address{
		"ODDToken":      cfg.ODDToken,
		"BettingPool":   cfg.BettingPool,
		"StakingPool":   cfg.StakingPool,
		"LiquidityPool": cfg.LiquidityPool,
		"SponsorImpl":   cfg.SponsorImpl,
	} {
		if addr == (common.Address{}) {
			return nil, fmt.Errorf("business: Config.%s address is required (got zero)", name)
		}
	}

	// ─── Defaults ────────────────────────────────────────────────────────
	if cfg.Confirmations == 0 {
		cfg.Confirmations = 2
	}
	if cfg.SignatureDeadline == 0 {
		cfg.SignatureDeadline = 5 * time.Minute
	}
	if cfg.SponsorPrivateKey == nil {
		cfg.SponsorPrivateKey = cfg.AdminPrivateKey
	}

	// ─── Dial RPC + open SDK ─────────────────────────────────────────────
	eth, err := ethclient.DialContext(ctx, cfg.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("business: dial RPC %s: %w", cfg.RPCURL, err)
	}

	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:                    cfg.RPCURL,
		ODDTokenProxy:             cfg.ODDToken,
		StakingPoolProxy:          cfg.StakingPool,
		LiquidityPoolProxy:        cfg.LiquidityPool,
		BettingPoolProxy:          cfg.BettingPool,
		BettingParlayLensContract: cfg.BettingParlayLens,
		TierSaleProxy:             cfg.TierSale,
		EcosystemRewardsProxy:     cfg.EcosystemRewards,
	})
	if err != nil {
		eth.Close()
		return nil, fmt.Errorf("business: oddfi.NewClient: %w", err)
	}

	actions := action.New(cfg.DB)

	// ─── Build three clients (each may fail; roll back on error) ────────
	addrs := relay.Addresses{
		ODDToken:      cfg.ODDToken,
		BettingPool:   cfg.BettingPool,
		StakingPool:   cfg.StakingPool,
		LiquidityPool: cfg.LiquidityPool,
	}

	adminCli, err := admin.New(eth, sdk, actions, cfg.Watcher, admin.Config{
		AdminPrivateKey:  cfg.AdminPrivateKey,
		ChainID:          cfg.ChainID,
		Confirmations:    cfg.Confirmations,
		MulticallAddress: cfg.MulticallAddress,
		Addresses:        admin.Addresses(addrs),
	})
	if err != nil {
		_ = sdk.Close(ctx)
		eth.Close()
		return nil, fmt.Errorf("business: admin.New: %w", err)
	}

	relayCli, err := relay.New(eth, sdk, actions, cfg.Watcher, relay.Config{
		SponsorPrivateKey: cfg.SponsorPrivateKey,
		UserSigner:        cfg.UserSigner,
		Logger:            cfg.Logger,
		ImplAddress:       cfg.SponsorImpl,
		ChainID:           cfg.ChainID,
		Confirmations:     cfg.Confirmations,
		SignatureDeadline: cfg.SignatureDeadline,
		MulticallAddress:  cfg.MulticallAddress,
		Addresses:         addrs,
		USDT:              cfg.USDT,
		EcosystemRewards:  cfg.EcosystemRewards,
	})
	if err != nil {
		_ = sdk.Close(ctx)
		eth.Close()
		return nil, fmt.Errorf("business: relay.New: %w", err)
	}

	readCli, err := read.New(eth, sdk, read.Config{
		Cache:              cfg.Cache,
		EnableProcessCache: cfg.Cache != nil,
		BettingPool:        cfg.BettingPool,
	})
	if err != nil {
		_ = sdk.Close(ctx)
		eth.Close()
		return nil, fmt.Errorf("business: read.New: %w", err)
	}

	// TierSale client is optional — only built when a sale address is configured.
	var tierSaleCli *tiersale.Client
	if cfg.TierSale != (common.Address{}) {
		tierSaleCli, err = tiersale.New(eth, sdk, tiersale.Config{
			SponsorPrivateKey: cfg.SponsorPrivateKey,
			UserSigner:        cfg.UserSigner,
			TierSale:          cfg.TierSale,
			ImplAddress:       cfg.SponsorImpl,
			Actions:           actions,
			Watcher:           cfg.Watcher,
			SignatureDeadline: cfg.SignatureDeadline,
			Confirmations:     cfg.Confirmations,
			Logger:            cfg.Logger,
		})
		if err != nil {
			_ = sdk.Close(ctx)
			eth.Close()
			return nil, fmt.Errorf("business: tiersale.New: %w", err)
		}
	}

	return &Clients{
		Admin:    adminCli,
		Relay:    relayCli,
		Read:     readCli,
		TierSale: tierSaleCli,
		Eth:      eth,
		SDK:      sdk,
		Actions:  actions,
	}, nil
}

// Close releases the SDK and RPC connection. Idempotent — safe to defer.
// Does NOT stop a user-provided Watcher (caller's responsibility).
func (c *Clients) Close(ctx context.Context) error {
	if c == nil {
		return nil
	}
	if c.SDK != nil {
		_ = c.SDK.Close(ctx)
	}
	if c.Eth != nil {
		c.Eth.Close()
	}
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════
// Per-service factories — for multi-service production deployments where
// each microservice should hold only the keys / DB it actually needs.
//
// Each factory dials its OWN RPC (no shared *ethclient.Client across
// processes; sharing makes no sense across services anyway).
//
// Suggested deployment topology:
//
//	admin-svc        →  NewAdminClients(AdminConfig{AdminPrivateKey, DB, …})
//	                    holds: admin key + chain_actions repo
//	user-api-svc     →  NewRelayClients(RelayConfig{SponsorPrivateKey, DB, …})
//	                    holds: sponsor key + chain_actions repo
//	read-svc / web   →  NewReadClients(ReadConfig{no keys, no DB})
//	                    completely read-only — no fund-moving capability
// ═══════════════════════════════════════════════════════════════════════════

// ─── admin-only factory ──────────────────────────────────────────────────

// AdminConfig is the input for NewAdminClients. Carries only what admin-svc
// needs: admin private key + chain_actions DB. NO sponsor key, NO sponsor
// implementation address.
type AdminConfig struct {
	RPCURL  string
	ChainID *big.Int

	AdminPrivateKey *ecdsa.PrivateKey

	ODDToken         common.Address
	BettingPool      common.Address
	StakingPool      common.Address
	LiquidityPool    common.Address
	MulticallAddress common.Address // optional

	DB *gorm.DB

	Confirmations int // default 2
	Watcher       *watcher.Watcher
}

// AdminClients is what NewAdminClients returns. Exposes admin.Client plus
// the shared infra (action.Repo for chain_actions queries, raw RPC + SDK).
type AdminClients struct {
	Admin   *admin.Client
	Actions *action.Repo // use Actions.GetStatus / GetStatusByIdempotencyKey
	Eth     *ethclient.Client
	SDK     *oddfi.Client
}

func NewAdminClients(ctx context.Context, cfg AdminConfig) (*AdminClients, error) {
	if cfg.RPCURL == "" {
		return nil, errors.New("business: AdminConfig.RPCURL required")
	}
	if cfg.ChainID == nil || cfg.ChainID.Sign() == 0 {
		return nil, errors.New("business: AdminConfig.ChainID required")
	}
	if cfg.AdminPrivateKey == nil {
		return nil, errors.New("business: AdminConfig.AdminPrivateKey required")
	}
	if cfg.DB == nil {
		return nil, errors.New("business: AdminConfig.DB required")
	}
	if cfg.Confirmations == 0 {
		cfg.Confirmations = 2
	}

	eth, sdk, err := dialEthAndSDK(ctx, cfg.RPCURL, cfg.ODDToken, cfg.StakingPool, cfg.LiquidityPool, cfg.BettingPool, common.Address{}, common.Address{}, common.Address{})
	if err != nil {
		return nil, err
	}
	actions := action.New(cfg.DB)

	adminCli, err := admin.New(eth, sdk, actions, cfg.Watcher, admin.Config{
		AdminPrivateKey:  cfg.AdminPrivateKey,
		ChainID:          cfg.ChainID,
		Confirmations:    cfg.Confirmations,
		MulticallAddress: cfg.MulticallAddress,
		Addresses: admin.Addresses{
			ODDToken: cfg.ODDToken, BettingPool: cfg.BettingPool,
			StakingPool: cfg.StakingPool, LiquidityPool: cfg.LiquidityPool,
		},
	})
	if err != nil {
		_ = sdk.Close(ctx)
		eth.Close()
		return nil, fmt.Errorf("business: admin.New: %w", err)
	}
	return &AdminClients{Admin: adminCli, Actions: actions, Eth: eth, SDK: sdk}, nil
}

func (a *AdminClients) Close(ctx context.Context) error {
	if a == nil {
		return nil
	}
	if a.SDK != nil {
		_ = a.SDK.Close(ctx)
	}
	if a.Eth != nil {
		a.Eth.Close()
	}
	return nil
}

// ─── relay-only factory ──────────────────────────────────────────────────

// RelayConfig is the input for NewRelayClients. Carries only what user-api-svc
// needs: sponsor key + sponsor impl + chain_actions DB. NO admin key.
type RelayConfig struct {
	RPCURL  string
	ChainID *big.Int

	SponsorPrivateKey *ecdsa.PrivateKey
	SponsorImpl       common.Address // EIP-7702 delegate impl

	ODDToken         common.Address
	BettingPool      common.Address
	StakingPool      common.Address
	LiquidityPool    common.Address
	MulticallAddress common.Address // optional

	// USDT is the public-sale stablecoin. Optional: required only for
	// relay.ApproveUsdt (USDT allowance → TierSale). Zero leaves ApproveUsdt
	// erroring; all other relay methods are unaffected.
	USDT common.Address

	// TierSale is the public-sale proxy. Optional: when set, NewRelayClients
	// also builds RelayClients.TierSale (Buy / RefundPurchase / EstimateOddForUsdt)
	// and configures the relay-path SDK with TierSaleProxy. Zero = TierSale is nil.
	TierSale common.Address

	// EcosystemRewards is the EcosystemRewards proxy. Optional: when set, the
	// relay-path SDK is configured with EcosystemRewardsProxy so
	// relay.ClaimEcosystemReward (DD-148 referral payout) can encode and submit
	// the sponsored claim. Zero = ClaimEcosystemReward errors.
	EcosystemRewards common.Address

	DB *gorm.DB

	Confirmations     int           // default 2
	SignatureDeadline time.Duration // default 5m
	Watcher           *watcher.Watcher

	// UserSigner signs user-side relay operations on behalf of UserID. Required.
	UserSigner magicclient.Signer

	// Logger is optional; nil = no-op. Forwarded to the relay client.
	Logger *zap.Logger
}

type RelayClients struct {
	Relay   *relay.Client
	Actions *action.Repo
	Eth     *ethclient.Client
	SDK     *oddfi.Client
	// TierSale is the public-sale write client (Buy / RefundPurchase /
	// EstimateOddForUsdt). Nil unless RelayConfig.TierSale was set.
	TierSale *tiersale.Client
}

func NewRelayClients(ctx context.Context, cfg RelayConfig) (*RelayClients, error) {
	if cfg.RPCURL == "" {
		return nil, errors.New("business: RelayConfig.RPCURL required")
	}
	if cfg.ChainID == nil || cfg.ChainID.Sign() == 0 {
		return nil, errors.New("business: RelayConfig.ChainID required")
	}
	if cfg.SponsorPrivateKey == nil {
		return nil, errors.New("business: RelayConfig.SponsorPrivateKey required")
	}
	if cfg.SponsorImpl == (common.Address{}) {
		return nil, errors.New("business: RelayConfig.SponsorImpl required")
	}
	if cfg.DB == nil {
		return nil, errors.New("business: RelayConfig.DB required")
	}
	if cfg.UserSigner == nil {
		return nil, errors.New("business: RelayConfig.UserSigner required")
	}
	if cfg.Confirmations == 0 {
		cfg.Confirmations = 2
	}
	if cfg.SignatureDeadline == 0 {
		cfg.SignatureDeadline = 5 * time.Minute
	}

	eth, sdk, err := dialEthAndSDK(ctx, cfg.RPCURL, cfg.ODDToken, cfg.StakingPool, cfg.LiquidityPool, cfg.BettingPool, common.Address{}, cfg.TierSale, cfg.EcosystemRewards)
	if err != nil {
		return nil, err
	}
	actions := action.New(cfg.DB)

	relayCli, err := relay.New(eth, sdk, actions, cfg.Watcher, relay.Config{
		SponsorPrivateKey: cfg.SponsorPrivateKey,
		UserSigner:        cfg.UserSigner,
		Logger:            cfg.Logger,
		ImplAddress:       cfg.SponsorImpl,
		ChainID:           cfg.ChainID,
		Confirmations:     cfg.Confirmations,
		SignatureDeadline: cfg.SignatureDeadline,
		MulticallAddress:  cfg.MulticallAddress,
		Addresses: relay.Addresses{
			ODDToken: cfg.ODDToken, BettingPool: cfg.BettingPool,
			StakingPool: cfg.StakingPool, LiquidityPool: cfg.LiquidityPool,
		},
		USDT:             cfg.USDT,
		EcosystemRewards: cfg.EcosystemRewards,
	})
	if err != nil {
		_ = sdk.Close(ctx)
		eth.Close()
		return nil, fmt.Errorf("business: relay.New: %w", err)
	}

	// TierSale 写客户端可选：仅在配置了 TierSale 地址时构造（公开发售 Buy / RefundPurchase）。
	// 复用同一 eth/sdk/actions + sponsor/signer，与 Relay 共享 sponsored 提交管道。
	var tierSaleCli *tiersale.Client
	if cfg.TierSale != (common.Address{}) {
		tierSaleCli, err = tiersale.New(eth, sdk, tiersale.Config{
			SponsorPrivateKey: cfg.SponsorPrivateKey,
			UserSigner:        cfg.UserSigner,
			TierSale:          cfg.TierSale,
			ImplAddress:       cfg.SponsorImpl,
			Actions:           actions,
			Watcher:           cfg.Watcher,
			SignatureDeadline: cfg.SignatureDeadline,
			Confirmations:     cfg.Confirmations,
			Logger:            cfg.Logger,
		})
		if err != nil {
			_ = sdk.Close(ctx)
			eth.Close()
			return nil, fmt.Errorf("business: tiersale.New: %w", err)
		}
	}

	return &RelayClients{Relay: relayCli, Actions: actions, Eth: eth, SDK: sdk, TierSale: tierSaleCli}, nil
}

func (r *RelayClients) Close(ctx context.Context) error {
	if r == nil {
		return nil
	}
	if r.SDK != nil {
		_ = r.SDK.Close(ctx)
	}
	if r.Eth != nil {
		r.Eth.Close()
	}
	return nil
}

// ─── read-only factory ──────────────────────────────────────────────────

// ReadConfig is the input for NewReadClients. NO private keys at all. NO DB.
// A read-svc built with this config can only read on-chain data — it cannot
// move funds, submit transactions, or query chain_actions history.
type ReadConfig struct {
	RPCURL  string
	ChainID *big.Int // currently informational; reserved for future use

	ODDToken      common.Address
	BettingPool   common.Address
	StakingPool   common.Address
	LiquidityPool common.Address

	// BettingParlayLens is optional; needed only for PreviewParlay /
	// EstimateParlayValue. Zero = those reads return an error.
	BettingParlayLens common.Address

	// TierSale is the public-sale proxy. Optional: needed only to read TierSale
	// state via SDK.TierSale() (TotalSold / UsdtDecimals / PreviewBuy / …).
	// Zero = those reads return a ConfigError.
	TierSale common.Address

	// EcosystemRewards is the EcosystemRewards proxy. Optional: needed only to read
	// EcosystemRewards state via SDK.EcosystemRewards() (Claimable / NextClaimID /
	// category budgets / …). Zero = those reads return a ConfigError.
	EcosystemRewards common.Address

	Cache cache.Client // optional
}

type ReadClients struct {
	Read *read.Client
	Eth  *ethclient.Client
	SDK  *oddfi.Client
}

func NewReadClients(ctx context.Context, cfg ReadConfig) (*ReadClients, error) {
	if cfg.RPCURL == "" {
		return nil, errors.New("business: ReadConfig.RPCURL required")
	}
	eth, sdk, err := dialEthAndSDK(ctx, cfg.RPCURL, cfg.ODDToken, cfg.StakingPool, cfg.LiquidityPool, cfg.BettingPool, cfg.BettingParlayLens, cfg.TierSale, cfg.EcosystemRewards)
	if err != nil {
		return nil, err
	}
	readCli, err := read.New(eth, sdk, read.Config{
		Cache:              cfg.Cache,
		EnableProcessCache: cfg.Cache != nil,
		BettingPool:        cfg.BettingPool,
	})
	if err != nil {
		_ = sdk.Close(ctx)
		eth.Close()
		return nil, fmt.Errorf("business: read.New: %w", err)
	}
	return &ReadClients{Read: readCli, Eth: eth, SDK: sdk}, nil
}

func (r *ReadClients) Close(ctx context.Context) error {
	if r == nil {
		return nil
	}
	if r.SDK != nil {
		_ = r.SDK.Close(ctx)
	}
	if r.Eth != nil {
		r.Eth.Close()
	}
	return nil
}

// ─── shared dial helper ──────────────────────────────────────────────────

func dialEthAndSDK(ctx context.Context, rpcURL string, odd, staking, lp, bp, parlayLens, tierSale, ecosystemRewards common.Address) (*ethclient.Client, *oddfi.Client, error) {
	eth, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return nil, nil, fmt.Errorf("business: dial RPC %s: %w", rpcURL, err)
	}
	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:                    rpcURL,
		ODDTokenProxy:             odd,
		StakingPoolProxy:          staking,
		LiquidityPoolProxy:        lp,
		BettingPoolProxy:          bp,
		BettingParlayLensContract: parlayLens,
		TierSaleProxy:             tierSale,
		EcosystemRewardsProxy:     ecosystemRewards,
	})
	if err != nil {
		eth.Close()
		return nil, nil, fmt.Errorf("business: oddfi.NewClient: %w", err)
	}
	return eth, sdk, nil
}
