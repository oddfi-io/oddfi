// Package config embeds the per-environment static configuration shipped with
// the SDK (chain id, contract addresses, expected admin/multisig). Files are
// committed under sdk/config/ and bundled into the binary via go:embed.
package config

import (
	"embed"
	"encoding/json"
	"fmt"

	"github.com/ethereum/go-ethereum/common"
)

//go:embed testnet.json mainnet.json
var fs embed.FS

// EnvConfig is the parsed view of one environment file.
type EnvConfig struct {
	Name          string        `json:"name"`
	ChainID       int64         `json:"chainId"`
	Contracts     Contracts     `json:"contracts"`
	ExpectedRoles ExpectedRoles `json:"expectedRoles"`
	DeployBlock   uint64        `json:"deployBlock"`
	Explorer      string        `json:"explorer"`
}

// Contracts holds well-known contract addresses for the environment.
type Contracts struct {
	BettingPool string `json:"bettingPool"`
	USDT        string `json:"usdt"`
}

// ExpectedRoles is the SDK-shipped expectation of who holds admin/multisig
// rights on chain. Connection startup compares these to the live values and
// either WARNs or ERRORs depending on env (see client.NewConnection).
type ExpectedRoles struct {
	Admin    string `json:"admin"`
	Multisig string `json:"multisig"`
}

// Load reads and parses the embedded config for the given env name
// ("testnet" or "mainnet"). The returned struct shares no state with the
// embedded bytes.
func Load(envName string) (*EnvConfig, error) {
	data, err := fs.ReadFile(envName + ".json")
	if err != nil {
		return nil, fmt.Errorf("config: load %q: %w", envName, err)
	}
	var c EnvConfig
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("config: parse %q: %w", envName, err)
	}
	return &c, nil
}

// BettingPoolAddress is a typed accessor; returns common.Address(0) if blank.
func (c *EnvConfig) BettingPoolAddress() common.Address {
	return common.HexToAddress(c.Contracts.BettingPool)
}

// USDTAddress is a typed accessor.
func (c *EnvConfig) USDTAddress() common.Address {
	return common.HexToAddress(c.Contracts.USDT)
}

// ExpectedAdmin is a typed accessor.
func (c *EnvConfig) ExpectedAdmin() common.Address {
	return common.HexToAddress(c.ExpectedRoles.Admin)
}

// ExpectedMultisig is a typed accessor.
func (c *EnvConfig) ExpectedMultisig() common.Address {
	return common.HexToAddress(c.ExpectedRoles.Multisig)
}
