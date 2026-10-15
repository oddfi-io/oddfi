package oddfi

import (
	"context"
	"errors"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// Config contains the proxy addresses and RPC endpoint used by NewClient.
// Config values are copied during construction and are safe to reuse.
//
// Only RPCURL is required. Every proxy address is optional: the matching
// contract adapter is bound only when its address is set, and the accessor for
// an unconfigured contract returns a ConfigError at call time. This lets a
// caller build, e.g., a TierSale-only client by setting just RPCURL +
// TierSaleProxy.
type Config struct {
	RPCURL                    string
	ODDTokenProxy             common.Address
	StakingPoolProxy          common.Address
	LiquidityPoolProxy        common.Address
	BettingPoolProxy          common.Address
	BettingParlayLensContract common.Address
	TierSaleProxy             common.Address
	HouseVaultProxy           common.Address
	DexLaunchControllerProxy  common.Address
	DexLpLockerProxy          common.Address
	EcosystemRewardsProxy     common.Address
}

// Client is the ODD-SDK public facade. Client methods are safe for concurrent
// use; methods that perform RPC accept context.Context and may block until the
// RPC backend returns or the context is canceled.
type Client struct {
	chain             *chain.Client
	oddToken          *ODDToken
	stakingPool       *StakingPool
	liquidityPool     *LiquidityPool
	bettingPool       *BettingPool
	bettingParlayLens *BettingParlayLens
	tierSale          *TierSale
	houseVault        *HouseVault
	dexLaunch         *DexLaunchController
	dexLpLocker       *DexLpLocker
	ecosystemRewards  *EcosystemRewards
}

// NewClient opens an RPC connection and binds read-only contract adapters.
// It returns ConfigError-wrapped errors for invalid configuration and InfraError
// wrapped errors when the RPC dial or binding fails.
func NewClient(ctx context.Context, cfg Config, opts ...Option) (*Client, error) {
	options := clientOptions{}
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		opt.apply(&options)
	}

	if cfg.RPCURL == "" {
		return nil, newConfigError("rpc url", chain.ErrMissingRPCURL)
	}
	// Proxy addresses are all optional: each contract adapter is bound only when
	// its address is configured (same pattern as TierSale / HouseVault / Dex*).
	// Accessors for unconfigured contracts return a ConfigError at call time.
	chainClient, err := chain.Dial(ctx, cfg.RPCURL)
	if err != nil {
		return nil, newInfraError("rpc dial", err)
	}
	caller, err := chainClient.Caller()
	if err != nil {
		closeErr := chainClient.Close(ctx)
		return nil, errors.Join(newInfraError("rpc caller", err), closeErr)
	}
	var oddToken *ODDToken
	if cfg.ODDTokenProxy != (common.Address{}) {
		oddAdapter, err := contracts.NewODDTokenAdapter(caller, caller, cfg.ODDTokenProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("odd token reader", err), closeErr)
		}
		oddToken = &ODDToken{adapter: oddAdapter}
	}
	var stakingPool *StakingPool
	if cfg.StakingPoolProxy != (common.Address{}) {
		stakingAdapter, err := contracts.NewStakingPoolAdapter(caller, caller, cfg.StakingPoolProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("staking pool reader", err), closeErr)
		}
		stakingPool = &StakingPool{adapter: stakingAdapter}
	}
	var liquidityPool *LiquidityPool
	if cfg.LiquidityPoolProxy != (common.Address{}) {
		liquidityAdapter, err := contracts.NewLiquidityPoolAdapter(caller, caller, cfg.LiquidityPoolProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("liquidity pool reader", err), closeErr)
		}
		liquidityPool = &LiquidityPool{adapter: liquidityAdapter}
	}
	var bettingPool *BettingPool
	if cfg.BettingPoolProxy != (common.Address{}) {
		bettingAdapter, err := contracts.NewBettingPoolAdapter(caller, caller, cfg.BettingPoolProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("betting pool reader", err), closeErr)
		}
		bettingPool = &BettingPool{adapter: bettingAdapter}
	}
	var parlayLens *BettingParlayLens
	if cfg.BettingParlayLensContract != (common.Address{}) {
		parlayLensAdapter, err := contracts.NewBettingParlayLensAdapter(caller, cfg.BettingParlayLensContract)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("betting parlay lens reader", err), closeErr)
		}
		parlayLens = &BettingParlayLens{adapter: parlayLensAdapter}
	}
	var tierSale *TierSale
	if cfg.TierSaleProxy != (common.Address{}) {
		tierSaleAdapter, err := contracts.NewTierSaleAdapter(caller, caller, cfg.TierSaleProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("tier sale reader", err), closeErr)
		}
		tierSale = &TierSale{adapter: tierSaleAdapter}
	}
	var houseVault *HouseVault
	if cfg.HouseVaultProxy != (common.Address{}) {
		houseVaultAdapter, err := contracts.NewHouseVaultAdapter(caller, caller, cfg.HouseVaultProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("house vault reader", err), closeErr)
		}
		houseVault = &HouseVault{adapter: houseVaultAdapter}
	}
	var dexLaunch *DexLaunchController
	if cfg.DexLaunchControllerProxy != (common.Address{}) {
		dexLaunchAdapter, err := contracts.NewDexLaunchControllerAdapter(caller, caller, cfg.DexLaunchControllerProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("dex launch controller reader", err), closeErr)
		}
		dexLaunch = &DexLaunchController{adapter: dexLaunchAdapter}
	}
	var dexLpLocker *DexLpLocker
	if cfg.DexLpLockerProxy != (common.Address{}) {
		dexLpLockerAdapter, err := contracts.NewDexLpLockerAdapter(caller, caller, cfg.DexLpLockerProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("dex lp locker reader", err), closeErr)
		}
		dexLpLocker = &DexLpLocker{adapter: dexLpLockerAdapter}
	}
	var ecosystemRewards *EcosystemRewards
	if cfg.EcosystemRewardsProxy != (common.Address{}) {
		ecosystemRewardsAdapter, err := contracts.NewEcosystemRewardsAdapter(caller, caller, cfg.EcosystemRewardsProxy)
		if err != nil {
			closeErr := chainClient.Close(ctx)
			return nil, errors.Join(newInfraError("ecosystem rewards reader", err), closeErr)
		}
		ecosystemRewards = &EcosystemRewards{adapter: ecosystemRewardsAdapter}
	}

	_ = options
	return &Client{
		chain:             chainClient,
		oddToken:          oddToken,
		stakingPool:       stakingPool,
		liquidityPool:     liquidityPool,
		bettingPool:       bettingPool,
		bettingParlayLens: parlayLens,
		tierSale:          tierSale,
		houseVault:        houseVault,
		dexLaunch:         dexLaunch,
		dexLpLocker:       dexLpLocker,
		ecosystemRewards:  ecosystemRewards,
	}, nil
}

