//go:build e2e

// placebet_simulate_test.go — isolates BettingPool.placeBet from the
// SponsoredDelegator/EIP-7702 wrapper using eth_call (no on-chain side
// effects, no gas).
//
// First run: detects that the market does not exist and runs OpenMarket +
//            admin-side DepositMatch (1-year matchStart so lockAt never
//            elapses before a follow-up run).
// Subsequent runs: market already exists → skips setup, only simulates.
//
// Reuses constants from scenario_e2e_test.go (same package). To run:
//
//	go test -tags e2e -run TestPlaceBetSimulate -v ./...

package business_test

import (
	"context"
	"encoding/hex"
	"errors"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// Hard-coded matchID (any 32-byte hex). The first run creates this market
// on-chain with a one-year matchStartTime; all later runs reuse it as long
// as lockAt has not elapsed (~1 year from first run).
//
// To force a fresh market: change this constant to any other 32-byte hex.
const fixedMatchIDHex = "00000000000000000000000000000000000000000000000000000000deadbeef"

func TestPlaceBetSimulate(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	// ── Dial + SDK ─────────────────────────────────────────────────────
	eth, err := ethclient.DialContext(ctx, scenarioRPCURL)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer eth.Close()

	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             scenarioRPCURL,
		ODDTokenProxy:      common.HexToAddress(addrODDToken),
		StakingPoolProxy:   common.HexToAddress(addrStakingPool),
		LiquidityPoolProxy: common.HexToAddress(addrLiquidityPool),
		BettingPoolProxy:   common.HexToAddress(addrBettingPool),
	})
	if err != nil {
		t.Fatalf("oddfi.NewClient: %v", err)
	}
	defer sdk.Close(ctx)

	adminKey, err := crypto.HexToECDSA(strings.TrimPrefix(adminKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse adminKey: %v", err)
	}
	bettorKey, err := crypto.HexToECDSA(strings.TrimPrefix(bettorKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse bettorKey: %v", err)
	}
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)
	bettorAddr := crypto.PubkeyToAddress(bettorKey.PublicKey)
	chainID := big.NewInt(scenarioChainID)

	bpAddr := common.HexToAddress(addrBettingPool)
	lpAddr := common.HexToAddress(addrLiquidityPool)

	var matchID coretypes.MatchID
	mb, err := hex.DecodeString(fixedMatchIDHex)
	if err != nil || len(mb) != 32 {
		t.Fatalf("bad fixedMatchIDHex: %v len=%d", err, len(mb))
	}
	copy(matchID[:], mb)
	marketID := scenarioMarketID(matchID, 0, 0)

	t.Logf("admin    = %s", adminAddr.Hex())
	t.Logf("bettor   = %s", bettorAddr.Hex())
	t.Logf("matchID  = 0x%x", matchID)
	t.Logf("marketID = 0x%x", marketID)

	// ── Helpers ────────────────────────────────────────────────────────
	adminOpts := func() *bind.TransactOpts {
		o, e := bind.NewKeyedTransactorWithChainID(adminKey, chainID)
		if e != nil {
			t.Fatalf("adminOpts: %v", e)
		}
		o.Context = ctx
		return o
	}

	mineTx := func(tx *types.Transaction, op string) {
		t.Logf("%-22s tx=%s", op, tx.Hash().Hex())
		for i := 0; i < 60; i++ {
			r, _ := eth.TransactionReceipt(ctx, tx.Hash())
			if r != nil {
				if r.Status != 1 {
					t.Fatalf("%s reverted: %s gas=%d", op, tx.Hash().Hex(), r.GasUsed)
				}
				t.Logf("%-22s mined block=%d gas=%d", op, r.BlockNumber, r.GasUsed)
				return
			}
			time.Sleep(2 * time.Second)
		}
		t.Fatalf("%s receipt timeout", op)
	}

	// ── Detect: does the market already exist? ────────────────────────
	mkt, gmErr := sdk.BettingPool().GetMarket(ctx, marketID)
	if gmErr != nil {
		t.Fatalf("GetMarket pre-check: %v", gmErr)
	}

	if mkt.OutcomeCount == 0 {
		// ────────────────────────────────────────────────────────────
		// FIRST RUN — open the market + admin LP deposit.
		// ────────────────────────────────────────────────────────────
		t.Log("=== First run: market not found, opening + depositing LP ===")

		operatorRole := crypto.Keccak256Hash([]byte("OPERATOR_ROLE"))
		if has, _ := sdk.BettingPool().HasRole(ctx, operatorRole, adminAddr); !has {
			tx, err2 := sdk.BettingPool().GrantRole(adminOpts(), operatorRole, adminAddr)
			if err2 != nil {
				t.Fatalf("GrantRole: %v", err2)
			}
			mineTx(tx, "GrantRole")
		}

		// One-year window so lockAt never elapses across repeated test sessions.
		matchStart := uint64(time.Now().Unix() + 365*24*3600)
		matchEnd := matchStart + 60
		baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}
		tx, err := sdk.BettingPool().OpenMarket(
			adminOpts(), matchID, 0, 0, matchStart, matchEnd, baseOdds, uint64(time.Now().Unix()),
		)
		if err != nil {
			t.Fatalf("OpenMarket: %v", err)
		}
		mineTx(tx, "OpenMarket")

		// Admin approve LP + DepositMatch (admin acts as LP here so we don't
		// need to thread through the sponsored path).
		one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
		lpAmount := new(big.Int).Mul(big.NewInt(1000), one18)

		tx, err = sdk.ODDToken().Approve(adminOpts(), lpAddr, lpAmount)
		if err != nil {
			t.Fatalf("Approve LP: %v", err)
		}
		mineTx(tx, "Approve LP")

		tx, err = sdk.LiquidityPool().DepositMatch(adminOpts(), matchID, lpAmount)
		if err != nil {
			t.Fatalf("DepositMatch: %v", err)
		}
		mineTx(tx, "DepositMatch")

		// Re-read market state.
		mkt, _ = sdk.BettingPool().GetMarket(ctx, marketID)
	} else {
		t.Logf("Market already exists: status=%d outcomes=%d lockAt=%d matchEnd=%d",
			mkt.Status, mkt.OutcomeCount, mkt.LockAt, mkt.MatchEndTime)
	}

	// ── Now simulate placeBet ─────────────────────────────────────────
	odds, _ := sdk.BettingPool().GetMarketOdds(ctx, marketID)
	t.Logf("odds: quoteVersion=%s updatedAt=%d quotedOdds=%v", odds.QuoteVersion, odds.UpdatedAt, odds.QuotedOdds)

	bal, _ := sdk.ODDToken().BalanceOf(ctx, bettorAddr)
	allow, _ := sdk.ODDToken().Allowance(ctx, bettorAddr, bpAddr)
	t.Logf("bettor.ODD balance=%s  allowance(to BP)=%s", bal, allow)

	now := uint64(time.Now().Unix())
	t.Logf("now=%d  lockAt=%d  matchEnd=%d  →  market %s",
		now, mkt.LockAt, mkt.MatchEndTime,
		map[bool]string{true: "STILL OPEN", false: "LOCKED"}[now < mkt.LockAt])

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	betAmount := new(big.Int).Mul(big.NewInt(100), one18)
	guard := oddfi.QuoteGuardInput{
		QuoteVersion:      odds.QuoteVersion,
		QuotedAt:          odds.UpdatedAt,
		MinOdds:           big.NewInt(10100),
		MinAcceptedAmount: big.NewInt(1),
		Deadline:          big.NewInt(time.Now().Add(15 * time.Minute).Unix()),
	}

	calldata, err := sdk.BettingPool().PlaceBetCalldata(marketID, 0, betAmount, guard)
	if err != nil {
		t.Fatalf("PlaceBetCalldata: %v", err)
	}

	result, callErr := eth.CallContract(ctx, ethereum.CallMsg{
		From: bettorAddr,
		To:   &bpAddr,
		Data: calldata,
	}, nil)

	if callErr == nil {
		t.Logf("✅ eth_call SUCCEEDED — placeBet would not revert. result=0x%x", result)
		t.Logf("   (so the failure path in TestScenarioFullMatch is in the SponsoredDelegator wrapper)")
		return
	}

	t.Logf("❌ eth_call REVERTED: %v", callErr)
	if data, ok := tryExtractRevertData(callErr); ok && len(data) >= 4 {
		sel := hex.EncodeToString(data[:4])
		t.Logf("revert raw  = 0x%x", data)
		t.Logf("revert selector = 0x%s", sel)
		t.Logf("─── BettingPool error selector reference ───")
		candidates := []string{
			"MarketClosed(bytes32)",
			"MarketLocked(bytes32)",
			"MarketNotOpen(bytes32)",
			"MarketAlreadyExists(bytes32)",
			"SettlementCannotClose(bytes32)",
			"BetNotOwner(bytes32,address)",
			"PayoutAlreadyClaimed(bytes32)",
			"PayoutNotClaimable(bytes32)",
			"InvalidReferralClaim()",
			"InvalidReferrerBinding()",
			"InvalidTaxConfig()",
			"PayoutTooSmall()",
			"MarketTemplateNotAllowed(uint8,uint8)",
			"AccessControlUnauthorizedAccount(address,bytes32)",
			"EnforcedPause()",
			"FailedCall()",
			"InvalidAddress()",
		}
		for _, sig := range candidates {
			s := hex.EncodeToString(crypto.Keccak256([]byte(sig))[:4])
			mark := ""
			if s == sel {
				mark = "  ← MATCH"
			}
			t.Logf("  %-46s 0x%s%s", sig, s, mark)
		}
	}
}

