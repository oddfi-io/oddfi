// signer.go — re-export the Signer interface from oddfi-magic-client so callers
// don't have to dual-import the relay and magic-client packages, and so tests
// can inject a mock without touching the concrete *magicclient.Client.

package relay

import (
	magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"
)

// Signer is the user-side signing capability injected into Client. The relay
// pipeline calls WalletAddress to resolve the user's EOA from their UserID
// (process-cached; see addr_cache.go) and SignDigest to sign on their behalf.
//
// In production this is *magicclient.Client; tests inject a mock.
type Signer = magicclient.Signer
