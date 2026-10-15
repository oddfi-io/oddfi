// Package client provides the Connection type — the single entry point that
// holds the RPC client, chain ID, contract addresses (loaded from embedded
// per-environment config), and the result of startup-time consistency checks
// against on-chain admin/multisig roles.
//
// Role packages (admin, multisig, reader) are constructed from a *Connection
// plus role-specific options.
package client
