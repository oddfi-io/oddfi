// Package testutil provides helpers for SDK tests:
//   - ForkTestnet / ForkMainnet: spin up `anvil --fork-url` against pinned blocks
//   - DryRun: build a Connection that refuses to broadcast (estimateGas/eth_call only)
package testutil
