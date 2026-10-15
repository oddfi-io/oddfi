// Package errs converts raw RPC revert errors into typed ContractError values
// using a caller-supplied ABI parser, so callers can switch on cerr.Name
// (e.g. "InsufficientBalance") via errors.As.
//
// abigen v1.14 does not generate per-error Go types, so the parsing relies on
// the parsed ABI from BettingPoolMetaData.GetAbi() (or any other source).
package errs

import (
	"bytes"
	"errors"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

// ── Public types ─────────────────────────────────────────────────────────────

// ContractError represents a revert that has been decoded against an ABI.
//
// Name is the Solidity error name (e.g. "InsufficientBalance"), or one of the
// special markers:
//
//   - "Error(string)": standard string revert ("revert: foo")
//   - "Panic(uint256)": standard panic (overflow, divide-by-zero, etc.)
//   - "Unknown": revert data did not match any known error
//
// Args holds the decoded inputs keyed by the Solidity parameter name (or
// "arg0", "arg1", … if the parameter was unnamed). Raw is the full revert
// bytes (selector + tail) for debugging.
type ContractError struct {
	Method string                 // best-effort caller-supplied label, e.g. "LockBet"
	Name   string                 // Solidity error name or special marker
	Args   map[string]interface{} // decoded inputs, may be nil
	Raw    []byte                 // raw revert bytes
	Inner  error                  // original RPC/bind error
}

// Error renders a compact diagnostic string.
func (e *ContractError) Error() string {
	if e == nil {
		return "<nil ContractError>"
	}
	if e.Method != "" {
		return fmt.Sprintf("%s reverted: %s args=%v", e.Method, e.Name, e.Args)
	}
	return fmt.Sprintf("reverted: %s args=%v", e.Name, e.Args)
}

// Unwrap returns the original error so errors.Is/As traverse correctly.
func (e *ContractError) Unwrap() error { return e.Inner }

// Is matches by Name to support errors.Is(target, &ContractError{Name: "X"}).
// (Most callers should use errors.As to extract args.)
func (e *ContractError) Is(target error) bool {
	t, ok := target.(*ContractError)
	if !ok {
		return false
	}
	return t.Name == "" || t.Name == e.Name
}

// ErrorParser decodes a revert byte slice into a Solidity error name + args.
// Implementations should return ok=false (rather than an error) for "no
// matching error in this ABI" so callers can fall through to standard
// Error(string)/Panic decoders.
type ErrorParser interface {
	ParseError(data []byte) (name string, args map[string]interface{}, ok bool)
}

// ── Standard selectors ───────────────────────────────────────────────────────

// Error(string) and Panic(uint256) selectors per Solidity ABI.
var (
	selectorErrorString = [4]byte{0x08, 0xc3, 0x79, 0xa0}
	selectorPanicUint   = [4]byte{0x4e, 0x48, 0x7b, 0x71}
)

// ── Wrap entry point ─────────────────────────────────────────────────────────

// Wrap converts err into a *ContractError if it carries revert data; otherwise
// it returns a plain wrapped error preserving %w semantics. Pass the parser
// returned by NewABIParser(<contract>.GetAbi()) for typed decoding.
func Wrap(err error, method string, parser ErrorParser) error {
	if err == nil {
		return nil
	}
	data := extractRevertData(err)
	if len(data) == 0 {
		// Not a revert we can introspect; preserve original chain.
		if method != "" {
			return fmt.Errorf("%s: %w", method, err)
		}
		return err
	}

	// 1) Try the contract's typed errors.
	if parser != nil {
		if name, args, ok := parser.ParseError(data); ok {
			return &ContractError{Method: method, Name: name, Args: args, Raw: data, Inner: err}
		}
	}
	// 2) Standard Error(string).
	if len(data) >= 4 && bytes.Equal(data[:4], selectorErrorString[:]) {
		if msg, ok := decodeErrorString(data[4:]); ok {
			return &ContractError{
				Method: method, Name: "Error(string)",
				Args:  map[string]interface{}{"message": msg},
				Raw:   data, Inner: err,
			}
		}
	}
	// 3) Standard Panic(uint256).
	if len(data) >= 4 && bytes.Equal(data[:4], selectorPanicUint[:]) {
		if code, ok := decodePanic(data[4:]); ok {
			return &ContractError{
				Method: method, Name: "Panic(uint256)",
				Args:  map[string]interface{}{"code": code},
				Raw:   data, Inner: err,
			}
		}
	}
	// 4) Unknown.
	return &ContractError{Method: method, Name: "Unknown", Raw: data, Inner: err}
}

// ── Revert data extraction ───────────────────────────────────────────────────

// dataErr is any error type that exposes the revert data via ErrorData().
// Both go-ethereum's *rpc.Error and bind's wrapped errors satisfy this
// (interface check via errors.As).
type dataErr interface {
	ErrorData() interface{}
}

// extractRevertData walks the err chain looking for a value that exposes
// revert payload bytes. Recognises hex strings ("0xab..."), []byte, and
// nested "originalError" maps (some RPCs use this).
func extractRevertData(err error) []byte {
	var de dataErr
	if !errors.As(err, &de) {
		return nil
	}
	switch v := de.ErrorData().(type) {
	case nil:
		return nil
	case string:
		return common.FromHex(v)
	case []byte:
		return v
	case map[string]interface{}:
		// Some RPC providers nest the data: {"data": "0x..."}.
		if d, ok := v["data"].(string); ok {
			return common.FromHex(d)
		}
		return nil
	default:
		return nil
	}
}

// ── Standard decoders ────────────────────────────────────────────────────────

// decodeErrorString unpacks the tail of a 0x08c379a0-prefixed revert to a
// string. Returns ok=false if the tail is malformed.
func decodeErrorString(tail []byte) (string, bool) {
	// ABI: a single dynamic string at offset 0x20.
	stringT, _ := abi.NewType("string", "", nil)
	args := abi.Arguments{{Type: stringT}}
	values, err := args.Unpack(tail)
	if err != nil || len(values) != 1 {
		return "", false
	}
	s, ok := values[0].(string)
	return s, ok
}

// decodePanic unpacks the tail of a 0x4e487b71-prefixed revert to its uint
// code (0x11 = arithmetic over/underflow, 0x12 = divide-by-zero, …).
func decodePanic(tail []byte) (uint64, bool) {
	uint256T, _ := abi.NewType("uint256", "", nil)
	args := abi.Arguments{{Type: uint256T}}
	values, err := args.Unpack(tail)
	if err != nil || len(values) != 1 {
		return 0, false
	}
	n := values[0].(*big.Int)
	if !n.IsUint64() {
		return 0, false
	}
	return n.Uint64(), true
}
