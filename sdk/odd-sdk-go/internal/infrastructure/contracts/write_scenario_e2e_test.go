package contracts

import (
	"context"
	"crypto/ecdsa"
	"math/big"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/liquiditypool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/oddtoken"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/stakingpool"
)

func TestWriteScenarioAdapterODDTokenTransfer(t *testing.T) {
	env := newAdapterWriteEnv(t)
	recipient := writeScenarioAddressOrDefault(t, "ODDFI_SCENARIO_RECIPIENT", env.sender)
	amount := writeScenarioAmount(t, "ODDFI_SCENARIO_TRANSFER_AMOUNT_WEI", big.NewInt(1))
	runWriteStep(t, env.ctx, env.rpc, env.odd, env.sender, env.oddAddress, "ODDToken.Transfer", func(auth *bind.TransactOpts) (*types.Transaction, error) {
		return env.odd.Transfer(auth, recipient, amount)
	}, env.privateKey, env.chainID)
}

func TestWriteScenarioAdapterODDTokenApprove(t *testing.T) {
	env := newAdapterWriteEnv(t)
	amount := writeScenarioAmount(t, "ODDFI_SCENARIO_APPROVE_AMOUNT_WEI", big.NewInt(1))
	runWriteStep(t, env.ctx, env.rpc, env.odd, env.sender, env.bettingAddress, "ODDToken.ApproveBettingPool", func(auth *bind.TransactOpts) (*types.Transaction, error) {
		return env.odd.Approve(auth, env.bettingAddress, amount)
	}, env.privateKey, env.chainID)
}

func TestWriteScenarioAdapterStakingPoolStake(t *testing.T) {
	env := newAdapterWriteEnv(t)
	amount, err := env.staking.MinStakeAmount(&bind.CallOpts{Context: env.ctx})
	if err != nil {
		t.Fatalf("read StakingPool.MinStakeAmount: %v", err)
	}
	amount = writeScenarioAmount(t, "ODDFI_SCENARIO_STAKE_AMOUNT_WEI", amount)
	planID := writeScenarioUint16(t, "ODDFI_SCENARIO_STAKE_PLAN_ID", 0)

	adapterApproveForScenario(t, env, env.stakingAddress, amount, "Setup.ODDToken.ApproveStakingPool")
	runWriteStep(t, env.ctx, env.rpc, env.odd, env.sender, env.stakingAddress, "StakingPool.Stake", func(auth *bind.TransactOpts) (*types.Transaction, error) {
		return env.staking.Stake(auth, amount, planID)
	}, env.privateKey, env.chainID)
}

func TestWriteScenarioAdapterLiquidityPoolDepositGlobal(t *testing.T) {
	env := newAdapterWriteEnv(t)
	amount, err := env.liquidity.MinDeposit(&bind.CallOpts{Context: env.ctx})
	if err != nil {
		t.Fatalf("read LiquidityPool.MinDeposit: %v", err)
	}
	amount = writeScenarioAmount(t, "ODDFI_SCENARIO_LIQUIDITY_AMOUNT_WEI", amount)
	planID := writeScenarioUint16(t, "ODDFI_SCENARIO_LIQUIDITY_PLAN_ID", 0)

	adapterApproveForScenario(t, env, env.liquidityAddress, amount, "Setup.ODDToken.ApproveLiquidityPool")
	runWriteStep(t, env.ctx, env.rpc, env.odd, env.sender, env.liquidityAddress, "LiquidityPool.DepositGlobal", func(auth *bind.TransactOpts) (*types.Transaction, error) {
		return env.liquidity.DepositGlobal(auth, amount, planID)
	}, env.privateKey, env.chainID)
}

func TestWriteScenarioAdapterBettingPoolAddPlatformReserve(t *testing.T) {
	env := newAdapterWriteEnv(t)
	amount := writeScenarioAmount(t, "ODDFI_SCENARIO_RESERVE_AMOUNT_WEI", big.NewInt(1))
	adapterApproveForScenario(t, env, env.bettingAddress, amount, "Setup.ODDToken.ApproveBettingPoolReserve")
	runWriteStep(t, env.ctx, env.rpc, env.odd, env.sender, env.bettingAddress, "BettingPool.AddPlatformReserve", func(auth *bind.TransactOpts) (*types.Transaction, error) {
		return env.betting.AddPlatformReserve(auth, amount)
	}, env.privateKey, env.chainID)
}

