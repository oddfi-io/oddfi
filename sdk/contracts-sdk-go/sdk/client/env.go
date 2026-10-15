package client

import "fmt"

// Env identifies the on-chain environment the SDK targets.
type Env int

const (
	// Testnet = BNB Smart Chain Testnet (chainId 97).
	Testnet Env = iota
	// Mainnet = BNB Smart Chain Mainnet (chainId 56).
	Mainnet
)

// String returns the lowercase env name used as the embedded config filename.
func (e Env) String() string {
	switch e {
	case Testnet:
		return "testnet"
	case Mainnet:
		return "mainnet"
	default:
		return fmt.Sprintf("env(%d)", int(e))
	}
}

// IsMainnet is a convenience used for safety gates.
func (e Env) IsMainnet() bool { return e == Mainnet }
