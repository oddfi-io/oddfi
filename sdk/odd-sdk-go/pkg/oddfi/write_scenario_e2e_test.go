package oddfi_test

import (
	"context"
	"crypto/ecdsa"
	"fmt"
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

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

func TestWriteScenarioODDTokenTransferViaPublicSDK(t *testing.T) {
	env := newWriteScenarioEnv(t)
	to := scenarioRecipient(t, env.from)
	amount := scenarioAmount(t, "ODDFI_SCENARIO_TRANSFER_AMOUNT_WEI", big.NewInt(1))
	zero := oddfi.MustParseAddress("0x0000000000000000000000000000000000000000")

	before := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, to, zero, zero)
	tx := submitTransfer(t, env.ctx, env.client, env.privateKey, env.chainID, to, amount)
	receipt := waitMined(t, env.ctx, env.observer, tx)
	after := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, to, zero, zero)
	logBalanceChange(t, "ODDToken.Transfer", tx, receipt, before, after)
}

func TestWriteScenarioODDTokenApproveViaPublicSDK(t *testing.T) {
	env := newWriteScenarioEnv(t)
	spender := scenarioSpender(t)
	amount := scenarioAmount(t, "ODDFI_SCENARIO_APPROVE_AMOUNT_WEI", big.NewInt(1))
	zero := oddfi.MustParseAddress("0x0000000000000000000000000000000000000000")

	before := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, spender, spender, zero)
	tx := submitApprove(t, env.ctx, env.client, env.privateKey, env.chainID, spender, amount)
	receipt := waitMined(t, env.ctx, env.observer, tx)
	after := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, spender, spender, zero)
	logBalanceChange(t, "ODDToken.Approve", tx, receipt, before, after)
}

func TestWriteScenarioStakingPoolStakeViaPublicSDK(t *testing.T) {
	env := newWriteScenarioEnv(t)
	amount, err := env.client.StakingPool().MinStakeAmount(env.ctx)
	if err != nil {
		t.Fatalf("StakingPool.MinStakeAmount: %v", err)
	}
	amount = scenarioAmount(t, "ODDFI_SCENARIO_STAKE_AMOUNT_WEI", amount)
	planID := scenarioUint16(t, "ODDFI_SCENARIO_STAKE_PLAN_ID", 0)

	approveForScenario(t, env, env.stakingPool, amount, "Setup.ODDToken.ApproveStakingPool")
	before := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, env.stakingPool, env.stakingPool, env.stakingPool)
	tx := submitStake(t, env.ctx, env.client, env.privateKey, env.chainID, amount, planID)
	receipt := waitMined(t, env.ctx, env.observer, tx)
	after := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, env.stakingPool, env.stakingPool, env.stakingPool)
	logBalanceChange(t, "StakingPool.Stake", tx, receipt, before, after)
}

func TestWriteScenarioLiquidityPoolDepositGlobalViaPublicSDK(t *testing.T) {
	env := newWriteScenarioEnv(t)
	amount, err := env.client.LiquidityPool().MinDeposit(env.ctx)
	if err != nil {
		t.Fatalf("LiquidityPool.MinDeposit: %v", err)
	}
	amount = scenarioAmount(t, "ODDFI_SCENARIO_LIQUIDITY_AMOUNT_WEI", amount)
	planID := scenarioUint16(t, "ODDFI_SCENARIO_LIQUIDITY_PLAN_ID", 0)

	approveForScenario(t, env, env.liquidityPool, amount, "Setup.ODDToken.ApproveLiquidityPool")
	before := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, env.liquidityPool, env.liquidityPool, env.liquidityPool)
	tx := submitDepositGlobal(t, env.ctx, env.client, env.privateKey, env.chainID, amount, planID)
	receipt := waitMined(t, env.ctx, env.observer, tx)
	after := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, env.liquidityPool, env.liquidityPool, env.liquidityPool)
	logBalanceChange(t, "LiquidityPool.DepositGlobal", tx, receipt, before, after)
}

