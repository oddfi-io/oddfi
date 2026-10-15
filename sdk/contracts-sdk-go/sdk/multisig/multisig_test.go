package multisig

import (
	"bytes"
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
)

// ── New / options validation ────────────────────────────────────────────────

func TestNew_NilConn(t *testing.T) {
	if _, err := New(nil); err == nil {
		t.Error("expected error for nil Connection")
	}
}

// ── ABI introspection: all 14 multisig methods present + correct arity ──────

func TestParsedABIHasAllMultisigMethods(t *testing.T) {
	parsed, err := bettingpool.BettingPoolMetaData.GetAbi()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	cases := map[string]int{
		"settle":                 5,
		"cancelMatch":            4,
		"batchCancelMatch":       4,
		"reopenMarket":           3,
		"releaseOrForfeiture":    1,
		"withdrawPlatform":       2,
		"setMaxMarketsPerMatch":  1,
		"setRedLightThreshold":   1,
		"setAdmin":               1,
		"setLpShareBps":          1,
		"pause":                  0,
		"unpause":                0,
		"executeLargeWithdrawal": 1,
		"rejectLargeWithdrawal":  1,
	}
	for name, wantArity := range cases {
		m, ok := parsed.Methods[name]
		if !ok {
			t.Errorf("ABI missing method %q", name)
			continue
		}
		if got := len(m.Inputs); got != wantArity {
			t.Errorf("%s arity = %d, want %d", name, got, wantArity)
		}
	}
}

// ── Calldata packing without a Connection ────────────────────────────────────

// We can pack ABI calldata using just BettingPoolMetaData, no RPC. This test
// exercises the packCalldata code path indirectly and confirms our handle
// constructors line up with the binding's expected types.
func TestCalldataPacking_Pause(t *testing.T) {
	parsed, _ := bettingpool.BettingPoolMetaData.GetAbi()
	method, ok := parsed.Methods["pause"]
	if !ok {
		t.Fatal("pause not in ABI")
	}
	if got := len(method.Inputs); got != 0 {
		t.Fatalf("pause arity = %d, want 0", got)
	}
	tail, err := method.Inputs.Pack()
	if err != nil {
		t.Fatalf("pack pause: %v", err)
	}
	calldata := append([]byte{}, method.ID...)
	calldata = append(calldata, tail...)
	if len(calldata) != 4 {
		t.Errorf("pause calldata = %d bytes, want 4 (selector only)", len(calldata))
	}
}

func TestCalldataPacking_SetAdmin(t *testing.T) {
	parsed, _ := bettingpool.BettingPoolMetaData.GetAbi()
	method := parsed.Methods["setAdmin"]
	addr := common.HexToAddress("0x1234567890aBCdEf1234567890aBCDEf12345678")
	tail, err := method.Inputs.Pack(addr)
	if err != nil {
		t.Fatalf("pack: %v", err)
	}
	if len(tail) != 32 {
		t.Errorf("setAdmin tail = %d bytes, want 32 (one address padded)", len(tail))
	}
}

// ── SafeTxHash math: deterministic + non-zero ────────────────────────────────

func TestSafeTxHash_Deterministic(t *testing.T) {
	stx := &SafeTx{
		To:             common.HexToAddress("0x" + "11"+"22"+"33"+"44"+"55"+"66"+"77"+"88"+"99"+"aa"+"bb"+"cc"+"dd"+"ee"+"ff"+"00"+"11"+"22"+"33"+"44"),
		Value:          big.NewInt(0),
		Data:           []byte{0xde, 0xad, 0xbe, 0xef},
		Operation:      0,
		SafeTxGas:      big.NewInt(0),
		BaseGas:        big.NewInt(0),
		GasPrice:       big.NewInt(0),
		GasToken:       common.Address{},
		RefundReceiver: common.Address{},
		Nonce:          big.NewInt(7),
	}
	chainID := big.NewInt(56)
	safeAddr := common.HexToAddress("0xabcdefABCDEFabcdefABCDEFabcdefABCDEFabcd")

	h1 := stx.SafeTxHash(chainID, safeAddr)
	h2 := stx.SafeTxHash(chainID, safeAddr)
	if h1 != h2 {
		t.Errorf("SafeTxHash not deterministic: %x vs %x", h1, h2)
	}
	if h1 == (common.Hash{}) {
		t.Error("SafeTxHash is zero")
	}

	// Changing chainId or safe should change the hash.
	if h1 == stx.SafeTxHash(big.NewInt(97), safeAddr) {
		t.Error("hash unchanged across chainId")
	}
	if h1 == stx.SafeTxHash(chainID, common.Address{}) {
		t.Error("hash unchanged across safeAddr")
	}
	// Changing data must change the hash.
	stx2 := *stx
	stx2.Data = []byte{0xca, 0xfe}
	if h1 == stx2.SafeTxHash(chainID, safeAddr) {
		t.Error("hash unchanged when data changes")
	}
}

