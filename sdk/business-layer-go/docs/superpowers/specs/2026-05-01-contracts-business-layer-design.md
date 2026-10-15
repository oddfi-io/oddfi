# Contracts Business Layer — v1 Design

**Date:** 2026-05-01
**Status:** Approved (brainstorming complete; implementation underway)
**Module:** `github.com/Crypto-Barrett/contracts-business-layer`

---

## 1. Purpose & Scope

`contracts-business-layer` is a Go library that wraps `oddfi-contracts-sdk/sdk` (the L1 SDK to the BettingPool contract) and adds the business-layer machinery the SDK deliberately stays out of:

- Idempotent on-chain writes via a persisted state machine (`chain_actions`)
- Multi-pod-safe nonce serialization (`signer_lease`)
- A background Watcher that progresses each `chain_actions` row from `submitted` → `confirmed`
- Multisig proposal flow against Safe Transaction Service, with a separate state table (`multisig_proposals`) and poller
- A "business ID → on-chain identity" boundary (resolver pattern) that lets non-AI collaborators fill in domain mappings without touching the plumbing

The library is consumed by sibling Go services: `chain_consumer`, `chain_crawler`, `oddfi-bets-api`, `oddfi-web-api`, etc. Each consumer holds one `*business.Service` for the lifetime of its process.

### Out of scope for v1

- WebSocket push of status changes to frontends — separate service, not this library
- Cross-DB resolver impls (chain_actions and business tables must share one MySQL instance)
- Multi-RPC-endpoint failover for writes — single nonce-coord endpoint, manual switch on outage
- Multi-admin-EOA sharding — single admin signer
- Counter-based nonce sequencing — lock-and-query strategy only
- 7 lower-frequency multisig methods (BatchCancelMatch, ReleaseOrForfeiture, WithdrawPlatform, SetMaxMarketsPerMatch, SetRedLightThreshold, SetAdmin, SetLpShareBps) — deferred to v2

### Replaces

This library REPLACES the existing `oddfi-contracts-sdk/service/` module. Once v1 is shipped, that module is removed; the SDK repo retains only the pure L1 (`sdk/`).

---

## 2. Architecture

### 2.1 Encapsulation principle

The library owns construction of every infrastructure handle. Consumers pass only declarative configuration. They do not construct or hold `*sdk.Connection`, `signer.Signer`, `*gorm.DB`, or Watcher goroutines.

```
┌─────────────────────────────────────────────────────────────────┐
│ Consumer process (chain_consumer / oddfi-bets-api / ...)        │
│                                                                  │
│   svc, _ := business.New(business.Config{                       │
│       Env: "testnet", RPC: "...", MySQLDSN: "...",              │
│       SignerEnvVar: "...", SignerSecretFile: "...",             │
│       SafeTxServiceURL: "...", ProposerSignerEnvVar: "...",     │
│       Tokens: map[...]TokenInfo{...},                            │
│       Logger: zap.L(),                                           │
│   })                                                             │
│   defer svc.Close()                                              │
│                                                                  │
│   // Only svc.SubmitX / svc.X / svc.GetAction / ... used        │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ contracts-business-layer (single Go module)                      │
│   New() builds: gorm DB → sdk.Connection → signer →              │
│   Repos → Watcher goroutines → Multisig poller goroutine         │
│   migrations auto-run on startup                                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────────┐
       ▼               ▼                   ▼
┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐
│ MySQL 8.4+ │  │ EVM RPC node │  │ Safe Tx Service (HTTPS) │
│ chain_acts │  │ (1 endpoint) │  │ safe-transaction-bsc... │
│ multisig_p │  │              │  │                          │
│ signer_lea │  │              │  │                          │
└────────────┘  └──────────────┘  └─────────────────────────┘
```

### 2.2 Module layout

Single Go module `github.com/Crypto-Barrett/contracts-business-layer`. Layout:

```
contracts-business-layer/
├── go.mod / go.sum
├── service.go        // business.Service + New + Close + Health[z]
├── config.go         // business.Config + validation
├── types.go          // ActionID, TxHash, Result, Status, WaitOption, ...
├── errors.go         // sentinels + typed wrappers
├── tokens.go         // TokenSymbol, TokenInfo
│
├── action/           // chain_actions table + Repo + state machine
├── proposal/         // multisig_proposals table + Repo
├── watcher/          // tx receipt → confirmation progression
├── multisigpoll/     // Safe Tx Service polling
├── writes/           // SubmitLockBet / LockBet / SubmitPlaceBet (stub) / ...
├── reads/            // GetUserBalance / GetBet / ... + GetUserPortfolio (stub)
├── multisig/         // Settle / Pause / ExecuteLargeWithdrawal / ...
│
├── resolver/
│   ├── interfaces.go
│   ├── stub/         // ErrNotImplemented defaults
│   └── impl/         // real impls — PR'd by business team
│
├── client/           // wraps sdk.Connection + per-RPC timeout + OTEL
│
├── internal/
│   ├── nonce/        // signer_lease lock + chain query
│   ├── money/        // decimal.Decimal ↔ *big.Int
│   ├── signerload/   // env+file → sdk/signer.Signer (hidden from caller)
│   └── testdb/       // testcontainers MySQL helpers
│
├── migrations/       // .up.sql / .down.sql, golang-migrate
│
├── docs/
│   ├── flows/        // bet-placement, settlement, withdrawal
│   ├── operations.md
│   └── resolver-implementation-guide.md
│
├── examples/         // chain_consumer / http_api / ops_cli
├── e2e/              // anvil + MySQL end-to-end tests
└── Makefile, docker-compose.yml, .github/workflows/ci.yml
```

