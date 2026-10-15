//go:build e2e

// buy_onchain_e2e_test.go — a REAL public-sale buy on a live chain using a raw
// private key. The buyer signs and pays its own gas, so this exercises the
// TierSale.buy contract call DIRECTLY (it does NOT go through the Magic /
// sponsored relay path — that path needs the Magic signer service).
//
// Everything you need to edit (private key, RPC, presale contract address) is a
// `var` at the top of TestBuyOnChain. USDT is auto-discovered from the contract
// (tierSale.usdt()), so you don't have to look it up.
//
// Run:
//
//	go test -tags e2e -run TestBuyOnChain -v -timeout 5m ./tiersale/
//
// Preconditions (otherwise the test t.Skips or fails with a clear reason):
//   - the sale is started (saleStartTime != 0) and not closed;
//   - the buyer holds enough USDT for previewBuy(buyOdd);
//   - the buyer has approved USDT to TierSale. Approve is owned by a separate
//     component in production; set approveIfNeeded=true to let this test send the
//     approve itself as setup.

package tiersale

import (
	"context"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

/*
=== RUN   TestBuyOnChain

	buy_onchain_e2e_test.go:110: buyer        = 0x30167334a30BB991193e812d11Dc9bFf0DF663d4
	buy_onchain_e2e_test.go:111: tierSale     = 0xBe938fB7AF656B111a123B749bB724d8351497C7
	buy_onchain_e2e_test.go:112: currentTier  = 1
	buy_onchain_e2e_test.go:113: totalSold    = 1000000000000000000000 ODD-wei
	buy_onchain_e2e_test.go:114: buyOdd       = 50000000000000000 ODD-wei
	buy_onchain_e2e_test.go:115: usdtNeeded   = 500000000000000 USDT-wei (previewBuy)
	buy_onchain_e2e_test.go:124: usdt         = 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd
	buy_onchain_e2e_test.go:131: usdt balance = 500000000000000000, allowance→TierSale = 0
	buy_onchain_e2e_test.go:142: approve    tx=0xb0189bd7cd8e134d7822231ec35e87513452ae3216723383901a313b2185aaba
	buy_onchain_e2e_test.go:149: approve    mined block=113716854 gas=46194
	buy_onchain_e2e_test.go:142: buy        tx=0x6559efe557356ee092406bd96a0f41919bca9596f2a73230175c86f33e905f9e
	buy_onchain_e2e_test.go:149: buy        mined block=113716872 gas=258986
	buy_onchain_e2e_test.go:182: PurchaseRecorded: purchaseId=2 oddAmount=50000000000000000 usdtPaid=500000000000000

--- PASS: TestBuyOnChain (14.99s)
PASS
ok      github.com/Crypto-Barrett/contracts-business-layer/tiersale     15.104s
*/
func TestBuyOnChain(t *testing.T) {
	// ─── EDIT THESE ──────────────────────────────────────────────────────
	var (
		// 0x30167334a30BB991193e812d11Dc9bFf0DF663d4
		privKeyHex      = "" // buyer EOA private key, WITHOUT 0x prefix
		chainRPC        = "https://bnb-testnet.g.alchemy.com/v2/H35XdJCol-9YDMElNIXe3"
		tierSaleAddr    = "0xBe938fB7AF656B111a123B749bB724d8351497C7"  // presale (TierSale) proxy — BSC testnet
		chainID         = big.NewInt(97)                                // BSC testnet=97, mainnet=56
		buyOdd          = new(big.Int).Div(zeroOneEther, big.NewInt(2)) // 0.2 ODD (wei) to buy
		approveIfNeeded = true                                          // send USDT.approve as setup if allowance is short
	)
	// ─────────────────────────────────────────────────────────────────────

	if strings.TrimSpace(privKeyHex) == "" {
		t.Skip("set privKeyHex to run the on-chain buy test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	key, err := crypto.HexToECDSA(strings.TrimPrefix(privKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse privKeyHex: %v", err)
	}
	buyer := crypto.PubkeyToAddress(key.PublicKey)
	tier := common.HexToAddress(tierSaleAddr)

	eth, err := ethclient.DialContext(ctx, chainRPC)
	if err != nil {
		t.Fatalf("dial %s: %v", chainRPC, err)
	}
	defer eth.Close()

	tierABI, err := abi.JSON(strings.NewReader(tierSaleABIJSON))
	if err != nil {
		t.Fatalf("parse tierSale abi: %v", err)
	}
	erc20ABI, err := abi.JSON(strings.NewReader(erc20ABIJSON))
	if err != nil {
		t.Fatalf("parse erc20 abi: %v", err)
	}
	tierBC := bind.NewBoundContract(tier, tierABI, eth, eth, eth)

	// ─── read helpers ──────────────────────────────────────────────────
	readBig := func(bc *bind.BoundContract, method string, args ...interface{}) *big.Int {
		var out []interface{}
		if e := bc.Call(&bind.CallOpts{Context: ctx}, &out, method, args...); e != nil {
			t.Fatalf("read %s: %v", method, e)
		}
		return out[0].(*big.Int)
	}

	// ─── sale state pre-checks ─────────────────────────────────────────
	var startOut []interface{}
	if e := tierBC.Call(&bind.CallOpts{Context: ctx}, &startOut, "saleStartTime"); e != nil {
		t.Fatalf("read saleStartTime: %v", e)
	}
	if startOut[0].(uint64) == 0 {
		t.Skip("sale not started (saleStartTime == 0): nothing to buy")
	}
	var closedOut []interface{}
	if e := tierBC.Call(&bind.CallOpts{Context: ctx}, &closedOut, "saleClosed"); e != nil {
		t.Fatalf("read saleClosed: %v", e)
	}
	if closedOut[0].(bool) {
		t.Skip("sale is closed: buy would revert")
	}

	currentTier := readBig(tierBC, "getCurrentTier")
	totalSold := readBig(tierBC, "totalSold")
	usdtNeeded := readBig(tierBC, "previewBuy", buyOdd)
	t.Logf("buyer        = %s", buyer.Hex())
	t.Logf("tierSale     = %s", tier.Hex())
	t.Logf("currentTier  = %s", currentTier)
	t.Logf("totalSold    = %s ODD-wei", totalSold)
	t.Logf("buyOdd       = %s ODD-wei", buyOdd)
	t.Logf("usdtNeeded   = %s USDT-wei (previewBuy)", usdtNeeded)

	// ─── discover USDT, check balance + allowance ──────────────────────
	var usdtOut []interface{}
	if e := tierBC.Call(&bind.CallOpts{Context: ctx}, &usdtOut, "usdt"); e != nil {
		t.Fatalf("read usdt(): %v", e)
	}
	usdtAddr := usdtOut[0].(common.Address)
	usdtBC := bind.NewBoundContract(usdtAddr, erc20ABI, eth, eth, eth)
	t.Logf("usdt         = %s", usdtAddr.Hex())

	bal := readBig(usdtBC, "balanceOf", buyer)
	if bal.Cmp(usdtNeeded) < 0 {
		t.Skipf("buyer USDT balance %s < needed %s — fund the buyer first", bal, usdtNeeded)
	}
	allowance := readBig(usdtBC, "allowance", buyer, tier)
	t.Logf("usdt balance = %s, allowance→TierSale = %s", bal, allowance)

	opts := func() *bind.TransactOpts {
		o, e := bind.NewKeyedTransactorWithChainID(key, chainID)
		if e != nil {
			t.Fatalf("transactor: %v", e)
		}
		o.Context = ctx
		return o
	}
	mineTx := func(tx *types.Transaction, op string) *types.Receipt {
		t.Logf("%-10s tx=%s", op, tx.Hash().Hex())
		for i := 0; i < 90; i++ {
			r, _ := eth.TransactionReceipt(ctx, tx.Hash())
			if r != nil {
				if r.Status != 1 {
					t.Fatalf("%s reverted: %s gas=%d", op, tx.Hash().Hex(), r.GasUsed)
				}
				t.Logf("%-10s mined block=%d gas=%d", op, r.BlockNumber, r.GasUsed)
				return r
			}
			time.Sleep(2 * time.Second)
		}
		t.Fatalf("%s receipt timeout", op)
		return nil
	}

	// ─── approve (test setup only — production approve lives elsewhere) ─
	if allowance.Cmp(usdtNeeded) < 0 {
		if !approveIfNeeded {
			t.Skipf("allowance %s < needed %s and approveIfNeeded=false — approve USDT→TierSale first", allowance, usdtNeeded)
		}
		tx, e := usdtBC.Transact(opts(), "approve", tier, usdtNeeded)
		if e != nil {
			t.Fatalf("approve: %v", e)
		}
		mineTx(tx, "approve")
	}

	// ─── the buy ───────────────────────────────────────────────────────
	tx, err := tierBC.Transact(opts(), "buy", buyOdd)
	if err != nil {
		t.Fatalf("buy: %v", err)
	}
	receipt := mineTx(tx, "buy")

	// Decode the on-chain PurchaseRecorded via the package's own parser.
	parsed := parsePurchaseRecorded(receipt, tier)
	if !parsed.Found {
		t.Fatalf("buy succeeded but no PurchaseRecorded event found in receipt")
	}
	t.Logf("PurchaseRecorded: purchaseId=%s oddAmount=%s usdtPaid=%s",
		parsed.PurchaseID, parsed.OddAmount, parsed.UsdtPaid)

	if parsed.OddAmount.Cmp(buyOdd) != 0 {
		t.Fatalf("oddAmount mismatch: event %s != requested %s", parsed.OddAmount, buyOdd)
	}
	if parsed.UsdtPaid.Cmp(usdtNeeded) != 0 {
		t.Errorf("usdtPaid %s != previewBuy %s (informational; pricing may have moved between calls)", parsed.UsdtPaid, usdtNeeded)
	}
}

const tierSaleABIJSON = `[
 {"inputs":[{"internalType":"uint256","name":"oddAmount","type":"uint256"}],"name":"buy","outputs":[{"internalType":"uint256","name":"purchaseId","type":"uint256"},{"internalType":"uint256","name":"usdtAmount","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
 {"inputs":[{"internalType":"uint256","name":"oddAmount","type":"uint256"}],"name":"previewBuy","outputs":[{"internalType":"uint256","name":"usdtAmount","type":"uint256"}],"stateMutability":"view","type":"function"},
 {"inputs":[],"name":"getCurrentTier","outputs":[{"internalType":"uint256","name":"tier","type":"uint256"}],"stateMutability":"view","type":"function"},
 {"inputs":[],"name":"totalSold","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
 {"inputs":[],"name":"saleStartTime","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},
 {"inputs":[],"name":"saleClosed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
 {"inputs":[],"name":"usdt","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}
]`

const erc20ABIJSON = `[
 {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
 {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
 {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
]`