func TestWriteScenarioBettingPoolAddPlatformReserveViaPublicSDK(t *testing.T) {
	env := newWriteScenarioEnv(t)
	amount := scenarioAmount(t, "ODDFI_SCENARIO_RESERVE_AMOUNT_WEI", big.NewInt(1))

	approveForScenario(t, env, env.bettingPool, amount, "Setup.ODDToken.ApproveBettingPoolReserve")
	before := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, env.bettingPool, env.bettingPool, env.bettingPool)
	tx := submitAddPlatformReserve(t, env.ctx, env.client, env.privateKey, env.chainID, amount)
	receipt := waitMined(t, env.ctx, env.observer, tx)
	after := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, env.bettingPool, env.bettingPool, env.bettingPool)
	logBalanceChange(t, "BettingPool.AddPlatformReserve", tx, receipt, before, after)
}

type writeScenarioEnv struct {
	ctx           context.Context
	observer      *ethclient.Client
	client        *oddfi.Client
	privateKey    *ecdsa.PrivateKey
	chainID       *big.Int
	from          common.Address
	stakingPool   common.Address
	liquidityPool common.Address
	bettingPool   common.Address
}

func newWriteScenarioEnv(t *testing.T) *writeScenarioEnv {
	t.Helper()
	if os.Getenv("ODDFI_WRITE_E2E") != "1" {
		t.Skip("set ODDFI_WRITE_E2E=1 to run write scenario e2e")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	t.Cleanup(cancel)

	rpcURL := requiredEnv(t, "ODDFI_RPC_URL")
	privateKey := requiredPrivateKey(t)
	from := crypto.PubkeyToAddress(privateKey.PublicKey)

	observer, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		t.Fatalf("dial observer rpc: %v", err)
	}
	t.Cleanup(observer.Close)

	chainID, err := observer.ChainID(ctx)
	if err != nil {
		t.Fatalf("chain id: %v", err)
	}

	client, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             rpcURL,
		ODDTokenProxy:      mustParseEnvAddress(t, "ODDFI_ODD_TOKEN_PROXY"),
		StakingPoolProxy:   mustParseEnvAddress(t, "ODDFI_STAKING_POOL_PROXY"),
		LiquidityPoolProxy: mustParseEnvAddress(t, "ODDFI_LIQUIDITY_POOL_PROXY"),
		BettingPoolProxy:   mustParseEnvAddress(t, "ODDFI_BETTING_POOL_PROXY"),
	})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	t.Cleanup(func() {
		if err := client.Close(ctx); err != nil {
			t.Fatalf("Close: %v", err)
		}
	})

	return &writeScenarioEnv{
		ctx:           ctx,
		observer:      observer,
		client:        client,
		privateKey:    privateKey,
		chainID:       chainID,
		from:          from,
		stakingPool:   mustParseEnvAddress(t, "ODDFI_STAKING_POOL_PROXY"),
		liquidityPool: mustParseEnvAddress(t, "ODDFI_LIQUIDITY_POOL_PROXY"),
		bettingPool:   mustParseEnvAddress(t, "ODDFI_BETTING_POOL_PROXY"),
	}
}

func approveForScenario(t *testing.T, env *writeScenarioEnv, spender common.Address, amount *big.Int, label string) {
	t.Helper()
	before := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, spender, spender, spender)
	tx := submitApprove(t, env.ctx, env.client, env.privateKey, env.chainID, spender, amount)
	receipt := waitMined(t, env.ctx, env.observer, tx)
	after := readScenarioBalances(t, env.ctx, env.observer, env.client, env.from, spender, spender, spender)
	logBalanceChange(t, label, tx, receipt, before, after)
}

type scenarioBalances struct {
	fromBNB      *big.Int
	fromODD      *big.Int
	recipientODD *big.Int
	allowance    *big.Int
	contractODD  *big.Int
}