type adapterWriteEnv struct {
	ctx              context.Context
	rpc              *ethclient.Client
	odd              *oddtoken.ODDToken
	staking          *stakingpool.StakingPool
	liquidity        *liquiditypool.LiquidityPool
	betting          *bettingpool.BettingPool
	privateKey       *ecdsa.PrivateKey
	chainID          *big.Int
	sender           common.Address
	oddAddress       common.Address
	stakingAddress   common.Address
	liquidityAddress common.Address
	bettingAddress   common.Address
}

func newAdapterWriteEnv(t *testing.T) *adapterWriteEnv {
	t.Helper()
	if os.Getenv("ODDFI_WRITE_E2E") != "1" {
		t.Skip("set ODDFI_WRITE_E2E=1 to run write scenario e2e")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	t.Cleanup(cancel)

	privateKey := requiredWritePrivateKey(t)
	sender := crypto.PubkeyToAddress(privateKey.PublicKey)

	rpc, err := ethclient.DialContext(ctx, requiredWriteEnv(t, "ODDFI_RPC_URL"))
	if err != nil {
		t.Fatalf("dial rpc: %v", err)
	}
	t.Cleanup(rpc.Close)

	chainID, err := rpc.ChainID(ctx)
	if err != nil {
		t.Fatalf("chain id: %v", err)
	}

	oddAddress := mustWriteAddress(t, "ODDFI_ODD_TOKEN_PROXY")
	stakingAddress := mustWriteAddress(t, "ODDFI_STAKING_POOL_PROXY")
	liquidityAddress := mustWriteAddress(t, "ODDFI_LIQUIDITY_POOL_PROXY")
	bettingAddress := mustWriteAddress(t, "ODDFI_BETTING_POOL_PROXY")

	odd, err := oddtoken.NewODDToken(oddAddress, rpc)
	if err != nil {
		t.Fatalf("bind ODDToken: %v", err)
	}
	staking, err := stakingpool.NewStakingPool(stakingAddress, rpc)
	if err != nil {
		t.Fatalf("bind StakingPool: %v", err)
	}
	liquidity, err := liquiditypool.NewLiquidityPool(liquidityAddress, rpc)
	if err != nil {
		t.Fatalf("bind LiquidityPool: %v", err)
	}
	betting, err := bettingpool.NewBettingPool(bettingAddress, rpc)
	if err != nil {
		t.Fatalf("bind BettingPool: %v", err)
	}

	return &adapterWriteEnv{
		ctx:              ctx,
		rpc:              rpc,
		odd:              odd,
		staking:          staking,
		liquidity:        liquidity,
		betting:          betting,
		privateKey:       privateKey,
		chainID:          chainID,
		sender:           sender,
		oddAddress:       oddAddress,
		stakingAddress:   stakingAddress,
		liquidityAddress: liquidityAddress,
		bettingAddress:   bettingAddress,
	}
}

func adapterApproveForScenario(t *testing.T, env *adapterWriteEnv, spender common.Address, amount *big.Int, label string) {
	t.Helper()
	runWriteStep(t, env.ctx, env.rpc, env.odd, env.sender, spender, label, func(auth *bind.TransactOpts) (*types.Transaction, error) {
		return env.odd.Approve(auth, spender, amount)
	}, env.privateKey, env.chainID)
}

type writeBalances struct {
	senderBNB   *big.Int
	senderODD   *big.Int
	contractODD *big.Int
}

func runWriteStep(
	t *testing.T,
	ctx context.Context,
	rpc *ethclient.Client,
	odd *oddtoken.ODDToken,
	sender common.Address,
	contractAddress common.Address,
	label string,
	submit func(*bind.TransactOpts) (*types.Transaction, error),
	privateKey *ecdsa.PrivateKey,
	chainID *big.Int,
) {
	t.Helper()
	before := readWriteBalances(t, ctx, rpc, odd, sender, contractAddress)
	tx, err := submit(writeTransactOpts(t, ctx, privateKey, chainID))
	if err != nil {
		t.Fatalf("%s submit: %v", label, err)
	}
	receipt := waitWriteReceipt(t, ctx, rpc, tx)
	after := readWriteBalances(t, ctx, rpc, odd, sender, contractAddress)
	logWriteResult(t, label, tx, receipt, before, after)
}

func writeTransactOpts(t *testing.T, ctx context.Context, privateKey *ecdsa.PrivateKey, chainID *big.Int) *bind.TransactOpts {
	t.Helper()
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		t.Fatalf("new transactor: %v", err)
	}
	auth.Context = ctx
	return auth
}

