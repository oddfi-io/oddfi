// Package money handles conversion between caller-side decimal.Decimal amounts
// and the *big.Int integer base units that the SDK and contracts speak.
package money

import (
	"math/big"

	"github.com/shopspring/decimal"
)

// ScaleToBase converts a human-friendly decimal amount (e.g. 100.50) into the
// integer base-unit amount the contract expects, given the token's decimals.
// Always rounds DOWN — never silently round up user funds.
//
// Example: ScaleToBase(decimal.NewFromFloat(100.5), 18) → 100500000000000000000.
func ScaleToBase(d decimal.Decimal, decimals uint8) *big.Int {
	rounded := d.Truncate(int32(decimals))   // RoundDown
	scaled := rounded.Shift(int32(decimals)) // shift the decimal point right
	return scaled.BigInt()
}

// ScaleFromBase converts an integer base-unit amount back to a decimal.Decimal
// expressed in human-friendly units.
//
// Example: ScaleFromBase(big.NewInt(100500000000000000000), 18) → 100.5.
func ScaleFromBase(n *big.Int, decimals uint8) decimal.Decimal {
	if n == nil {
		return decimal.Zero
	}
	d := decimal.NewFromBigInt(n, 0)
	return d.Shift(-int32(decimals))
}
