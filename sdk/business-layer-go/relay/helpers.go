// helpers.go — small utilities used across relay methods.

package relay

import (
	"errors"
	"strings"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// quoteGuardInput is an alias for oddfi.QuoteGuardInput so call sites in
// place_bet.go don't need to import the SDK.
type quoteGuardInput = oddfi.QuoteGuardInput

// errStr lifts a plain string into an error for wrapping into BusinessError.
func errStr(s string) error { return errors.New(s) }

// hashFromString decodes a coretypes.TxHash (a 0x-prefixed hex string) into
// common.Hash. Empty input returns the zero hash.
func hashFromString(h coretypes.TxHash) common.Hash {
	s := strings.TrimSpace(string(h))
	if s == "" {
		return common.Hash{}
	}
	return common.HexToHash(s)
}
