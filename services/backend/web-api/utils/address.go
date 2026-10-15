package utils

import (
	"strings"

	"github.com/samber/lo"
)

var (
	evmChains             = []string{"bsc", "polygon", "base", "eth"}
	supportWithDrawChains = []string{"bsc"}
)

func IsEvmChain(chain string) bool {
	return lo.Contains(evmChains, chain)
}

func IsSupportWithDrawChain(chain string) bool {
	return lo.Contains(supportWithDrawChains, chain)
}

func ValidateEvmAddress(address string) bool {
	if len(address) != 42 {
		return false
	}
	if !strings.HasPrefix(address, "0x") {
		return false
	}
	for _, c := range address[2:] {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}

	return true
}