// Close releases resources owned by Client. Close is idempotent and returns ctx
// cancellation errors if ctx is already canceled before close starts.
func (c *Client) Close(ctx context.Context) error {
	if c == nil || c.chain == nil {
		return nil
	}
	if err := c.chain.Close(ctx); err != nil {
		return newInfraError("close client", err)
	}
	return nil
}

// ODDToken returns the read-only ODDToken API bound to the configured proxy.
func (c *Client) ODDToken() *ODDToken {
	if c == nil {
		return nil
	}
	return c.oddToken
}

// StakingPool returns the read-only StakingPool API bound to the configured proxy.
func (c *Client) StakingPool() *StakingPool {
	if c == nil {
		return nil
	}
	return c.stakingPool
}

// LiquidityPool returns the read-only LiquidityPool API bound to the configured proxy.
func (c *Client) LiquidityPool() *LiquidityPool {
	if c == nil {
		return nil
	}
	return c.liquidityPool
}

// BettingPool returns the read-only BettingPool API bound to the configured proxy.
func (c *Client) BettingPool() *BettingPool {
	if c == nil {
		return nil
	}
	return c.bettingPool
}

// BettingParlayLens returns the read-only BettingParlayLens API bound to the configured lens contract.
func (c *Client) BettingParlayLens() *BettingParlayLens {
	if c == nil {
		return nil
	}
	return c.bettingParlayLens
}

