package errs

import (
	"errors"
	"fmt"
	"math/big"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

// fakeRPCErr satisfies both error and the dataErr interface used by
// extractRevertData.
type fakeRPCErr struct {
	msg  string
	data interface{}
}

func (f *fakeRPCErr) Error() string         { return f.msg }
func (f *fakeRPCErr) ErrorData() interface{} { return f.data }

func TestWrap_NilPassthrough(t *testing.T) {
	if err := Wrap(nil, "X", nil); err != nil {
		t.Errorf("Wrap(nil) = %v, want nil", err)
	}
}

func TestWrap_PlainErrorWithoutData(t *testing.T) {
	base := errors.New("boom")
	err := Wrap(base, "DoThing", nil)
	if err == nil {
		t.Fatal("nil")
	}
	if !errors.Is(err, base) {
		t.Errorf("errors.Is should chain to base")
	}
	if !strings.Contains(err.Error(), "DoThing") {
		t.Errorf("error msg should contain method label: %v", err)
	}
}

func TestWrap_ErrorString(t *testing.T) {
	// Build "Error(string)" revert: selector + ABI-encoded "hello"
	stringT, _ := abi.NewType("string", "", nil)
	args := abi.Arguments{{Type: stringT}}
	tail, err := args.Pack("hello")
	if err != nil {
		t.Fatal(err)
	}
	data := append(selectorErrorString[:], tail...)

	rpcErr := &fakeRPCErr{msg: "execution reverted", data: "0x" + common.Bytes2Hex(data)}
	wrapped := Wrap(rpcErr, "M", nil)

	var ce *ContractError
	if !errors.As(wrapped, &ce) {
		t.Fatalf("expected ContractError, got %T", wrapped)
	}
	if ce.Name != "Error(string)" {
		t.Errorf("Name = %q", ce.Name)
	}
	if msg, _ := ce.Args["message"].(string); msg != "hello" {
		t.Errorf("message = %q", msg)
	}
	if !errors.Is(ce, rpcErr) {
		t.Errorf("Unwrap should preserve inner err")
	}
}

func TestWrap_PanicUint(t *testing.T) {
	// Build Panic(0x11) revert.
	u256, _ := abi.NewType("uint256", "", nil)
	args := abi.Arguments{{Type: u256}}
	tail, err := args.Pack(big.NewInt(0x11))
	if err != nil {
		t.Fatal(err)
	}
	data := append(selectorPanicUint[:], tail...)
	rpcErr := &fakeRPCErr{msg: "execution reverted", data: data} // []byte form
	wrapped := Wrap(rpcErr, "M", nil)
	var ce *ContractError
	if !errors.As(wrapped, &ce) {
		t.Fatalf("expected ContractError")
	}
	if ce.Name != "Panic(uint256)" {
		t.Errorf("Name = %q", ce.Name)
	}
	if code, _ := ce.Args["code"].(uint64); code != 0x11 {
		t.Errorf("code = 0x%x", code)
	}
}

func TestWrap_TypedABIError(t *testing.T) {
	// Define an inline ABI with one error; produce its revert payload; verify
	// our parser recognises it.
	const aBIJSON = `[
		{"type":"error","name":"InsufficientBalance",
		 "inputs":[
		   {"name":"required","type":"uint256"},
		   {"name":"available","type":"uint256"}
		 ]
		}
	]`
	parsed, err := abi.JSON(strings.NewReader(aBIJSON))
	if err != nil {
		t.Fatal(err)
	}
	parser := NewABIParser(parsed)

	e := parsed.Errors["InsufficientBalance"]
	tail, err := e.Inputs.Pack(big.NewInt(1000), big.NewInt(500))
	if err != nil {
		t.Fatal(err)
	}
	data := append(e.ID[:4], tail...)

	rpcErr := &fakeRPCErr{msg: "reverted", data: data}
	wrapped := Wrap(rpcErr, "LockBet", parser)

	var ce *ContractError
	if !errors.As(wrapped, &ce) {
		t.Fatalf("expected ContractError, got %T: %v", wrapped, wrapped)
	}
	if ce.Name != "InsufficientBalance" {
		t.Errorf("Name = %q", ce.Name)
	}
	req, _ := ce.Args["required"].(*big.Int)
	avail, _ := ce.Args["available"].(*big.Int)
	if req == nil || req.Cmp(big.NewInt(1000)) != 0 {
		t.Errorf("required = %v", req)
	}
	if avail == nil || avail.Cmp(big.NewInt(500)) != 0 {
		t.Errorf("available = %v", avail)
	}
	if ce.Method != "LockBet" {
		t.Errorf("Method = %q", ce.Method)
	}
}

func TestWrap_UnknownSelector(t *testing.T) {
	data := []byte{0xde, 0xad, 0xbe, 0xef, 0, 1, 2, 3}
	rpcErr := &fakeRPCErr{msg: "reverted", data: data}
	wrapped := Wrap(rpcErr, "M", nil)
	var ce *ContractError
	if !errors.As(wrapped, &ce) {
		t.Fatal("expected ContractError")
	}
	if ce.Name != "Unknown" {
		t.Errorf("Name = %q, want Unknown", ce.Name)
	}
	if len(ce.Raw) != len(data) {
		t.Errorf("Raw lost data")
	}
}

func TestExtractRevertData_NestedDataMap(t *testing.T) {
	// Some RPC providers wrap the data as { "data": "0x..." }.
	rpcErr := &fakeRPCErr{
		msg:  "reverted",
		data: map[string]interface{}{"data": "0x" + common.Bytes2Hex([]byte{1, 2, 3, 4})},
	}
	got := extractRevertData(rpcErr)
	want := []byte{1, 2, 3, 4}
	if string(got) != string(want) {
		t.Errorf("got %x want %x", got, want)
	}
}

func TestContractError_IsByName(t *testing.T) {
	a := &ContractError{Name: "Foo"}
	b := &ContractError{Name: "Foo"}
	c := &ContractError{Name: "Bar"}
	if !errors.Is(a, b) {
		t.Error("Foo Is Foo failed")
	}
	if errors.Is(a, c) {
		t.Error("Foo should not match Bar")
	}
	// Wildcard target (empty Name) matches anything.
	if !errors.Is(a, &ContractError{}) {
		t.Error("wildcard match failed")
	}
}

func TestParseError_BadSelector(t *testing.T) {
	const aBIJSON = `[{"type":"error","name":"X","inputs":[]}]`
	parsed, _ := abi.JSON(strings.NewReader(aBIJSON))
	p := NewABIParser(parsed)
	if _, _, ok := p.ParseError([]byte{0x00, 0x01, 0x02}); ok {
		t.Error("ParseError should fail for short data")
	}
	if _, _, ok := p.ParseError([]byte{0xff, 0xff, 0xff, 0xff}); ok {
		t.Error("ParseError should fail for unknown selector")
	}
	// silence unused fmt import in this test file
	_ = fmt.Sprintf
}