// tryExtractRevertData inspects an eth_call error and tries to pull out
// the contract's raw return data (4-byte selector + args).
func tryExtractRevertData(err error) ([]byte, bool) {
	type dataErr interface{ ErrorData() interface{} }
	var de dataErr
	if errors.As(err, &de) {
		switch v := de.ErrorData().(type) {
		case string:
			if b, ok := hexToBytes(v); ok {
				return b, true
			}
		case []byte:
			return v, true
		}
	}
	msg := err.Error()
	if i := strings.Index(msg, "0x"); i >= 0 {
		end := i + 2
		for end < len(msg) {
			c := msg[end]
			if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') {
				end++
				continue
			}
			break
		}
		if end-i >= 10 {
			if b, ok := hexToBytes(msg[i:end]); ok {
				return b, true
			}
		}
	}
	return nil, false
}

// TestPlaceBetHistorical replays the failing sponsored PlaceBet from the last
// TestScenarioFullMatch run, BUT executes eth_call at a historical block
// (one block BEFORE the failure) — at that height the market was still Open,
// so any revert we observe is the SAME failure path the sponsored tx hit.
//
// Update these two constants from your latest ./1 failure log if needed.
func TestPlaceBetHistorical(t *testing.T) {
	const failedMarketIDHex = "3fffb8865fc5b6fef7fad2e64eff2ff6f30d49d056230faed875945d798e66f0"
	const simulateAtBlock = uint64(107386384) // failure block - 1

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	eth, err := ethclient.DialContext(ctx, scenarioRPCURL)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer eth.Close()

	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             scenarioRPCURL,
		ODDTokenProxy:      common.HexToAddress(addrODDToken),
		StakingPoolProxy:   common.HexToAddress(addrStakingPool),
		LiquidityPoolProxy: common.HexToAddress(addrLiquidityPool),
		BettingPoolProxy:   common.HexToAddress(addrBettingPool),
	})
	if err != nil {
		t.Fatalf("oddfi.NewClient: %v", err)
	}
	defer sdk.Close(ctx)

	bettorKey, _ := crypto.HexToECDSA(strings.TrimPrefix(bettorKeyHex, "0x"))
	bettorAddr := crypto.PubkeyToAddress(bettorKey.PublicKey)
	bpAddr := common.HexToAddress(addrBettingPool)

	var marketID coretypes.MarketID
	mb, _ := hex.DecodeString(failedMarketIDHex)
	copy(marketID[:], mb)
	t.Logf("replaying at block %d  marketID=0x%x  bettor=%s",
		simulateAtBlock, marketID, bettorAddr.Hex())

	blockBig := new(big.Int).SetUint64(simulateAtBlock)

	// Build PlaceBetCalldata with conservative guard. Use latest-known odds
	// (cheap to read at historical block via RPC); fallback to constants.
	// We can't easily ask SDK to read at a historical block, so use RPC
	// for getMarketOdds at the historical block.
	oddsSelector := crypto.Keccak256([]byte("getMarketOdds(bytes32)"))[:4]
	oddsCalldata := append(append([]byte(nil), oddsSelector...), marketID[:]...)
	oddsRaw, err := eth.CallContract(ctx, ethereum.CallMsg{To: &bpAddr, Data: oddsCalldata}, blockBig)
	if err != nil {
		t.Fatalf("historical getMarketOdds: %v", err)
	}
	t.Logf("historical odds raw len=%d", len(oddsRaw))
	// Decode just QuoteVersion (last 32 bytes) and UpdatedAt (preceding 32 bytes
	// after offsets). Standard ABI layout for (uint256[], uint256[], uint64, uint256):
	// 4 head words then dynamic arrays. Easiest: extract uint64 updatedAt + uint256
	// QuoteVersion from the tail. We'll just use whatever raw shape — to keep
	// this simple, just use placeholder guard values that PASS guard checks.
	// (placeBet rejects on guard mismatch; we accept that as one possible answer.)
	guard := oddfi.QuoteGuardInput{
		QuoteVersion:      big.NewInt(1),
		QuotedAt:          0, // 0 == "I don't care"; if contract rejects, that's a clue
		MinOdds:           big.NewInt(10100),
		MinAcceptedAmount: big.NewInt(1),
		Deadline:          big.NewInt(time.Now().Add(15 * time.Minute).Unix()),
	}

	// However, the original failing tx used the REAL latest-at-the-time
	// QuoteVersion/UpdatedAt. To best replay, fetch the contract's storage
	// values at simulateAtBlock by re-using getMarketOdds output. Try the
	// simpler path first — using the *current* odds wherever they are.
	odds, _ := sdk.BettingPool().GetMarketOdds(ctx, marketID)
	if odds.QuoteVersion != nil && odds.QuoteVersion.Sign() > 0 {
		guard.QuoteVersion = odds.QuoteVersion
		guard.QuotedAt = odds.UpdatedAt
	}

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	betAmount := new(big.Int).Mul(big.NewInt(100), one18)

	calldata, err := sdk.BettingPool().PlaceBetCalldata(marketID, 0, betAmount, guard)
	if err != nil {
		t.Fatalf("PlaceBetCalldata: %v", err)
	}

	// Execute at historical block — bettor sees latest-block code (delegate
	// already attached), but state is rewound. This reproduces the sponsored
	// failure path while keeping market state = Open.
	result, callErr := eth.CallContract(ctx, ethereum.CallMsg{
		From: bettorAddr,
		To:   &bpAddr,
		Data: calldata,
	}, blockBig)

	if callErr == nil {
		t.Logf("✅ historical eth_call SUCCEEDED at block %d — placeBet would have worked. result=0x%x",
			simulateAtBlock, result)
		t.Logf("   → real sponsored failure must come from SponsoredDelegator wrapping (msg.sender / context divergence)")
		return
	}

	t.Logf("❌ historical eth_call REVERTED: %v", callErr)
	if data, ok := tryExtractRevertData(callErr); ok && len(data) >= 4 {
		sel := hex.EncodeToString(data[:4])
		t.Logf("revert raw      = 0x%x", data)
		t.Logf("revert selector = 0x%s", sel)
		t.Logf("─── selector reference ───")
		candidates := []string{
			"MarketClosed(bytes32)", "MarketLocked(bytes32)", "MarketNotOpen(bytes32)",
			"MarketAlreadyExists(bytes32)", "SettlementCannotClose(bytes32)",
			"BetNotOwner(bytes32,address)", "PayoutAlreadyClaimed(bytes32)",
			"PayoutNotClaimable(bytes32)", "InvalidReferralClaim()",
			"InvalidReferrerBinding()", "InvalidTaxConfig()", "PayoutTooSmall()",
			"MarketTemplateNotAllowed(uint8,uint8)",
			"AccessControlUnauthorizedAccount(address,bytes32)",
			"EnforcedPause()", "FailedCall()", "InvalidAddress()",
		}
		for _, sig := range candidates {
			s := hex.EncodeToString(crypto.Keccak256([]byte(sig))[:4])
			mark := ""
			if s == sel {
				mark = "  ← MATCH"
			}
			t.Logf("  %-46s 0x%s%s", sig, s, mark)
		}
	}
}

func hexToBytes(s string) ([]byte, bool) {
	s = strings.TrimPrefix(s, "0x")
	if len(s)%2 != 0 {
		return nil, false
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		return nil, false
	}
	return b, true
}