// TierSale returns the TierSale API bound to the configured proxy, or nil when not configured.
func (c *Client) TierSale() *TierSale {
	if c == nil {
		return nil
	}
	return c.tierSale
}

// HouseVault returns the HouseVault API bound to the configured proxy, or nil when not configured.
func (c *Client) HouseVault() *HouseVault {
	if c == nil {
		return nil
	}
	return c.houseVault
}

// DexLaunchController returns the DexLaunchController API bound to the configured proxy, or nil when not configured.
func (c *Client) DexLaunchController() *DexLaunchController {
	if c == nil {
		return nil
	}
	return c.dexLaunch
}

// DexLpLocker returns the DexLpLocker API bound to the configured proxy, or nil when not configured.
func (c *Client) DexLpLocker() *DexLpLocker {
	if c == nil {
		return nil
	}
	return c.dexLpLocker
}

// EcosystemRewards returns the EcosystemRewards API bound to the configured proxy, or nil when not configured.
func (c *Client) EcosystemRewards() *EcosystemRewards {
	if c == nil {
		return nil
	}
	return c.ecosystemRewards
}

// Option customizes Client construction.
type Option interface {
	apply(*clientOptions)
}

type clientOptions struct{}

func newConfigError(op string, err error) error {
	return &ConfigError{Op: op, Err: err}
}

func newInfraError(op string, err error) error {
	return &InfraError{Op: op, Err: err}
}

func wrapUserError(op string, err error) error {
	return &UserError{Op: op, Err: err}
}

func wrapInfraError(op string, err error) error {
	return &InfraError{Op: op, Err: err}
}

func checkContext(ctx context.Context, op string) error {
	if ctx == nil {
		return wrapUserError(op, ErrNilContext)
	}
	return nil
}

func ensureODDToken(token *ODDToken) error {
	if token == nil || token.adapter == nil {
		return newConfigError("odd token", ErrMissingODDToken)
	}
	return nil
}

func ensureStakingPool(pool *StakingPool) error {
	if pool == nil || pool.adapter == nil {
		return newConfigError("staking pool", ErrMissingStakingPool)
	}
	return nil
}

func ensureLiquidityPool(pool *LiquidityPool) error {
	if pool == nil || pool.adapter == nil {
		return newConfigError("liquidity pool", ErrMissingLiquidityPool)
	}
	return nil
}

func ensureBettingPool(pool *BettingPool) error {
	if pool == nil || pool.adapter == nil {
		return newConfigError("betting pool", ErrMissingBettingPool)
	}
	return nil
}

func ensureBettingParlayLens(lens *BettingParlayLens) error {
	if lens == nil || lens.adapter == nil {
		return newConfigError("betting parlay lens", ErrInvalidAddress)
	}
	return nil
}

func ensureTierSale(sale *TierSale) error {
	if sale == nil || sale.adapter == nil {
		return newConfigError("tier sale", ErrMissingTierSale)
	}
	return nil
}

func ensureHouseVault(vault *HouseVault) error {
	if vault == nil || vault.adapter == nil {
		return newConfigError("house vault", ErrMissingHouseVault)
	}
	return nil
}

func ensureDexLaunchController(controller *DexLaunchController) error {
	if controller == nil || controller.adapter == nil {
		return newConfigError("dex launch controller", ErrMissingDexLaunchController)
	}
	return nil
}

func ensureDexLpLocker(locker *DexLpLocker) error {
	if locker == nil || locker.adapter == nil {
		return newConfigError("dex lp locker", ErrMissingDexLpLocker)
	}
	return nil
}

func ensureEcosystemRewards(rewards *EcosystemRewards) error {
	if rewards == nil || rewards.adapter == nil {
		return newConfigError("ecosystem rewards", ErrMissingEcosystemRewards)
	}
	return nil
}
