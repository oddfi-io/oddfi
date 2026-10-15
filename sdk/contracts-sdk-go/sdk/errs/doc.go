// Package errs converts raw RPC revert errors into typed ContractError values
// using the abigen-generated UnpackError functions, so callers can switch on
// cerr.Name (e.g. "InsufficientBalance", "MarketClosed") via errors.As.
package errs
