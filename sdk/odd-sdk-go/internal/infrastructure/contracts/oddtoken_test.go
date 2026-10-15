package contracts

import (
	"context"
	"math/big"
	"testing"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/oddtoken"
)

func TestODDTokenReaderReadMethods(t *testing.T) {
	t.Parallel()

	contractABI, err := oddtoken.ODDTokenMetaData.GetAbi()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	proxy := mustParseInfrastructureAddress(t, "0x52908400098527886E0F7030069857D2E4169EE7")
	account := mustParseInfrastructureAddress(t, "0x8617E340B3D01FA5F11F306F4090FD50E238070D")
	spender := mustParseInfrastructureAddress(t, "0xde709f2102306220921060314715629080e2fb77")

	backend := &fakeCaller{
		code: []byte{0x01},
		responses: map[string][]byte{
			methodID(t, contractABI, "name"):        packOutput(t, contractABI, "name", "ODD Token"),
			methodID(t, contractABI, "symbol"):      packOutput(t, contractABI, "symbol", "ODD"),
			methodID(t, contractABI, "decimals"):    packOutput(t, contractABI, "decimals", uint8(18)),
			methodID(t, contractABI, "totalSupply"): packOutput(t, contractABI, "totalSupply", big.NewInt(1000)),
			methodID(t, contractABI, "balanceOf"):   packOutput(t, contractABI, "balanceOf", big.NewInt(42)),
			methodID(t, contractABI, "allowance"):   packOutput(t, contractABI, "allowance", big.NewInt(7)),
			methodID(t, contractABI, "paused"):      packOutput(t, contractABI, "paused", true),
		},
	}
	reader, err := NewODDTokenAdapter(backend, nil, proxy)
	if err != nil {
		t.Fatalf("new reader: %v", err)
	}

	ctx := context.Background()
	if got, err := reader.Name(ctx); err != nil || got != "ODD Token" {
		t.Fatalf("Name() = %q, %v", got, err)
	}
	if got, err := reader.Symbol(ctx); err != nil || got != "ODD" {
		t.Fatalf("Symbol() = %q, %v", got, err)
	}
	if got, err := reader.Decimals(ctx); err != nil || got != 18 {
		t.Fatalf("Decimals() = %d, %v", got, err)
	}
	assertBigInt(t, "TotalSupply", func() (*big.Int, error) { return reader.TotalSupply(ctx) }, "1000")
	assertBigInt(t, "BalanceOf", func() (*big.Int, error) { return reader.BalanceOf(ctx, account) }, "42")
	assertBigInt(t, "Allowance", func() (*big.Int, error) { return reader.Allowance(ctx, account, spender) }, "7")
	if got, err := reader.Paused(ctx); err != nil || !got {
		t.Fatalf("Paused() = %v, %v", got, err)
	}
}

func TestODDTokenReaderCopiesBigIntResults(t *testing.T) {
	t.Parallel()

	contractABI, err := oddtoken.ODDTokenMetaData.GetAbi()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	value := big.NewInt(12)
	backend := &fakeCaller{
		code: []byte{0x01},
		responses: map[string][]byte{
			methodID(t, contractABI, "totalSupply"): packOutput(t, contractABI, "totalSupply", value),
		},
	}
	reader, err := NewODDTokenAdapter(backend, nil, common.HexToAddress("0x52908400098527886E0F7030069857D2E4169EE7"))
	if err != nil {
		t.Fatalf("new reader: %v", err)
	}
	got, err := reader.TotalSupply(context.Background())
	if err != nil {
		t.Fatalf("TotalSupply(): %v", err)
	}
	got.SetInt64(99)
	again, err := reader.TotalSupply(context.Background())
	if err != nil {
		t.Fatalf("TotalSupply() second call: %v", err)
	}
	if again.String() != "12" {
		t.Fatalf("TotalSupply returned shared value: %s", again.String())
	}
}

type fakeCaller struct {
	code      []byte
	responses map[string][]byte
}

func (f *fakeCaller) CodeAt(ctx context.Context, contract common.Address, blockNumber *big.Int) ([]byte, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return append([]byte(nil), f.code...), nil
}

func (f *fakeCaller) CallContract(ctx context.Context, call ethereum.CallMsg, blockNumber *big.Int) ([]byte, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if len(call.Data) < 4 {
		return nil, ethereum.NotFound
	}
	output, ok := f.responses[string(call.Data[:4])]
	if !ok {
		return nil, ethereum.NotFound
	}
	return append([]byte(nil), output...), nil
}

func mustParseInfrastructureAddress(t *testing.T, value string) common.Address {
	t.Helper()
	return common.HexToAddress(value)
}

func methodID(t *testing.T, contractABI *abi.ABI, method string) string {
	t.Helper()
	return string(contractABI.Methods[method].ID)
}

func packOutput(t *testing.T, contractABI *abi.ABI, method string, value interface{}) []byte {
	t.Helper()
	output, err := contractABI.Methods[method].Outputs.Pack(value)
	if err != nil {
		t.Fatalf("pack %s output: %v", method, err)
	}
	return output
}

func packOutputs(t *testing.T, contractABI *abi.ABI, method string, values ...interface{}) []byte {
	t.Helper()
	output, err := contractABI.Methods[method].Outputs.Pack(values...)
	if err != nil {
		t.Fatalf("pack %s output: %v", method, err)
	}
	return output
}

func assertBigInt(t *testing.T, name string, fn func() (*big.Int, error), want string) {
	t.Helper()
	got, err := fn()
	if err != nil {
		t.Fatalf("%s(): %v", name, err)
	}
	if got == nil || got.String() != want {
		t.Fatalf("%s() = %v, want %s", name, got, want)
	}
}
