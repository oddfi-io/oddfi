// sponsored.go — internal alias layer that re-exports the EIP-7702 primitives
// under names that do not leak "eip7702" into relay's public surface.
//
// Public callers see only relay.PlaceBet / relay.Transfer / etc. — never the
// underlying delegation mechanism.
//
// We deliberately do NOT physically move the EIP-7702 implementation. It lives
// under internal/eip7702 (which is unimportable by external modules thanks to
// Go's internal/ rule), and this file imports it under a friendlier name.
//
// Signing is no longer performed here: relay computes the auth + execute
// digests via eip7702 and hands them to the injected Signer (Magic). See
// service.go submit().

package relay

import (
	"github.com/Crypto-Barrett/contracts-business-layer/internal/eip7702"
)

// sponsoredCall is one inner call inside a sponsored bundle (= eip7702.Call).
type sponsoredCall = eip7702.Call

// executeDigestInput configures the EIP-712 Execute digest (= eip7702.ExecuteDigestInput).
type executeDigestInput = eip7702.ExecuteDigestInput
