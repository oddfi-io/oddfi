package utils

import "fmt"

const (
	DepositAddressesKey = "deposit_addresses"
)

func GetRedisDepositAddressesKey(chain string) string {
	return fmt.Sprintf("%s_%s", DepositAddressesKey, chain)
}