### 2.3 Three boundaries

| Boundary | Inside the library | Outside |
|---|---|---|
| **Library vs consumer** | gorm DB, sdk.Connection, signer, Watcher, Poller, migrations, all goroutine lifecycles | Process entrypoint, declarative `Config`, Kafka/HTTP wiring, **WS push** |
| **Library vs SDK** | State machines, idempotency, business naming, Watcher, resolver, error normalization, OTEL spans | EVM RPC, signer interface, ABI bindings, contract revert parsing |
| **Library code vs business team** | All of the above + resolver interfaces | `resolver/impl/*` real impls (business ID → on-chain params, business validation) |

---

## 3. Public API

### 3.1 Service construction

```go
package business

func New(cfg Config) (*Service, error)
func (s *Service) Close() error                 // stops watcher/poller, closes DB, drops RPC
func (s *Service) Healthz(ctx context.Context) error  // for K8s liveness/readiness
func (s *Service) Health(ctx context.Context) HealthStatus
```

### 3.2 `business.Config`

```go
type Config struct {
    // Required
    Env              string                // "testnet" | "mainnet"
    RPC              string                // single endpoint
    MySQLDSN         string                // OR DB *gorm.DB (escape hatch)

    // Admin signer
    SignerEnvVar     string                // testnet path
    SignerSecretFile string                // mainnet required, testnet fallback

    // Token metadata (caller-provided, library does not bundle addresses)
    Tokens map[TokenSymbol]TokenInfo

    // Optional — escape hatches
    DB *gorm.DB                            // pre-opened; if set, MySQLDSN ignored

    // Optional — observability
    Logger *zap.Logger                     // default zap.NewNop()

    // Optional — timeouts
    RPCTimeout       time.Duration         // default 5s, applied per individual RPC call
    TxTimeout        time.Duration         // default 30s, applied to whole tx send

    // Optional — Watcher knobs
    WatcherWorkers       int               // default 4
    WatcherPollInterval  time.Duration     // default 500ms
    DefaultConfirmations int               // default 2
    OrphanPendingAfter   time.Duration     // default 5min, then mark pending → failed
    SkipMigrations       bool              // default false; ops escape hatch

    // Optional — multisig (omit if not using multisig)
    SafeTxServiceURL         string        // e.g. "https://safe-transaction-bsc.safe.global"
    ProposerSignerEnvVar     string        // proposer key (Safe owner)
    ProposerSignerSecretFile string
    EnableDirectExecute      bool          // testnet only
    MultisigPollInterval     time.Duration // default 30s

    // Optional — resolver overrides (nil = use resolver/impl/* default)
    UserResolver  resolver.UserResolver
    MatchResolver resolver.MatchResolver
    OddsResolver  resolver.OddsResolver
    BetIDResolver resolver.BetIDResolver
}

type TokenInfo struct {
    Symbol   TokenSymbol
    Address  common.Address
    Decimals uint8
}
```

### 3.3 Common types

```go
type ActionID int64                        // chain_actions.id
type ProposalID int64                      // multisig_proposals.id
type TxHash string                         // "0x" + 64 hex
type BetID [32]byte                        // bytes32 on-chain identifier

type Result struct {
    ActionID          ActionID
    TxHash            TxHash
    Status            Status
    BlockNumber       uint64
    BlockHash         common.Hash
    GasUsed           uint64
    EffectiveGasPrice decimal.Decimal      // wei
    Revert            *RevertInfo          // non-nil iff failed-due-to-revert
    SubmittedAt       time.Time
    ConfirmedAt       time.Time
}

type Status string
const (
    StatusPending   Status = "pending"
    StatusSubmitted Status = "submitted"
    StatusMined     Status = "mined"
    StatusConfirmed Status = "confirmed"
    StatusFailed    Status = "failed"
    StatusDropped   Status = "dropped"
)

type RevertInfo struct {
    Method string
    Name   string                          // contract-defined error name
    Args   map[string]any
    Raw    string                          // raw hex revert data
}

type WaitOption func(*waitConfig)
func WaitForConfirmations(n int) WaitOption    // default 2
func WaitPollInterval(d time.Duration) WaitOption  // default 250ms
// Note: total timeout is controlled by ctx, not by WaitOption.
```

