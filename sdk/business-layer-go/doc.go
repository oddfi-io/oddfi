// Package business is the umbrella package for the contracts-business-layer.
//
// It exports no symbols itself. Consumers import the sub-packages directly:
//
//   - github.com/Crypto-Barrett/contracts-business-layer/admin
//     Platform-operator writes (open / update-odds / settle / refund / grant
//     role / add reserve).
//
//   - github.com/Crypto-Barrett/contracts-business-layer/relay
//     User-side writes submitted via gas-sponsored EIP-7702 SetCodeTx.
//
//   - github.com/Crypto-Barrett/contracts-business-layer/read
//     Read-only contract data + chain_actions status queries.
//
//   - github.com/Crypto-Barrett/contracts-business-layer/cache
//     In-process cache; pluggable backend interface.
//
//   - github.com/Crypto-Barrett/contracts-business-layer/multicall
//     multicall3 client for batching predicate reads.
//
//   - github.com/Crypto-Barrett/contracts-business-layer/coretypes
//     Shared identifiers, status enums, error types, and sentinel codes.
//
// See README.md and docs/usage-examples.md for end-to-end examples.
package business