func readWriteBalances(t *testing.T, ctx context.Context, rpc *ethclient.Client, odd *oddtoken.ODDToken, sender common.Address, contractAddress common.Address) writeBalances {
	t.Helper()
	senderBNB, err := rpc.BalanceAt(ctx, sender, nil)
	if err != nil {
		t.Fatalf("read sender BNB: %v", err)
	}
	senderODD, err := odd.BalanceOf(&bind.CallOpts{Context: ctx}, sender)
	if err != nil {
		t.Fatalf("read sender ODD: %v", err)
	}
	contractODD, err := odd.BalanceOf(&bind.CallOpts{Context: ctx}, contractAddress)
	if err != nil {
		t.Fatalf("read contract ODD: %v", err)
	}
	return writeBalances{
		senderBNB:   senderBNB,
		senderODD:   senderODD,
		contractODD: contractODD,
	}
}

func waitWriteReceipt(t *testing.T, ctx context.Context, rpc *ethclient.Client, tx *types.Transaction) *types.Receipt {
	t.Helper()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		receipt, err := rpc.TransactionReceipt(ctx, tx.Hash())
		if err == nil {
			if receipt.Status != types.ReceiptStatusSuccessful {
				t.Fatalf("tx %s failed with status %d", tx.Hash(), receipt.Status)
			}
			return receipt
		}
		select {
		case <-ctx.Done():
			t.Fatalf("wait tx %s: %v", tx.Hash(), ctx.Err())
		case <-ticker.C:
		}
	}
}

func logWriteResult(t *testing.T, label string, tx *types.Transaction, receipt *types.Receipt, before writeBalances, after writeBalances) {
	t.Helper()
	t.Logf("%s tx_hash=%s block=%s gas_used=%d", label, tx.Hash(), receipt.BlockNumber.String(), receipt.GasUsed)
	t.Logf("%s sender_bnb_before=%s sender_bnb_after=%s sender_bnb_delta=%s", label, before.senderBNB, after.senderBNB, writeDelta(after.senderBNB, before.senderBNB))
	t.Logf("%s sender_odd_before=%s sender_odd_after=%s sender_odd_delta=%s", label, before.senderODD, after.senderODD, writeDelta(after.senderODD, before.senderODD))
	t.Logf("%s contract_odd_before=%s contract_odd_after=%s contract_odd_delta=%s", label, before.contractODD, after.contractODD, writeDelta(after.contractODD, before.contractODD))
}

func writeDelta(after *big.Int, before *big.Int) *big.Int {
	return new(big.Int).Sub(after, before)
}

func requiredWriteEnv(t *testing.T, key string) string {
	t.Helper()
	value := os.Getenv(key)
	if value == "" {
		t.Fatalf("missing %s", key)
	}
	return value
}

func requiredWritePrivateKey(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()
	value := strings.TrimPrefix(requiredWriteEnv(t, "ODDFI_PRIVATE_KEY"), "0x")
	privateKey, err := crypto.HexToECDSA(value)
	if err != nil {
		t.Fatalf("parse ODDFI_PRIVATE_KEY: %v", err)
	}
	return privateKey
}

func mustWriteAddress(t *testing.T, key string) common.Address {
	t.Helper()
	value := requiredWriteEnv(t, key)
	if !common.IsHexAddress(value) {
		t.Fatalf("%s is not a hex address", key)
	}
	return common.HexToAddress(value)
}

func writeScenarioAddressOrDefault(t *testing.T, key string, fallback common.Address) common.Address {
	t.Helper()
	value := os.Getenv(key)
	if value == "" {
		t.Logf("%s not set; defaulting to %s", key, fallback)
		return fallback
	}
	if !common.IsHexAddress(value) {
		t.Fatalf("%s is not a hex address", key)
	}
	return common.HexToAddress(value)
}

func writeScenarioAmount(t *testing.T, key string, fallback *big.Int) *big.Int {
	t.Helper()
	value := os.Getenv(key)
	if value == "" {
		return new(big.Int).Set(fallback)
	}
	amount, ok := new(big.Int).SetString(value, 10)
	if !ok || amount.Sign() < 0 {
		t.Fatalf("parse %s: %q", key, value)
	}
	return amount
}

func writeScenarioUint16(t *testing.T, key string, fallback uint16) uint16 {
	t.Helper()
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, ok := new(big.Int).SetString(value, 10)
	if !ok || parsed.Sign() < 0 || parsed.BitLen() > 16 {
		t.Fatalf("parse %s: %q", key, value)
	}
	return uint16(parsed.Uint64())
}
