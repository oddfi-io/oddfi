package money

import (
	"math/big"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

func TestScaleToBase(t *testing.T) {
	cases := []struct {
		name     string
		in       string
		decimals uint8
		want     string
	}{
		{"100 USDT 18d", "100", 18, "100000000000000000000"},
		{"100.5 USDT 18d", "100.5", 18, "100500000000000000000"},
		{"0.000001 USDC 6d", "0.000001", 6, "1"},
		{"rounds down extra precision", "1.123456789", 6, "1123456"},
		{"zero", "0", 18, "0"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			d, err := decimal.NewFromString(tc.in)
			require.NoError(t, err)
			got := ScaleToBase(d, tc.decimals)
			require.Equal(t, tc.want, got.String())
		})
	}
}

func TestScaleFromBase(t *testing.T) {
	cases := []struct {
		name     string
		in       string
		decimals uint8
		want     string
	}{
		{"100 USDT 18d", "100000000000000000000", 18, "100"},
		{"100.5 USDT 18d", "100500000000000000000", 18, "100.5"},
		{"1 wei 18d", "1", 18, "0.000000000000000001"},
		{"1 USDC 6d", "1000000", 6, "1"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			n, ok := new(big.Int).SetString(tc.in, 10)
			require.True(t, ok)
			got := ScaleFromBase(n, tc.decimals)
			require.Equal(t, tc.want, got.String())
		})
	}
}

func TestScaleFromBase_Nil(t *testing.T) {
	require.True(t, ScaleFromBase(nil, 18).IsZero())
}

func TestRoundtrip(t *testing.T) {
	in, _ := decimal.NewFromString("123.456789")
	got := ScaleFromBase(ScaleToBase(in, 6), 6)
	require.Equal(t, "123.456789", got.String())
}