func TestStructHash_DataIsHashed(t *testing.T) {
	// Two payloads with different data of equal length must hash differently.
	mk := func(data []byte) common.Hash {
		stx := &SafeTx{
			To:    common.Address{},
			Value: big.NewInt(0),
			Data:  data, Operation: 0,
			SafeTxGas: big.NewInt(0), BaseGas: big.NewInt(0), GasPrice: big.NewInt(0),
			Nonce: big.NewInt(0),
		}
		return stx.structHash()
	}
	h1 := mk([]byte{1, 2, 3, 4})
	h2 := mk([]byte{1, 2, 3, 5})
	if h1 == h2 {
		t.Error("structHash collision on different data")
	}
}

// ── PackExecTransaction roundtrip ────────────────────────────────────────────

func TestPackExecTransaction_RoundTrip(t *testing.T) {
	stx := &SafeTx{
		To:             common.HexToAddress("0x1111111111111111111111111111111111111111"),
		Value:          big.NewInt(0),
		Data:           []byte{0xab, 0xcd},
		Operation:      0,
		SafeTxGas:      big.NewInt(0),
		BaseGas:        big.NewInt(0),
		GasPrice:       big.NewInt(0),
		GasToken:       common.Address{},
		RefundReceiver: common.Address{},
		Nonce:          big.NewInt(1),
	}
	sig := make([]byte, 65)
	for i := range sig {
		sig[i] = byte(i)
	}
	calldata, err := stx.PackExecTransaction(sig)
	if err != nil {
		t.Fatalf("pack: %v", err)
	}
	method := safeABI.Methods["execTransaction"]
	if !bytes.Equal(calldata[:4], method.ID) {
		t.Errorf("selector mismatch: got %x want %x", calldata[:4], method.ID)
	}
	// Decode back and check key fields.
	values, err := method.Inputs.Unpack(calldata[4:])
	if err != nil {
		t.Fatalf("unpack: %v", err)
	}
	if got, _ := values[0].(common.Address); got != stx.To {
		t.Errorf("to mismatch: %s vs %s", got.Hex(), stx.To.Hex())
	}
	if got, _ := values[2].([]byte); !bytes.Equal(got, stx.Data) {
		t.Errorf("data mismatch")
	}
	if got, _ := values[9].([]byte); !bytes.Equal(got, sig) {
		t.Errorf("signatures mismatch")
	}
}

// ── Mode-not-configured errors ───────────────────────────────────────────────

func TestModeNotConfiguredErr_Strings(t *testing.T) {
	for _, mode := range []string{"execute", "propose", "weird"} {
		e := &ErrModeNotConfigured{Mode: mode}
		if e.Error() == "" {
			t.Errorf("Error() empty for mode %q", mode)
		}
	}
}

func TestPropose_NotConfigured(t *testing.T) {
	c := &Client{} // zero-value: no proposer, no URL
	h := &Handle{c: c, methodName: "pause", callArgs: nil}
	_, err := h.Propose(context.Background())
	var modeErr *ErrModeNotConfigured
	if !errors.As(err, &modeErr) {
		t.Errorf("want ErrModeNotConfigured, got %v", err)
	}
}

func TestExecute_NotConfigured(t *testing.T) {
	c := &Client{} // zero-value: no safeOwner, no directExecute
	h := &Handle{c: c, methodName: "pause", callArgs: nil}
	_, err := h.Execute(context.Background())
	var modeErr *ErrModeNotConfigured
	if !errors.As(err, &modeErr) {
		t.Errorf("want ErrModeNotConfigured, got %v", err)
	}
}

// ── Enum String ──────────────────────────────────────────────────────────────

func TestMarketTypeString(t *testing.T) {
	cases := map[MarketType]string{
		MarketX12: "X12", MarketAH: "AH", MarketOU: "OU", MarketType(99): "MarketType(?)",
	}
	for m, want := range cases {
		if got := m.String(); got != want {
			t.Errorf("%d.String() = %q, want %q", m, got, want)
		}
	}
}

// ── Domain typeHash sanity (matches Safe v1.3 published value) ───────────────
//
// Reference:
//   keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")
//   = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218
func TestDomainTypeHash(t *testing.T) {
	want := common.HexToHash("0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218")
	if domainTypeHash != want {
		t.Errorf("domainTypeHash = %x, want %x", domainTypeHash, want)
	}
}

// SafeTx typeHash sanity: well-known value from Safe v1.3.
//   keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,
//             uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,
//             address refundReceiver,uint256 nonce)")
//   = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8
func TestSafeTxTypeHash(t *testing.T) {
	want := common.HexToHash("0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8")
	if safeTxTypeHash != want {
		t.Errorf("safeTxTypeHash = %x, want %x", safeTxTypeHash, want)
	}
}

// Sanity: parsed safeABI has all the methods we expect.
func TestSafeABIHasMethods(t *testing.T) {
	for _, name := range []string{"nonce", "getThreshold", "execTransaction"} {
		if _, ok := safeABI.Methods[name]; !ok {
			t.Errorf("safeABI missing %q", name)
		}
	}
	// Spot-check selector for execTransaction.
	method := safeABI.Methods["execTransaction"]
	if len(method.ID) != 4 {
		t.Errorf("selector len = %d", len(method.ID))
	}
	// Re-derive selector independently to verify.
	want := crypto.Keccak256([]byte(method.Sig))[:4]
	if !bytes.Equal(method.ID, want) {
		t.Errorf("selector = %x, want %x (sig=%s)", method.ID, want, method.Sig)
	}
	_ = abi.JSON // keep import warm in case future tests use it
}
