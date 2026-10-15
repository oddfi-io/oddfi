// Package oddfi exposes the public ODD-SDK API.
package oddfi

import (
	"fmt"

	"github.com/ethereum/go-ethereum/common"
)

// ParseAddress parses an EVM address. Mixed-case input must have a valid EIP-55
// checksum; invalid input returns ErrInvalidAddress.
func ParseAddress(value string) (common.Address, error) {
	mixed, err := common.NewMixedcaseAddressFromString(value)
	if err != nil {
		return common.Address{}, fmt.Errorf("%w: %s", ErrInvalidAddress, value)
	}
	if hasMixedCaseHex(value) && !mixed.ValidChecksum() {
		return common.Address{}, fmt.Errorf("%w: invalid checksum", ErrInvalidAddress)
	}
	return mixed.Address(), nil
}

// MustParseAddress parses an EVM address and panics if the input is invalid.
// It is intended only for package-level constants and examples.
func MustParseAddress(value string) common.Address {
	parsed, err := ParseAddress(value)
	if err != nil {
		panic(err)
	}
	return parsed
}

func hasMixedCaseHex(value string) bool {
	hasLower := false
	hasUpper := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'f':
			hasLower = true
		case r >= 'A' && r <= 'F':
			hasUpper = true
		}
	}
	return hasLower && hasUpper
}