### 3.4 Writes (admin) — two-layer API

For each SDK admin method we provide three forms:

- `Simulate{Op}(ctx, req) error` — eth_call dry-run; typed revert error
- `Submit{Op}(ctx, req) (TxHash, ActionID, error)` — broadcast-and-go; ~3-5s blocking on RPC
- `{Op}(ctx, req, opts ...WaitOption) (Result, error)` — same broadcast then block until terminal

v1 covers (low-level, `Req`s use already-translated on-chain types):

| Op | LowReq |
|---|---|
| LockBet | `LockBetReq{BetID, User common.Address, Amount decimal.Decimal, Token, MatchID, Market, Outcome, Line, LockedOdds, IdempotencyKey}` |
| LockCreditBet | + `CollateralBetID` |
| UnlockBet | `UnlockBetReq{BetID, IdempotencyKey}` |
| LockParlay | `LockParlayReq{...}` (multi-leg) |
| UnlockParlay | `UnlockParlayReq{ParlayID, IdempotencyKey}` |
| CreditDeposit | `CreditDepositReq{User, Amount, OffchainTxHash, IdempotencyKey}` |
| OpenMarket | `OpenMarketReq{MatchID, Market, Line, IdempotencyKey}` |
| CloseMarket | `CloseMarketReq{MatchID, Market, Line, IdempotencyKey}` |
| UpdateSignal | `UpdateSignalReq{...}` |

**Higher-level wrappers** (business team fills in via resolver impls):

```go
type PlaceBetReq struct {
    UserID         string                  // business ID
    MatchID        string                  // business ID
    Market         MarketKind
    Outcome        uint8
    Stake          decimal.Decimal
    Token          TokenSymbol
    IdempotencyKey string
}

func (s *Service) SubmitPlaceBet(ctx, req) (TxHash, ActionID, error)  // stub by default
func (s *Service) PlaceBet(ctx, req, opts...) (Result, error)         // stub by default
```

The default impl calls `UserResolver.OnchainAddress` + `MatchResolver.OnchainMatchID` + `OddsResolver.LockedOddsAt` + `BetIDResolver.Hash`, builds a `LockBetReq`, calls `LockBet`. When `resolver/impl/*` is empty, it returns `ErrNotImplemented` from the stub.

### 3.5 Reads

Pass-through with `decimal.Decimal` conversion. v1 has NO caching.

```go
func (s *Service) GetUserBalance(ctx, addr common.Address, token TokenSymbol) (decimal.Decimal, error)
func (s *Service) GetBet(ctx, betID BetID) (BetState, error)
func (s *Service) GetMatchPool(ctx, matchID decimal.Decimal) (PoolInfo, error)
func (s *Service) GetMarketStatus(ctx, matchID decimal.Decimal, market MarketKind) (MarketStatus, error)

// Higher-level — stubs
func (s *Service) GetUserPortfolio(ctx, userID string) (Portfolio, error)
func (s *Service) ListUserBets(ctx, userID string, filter BetFilter) ([]BetSummary, error)

// Action introspection
func (s *Service) GetAction(ctx, id ActionID) (ActionRow, error)
func (s *Service) ListActions(ctx, filter ActionFilter) ([]ActionRow, error)
func (s *Service) ActionByIdempotencyKey(ctx, key string) (ActionRow, error)
```

### 3.6 Multisig (v1 high-frequency subset)

7 methods in v1: `Settle`, `CancelMatch`, `Pause`, `Unpause`, `ReopenMarket`, `ExecuteLargeWithdrawal`, `RejectLargeWithdrawal`.

For each, three modes:

```go
// Pure local — no RPC, no signer; for ops to paste into Safe UI
func (s *Service) Build{Op}Calldata(ctx, req) (CalldataPacket, error)

// Propose to Safe Transaction Service; signed by proposer key; poller tracks
func (s *Service) SubmitPropose{Op}(ctx, req) (*Proposal, error)
func (s *Service) Propose{Op}(ctx, req, opts...) (*ProposalResult, error)

// Testnet 1-of-1 only; goes through chain_actions like an admin write
func (s *Service) Execute{Op}Direct(ctx, req, opts...) (Result, error)

// Simulate against the Safe address as msg.sender
func (s *Service) Simulate{Op}(ctx, req) error
```

