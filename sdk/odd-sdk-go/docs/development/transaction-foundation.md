# Transaction Foundation Implementation Plan

## Background

The SDK foundation exposes read-only protocol status. The next safe increment is to add low-risk ODDToken ERC-20 write methods (`transfer` / `approve`) using caller-supplied go-ethereum transaction options, while keeping broadcast/write e2e disabled by default.

## Scope

- Implement ODDToken `transfer` and `approve` wrappers.
- Accept `*bind.TransactOpts` from the caller for signer / nonce / gas policy.
- Return `*types.Transaction` directly.
- Optionally add read-only `eth_call` simulation helpers where they provide clear value, using go-ethereum call types directly.
- Add unit tests and keep e2e read-only by default; write e2e must require a separate explicit opt-in flag.

## Non-Scope

- No default write e2e broadcast.
- No hidden use of private keys; signing stays in caller-supplied `bind.TransactOpts`.
- No SDK-owned gas / nonce policy in this increment.
- No `SendAndWait` implementation in this increment unless receipt reorg validation is implemented at the same time.
- No full StakingPool, LiquidityPool, or BettingPool write APIs in this increment.

## API Change Surface

New public API must remain in `/pkg/oddfi` and may expose go-ethereum public types:

- `Transfer(opts *bind.TransactOpts, to common.Address, value *big.Int) (*types.Transaction, error)`
- `Approve(opts *bind.TransactOpts, spender common.Address, value *big.Int) (*types.Transaction, error)`
- Optional simulation helpers may use `ethereum.CallMsg`, `bind.CallOpts`, `common.Address`, and `*big.Int`.

## Test Plan

- Unit tests for:
  - ODDToken transfer / approve facade calls with fake transactor backend
  - nil / invalid transaction options behavior
  - read-only methods continue returning expected values with fake caller backend
- Gated e2e:
  - use environment variables for RPC URL and addresses
  - write tests remain disabled unless a separate opt-in flag is set
  - when enabled, derive signer address from environment-provided key only at runtime
  - never store private keys, RPC URLs, or signed transaction payloads in source/docs

## Rollback

Remove transaction foundation public methods, related infrastructure facade code, e2e additions, and progress updates. Read-only SDK foundation remains intact.