func submitTransfer(t *testing.T, ctx context.Context, client *oddfi.Client, privateKey *ecdsa.PrivateKey, chainID *big.Int, to common.Address, amount *big.Int) *types.Transaction {
	t.Helper()
	opts := transactOpts(t, ctx, privateKey, chainID)
	tx, err := client.ODDToken().Transfer(opts, to, new(big.Int).Set(amount))
	if err != nil {
		t.Fatalf("transfer submit: %v", err)
	}
	return tx
}

func submitApprove(t *testing.T, ctx context.Context, client *oddfi.Client, privateKey *ecdsa.PrivateKey, chainID *big.Int, spender common.Address, amount *big.Int) *types.Transaction {
	t.Helper()
	opts := transactOpts(t, ctx, privateKey, chainID)
	tx, err := client.ODDToken().Approve(opts, spender, new(big.Int).Set(amount))
	if err != nil {
		t.Fatalf("approve submit: %v", err)
	}
	return tx
}

func submitStake(t *testing.T, ctx context.Context, client *oddfi.Client, privateKey *ecdsa.PrivateKey, chainID *big.Int, amount *big.Int, planID uint16) *types.Transaction {
	t.Helper()
	tx, err := client.StakingPool().Stake(transactOpts(t, ctx, privateKey, chainID), new(big.Int).Set(amount), planID)
	if err != nil {
		t.Fatalf("stake submit: %v", err)
	}
	return tx
}

func submitDepositGlobal(t *testing.T, ctx context.Context, client *oddfi.Client, privateKey *ecdsa.PrivateKey, chainID *big.Int, amount *big.Int, planID uint16) *types.Transaction {
	t.Helper()
	tx, err := client.LiquidityPool().DepositGlobal(transactOpts(t, ctx, privateKey, chainID), new(big.Int).Set(amount), planID)
	if err != nil {
		t.Fatalf("deposit global submit: %v", err)
	}
	return tx
}

func submitAddPlatformReserve(t *testing.T, ctx context.Context, client *oddfi.Client, privateKey *ecdsa.PrivateKey, chainID *big.Int, amount *big.Int) *types.Transaction {
	t.Helper()
	tx, err := client.BettingPool().AddPlatformReserve(transactOpts(t, ctx, privateKey, chainID), new(big.Int).Set(amount))
	if err != nil {
		t.Fatalf("add platform reserve submit: %v", err)
	}
	return tx
}

func transactOpts(t *testing.T, ctx context.Context, privateKey *ecdsa.PrivateKey, chainID *big.Int) *bind.TransactOpts {
	t.Helper()
	opts, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		t.Fatalf("new transactor: %v", err)
	}
	opts.Context = ctx
	return opts
}

func readScenarioBalances(t *testing.T, ctx context.Context, observer *ethclient.Client, client *oddfi.Client, from common.Address, to common.Address, spender common.Address, contract common.Address) scenarioBalances {
	t.Helper()
	fromBNB, err := observer.BalanceAt(ctx, from, nil)
	if err != nil {
		t.Fatalf("read BNB balance: %v", err)
	}
	fromODD, err := client.ODDToken().BalanceOf(ctx, from)
	if err != nil {
		t.Fatalf("read sender ODD balance: %v", err)
	}
	recipientODD, err := client.ODDToken().BalanceOf(ctx, to)
	if err != nil {
		t.Fatalf("read recipient ODD balance: %v", err)
	}
	allowance, err := client.ODDToken().Allowance(ctx, from, spender)
	if err != nil {
		t.Fatalf("read allowance: %v", err)
	}
	contractODD, err := client.ODDToken().BalanceOf(ctx, contract)
	if err != nil {
		t.Fatalf("read contract ODD balance: %v", err)
	}
	return scenarioBalances{
		fromBNB:      fromBNB,
		fromODD:      fromODD,
		recipientODD: recipientODD,
		allowance:    allowance,
		contractODD:  contractODD,
	}
}