```go
type Proposal struct {
    ID                    ProposalID
    Op                    string
    SafeAddress           common.Address
    SafeTxHash            common.Hash
    SafeNonce             uint64
    ProposerAddress       common.Address
    Status                ProposalStatus
    ConfirmationsRequired uint
    ConfirmationsCount    uint
    OnChainTxHash         *common.Hash    // only when executed
    SafeUIURL             string
    ProposedAt            time.Time
    ExecutedAt            *time.Time
}

type ProposalStatus string
const (
    ProposalProposed       ProposalStatus = "proposed"
    ProposalExecuted       ProposalStatus = "executed"
    ProposalExecutedFailed ProposalStatus = "executed_failed"
    ProposalRejected       ProposalStatus = "rejected"
)

type ProposalResult struct {
    Proposal      Proposal
    OnChainResult *Result   // chain_actions row that mirrored the executed tx
}

func (s *Service) GetProposal(ctx, id ProposalID) (Proposal, error)
func (s *Service) GetProposalBySafeTxHash(ctx, h common.Hash) (Proposal, error)
func (s *Service) ListProposals(ctx, filter ProposalFilter) ([]Proposal, error)
```

### 3.7 Errors — dual mode

```go
// Sentinels — for errors.Is
var (
    ErrNotImplemented      = errors.New("business: not implemented (resolver stub)")
    ErrIdempotencyConflict = errors.New("business: idempotency_key collision with different args")
    ErrConfigInvalid       = errors.New("business: config invalid")
    ErrServiceClosed       = errors.New("business: service closed")
    ErrActionNotFound      = errors.New("business: action not found")
    ErrProposalNotFound    = errors.New("business: proposal not found")
    ErrDropped             = errors.New("business: tx dropped from mempool")
    ErrTimeout             = errors.New("business: wait timed out (ctx)")
    ErrModeNotConfigured   = errors.New("business: multisig mode not configured")
)

// Typed wrappers — for errors.As
type ErrSimulationFailed struct {
    Method string
    Revert *RevertInfo
    Cause  error
}
type ErrReverted struct {
    Method string
    TxHash TxHash
    Revert *RevertInfo
}
type ErrRPC struct {
    Op    string                          // "PendingNonceAt" / "SendRawTransaction" / "GetReceipt"
    Cause error
}
type ErrResolver struct {
    Resolver string                       // "UserResolver" / ...
    Cause    error
}
type ErrDB struct {
    Op    string
    Cause error
}
```

### 3.8 Resolver interfaces

```go
package resolver

type UserResolver interface {
    OnchainAddress(ctx context.Context, userID string) (common.Address, error)
    CanPlaceBet(ctx context.Context, userID string, stake decimal.Decimal, token TokenSymbol) error
}

type MatchResolver interface {
    OnchainMatchID(ctx context.Context, matchID string) (decimal.Decimal, error)
    IsMarketOpen(ctx context.Context, matchID string, market MarketKind) (bool, error)
}

type OddsResolver interface {
    LockedOddsAt(ctx context.Context, matchID string, market MarketKind, outcome uint8) (decimal.Decimal, error)
}

type BetIDResolver interface {
    Hash(ctx context.Context, businessBetID string) (BetID, error)
}
```

