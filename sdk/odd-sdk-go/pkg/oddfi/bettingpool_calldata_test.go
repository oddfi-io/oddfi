package oddfi

// Note: adapter-level abi.Pack failure for all BettingPool Calldata methods
// is structurally unreachable from the typed public facade — every parameter
// is a fixed Go type that the ABI binding accepts unconditionally. The
// wrapUserError(op, err) path on adapter failure exists as defense-in-depth
// for ABI drift after binding regeneration. Nil-bigint tests cover the only
// reachable user-input error path.

import (
	"bytes"
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

type stubBettingPoolCaller struct{}

func (stubBettingPoolCaller) CodeAt(_ context.Context, _ common.Address, _ *big.Int) ([]byte, error) {
	return []byte{0x60}, nil
}
func (stubBettingPoolCaller) CallContract(_ context.Context, _ ethereum.CallMsg, _ *big.Int) ([]byte, error) {
	return nil, errors.New("stub call contract")
}

func newOfflineBettingPool(t *testing.T) *BettingPool {
	t.Helper()
	adapter, err := contracts.NewBettingPoolAdapter(stubBettingPoolCaller{}, nil, common.HexToAddress("0x0000000000000000000000000000000000000001"))
	if err != nil {
		t.Fatalf("build adapter: %v", err)
	}
	return &BettingPool{adapter: adapter}
}

// TestBettingPool_AddPlatformReserveCalldata verifies selector correctness.
func TestBettingPool_AddPlatformReserveCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	amount := big.NewInt(5_000_000_000_000_000_000)

	data, err := pool.AddPlatformReserveCalldata(amount)
	if err != nil {
		t.Fatalf("AddPlatformReserveCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("addPlatformReserve(uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_AddPlatformReserveCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_AddPlatformReserveCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*BettingPool)(nil).AddPlatformReserveCalldata(big.NewInt(1))
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_AddPlatformReserveCalldata_NilAmount verifies nil amount returns UserError.
func TestBettingPool_AddPlatformReserveCalldata_NilAmount(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	_, err := pool.AddPlatformReserveCalldata(nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestBettingPool_GrantRoleCalldata verifies selector correctness.
func TestBettingPool_GrantRoleCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	role := [32]byte(crypto.Keccak256Hash([]byte("OPERATOR_ROLE")))
	account := common.HexToAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F")

	data, err := pool.GrantRoleCalldata(role, account)
	if err != nil {
		t.Fatalf("GrantRoleCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("grantRole(bytes32,address)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_GrantRoleCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_GrantRoleCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	role := [32]byte(crypto.Keccak256Hash([]byte("SETTLER_ROLE")))
	account := common.HexToAddress("0x0000000000000000000000000000000000000002")
	_, err := (*BettingPool)(nil).GrantRoleCalldata(role, account)
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_GrantRoleCalldata_Deterministic verifies that encoding the same
// inputs twice yields identical bytes (no mutable state in ABI encoding).
func TestBettingPool_GrantRoleCalldata_Deterministic(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	role := [32]byte(crypto.Keccak256Hash([]byte("ADMIN_ROLE")))
	account := common.HexToAddress("0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF")

	data1, err := pool.GrantRoleCalldata(role, account)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}
	data2, err := pool.GrantRoleCalldata(role, account)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}
	if !bytes.Equal(data1, data2) {
		t.Fatalf("non-deterministic encoding: %x vs %x", data1, data2)
	}
}

// TestBettingPool_OpenMarketCalldata verifies selector correctness.
func TestBettingPool_OpenMarketCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var matchID [32]byte
	copy(matchID[:], crypto.Keccak256([]byte("match-42")))
	var marketType uint8 = 1
	var line uint8 = 0
	var matchStartTime uint64 = 1_700_100_000
	var matchEndTime uint64 = 1_700_106_000
	baseOdds := []*big.Int{big.NewInt(20_000), big.NewInt(18_000), big.NewInt(30_000)}
	var updatedAt uint64 = 1_700_000_000

	data, err := pool.OpenMarketCalldata(matchID, marketType, line, matchStartTime, matchEndTime, baseOdds, updatedAt)
	if err != nil {
		t.Fatalf("OpenMarketCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("openMarket(bytes32,uint8,uint8,uint64,uint64,uint256[],uint64)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_OpenMarketCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_OpenMarketCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	var matchID [32]byte
	baseOdds := []*big.Int{big.NewInt(20_000), big.NewInt(18_000)}
	_, err := (*BettingPool)(nil).OpenMarketCalldata(matchID, 0, 0, 0, 0, baseOdds, 0)
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_OpenMarketCalldata_NilBaseOdds verifies nil baseOdds returns UserError.
func TestBettingPool_OpenMarketCalldata_NilBaseOdds(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var matchID [32]byte
	_, err := pool.OpenMarketCalldata(matchID, 0, 0, 0, 0, nil, 0)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestBettingPool_OpenMarketCalldata_NilElementInBaseOdds verifies a nil element in baseOdds returns UserError.
func TestBettingPool_OpenMarketCalldata_NilElementInBaseOdds(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var matchID [32]byte
	baseOdds := []*big.Int{big.NewInt(20_000), nil, big.NewInt(30_000)}
	_, err := pool.OpenMarketCalldata(matchID, 0, 0, 0, 0, baseOdds, 0)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam for nil element, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestBettingPool_UpdateOddsCalldata verifies selector correctness.
func TestBettingPool_UpdateOddsCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	copy(marketID[:], crypto.Keccak256([]byte("market-update-odds")))
	baseOdds := []*big.Int{big.NewInt(20_000), big.NewInt(18_000)}
	var updatedAt uint64 = 1_700_000_010

	data, err := pool.UpdateOddsCalldata(marketID, baseOdds, updatedAt)
	if err != nil {
		t.Fatalf("UpdateOddsCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("updateOdds(bytes32,uint256[],uint64)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_UpdateOddsCalldata_NilBaseOdds verifies nil baseOdds returns UserError.
func TestBettingPool_UpdateOddsCalldata_NilBaseOdds(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	_, err := pool.UpdateOddsCalldata(marketID, nil, 0)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestBettingPool_LockMarketCalldata verifies selector correctness.
func TestBettingPool_LockMarketCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	copy(marketID[:], crypto.Keccak256([]byte("market-lock")))

	data, err := pool.LockMarketCalldata(marketID)
	if err != nil {
		t.Fatalf("LockMarketCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("lockMarket(bytes32)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_LockMarketCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_LockMarketCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	var marketID [32]byte
	_, err := (*BettingPool)(nil).LockMarketCalldata(marketID)
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_CashOutCalldata verifies selector correctness.
func TestBettingPool_CashOutCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	betID := [32]byte(crypto.Keccak256Hash([]byte("bet-cash-out")))
	expectedQuoteVersion := big.NewInt(7)
	var quotedAt uint64 = 1_700_000_020
	minAmountOut := big.NewInt(90_000_000)
	deadline := big.NewInt(1_700_000_120)

	data, err := pool.CashOutCalldata(betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)
	if err != nil {
		t.Fatalf("CashOutCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("cashOut(bytes32,uint256,uint64,uint256,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_CashOutCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_CashOutCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	betID := [32]byte(crypto.Keccak256Hash([]byte("bet-cash-out-nil-receiver")))
	_, err := (*BettingPool)(nil).CashOutCalldata(betID, big.NewInt(1), 1, big.NewInt(1), big.NewInt(2))
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_CashOutCalldata_NilBigInt verifies nil bigint parameters return UserError.
func TestBettingPool_CashOutCalldata_NilBigInt(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	betID := [32]byte(crypto.Keccak256Hash([]byte("bet-cash-out-nil-bigint")))

	tests := []struct {
		name                 string
		expectedQuoteVersion *big.Int
		minAmountOut         *big.Int
		deadline             *big.Int
	}{
		{name: "expected quote version", expectedQuoteVersion: nil, minAmountOut: big.NewInt(1), deadline: big.NewInt(2)},
		{name: "min amount out", expectedQuoteVersion: big.NewInt(1), minAmountOut: nil, deadline: big.NewInt(2)},
		{name: "deadline", expectedQuoteVersion: big.NewInt(1), minAmountOut: big.NewInt(1), deadline: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := pool.CashOutCalldata(betID, tt.expectedQuoteVersion, 1, tt.minAmountOut, tt.deadline)
			if !errors.Is(err, ErrNilBigIntParam) {
				t.Fatalf("expected ErrNilBigIntParam, got %v", err)
			}
			var ue *UserError
			if !errors.As(err, &ue) {
				t.Fatalf("expected *UserError, got %T", err)
			}
		})
	}
}

// TestBettingPool_PlaceParlayCalldata verifies selector correctness.
func TestBettingPool_PlaceParlayCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	legs := []ParlayLegInput{{
		MarketID:     [32]byte(crypto.Keccak256Hash([]byte("parlay-market-1"))),
		Outcome:      1,
		QuoteVersion: big.NewInt(4),
		QuotedAt:     1_700_000_030,
		MinOdds:      big.NewInt(12_000),
	}}
	stake := big.NewInt(100_000_000)
	minComboOdds := big.NewInt(15_000)
	deadline := big.NewInt(1_700_000_330)
	referrer := common.HexToAddress("0x0000000000000000000000000000000000000123")

	data, err := pool.PlaceParlayCalldata(legs, stake, minComboOdds, deadline, referrer)
	if err != nil {
		t.Fatalf("PlaceParlayCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("placeParlay((bytes32,uint8,uint256,uint64,uint256)[],uint256,uint256,uint256,address)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_PlaceParlayCalldata_NilBigInt verifies nil bigint parameters return UserError.
func TestBettingPool_PlaceParlayCalldata_NilBigInt(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	legs := []ParlayLegInput{{
		MarketID:     [32]byte{0x01},
		QuoteVersion: big.NewInt(1),
		MinOdds:      big.NewInt(10_000),
	}}

	tests := []struct {
		name         string
		legs         []ParlayLegInput
		stake        *big.Int
		minComboOdds *big.Int
		deadline     *big.Int
	}{
		{name: "nil legs", legs: nil, stake: big.NewInt(1), minComboOdds: big.NewInt(10_000), deadline: big.NewInt(2)},
		{name: "leg quote version", legs: []ParlayLegInput{{MarketID: [32]byte{0x01}, QuoteVersion: nil, MinOdds: big.NewInt(10_000)}}, stake: big.NewInt(1), minComboOdds: big.NewInt(10_000), deadline: big.NewInt(2)},
		{name: "leg min odds", legs: []ParlayLegInput{{MarketID: [32]byte{0x01}, QuoteVersion: big.NewInt(1), MinOdds: nil}}, stake: big.NewInt(1), minComboOdds: big.NewInt(10_000), deadline: big.NewInt(2)},
		{name: "stake", legs: legs, stake: nil, minComboOdds: big.NewInt(10_000), deadline: big.NewInt(2)},
		{name: "min combo odds", legs: legs, stake: big.NewInt(1), minComboOdds: nil, deadline: big.NewInt(2)},
		{name: "deadline", legs: legs, stake: big.NewInt(1), minComboOdds: big.NewInt(10_000), deadline: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := pool.PlaceParlayCalldata(tt.legs, tt.stake, tt.minComboOdds, tt.deadline, common.Address{})
			if !errors.Is(err, ErrNilBigIntParam) {
				t.Fatalf("expected ErrNilBigIntParam, got %v", err)
			}
			var ue *UserError
			if !errors.As(err, &ue) {
				t.Fatalf("expected *UserError, got %T", err)
			}
		})
	}
}

// TestBettingPool_SettleParlayCalldata verifies selector correctness.
func TestBettingPool_SettleParlayCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	parlayID := [32]byte(crypto.Keccak256Hash([]byte("parlay-settle")))

	data, err := pool.SettleParlayCalldata(parlayID)
	if err != nil {
		t.Fatalf("SettleParlayCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("settleParlay(bytes32)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_ClaimParlayPayoutCalldata verifies selector correctness.
func TestBettingPool_ClaimParlayPayoutCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	parlayID := [32]byte(crypto.Keccak256Hash([]byte("parlay-claim")))

	data, err := pool.ClaimParlayPayoutCalldata(parlayID)
	if err != nil {
		t.Fatalf("ClaimParlayPayoutCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("claimParlayPayout(bytes32)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_ReleasePayoutReserveCalldata verifies selector correctness.
func TestBettingPool_ReleasePayoutReserveCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	riskID := [32]byte(crypto.Keccak256Hash([]byte("risk-release")))

	data, err := pool.ReleasePayoutReserveCalldata(riskID)
	if err != nil {
		t.Fatalf("ReleasePayoutReserveCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("releasePayoutReserve(bytes32)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_PlaceBetCalldata verifies selector correctness.
func TestBettingPool_PlaceBetCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	copy(marketID[:], crypto.Keccak256([]byte("market-1")))
	var outcome uint8 = 1
	requestedAmount := big.NewInt(100_000_000)
	guard := QuoteGuardInput{
		QuoteVersion:      big.NewInt(3),
		QuotedAt:          1_700_000_000,
		MinOdds:           big.NewInt(18_180),
		MinAcceptedAmount: big.NewInt(90_000_000),
		Deadline:          big.NewInt(1_700_000_300),
	}

	data, err := pool.PlaceBetCalldata(marketID, outcome, requestedAmount, guard)
	if err != nil {
		t.Fatalf("PlaceBetCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("placeBet(bytes32,uint8,uint256,(uint256,uint64,uint256,uint256,uint256))"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}

}

// TestBettingPool_PlaceBetCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_PlaceBetCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	var marketID [32]byte
	guard := QuoteGuardInput{
		QuoteVersion:      big.NewInt(1),
		QuotedAt:          1_700_000_000,
		MinOdds:           big.NewInt(10_000),
		MinAcceptedAmount: big.NewInt(1_000),
		Deadline:          big.NewInt(1_700_001_000),
	}
	_, err := (*BettingPool)(nil).PlaceBetCalldata(marketID, 0, big.NewInt(1), guard)
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_PlaceBetCalldata_NilRequestedAmount verifies nil requestedAmount returns UserError.
func TestBettingPool_PlaceBetCalldata_NilRequestedAmount(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	guard := QuoteGuardInput{
		QuoteVersion:      big.NewInt(1),
		QuotedAt:          1_700_000_000,
		MinOdds:           big.NewInt(10_000),
		MinAcceptedAmount: big.NewInt(1_000),
		Deadline:          big.NewInt(1_700_001_000),
	}
	_, err := pool.PlaceBetCalldata(marketID, 0, nil, guard)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestBettingPool_SettleMarketBetsByScoreCalldata verifies selector correctness.
func TestBettingPool_SettleMarketBetsByScoreCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	copy(marketID[:], crypto.Keccak256([]byte("market-settle-1")))
	var homeScore uint16 = 2
	var awayScore uint16 = 1
	betIDs := [][32]byte{
		[32]byte(crypto.Keccak256Hash([]byte("bet-score-1"))),
		[32]byte(crypto.Keccak256Hash([]byte("bet-score-2"))),
	}

	data, err := pool.SettleMarketBetsByScoreCalldata(marketID, homeScore, awayScore, betIDs)
	if err != nil {
		t.Fatalf("SettleMarketBetsByScoreCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("settleMarketBetsByScore(bytes32,uint16,uint16,bytes32[])"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_SettleMarketBetsByScoreCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_SettleMarketBetsByScoreCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	var marketID [32]byte
	_, err := (*BettingPool)(nil).SettleMarketBetsByScoreCalldata(marketID, 2, 1, nil)
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_SettleMarketBetsByScoreCalldata_Deterministic verifies that encoding the same
// inputs twice yields identical bytes (no mutable state in ABI encoding).
func TestBettingPool_SettleMarketBetsByScoreCalldata_Deterministic(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	copy(marketID[:], crypto.Keccak256([]byte("market-deterministic")))
	var homeScore uint16 = 1
	var awayScore uint16 = 1
	betIDs := [][32]byte{{0x01}, {0x02}}

	data1, err := pool.SettleMarketBetsByScoreCalldata(marketID, homeScore, awayScore, betIDs)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}
	data2, err := pool.SettleMarketBetsByScoreCalldata(marketID, homeScore, awayScore, betIDs)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}
	if !bytes.Equal(data1, data2) {
		t.Fatalf("non-deterministic encoding: %x vs %x", data1, data2)
	}
}

// TestBettingPool_FinalizeMarketSettlementCalldata verifies selector correctness.
func TestBettingPool_FinalizeMarketSettlementCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	copy(marketID[:], crypto.Keccak256([]byte("market-finalize-1")))
	var resultKindRaw uint8 = 0

	data, err := pool.FinalizeMarketSettlementCalldata(marketID, resultKindRaw)
	if err != nil {
		t.Fatalf("FinalizeMarketSettlementCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("finalizeMarketSettlement(bytes32,uint8)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_FinalizeMarketSettlementCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_FinalizeMarketSettlementCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	var marketID [32]byte
	_, err := (*BettingPool)(nil).FinalizeMarketSettlementCalldata(marketID, 0)
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_RefundBetsCalldata verifies selector correctness.
func TestBettingPool_RefundBetsCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	copy(marketID[:], crypto.Keccak256([]byte("market-refund-bets")))
	betIDs := [][32]byte{{0x01}, {0x02}}
	refundAmounts := []*big.Int{big.NewInt(10), big.NewInt(20)}

	data, err := pool.RefundBetsCalldata(marketID, betIDs, refundAmounts)
	if err != nil {
		t.Fatalf("RefundBetsCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("refundBets(bytes32,bytes32[],uint256[])"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_RefundBetsCalldata_NilRefundAmount verifies nil refund amount returns UserError.
func TestBettingPool_RefundBetsCalldata_NilRefundAmount(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	var marketID [32]byte
	_, err := pool.RefundBetsCalldata(marketID, [][32]byte{{0x01}}, []*big.Int{nil})
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestBettingPool_ClaimPayoutCalldata verifies selector correctness.
func TestBettingPool_ClaimPayoutCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	betID := [32]byte(crypto.Keccak256Hash([]byte("bet-id-abc123-unique")))

	data, err := pool.ClaimPayoutCalldata(betID)
	if err != nil {
		t.Fatalf("ClaimPayoutCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("claimPayout(bytes32)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_ClaimPayoutCalldata_NilReceiver verifies nil *BettingPool returns ConfigError.
func TestBettingPool_ClaimPayoutCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	betID := [32]byte(crypto.Keccak256Hash([]byte("bet-nil-receiver")))
	_, err := (*BettingPool)(nil).ClaimPayoutCalldata(betID)
	if !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("expected ErrMissingBettingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestBettingPool_ClaimPayoutCalldata_Deterministic verifies that encoding the same
// betID twice yields identical bytes (no mutable state in ABI encoding).
func TestBettingPool_ClaimPayoutCalldata_Deterministic(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	betID := [32]byte{
		0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe,
		0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
		0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
		0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
	}

	data1, err := pool.ClaimPayoutCalldata(betID)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}
	data2, err := pool.ClaimPayoutCalldata(betID)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}
	if !bytes.Equal(data1, data2) {
		t.Fatalf("non-deterministic encoding: %x vs %x", data1, data2)
	}
}

// TestBettingPool_SetBetModuleCalldata verifies selector correctness.
func TestBettingPool_SetBetModuleCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	module := common.HexToAddress("0x00000000000000000000000000000000000000bE")

	data, err := pool.SetBetModuleCalldata(module)
	if err != nil {
		t.Fatalf("SetBetModuleCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("setBetModule(address)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_SetMarketModuleCalldata verifies selector correctness.
func TestBettingPool_SetMarketModuleCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	module := common.HexToAddress("0x0000000000000000000000000000000000000aAA")

	data, err := pool.SetMarketModuleCalldata(module)
	if err != nil {
		t.Fatalf("SetMarketModuleCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("setMarketModule(address)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestBettingPool_SetReferralModuleCalldata verifies selector correctness.
func TestBettingPool_SetReferralModuleCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineBettingPool(t)
	module := common.HexToAddress("0x0000000000000000000000000000000000000abc")

	data, err := pool.SetReferralModuleCalldata(module)
	if err != nil {
		t.Fatalf("SetReferralModuleCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("setReferralModule(address)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}