func waitMined(t *testing.T, ctx context.Context, observer *ethclient.Client, tx *types.Transaction) *types.Receipt {
	t.Helper()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		receipt, err := observer.TransactionReceipt(ctx, tx.Hash())
		if err == nil {
			if receipt.Status != types.ReceiptStatusSuccessful {
				t.Fatalf("tx %s failed with status %d", tx.Hash(), receipt.Status)
			}
			return receipt
		}
		select {
		case <-ctx.Done():
			t.Fatalf("wait receipt %s: %v", tx.Hash(), ctx.Err())
		case <-ticker.C:
		}
	}
}

func logBalanceChange(t *testing.T, label string, tx *types.Transaction, receipt *types.Receipt, before scenarioBalances, after scenarioBalances) {
	t.Helper()
	t.Logf("%s tx_hash=%s block=%d gas_used=%d", label, tx.Hash(), receipt.BlockNumber.Uint64(), receipt.GasUsed)
	t.Logf("%s sender_bnb_before=%s sender_bnb_after=%s sender_bnb_delta=%s", label, before.fromBNB, after.fromBNB, delta(after.fromBNB, before.fromBNB))
	t.Logf("%s sender_odd_before=%s sender_odd_after=%s sender_odd_delta=%s", label, before.fromODD, after.fromODD, delta(after.fromODD, before.fromODD))
	t.Logf("%s recipient_odd_before=%s recipient_odd_after=%s recipient_odd_delta=%s", label, before.recipientODD, after.recipientODD, delta(after.recipientODD, before.recipientODD))
	t.Logf("%s allowance_before=%s allowance_after=%s allowance_delta=%s", label, before.allowance, after.allowance, delta(after.allowance, before.allowance))
	t.Logf("%s contract_odd_before=%s contract_odd_after=%s contract_odd_delta=%s", label, before.contractODD, after.contractODD, delta(after.contractODD, before.contractODD))
}

func delta(after *big.Int, before *big.Int) *big.Int {
	return new(big.Int).Sub(after, before)
}

func requiredPrivateKey(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()
	value := strings.TrimPrefix(requiredEnv(t, "ODDFI_PRIVATE_KEY"), "0x")
	privateKey, err := crypto.HexToECDSA(value)
	if err != nil {
		t.Fatalf("parse ODDFI_PRIVATE_KEY: %v", err)
	}
	return privateKey
}

func scenarioRecipient(t *testing.T, fallback common.Address) common.Address {
	t.Helper()
	value := os.Getenv("ODDFI_SCENARIO_RECIPIENT")
	if value == "" {
		t.Logf("ODDFI_SCENARIO_RECIPIENT not set; defaulting recipient to sender %s", fallback)
		return fallback
	}
	address, err := oddfi.ParseAddress(value)
	if err != nil {
		t.Fatalf("parse ODDFI_SCENARIO_RECIPIENT: %v", err)
	}
	return address
}

func scenarioSpender(t *testing.T) common.Address {
	t.Helper()
	value := os.Getenv("ODDFI_SCENARIO_SPENDER")
	if value == "" {
		return mustParseEnvAddress(t, "ODDFI_BETTING_POOL_PROXY")
	}
	address, err := oddfi.ParseAddress(value)
	if err != nil {
		t.Fatalf("parse ODDFI_SCENARIO_SPENDER: %v", err)
	}
	return address
}

func scenarioAmount(t *testing.T, key string, fallback *big.Int) *big.Int {
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

func scenarioUint16(t *testing.T, key string, fallback uint16) uint16 {
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

func Example_writeScenarioCommand() {
	fmt.Println("ODDFI_WRITE_E2E=1 ODDFI_PRIVATE_KEY=<redacted> go test ./pkg/oddfi -run 'TestWriteScenario.*ViaPublicSDK' -count=1 -v")
	// Output:
	// ODDFI_WRITE_E2E=1 ODDFI_PRIVATE_KEY=<redacted> go test ./pkg/oddfi -run 'TestWriteScenario.*ViaPublicSDK' -count=1 -v
}