Default impls live in `resolver/impl/` (business team writes them, gets PR'd into this repo). When `impl/` lacks an implementation, the library falls through to `resolver/stub/` whose methods all return `ErrNotImplemented`.

---

## 4. State machines & storage

### 4.1 `chain_actions` schema

```sql
CREATE TABLE chain_actions (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idempotency_key     VARCHAR(128)    NOT NULL,
  op                  VARCHAR(48)     NOT NULL,
  args_json           JSON            NOT NULL,
  status              VARCHAR(16)     NOT NULL,            -- pending|submitted|mined|confirmed|failed|dropped
  attempts            INT UNSIGNED    NOT NULL DEFAULT 0,
  tx_hash             CHAR(66)            NULL,
  block_number        BIGINT UNSIGNED     NULL,
  block_hash          CHAR(66)            NULL,            -- for reorg detection
  gas_used            BIGINT UNSIGNED     NULL,
  effective_gas_price DECIMAL(38, 0)      NULL,            -- wei
  signer_address      CHAR(42)        NOT NULL,
  nonce               BIGINT UNSIGNED     NULL,
  last_error          TEXT                NULL,
  last_error_kind     VARCHAR(24)         NULL,            -- revert|rpc|timeout|sim_failed|replaced
  assigned_to         VARCHAR(64)         NULL,
  heartbeat_at        DATETIME(3)         NULL,
  created_at          DATETIME(3)     NOT NULL,
  submitted_at        DATETIME(3)         NULL,
  mined_at            DATETIME(3)         NULL,
  confirmed_at        DATETIME(3)         NULL,
  failed_at           DATETIME(3)         NULL,
  updated_at          DATETIME(3)     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE  KEY uk_idem (idempotency_key),
  KEY     ix_status_updated (status, updated_at),
  KEY     ix_tx_hash (tx_hash),
  KEY     ix_signer_status (signer_address, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

State machine:

```
[pending] ── Submit broadcast OK ──────────► [submitted]
[pending] ── Sim revert / broadcast err ──► [failed]
[submitted] ── Receipt status=1 ──────────► [mined]
[submitted] ── Receipt status=0 ──────────► [failed]
[submitted] ── No mining for >5min ──────► [dropped]
[mined]    ── N confirmations & no reorg ─► [confirmed] ★
[mined]    ── Reorg (block hash changed) ► [submitted]  (re-track)
```

Terminal states: `confirmed`, `failed`. (`dropped` may be picked up by ops to re-issue with a new idempotency key.)

### 4.2 `multisig_proposals` schema

```sql
CREATE TABLE multisig_proposals (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idempotency_key         VARCHAR(128)    NOT NULL,
  op                      VARCHAR(48)     NOT NULL,
  args_json               JSON            NOT NULL,
  safe_address            CHAR(42)        NOT NULL,
  safe_tx_hash            CHAR(66)        NOT NULL,
  safe_nonce              BIGINT UNSIGNED NOT NULL,
  proposer_address        CHAR(42)        NOT NULL,
  status                  VARCHAR(24)     NOT NULL,        -- proposed|executed|executed_failed|rejected
  confirmations_required  INT UNSIGNED        NULL,
  confirmations_count     INT UNSIGNED        NULL,
  on_chain_tx_hash        CHAR(66)            NULL,
  safe_ui_url             TEXT,
  last_polled_at          DATETIME(3)         NULL,
  created_at              DATETIME(3)     NOT NULL,
  proposed_at             DATETIME(3)     NOT NULL,
  executed_at             DATETIME(3)         NULL,
  updated_at              DATETIME(3)     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_idem (idempotency_key),
  UNIQUE KEY uk_safe_tx_hash (safe_tx_hash),
  KEY    ix_status_polled (status, last_polled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.3 `signer_lease` schema (lock token only)

```sql
CREATE TABLE signer_lease (
  signer_address  CHAR(42)        NOT NULL,
  updated_at      DATETIME(3)     NOT NULL,
  PRIMARY KEY (signer_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

No `next_nonce` column — chain is the source of truth (see §5.5).

### 4.4 Migrations

Tool: `golang-migrate/migrate`. Files in `migrations/`:

```
0001_chain_actions.up.sql / .down.sql
0002_signer_lease.up.sql / .down.sql
0003_multisig_proposals.up.sql / .down.sql
```

The library auto-runs `migrate.Up()` from inside `business.New()` (unless `Config.SkipMigrations=true`). Failure causes `New()` to return an error.

---

## 5. Concurrency model

### 5.1 Two-layer timeout policy (mandatory)

Every public method takes `ctx context.Context` as its first argument. Internally:

- **Per-call ctx**: the caller's deadline applies to the entire operation including waits for confirmation. The library MUST NOT do best-effort completion past `ctx.Done()`.
- **Per-RPC timeout**: every individual RPC call (`eth_call`, `eth_getTransactionReceipt`, `eth_sendRawTransaction`) is wrapped with `context.WithTimeout(ctx, Config.RPCTimeout)`. The effective deadline is `min(ctx.Deadline, now + RPCTimeout)`.

Defaults: `RPCTimeout=5s`, `TxTimeout=30s`.

### 5.2 Submit foreground flow

`SubmitLockBet` (and every Submit) does ALL of this synchronously, ~3-5s:

1. Resolver translation (cheap, possibly DB read)
2. `INSERT chain_actions` (idempotent: on `idempotency_key` collision, SELECT existing and short-circuit)
3. `Simulate{Op}` (eth_call); on revert, `MarkFailed` and return
4. `signer_lease` row lock acquired
5. `eth_getTransactionCount(addr, "pending")` → nonce
6. `admin.{Op}WithNonce` broadcast (RPC roundtrip ~1-3s)
7. `UPDATE chain_actions SET status='submitted', tx_hash=?, nonce=?` (still inside DB tx)
8. Commit (releases `signer_lease` lock)
9. Return `(tx_hash, action_id)` to caller

The Watcher takes over from `submitted`.

### 5.3 Watcher (in-process, multi-pod-safe)

`Config.WatcherWorkers` (default 4) goroutines per pod. Each runs:

```
loop every WatcherPollInterval (default 500ms):
    SELECT id FROM chain_actions
      WHERE status = 'submitted'
        AND (assigned_to IS NULL OR heartbeat_at < NOW() - 60s)
      ORDER BY updated_at LIMIT 1
      FOR UPDATE SKIP LOCKED
    if no row: continue
    UPDATE assigned_to=workerID, heartbeat_at=NOW()
    track(row):
        // heartbeat goroutine: every 20s update heartbeat_at
        receipt = waitReceipt(tx_hash)        // poll eth_getTransactionReceipt
        if receipt.Status == 0:
            MarkFailed(parsed revert)
            return
        MarkMined(blockNum, blockHash, gasUsed)
        loop:
            head = eth_blockNumber()
            if head < blockNum + DefaultConfirmations: sleep, retry
            currHash = eth_headerHash(blockNum)
            if currHash != original blockHash:
                MarkResubmittedAfterReorg()      // back to 'submitted'
                return
            MarkConfirmed()
            return
```

Multi-pod safety relies on `FOR UPDATE SKIP LOCKED` (MySQL 8.4.7). A worker that dies releases its row after 60s of stale heartbeat, when another worker reclaims.

Pending rows older than `Config.OrphanPendingAfter` (default 5min) are swept to `failed("interrupted")` by a low-frequency cleanup loop.

### 5.4 Multisig poller

A single goroutine ticks every `Config.MultisigPollInterval` (default 30s):

```
SELECT * FROM multisig_proposals
  WHERE status = 'proposed'
    AND (last_polled_at IS NULL OR last_polled_at < NOW() - 30s)
  LIMIT 50
for each row:
    prop = sdk/multisig.GetProposal(safeTxHash)
    switch prop.Status:
    case "executed":
        UPDATE proposal SET status='executed', on_chain_tx_hash=?, executed_at=NOW()
        INSERT chain_actions (op='multisig_executed:settle', status='submitted', tx_hash=prop.OnChainTxHash, ...)
        // standard Watcher then confirms it
    case "executed_failed":
        UPDATE proposal SET status='executed_failed', ...
    case "rejected":
        UPDATE proposal SET status='rejected', ...
    case "proposed":
        UPDATE proposal SET confirmations_count=?, confirmations_required=?, last_polled_at=NOW()
```

Single worker is intentional — Safe Tx Service is rate-limited; parallelism just gets throttled.

### 5.5 Nonce management

Single admin EOA. Single RPC endpoint (`Config.RPC`). Lock-and-query inside one DB transaction:

```
BEGIN;
SELECT 1 FROM signer_lease WHERE signer_address=? FOR UPDATE;
nonce = eth.PendingNonceAt(ctx, addr)         -- always trust the chain
broadcast(nonce)                              -- still inside lock
UPDATE chain_actions SET status='submitted', tx_hash=?, nonce=?
COMMIT;                                        -- release lock
```

Throughput: ~2-5 TPS per signer (lock holds for `PendingNonceAt + broadcast` ≈ 200-700ms). Comfortable headroom over the v1 stated peak of 10 TPS total.

Self-healing properties:
- External manual tx (e.g., `cast send`): next call's chain query reflects the new nonce; library auto-bumps.
- Database row corruption: not possible — there's no counter to corrupt.
- Cold start: no calibration needed; first call queries chain.

Operational notes:
- The single nonce-coord endpoint is a SPOF for writes. On outage, restart the process with a new `Config.RPC`.
- External manual tx should use the same RPC endpoint, otherwise the library may briefly see a stale `PendingNonceAt` and have to retry the next Submit.

### 5.6 Crash recovery

Driven by the state machine, no separate recovery script:

| Status on restart | Watcher behavior |
|---|---|
| `pending` | Orphan from a Submit that crashed before broadcast. Cleanup loop sweeps to `failed` after `OrphanPendingAfter`. |
| `submitted` | Standard Watcher claims, queries receipt, progresses. tx is already in mempool/chain — never re-broadcast. |
| `mined` | Watcher claims, jumps directly to confirmation loop. |
| `confirmed`/`failed` | Untouched. |

The library never re-broadcasts a tx — broadcast happens exactly once in the `pending → submitted` transition, which is the foreground Submit call.

---

## 6. Observability

### 6.1 OpenTelemetry (embedded in v1)

Direct dependency on `go.opentelemetry.io/otel`. Every public method opens a span; every internal RPC, DB write, and wait-loop iteration is annotated. Span attributes: `action_id`, `op`, `idempotency_key`, `tx_hash`, `nonce`, `status_transition`. Default exporter is no-op (zero overhead if caller doesn't configure OTEL).

### 6.2 Health

```go
func (s *Service) Healthz(ctx context.Context) error          // K8s probe — error iff unhealthy
func (s *Service) Health(ctx context.Context) HealthStatus    // detailed snapshot

type HealthStatus struct {
    DBOK               bool
    RPCOK              bool
    SignerOK           bool
    LastBlockSeen      uint64
    PendingActionCount int                  // queue depth
    OldestPendingAt    *time.Time
}
```

### 6.3 Logging

Library accepts `*zap.Logger` (workspace standard). Internally uses an adapter that wraps it as `log/slog` for SDK calls. No zerolog support.

---

## 7. Money handling

All amount fields use `github.com/shopspring/decimal`. **Never `float64`**. **Never raw `*big.Int` at the public API surface.**

On-chain conversion lives in `internal/money`:

```go
// decimal "100.00" + USDC (decimals=18) → *big.Int (100 * 10^18)
func ScaleToBase(d decimal.Decimal, decimals uint8) *big.Int

// reverse
func ScaleFromBase(n *big.Int, decimals uint8) decimal.Decimal
```

Rounding policy: `RoundDown` (never silently round up user funds).

DB storage:
- `chain_actions.args_json`: decimal fields encoded as strings ("100.00")
- `chain_actions.effective_gas_price`: `DECIMAL(38, 0)` to fit any wei value

---

## 8. End-to-end flows (summaries)

Full versions: `docs/flows/`.

### 8.1 Bet placement (`docs/flows/bet-placement.md`)

```
T+0s    HTTP POST /bets ──► oddfi-bets-api
T+0.05s api: svc.SubmitPlaceBet(ctx, PlaceBetReq{UserID, MatchID, Stake, ...})
T+0.05s   resolver translation (UserResolver, MatchResolver, OddsResolver, BetIDResolver)
T+0.10s   INSERT chain_actions(status=pending, op='lockBet', args_json=...)
T+0.20s   SimulateLockBet (eth_call) → no revert
T+0.25s   acquire signer_lease lock, get pending nonce
T+0.40s   admin.LockBetWithNonce(args, nonce) → tx_hash
T+0.45s   UPDATE chain_actions SET status='submitted', tx_hash=?, nonce=?
T+0.50s   COMMIT (lock released)
T+0.50s api: return {tx_hash, action_id} to caller
T+0.50s caller: respond 202 { tx_hash, action_id }; frontend subscribes via WS (separate service)

T+0.50s ── Watcher takes over (background) ──
T+1.0s    worker claims row, tracks receipt
T+8.0s    receipt arrives, status=1 → UPDATE status='mined', block_number=N
T+24.0s   block N+2 confirmed without reorg → UPDATE status='confirmed'
T+24.0s   external WS service detects update (via DB-poll or future hook), pushes to frontend
```

### 8.2 Settlement via multisig (`docs/flows/settlement.md`)

```
T+0s     scorer detects match end → ops triggers settle
T+0.5s   svc.SubmitProposeSettle(ctx, SettleReq{MatchID, WinningOutcome, BetIDs, ...})
T+0.5s     INSERT multisig_proposals(status='proposed', confirmations_count=1)
T+0.5s     sdk/multisig.Settle(args).Propose(ctx)
T+0.6s       compute safeTxHash (EIP-712)
T+0.6s       sign with proposer key
T+1.0s       POST safe-transaction-bsc.safe.global
T+1.0s     return Proposal{safeTxHash, safeUIURL, ...}
T+1.0s   api: return Proposal to ops; ops drops safeUIURL into Slack/email

(human time)
T+5min   owner_2 signs in Safe UI → Safe TX Service stores 2nd signature
T+15min  owner_3 signs → 3rd signature
T+18min  owner_5 clicks "Execute" in UI → Safe.execTransaction(...) broadcasts on-chain

T+30s    multisig poller: GetProposal returns isExecuted=true, on_chain_tx_hash=0xabc
T+30s      UPDATE multisig_proposals SET status='executed', on_chain_tx_hash='0xabc'
T+30s      INSERT chain_actions(op='multisig_executed:settle', status='submitted', tx_hash='0xabc')

T+2s     Watcher claims row, tracks confirmation
T+10s    confirmed
T+10s    sync waiter (if any) on Propose Settle wakes up with ProposalResult
```

### 8.3 Withdrawal (`docs/flows/withdrawal.md`)

Two paths depending on amount.

**Small withdrawal (below contract threshold)**: user calls the BettingPool's user-facing `withdraw()` directly (signed with their own key, paid by their own gas). This library does NOT participate. The user's frontend handles signing.

**Large withdrawal (above threshold)**:

```
T+0s     user submits withdraw request → user-facing contract enqueues a request_id
         (tx happens user-side; library doesn't broadcast it)
T+0s     ops dashboard polls on-chain "pending large withdrawals" view (or listens to events)
T+0s     ops decides: approve → svc.SubmitProposeExecuteLargeWithdrawal(ctx, ELWReq{RequestID, IdempotencyKey})
                              ─OR─
                      reject  → svc.SubmitProposeRejectLargeWithdrawal(ctx, RLWReq{RequestID, IdempotencyKey})

         (from here, identical to the settlement flow:
          INSERT multisig_proposals → POST Safe → owners sign in UI →
          execute → poller mirrors to chain_actions → Watcher confirms)
```

---

## 9. v1 method scope (concrete list)

**Admin** (each gets `Submit{Op}` + `{Op}` + `Simulate{Op}`):
LockBet · LockCreditBet · UnlockBet · LockParlay · UnlockParlay · CreditDeposit · OpenMarket · CloseMarket · UpdateSignal

**Multisig** (each gets `Build{Op}Calldata` + `SubmitPropose{Op}` + `Propose{Op}` + `Execute{Op}Direct` + `Simulate{Op}`):
Settle · CancelMatch · Pause · Unpause · ReopenMarket · ExecuteLargeWithdrawal · RejectLargeWithdrawal

**Reads** (pass-through):
GetUserBalance · GetBet · GetMatchPool · GetMarketStatus

**Higher-level (stub by default):**
SubmitPlaceBet/PlaceBet · GetUserPortfolio · ListUserBets

**Introspection:**
GetAction · ListActions · ActionByIdempotencyKey · GetProposal · GetProposalBySafeTxHash · ListProposals

**Lifecycle:**
New · Close · Healthz · Health

---

## 10. v1 ↔ v2

| Capability | v1 | v2 |
|---|---|---|
| Admin write methods | full set | — |
| Multisig methods | 7 high-freq | + 7 deferred (BatchCancelMatch, ReleaseOrForfeiture, WithdrawPlatform, SetMaxMarketsPerMatch, SetRedLightThreshold, SetAdmin, SetLpShareBps) |
| RPC endpoint | single | multi-endpoint with nonce-coord routing + read-side LB |
| Nonce strategy | lock-and-query | counter + lease (higher TPS) — only if needed |
| Watcher topology | in-process per pod | + optional sidecar mode |
| Sync wait wake-up | DB polling (250ms) | + Redis pub/sub channel |
| Reads | pass-through | + opt-in cache layer |
| Multi-admin EOA | single | sharded by vertical |
| Status push to consumers | DB-only | + status hook (Kafka topic / webhook) |
| WebSocket push to frontends | out of scope (separate service) | still out of scope |

---

## 11. Testing strategy

### Unit tests (target ≥80% on core packages)
- `action/`, `proposal/`: testcontainers MySQL; verify SQL behavior including SKIP LOCKED, UNIQUE collision, reorg UPDATE.
- `watcher/`, `multisigpoll/`: mock SDK clients; verify state transitions, retry, heartbeat.
- `writes/`, `multisig/`, `reads/`: mock everything below; verify idempotency short-circuit, decimal conversion, error classification.

### Integration tests
- Real MySQL via `internal/testdb`; real migrations; multi-row contention scenarios.

### E2E tests (`e2e/`)
- Anvil local EVM + MySQL + deployed BettingPool fixture.
- Scenarios: LockBet → confirm; ExecuteLargeWithdrawal multisig propose → simulated owners sign → execute → confirm.
- Run on CI per PR (~60-120s); switchable to real testnet via env var for release smoke.

### Resolver stub tests
- Each `resolver/stub/*_test.go` asserts `ErrNotImplemented` — these are explicit "REPLACE ME" markers for the business team.

---

## 12. TODO list for the business team

Lives in `resolver/impl/README.md`. Summary:

1. Implement `UserResolver` (table lookup `users.wallet_address`, plus `CanPlaceBet` business rules).
2. Implement `MatchResolver` (table lookup `matches.onchain_id`, plus `IsMarketOpen`).
3. Implement `OddsResolver` (read from odds engine / cache).
4. Implement `BetIDResolver` (`keccak256(userID || matchID || timestamp || nonce)` or your team's convention).
5. Optionally implement higher-level wrappers `SubmitPlaceBet`, `GetUserPortfolio`, `ListUserBets` (extend the library's `writes/`, `reads/` packages).

Each impl ships with `_test.go` using `internal/testdb`.

---

## 13. Operational concerns (`docs/operations.md`)

- RPC endpoint outage: restart with new `Config.RPC`. Pending rows continue from `submitted`.
- External manual tx: must use the same RPC endpoint as the library, otherwise expect 1-2 retries on next Submit.
- Watcher backlog: monitor `pending_action_count` from `Health()`; alert above threshold.
- Multisig stuck: if `confirmations_count < required` for >24h, ops chases owners.
- Schema migration: library auto-runs on `New`; for blue-green deploys, set `SkipMigrations=true` and apply via CI.

---

## 14. References

- SDK: `github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk` (L1 chain access)
- Safe Tx Service: `https://safe-transaction-bsc.safe.global` (mainnet) / `https://safe-transaction-bsc-testnet.safe.global` (testnet)
- Workspace docs: `D:\everything_finance\priv\oddfi-contracts-sdk\README.md`, `D:\everything_finance\priv\oddfi-contracts-sdk\docs\`

---

**End of design document.** Implementation plan is generated separately via the writing-plans skill.
