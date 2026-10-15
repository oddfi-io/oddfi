# Contracts Business Layer — v1 Skeleton + LockBet + Withdraw Multisig

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `contracts-business-layer` Go library, implement the chain_actions / multisig_proposals / signer_lease state machines, ship one admin write end-to-end (LockBet) as a reference, and ship the two withdraw multisig methods (ExecuteLargeWithdrawal + RejectLargeWithdrawal). Leave the remaining 8 admin writes and 5 multisig methods as scaffolds the business team can fill in copy-pasting from LockBet.

**Architecture:** Single Go module (`github.com/Crypto-Barrett/contracts-business-layer`). Library owns all infrastructure: opens gorm DB, builds sdk.Connection, builds signer via `sdk/signer.NewAuto`, runs migrations, starts in-process Watcher + Multisig poller. Two-layer write API (Submit + sync), in-band broadcast, Watcher tracks post-broadcast lifecycle. Nonce serialized via `signer_lease` row lock + `eth_getTransactionCount` inside the lock. See spec at `docs/superpowers/specs/2026-05-01-contracts-business-layer-design.md`.

**Tech Stack:** Go 1.24 · gorm v1.31 · MySQL 8.4.7 · golang-migrate v4 · shopspring/decimal · go.uber.org/zap · go.opentelemetry.io/otel · github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk (sibling, replace directive) · testify · testcontainers-go

**Local sibling SDK:** `D:\everything_finance\priv\oddfi-contracts-sdk\sdk` — referenced via `replace` in go.mod (relative path `../oddfi-contracts-sdk/sdk`).

---

## File map (what gets created)

```
contracts-business-layer/
├── go.mod, go.sum
├── doc.go, service.go, config.go, types.go, errors.go, tokens.go
├── markets.go             // MarketKind enum
│
├── action/
│   ├── model.go           // chain_actions row struct (gorm tags)
│   ├── repo.go            // Repo interface + gorm impl
│   └── repo_test.go       // testcontainers MySQL
│
├── proposal/
│   ├── model.go
│   ├── repo.go
│   └── repo_test.go
│
├── client/
│   └── connection.go      // wraps sdk/client.Connection + per-RPC ctx helper + OTEL span helpers
│
├── internal/
│   ├── money/
│   │   ├── scale.go       // ScaleToBase / ScaleFromBase
│   │   └── scale_test.go
│   ├── signerload/
│   │   └── load.go        // env+file → sdk/signer.Signer (hidden helper)
│   ├── nonce/
│   │   ├── lease.go       // Acquire (lock) → nonce → Release (commit/rollback)
│   │   └── lease_test.go
│   └── testdb/
│       └── testdb.go      // testcontainers MySQL bootstrap helper
│
├── resolver/
│   ├── interfaces.go      // UserResolver, MatchResolver, OddsResolver, BetIDResolver
│   └── stub/
│       ├── user.go
│       ├── match.go
│       ├── odds.go
│       ├── betid.go
│       └── stub_test.go
│
├── watcher/
│   ├── watcher.go         // worker pool, claim loop, heartbeat
│   ├── tracker.go         // tracks one row through receipt → confirmations
│   ├── reorg.go
│   ├── ethclient.go       // narrow interface so tests can mock
│   └── watcher_test.go
│
├── multisigpoll/
│   ├── poller.go          // single-worker tick, mirrors executed → chain_actions
│   ├── safetxservice.go   // narrow interface
│   └── poller_test.go
│
├── writes/
│   ├── shared.go          // Submit template (INSERT pending → Sim → broadcast → mark)
│   ├── lockbet.go         // LockBetReq + SubmitLockBet/LockBet/SimulateLockBet + PlaceBet stub
│   └── lockbet_test.go
│
├── multisig/
│   ├── shared.go          // Build/Submit/Propose templates
│   ├── executelargewithdrawal.go
│   ├── executelargewithdrawal_test.go
│   ├── rejectlargewithdrawal.go
│   └── rejectlargewithdrawal_test.go
│
├── migrations/
│   ├── 0001_chain_actions.up.sql / .down.sql
│   ├── 0002_signer_lease.up.sql / .down.sql
│   └── 0003_multisig_proposals.up.sql / .down.sql
│
├── Makefile, docker-compose.yml
└── README.md
```

---

## Task 1: Bootstrap go.mod + replace + doc.go

**Files:**
- Create: `go.mod`, `go.sum`, `doc.go`, `README.md`, `Makefile`, `.gitignore`, `docker-compose.yml`

- [ ] Create `go.mod`:

```
module github.com/Crypto-Barrett/contracts-business-layer

go 1.24

require (
	github.com/ethereum/go-ethereum v1.17.2
	github.com/golang-migrate/migrate/v4 v4.18.1
	github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk v0.0.0-00010101000000-000000000000
	github.com/shopspring/decimal v1.4.0
	github.com/stretchr/testify v1.10.0
	github.com/testcontainers/testcontainers-go v0.34.0
	github.com/testcontainers/testcontainers-go/modules/mysql v0.34.0
	go.opentelemetry.io/otel v1.32.0
	go.opentelemetry.io/otel/trace v1.32.0
	go.uber.org/zap v1.27.0
	gorm.io/driver/mysql v1.5.7
	gorm.io/gorm v1.25.12
)

replace github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk => ../oddfi-contracts-sdk/sdk
```

- [ ] Create `doc.go`:

```go
// Package business is the contracts business layer.
//
// It wraps oddfi-contracts-sdk/sdk and adds:
//   - Idempotent on-chain writes via the chain_actions state machine
//   - Multi-pod-safe nonce serialization via signer_lease
//   - In-process Watcher to progress submitted → confirmed
//   - Multisig proposals via Safe Transaction Service with their own state table
//   - Resolver pattern for "business ID → on-chain identity" mapping
//
// Construct one *Service per process, reuse for the lifetime of the process.
//
//	svc, err := business.New(business.Config{
//	    Env: "testnet", RPC: "https://...", MySQLDSN: "...",
//	    SignerEnvVar: "ADMIN_PRIVATE_KEY", ...
//	})
//	defer svc.Close()
//
// See docs/superpowers/specs/2026-05-01-contracts-business-layer-design.md.
package business
```

- [ ] Create `.gitignore`:

```
*.exe
*.test
*.out
.idea/
.vscode/
.env
coverage.txt
/dist/
```

- [ ] Create `Makefile`:

```makefile
.PHONY: build test test-unit test-integ tidy fmt vet

build:
	go build ./...

test:
	go test ./... -count=1

test-unit:
	go test ./... -short -count=1

vet:
	go vet ./...

tidy:
	go mod tidy

fmt:
	gofmt -w .
```

- [ ] Create `docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8.4.7
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: oddfi
    ports:
      - "3306:3306"
    command: --character-set-server=utf8mb4
```

- [ ] Create `README.md`:

```markdown
# contracts-business-layer

Go library wrapping `oddfi-contracts-sdk/sdk` with chain_actions state machine,
in-process Watcher, multisig proposal flow, and resolver pattern.

See `docs/superpowers/specs/2026-05-01-contracts-business-layer-design.md` for
the full design. See `docs/flows/` for end-to-end flow narratives.

## Quickstart

\`\`\`go
svc, err := business.New(business.Config{
    Env: "testnet",
    RPC: "https://...",
    MySQLDSN: "user:pass@tcp(localhost:3306)/oddfi?parseTime=true",
    SignerEnvVar: "ADMIN_PRIVATE_KEY",
    SignerSecretFile: "/etc/oddfi/admin.key",
    Tokens: map[business.TokenSymbol]business.TokenInfo{
        "USDT": {Symbol: "USDT", Address: ..., Decimals: 18},
    },
})
defer svc.Close()
\`\`\`
```

- [ ] Run `go mod tidy` — Expected: downloads dependencies into go.sum.

```bash
go mod tidy
```

---

## Task 2: Core public types (no logic yet)

**Files:**
- Create: `tokens.go`, `markets.go`, `types.go`

- [ ] Create `tokens.go`:

```go
package business

import "github.com/ethereum/go-ethereum/common"

// TokenSymbol is the caller-side identifier for a token (e.g. "USDT", "USDC").
type TokenSymbol string

// TokenInfo is provided by the caller via Config.Tokens. The library does not
// bundle token addresses because they vary per environment.
type TokenInfo struct {
	Symbol   TokenSymbol
	Address  common.Address
	Decimals uint8
}
```

- [ ] Create `markets.go`:

```go
package business

// MarketKind mirrors the BettingPool MarketType enum. Values must match the
// uint8 the contract expects.
type MarketKind uint8

const (
	MarketSpread     MarketKind = 0
	MarketMoneyline  MarketKind = 1
	MarketTotalsOver MarketKind = 2
	MarketTotalsUnder MarketKind = 3
)
```

- [ ] Create `types.go`:

```go
package business

import (
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"
)

// ── Identifiers ─────────────────────────────────────────────────────────────

// ActionID is chain_actions.id.
type ActionID int64

// ProposalID is multisig_proposals.id.
type ProposalID int64

// TxHash is "0x" + 64 hex characters.
type TxHash string

// BetID is the bytes32 the BettingPool contract uses to identify a bet.
type BetID [32]byte

// ── Status ──────────────────────────────────────────────────────────────────

// Status is the chain_actions row status.
type Status string

const (
	StatusPending   Status = "pending"
	StatusSubmitted Status = "submitted"
	StatusMined     Status = "mined"
	StatusConfirmed Status = "confirmed"
	StatusFailed    Status = "failed"
	StatusDropped   Status = "dropped"
)

// ProposalStatus is the multisig_proposals row status.
type ProposalStatus string

const (
	ProposalProposed       ProposalStatus = "proposed"
	ProposalExecuted       ProposalStatus = "executed"
	ProposalExecutedFailed ProposalStatus = "executed_failed"
	ProposalRejected       ProposalStatus = "rejected"
)

// ── Result of a write ──────────────────────────────────────────────────────

// Result is what a sync write method returns once the chain_actions row reaches
// a terminal status.
type Result struct {
	ActionID          ActionID
	TxHash            TxHash
	Status            Status
	BlockNumber       uint64
	BlockHash         common.Hash
	GasUsed           uint64
	EffectiveGasPrice decimal.Decimal
	Revert            *RevertInfo
	SubmittedAt       time.Time
	ConfirmedAt       time.Time
}

// RevertInfo carries parsed contract revert detail.
type RevertInfo struct {
	Method string
	Name   string
	Args   map[string]any
	Raw    string
}

// CalldataPacket is a (to, value, data) triple the multisig Build*Calldata
// methods emit.
type CalldataPacket struct {
	To        common.Address
	Value     decimal.Decimal // wei, integer
	Data      []byte
	Operation uint8 // 0 = Call (Safe enum)
}

// ── Wait options ────────────────────────────────────────────────────────────

// WaitOption configures the sync wait of *Service.LockBet etc.
type WaitOption func(*WaitConfig)

// WaitConfig is the resolved set of options. Exposed so internal packages can
// read it; callers should construct via WaitForConfirmations / WaitPollInterval.
type WaitConfig struct {
	Confirmations int
	PollInterval  time.Duration
}

// WaitForConfirmations sets the confirmation count required for a write to
// be considered confirmed. Default 2.
func WaitForConfirmations(n int) WaitOption {
	return func(c *WaitConfig) { c.Confirmations = n }
}

// WaitPollInterval sets how often the sync wait polls the chain_actions row.
// Default 250ms.
func WaitPollInterval(d time.Duration) WaitOption {
	return func(c *WaitConfig) { c.PollInterval = d }
}

// DefaultWaitConfig returns the sync-wait defaults.
func DefaultWaitConfig() WaitConfig {
	return WaitConfig{Confirmations: 2, PollInterval: 250 * time.Millisecond}
}

// ── Health ──────────────────────────────────────────────────────────────────

// HealthStatus is a snapshot of the library's runtime state.
type HealthStatus struct {
	DBOK               bool
	RPCOK              bool
	SignerOK           bool
	LastBlockSeen      uint64
	PendingActionCount int
	OldestPendingAt    *time.Time
}
```

- [ ] Run `go vet ./...` — Expected: no errors.

```bash
go vet ./...
```

---

## Task 3: Errors

**Files:**
- Create: `errors.go`

- [ ] Create `errors.go`:

```go
package business

import (
	"errors"
	"fmt"
)

// ── Sentinels (use with errors.Is) ─────────────────────────────────────────

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

// ── Typed wrappers (use with errors.As) ────────────────────────────────────

// ErrSimulationFailed wraps an eth_call dry-run revert.
type ErrSimulationFailed struct {
	Method string
	Revert *RevertInfo
	Cause  error
}

func (e *ErrSimulationFailed) Error() string {
	if e.Revert != nil {
		return fmt.Sprintf("business: simulate %s reverted: %s", e.Method, e.Revert.Name)
	}
	return fmt.Sprintf("business: simulate %s failed: %v", e.Method, e.Cause)
}

func (e *ErrSimulationFailed) Unwrap() error { return e.Cause }

// ErrReverted wraps an on-chain revert (receipt.Status==0).
type ErrReverted struct {
	Method string
	TxHash TxHash
	Revert *RevertInfo
}

func (e *ErrReverted) Error() string {
	name := "<unparsed>"
	if e.Revert != nil {
		name = e.Revert.Name
	}
	return fmt.Sprintf("business: %s tx %s reverted: %s", e.Method, e.TxHash, name)
}

// ErrRPC wraps any RPC-level error.
type ErrRPC struct {
	Op    string
	Cause error
}

func (e *ErrRPC) Error() string { return fmt.Sprintf("business: rpc %s: %v", e.Op, e.Cause) }
func (e *ErrRPC) Unwrap() error { return e.Cause }

// ErrResolver wraps an error returned from a resolver impl.
type ErrResolver struct {
	Resolver string
	Cause    error
}

func (e *ErrResolver) Error() string {
	return fmt.Sprintf("business: resolver %s: %v", e.Resolver, e.Cause)
}
func (e *ErrResolver) Unwrap() error { return e.Cause }

// ErrDB wraps an error from the gorm DB layer.
type ErrDB struct {
	Op    string
	Cause error
}

func (e *ErrDB) Error() string { return fmt.Sprintf("business: db %s: %v", e.Op, e.Cause) }
func (e *ErrDB) Unwrap() error { return e.Cause }
```

- [ ] Run `go vet ./...` — Expected: no errors.

---

## Task 4: Resolver interfaces and stubs

**Files:**
- Create: `resolver/interfaces.go`, `resolver/stub/user.go`, `resolver/stub/match.go`, `resolver/stub/odds.go`, `resolver/stub/betid.go`, `resolver/stub/stub_test.go`

- [ ] Create `resolver/interfaces.go`:

```go
// Package resolver defines the boundary between the library's plumbing and
// the business team's domain mapping code.
package resolver

import (
	"context"

	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"

	business "github.com/Crypto-Barrett/contracts-business-layer"
)

// UserResolver translates a business user ID into an on-chain address and
// applies pre-bet business validation.
type UserResolver interface {
	OnchainAddress(ctx context.Context, userID string) (common.Address, error)
	CanPlaceBet(ctx context.Context, userID string, stake decimal.Decimal, token business.TokenSymbol) error
}

// MatchResolver translates a business match ID into the on-chain matchID and
// reports market openness.
type MatchResolver interface {
	OnchainMatchID(ctx context.Context, matchID string) (decimal.Decimal, error)
	IsMarketOpen(ctx context.Context, matchID string, market business.MarketKind) (bool, error)
}

// OddsResolver returns the locked odds (×1000 scale, e.g. 1.818 → 1818).
type OddsResolver interface {
	LockedOddsAt(ctx context.Context, matchID string, market business.MarketKind, outcome uint8) (decimal.Decimal, error)
}

// BetIDResolver hashes a business bet identifier into the [32]byte the
// BettingPool contract uses.
type BetIDResolver interface {
	Hash(ctx context.Context, businessBetID string) (business.BetID, error)
}
```

- [ ] Create `resolver/stub/user.go`:

```go
// Package stub provides default ErrNotImplemented implementations of every
// resolver interface. The library falls back to these when resolver/impl/ is
// empty, so consumers still compile but writes that need a resolver fail
// loudly with ErrNotImplemented.
package stub

import (
	"context"

	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/resolver"
)

type user struct{}

// NewUserResolver returns a stub UserResolver whose methods all return
// ErrNotImplemented.
func NewUserResolver() resolver.UserResolver { return user{} }

func (user) OnchainAddress(ctx context.Context, userID string) (common.Address, error) {
	return common.Address{}, &business.ErrResolver{Resolver: "UserResolver.OnchainAddress", Cause: business.ErrNotImplemented}
}

func (user) CanPlaceBet(ctx context.Context, userID string, stake decimal.Decimal, token business.TokenSymbol) error {
	return &business.ErrResolver{Resolver: "UserResolver.CanPlaceBet", Cause: business.ErrNotImplemented}
}
```

- [ ] Create `resolver/stub/match.go`:

```go
package stub

import (
	"context"

	"github.com/shopspring/decimal"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/resolver"
)

type match struct{}

// NewMatchResolver returns a stub MatchResolver whose methods all return
// ErrNotImplemented.
func NewMatchResolver() resolver.MatchResolver { return match{} }

func (match) OnchainMatchID(ctx context.Context, matchID string) (decimal.Decimal, error) {
	return decimal.Zero, &business.ErrResolver{Resolver: "MatchResolver.OnchainMatchID", Cause: business.ErrNotImplemented}
}

func (match) IsMarketOpen(ctx context.Context, matchID string, market business.MarketKind) (bool, error) {
	return false, &business.ErrResolver{Resolver: "MatchResolver.IsMarketOpen", Cause: business.ErrNotImplemented}
}
```

- [ ] Create `resolver/stub/odds.go`:

```go
package stub

import (
	"context"

	"github.com/shopspring/decimal"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/resolver"
)

type odds struct{}

// NewOddsResolver returns a stub OddsResolver.
func NewOddsResolver() resolver.OddsResolver { return odds{} }

func (odds) LockedOddsAt(ctx context.Context, matchID string, market business.MarketKind, outcome uint8) (decimal.Decimal, error) {
	return decimal.Zero, &business.ErrResolver{Resolver: "OddsResolver.LockedOddsAt", Cause: business.ErrNotImplemented}
}
```

- [ ] Create `resolver/stub/betid.go`:

```go
package stub

import (
	"context"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/resolver"
)

type betid struct{}

// NewBetIDResolver returns a stub BetIDResolver.
func NewBetIDResolver() resolver.BetIDResolver { return betid{} }

func (betid) Hash(ctx context.Context, businessBetID string) (business.BetID, error) {
	return business.BetID{}, &business.ErrResolver{Resolver: "BetIDResolver.Hash", Cause: business.ErrNotImplemented}
}
```

- [ ] Create `resolver/stub/stub_test.go`:

```go
package stub

import (
	"context"
	"errors"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"

	business "github.com/Crypto-Barrett/contracts-business-layer"
)

func TestStubsReturnErrNotImplemented(t *testing.T) {
	ctx := context.Background()

	t.Run("UserResolver", func(t *testing.T) {
		u := NewUserResolver()
		_, err := u.OnchainAddress(ctx, "u_1")
		require.ErrorIs(t, err, business.ErrNotImplemented)
		err = u.CanPlaceBet(ctx, "u_1", decimal.NewFromInt(1), "USDT")
		require.ErrorIs(t, err, business.ErrNotImplemented)
	})

	t.Run("MatchResolver", func(t *testing.T) {
		m := NewMatchResolver()
		_, err := m.OnchainMatchID(ctx, "m_1")
		require.ErrorIs(t, err, business.ErrNotImplemented)
		_, err = m.IsMarketOpen(ctx, "m_1", business.MarketSpread)
		require.ErrorIs(t, err, business.ErrNotImplemented)
	})

	t.Run("OddsResolver", func(t *testing.T) {
		o := NewOddsResolver()
		_, err := o.LockedOddsAt(ctx, "m_1", business.MarketSpread, 1)
		require.ErrorIs(t, err, business.ErrNotImplemented)
	})

	t.Run("BetIDResolver", func(t *testing.T) {
		b := NewBetIDResolver()
		_, err := b.Hash(ctx, "bet:abc")
		var e *business.ErrResolver
		require.True(t, errors.As(err, &e))
		require.ErrorIs(t, err, business.ErrNotImplemented)
	})
}
```

- [ ] Run `go test ./resolver/stub/... -v` — Expected: all tests pass.

```bash
go test ./resolver/stub/... -v
```

---

## Task 5: internal/money — decimal ↔ *big.Int

**Files:**
- Create: `internal/money/scale.go`, `internal/money/scale_test.go`

- [ ] Create `internal/money/scale.go`:

```go
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
	rounded := d.Truncate(int32(decimals))                 // RoundDown
	scaled := rounded.Shift(int32(decimals))               // shift the decimal point right
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
```

- [ ] Create `internal/money/scale_test.go`:

```go
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
```

- [ ] Run `go test ./internal/money/... -v` — Expected: all tests pass.

---

## Task 6: Migrations + golang-migrate driver wiring

**Files:**
- Create: `migrations/0001_chain_actions.up.sql`, `migrations/0001_chain_actions.down.sql`, `migrations/0002_signer_lease.up.sql`, `migrations/0002_signer_lease.down.sql`, `migrations/0003_multisig_proposals.up.sql`, `migrations/0003_multisig_proposals.down.sql`, `migrations/embed.go`

- [ ] Create `migrations/0001_chain_actions.up.sql`:

```sql
CREATE TABLE chain_actions (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idempotency_key     VARCHAR(128)    NOT NULL,
  op                  VARCHAR(48)     NOT NULL,
  args_json           JSON            NOT NULL,
  status              VARCHAR(16)     NOT NULL,
  attempts            INT UNSIGNED    NOT NULL DEFAULT 0,
  tx_hash             CHAR(66)            NULL,
  block_number        BIGINT UNSIGNED     NULL,
  block_hash          CHAR(66)            NULL,
  gas_used            BIGINT UNSIGNED     NULL,
  effective_gas_price DECIMAL(38, 0)      NULL,
  signer_address      CHAR(42)        NOT NULL,
  nonce               BIGINT UNSIGNED     NULL,
  last_error          TEXT                NULL,
  last_error_kind     VARCHAR(24)         NULL,
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

- [ ] Create `migrations/0001_chain_actions.down.sql`:

```sql
DROP TABLE IF EXISTS chain_actions;
```

- [ ] Create `migrations/0002_signer_lease.up.sql`:

```sql
CREATE TABLE signer_lease (
  signer_address  CHAR(42)    NOT NULL,
  updated_at      DATETIME(3) NOT NULL,
  PRIMARY KEY (signer_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] Create `migrations/0002_signer_lease.down.sql`:

```sql
DROP TABLE IF EXISTS signer_lease;
```

- [ ] Create `migrations/0003_multisig_proposals.up.sql`:

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
  status                  VARCHAR(24)     NOT NULL,
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

- [ ] Create `migrations/0003_multisig_proposals.down.sql`:

```sql
DROP TABLE IF EXISTS multisig_proposals;
```

- [ ] Create `migrations/embed.go`:

```go
// Package migrations embeds the .sql files so the library can run them at New
// time without depending on a filesystem path.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
```

- [ ] Run `go vet ./migrations/...` — Expected: no errors.

---

## Task 7: action package (chain_actions Repo)

**Files:**
- Create: `action/model.go`, `action/repo.go`, `action/repo_test.go`

- [ ] Create `action/model.go`:

```go
// Package action holds the chain_actions row model and Repo.
package action

import (
	"database/sql"
	"time"

	business "github.com/Crypto-Barrett/contracts-business-layer"
)

// Row maps to the chain_actions table.
type Row struct {
	ID                int64           `gorm:"column:id;primaryKey"`
	IdempotencyKey    string          `gorm:"column:idempotency_key;uniqueIndex"`
	Op                string          `gorm:"column:op"`
	ArgsJSON          string          `gorm:"column:args_json"`
	Status            business.Status `gorm:"column:status"`
	Attempts          uint            `gorm:"column:attempts"`
	TxHash            sql.NullString  `gorm:"column:tx_hash"`
	BlockNumber       sql.NullInt64   `gorm:"column:block_number"`
	BlockHash         sql.NullString  `gorm:"column:block_hash"`
	GasUsed           sql.NullInt64   `gorm:"column:gas_used"`
	EffectiveGasPrice sql.NullString  `gorm:"column:effective_gas_price"` // wei as decimal text
	SignerAddress     string          `gorm:"column:signer_address"`
	Nonce             sql.NullInt64   `gorm:"column:nonce"`
	LastError         sql.NullString  `gorm:"column:last_error"`
	LastErrorKind     sql.NullString  `gorm:"column:last_error_kind"`
	AssignedTo        sql.NullString  `gorm:"column:assigned_to"`
	HeartbeatAt       sql.NullTime    `gorm:"column:heartbeat_at"`
	CreatedAt         time.Time       `gorm:"column:created_at"`
	SubmittedAt       sql.NullTime    `gorm:"column:submitted_at"`
	MinedAt           sql.NullTime    `gorm:"column:mined_at"`
	ConfirmedAt       sql.NullTime    `gorm:"column:confirmed_at"`
	FailedAt          sql.NullTime    `gorm:"column:failed_at"`
	UpdatedAt         time.Time       `gorm:"column:updated_at"`
}

// TableName is fixed (do not let gorm auto-pluralize).
func (Row) TableName() string { return "chain_actions" }
```

- [ ] Create `action/repo.go`:

```go
package action

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
)

// Repo persists chain_actions rows.
type Repo struct {
	db *gorm.DB
}

// New constructs a Repo bound to db.
func New(db *gorm.DB) *Repo { return &Repo{db: db} }

// InsertOrLoad attempts to INSERT row. On duplicate idempotency_key it returns
// the existing row's ID and existed=true. Caller compares args_json themselves
// if they want strict idempotency (same key + different args should be a
// conflict — see ErrIdempotencyConflict in writes/shared.go).
func (r *Repo) InsertOrLoad(ctx context.Context, row *Row) (id int64, existed bool, err error) {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return 0, false, &business.ErrDB{Op: "Begin", Cause: tx.Error}
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	now := time.Now().UTC()
	if row.CreatedAt.IsZero() {
		row.CreatedAt = now
	}
	row.UpdatedAt = now

	res := tx.Exec(`
		INSERT IGNORE INTO chain_actions
		  (idempotency_key, op, args_json, status, attempts, signer_address, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, ?, ?)
	`, row.IdempotencyKey, row.Op, row.ArgsJSON, row.Status, row.SignerAddress, row.CreatedAt, row.UpdatedAt)
	if res.Error != nil {
		return 0, false, &business.ErrDB{Op: "InsertIgnore", Cause: res.Error}
	}

	if res.RowsAffected == 0 {
		// existing row
		var existing Row
		if e := tx.Where("idempotency_key = ?", row.IdempotencyKey).First(&existing).Error; e != nil {
			return 0, false, &business.ErrDB{Op: "SelectExisting", Cause: e}
		}
		if e := tx.Commit().Error; e != nil {
			return 0, false, &business.ErrDB{Op: "Commit", Cause: e}
		}
		return existing.ID, true, nil
	}

	// freshly inserted; SELECT to get the auto id
	var inserted Row
	if e := tx.Where("idempotency_key = ?", row.IdempotencyKey).First(&inserted).Error; e != nil {
		return 0, false, &business.ErrDB{Op: "SelectInserted", Cause: e}
	}
	if e := tx.Commit().Error; e != nil {
		return 0, false, &business.ErrDB{Op: "Commit", Cause: e}
	}
	return inserted.ID, false, nil
}

// Get fetches a row by ID.
func (r *Repo) Get(ctx context.Context, id int64) (*Row, error) {
	var row Row
	err := r.db.WithContext(ctx).First(&row, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, business.ErrActionNotFound
	}
	if err != nil {
		return nil, &business.ErrDB{Op: "Get", Cause: err}
	}
	return &row, nil
}

// GetByIdempotencyKey fetches a row by its idempotency_key.
func (r *Repo) GetByIdempotencyKey(ctx context.Context, key string) (*Row, error) {
	var row Row
	err := r.db.WithContext(ctx).Where("idempotency_key = ?", key).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, business.ErrActionNotFound
	}
	if err != nil {
		return nil, &business.ErrDB{Op: "GetByIdempotencyKey", Cause: err}
	}
	return &row, nil
}

// MarkSubmittedTx updates a row from pending → submitted with tx info. Must be
// called inside the same DB tx that holds the signer_lease lock.
func (r *Repo) MarkSubmittedTx(tx *gorm.DB, id int64, txHash string, nonce uint64) error {
	now := time.Now().UTC()
	res := tx.Exec(`
		UPDATE chain_actions
		   SET status = 'submitted',
		       tx_hash = ?,
		       nonce = ?,
		       submitted_at = ?,
		       updated_at = ?,
		       attempts = attempts + 1
		 WHERE id = ?
	`, txHash, nonce, now, now, id)
	if res.Error != nil {
		return &business.ErrDB{Op: "MarkSubmittedTx", Cause: res.Error}
	}
	return nil
}

// MarkFailed transitions a row to failed status with a reason.
func (r *Repo) MarkFailed(ctx context.Context, id int64, kind string, cause error) error {
	now := time.Now().UTC()
	msg := ""
	if cause != nil {
		msg = cause.Error()
	}
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'failed',
		       last_error = ?,
		       last_error_kind = ?,
		       failed_at = ?,
		       updated_at = ?
		 WHERE id = ?
	`, msg, kind, now, now, id).Error; err != nil {
		return &business.ErrDB{Op: "MarkFailed", Cause: err}
	}
	return nil
}

// ClaimSubmittedRow runs SELECT FOR UPDATE SKIP LOCKED to atomically claim a
// row in 'submitted' status that no worker is actively processing. Returns
// (nil, nil) when no row is available.
func (r *Repo) ClaimSubmittedRow(ctx context.Context, workerID string, staleHeartbeatAfter time.Duration) (*Row, error) {
	var claimed *Row
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var idResult struct{ ID int64 }
		err := tx.Raw(`
			SELECT id FROM chain_actions
			 WHERE status = 'submitted'
			   AND (assigned_to IS NULL OR heartbeat_at < ?)
			 ORDER BY updated_at
			 LIMIT 1
			 FOR UPDATE SKIP LOCKED
		`, time.Now().UTC().Add(-staleHeartbeatAfter)).Scan(&idResult).Error
		if err != nil {
			return err
		}
		if idResult.ID == 0 {
			return nil
		}
		now := time.Now().UTC()
		if err := tx.Exec(`
			UPDATE chain_actions
			   SET assigned_to = ?, heartbeat_at = ?, updated_at = ?
			 WHERE id = ?
		`, workerID, now, now, idResult.ID).Error; err != nil {
			return err
		}
		var row Row
		if err := tx.First(&row, idResult.ID).Error; err != nil {
			return err
		}
		claimed = &row
		return nil
	})
	if err != nil {
		return nil, &business.ErrDB{Op: "ClaimSubmittedRow", Cause: err}
	}
	return claimed, nil
}

// Heartbeat refreshes assigned_to/heartbeat_at if the row is still ours.
func (r *Repo) Heartbeat(ctx context.Context, id int64, workerID string) error {
	now := time.Now().UTC()
	res := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET heartbeat_at = ?, updated_at = ?
		 WHERE id = ? AND assigned_to = ?
	`, now, now, id, workerID)
	if res.Error != nil {
		return &business.ErrDB{Op: "Heartbeat", Cause: res.Error}
	}
	return nil
}

// MarkMined moves submitted → mined.
func (r *Repo) MarkMined(ctx context.Context, id int64, blockNumber uint64, blockHash string, gasUsed uint64, effectiveGasPriceWei string) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'mined',
		       block_number = ?,
		       block_hash = ?,
		       gas_used = ?,
		       effective_gas_price = ?,
		       mined_at = ?,
		       updated_at = ?
		 WHERE id = ?
	`, blockNumber, blockHash, gasUsed, effectiveGasPriceWei, now, now, id).Error; err != nil {
		return &business.ErrDB{Op: "MarkMined", Cause: err}
	}
	return nil
}

// MarkConfirmed moves mined → confirmed.
func (r *Repo) MarkConfirmed(ctx context.Context, id int64) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'confirmed',
		       confirmed_at = ?,
		       updated_at = ?
		 WHERE id = ?
	`, now, now, id).Error; err != nil {
		return &business.ErrDB{Op: "MarkConfirmed", Cause: err}
	}
	return nil
}

// MarkResubmittedAfterReorg pushes a row from mined back to submitted (re-track).
func (r *Repo) MarkResubmittedAfterReorg(ctx context.Context, id int64) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'submitted',
		       block_number = NULL,
		       block_hash = NULL,
		       mined_at = NULL,
		       updated_at = ?
		 WHERE id = ?
	`, now, id).Error; err != nil {
		return &business.ErrDB{Op: "MarkResubmittedAfterReorg", Cause: err}
	}
	return nil
}

// SweepOrphanPending marks pending rows older than threshold as failed.
func (r *Repo) SweepOrphanPending(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	res := r.db.WithContext(ctx).Exec(`
		UPDATE chain_actions
		   SET status = 'failed',
		       last_error = 'orphan_pending_swept',
		       last_error_kind = 'interrupted',
		       failed_at = ?,
		       updated_at = ?
		 WHERE status = 'pending' AND created_at < ?
	`, time.Now().UTC(), time.Now().UTC(), cutoff)
	if res.Error != nil {
		return 0, &business.ErrDB{Op: "SweepOrphanPending", Cause: res.Error}
	}
	return res.RowsAffected, nil
}

// CountPending returns the number of pending+submitted rows (queue depth).
func (r *Repo) CountPending(ctx context.Context) (int, *time.Time, error) {
	var n int
	if err := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM chain_actions WHERE status IN ('pending','submitted')
	`).Scan(&n).Error; err != nil {
		return 0, nil, &business.ErrDB{Op: "CountPending", Cause: err}
	}
	if n == 0 {
		return 0, nil, nil
	}
	var oldest sql.NullTime
	if err := r.db.WithContext(ctx).Raw(`
		SELECT MIN(created_at) FROM chain_actions WHERE status IN ('pending','submitted')
	`).Scan(&oldest).Error; err != nil {
		return n, nil, &business.ErrDB{Op: "OldestPending", Cause: err}
	}
	if oldest.Valid {
		return n, &oldest.Time, nil
	}
	return n, nil, nil
}
```

- [ ] Create `action/repo_test.go`:

```go
package action_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/testdb"
)

func TestRepo_InsertOrLoad_Idempotency(t *testing.T) {
	if testing.Short() { t.Skip("requires docker") }
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := action.New(db)
	ctx := context.Background()

	row := &action.Row{
		IdempotencyKey: "test:idem-1",
		Op:             "lockBet",
		ArgsJSON:       `{"foo":"bar"}`,
		Status:         business.StatusPending,
		SignerAddress:  "0x1234567890123456789012345678901234567890",
	}

	id1, existed1, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)
	require.False(t, existed1)
	require.Greater(t, id1, int64(0))

	id2, existed2, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)
	require.True(t, existed2)
	require.Equal(t, id1, id2)
}

func TestRepo_MarkFailed(t *testing.T) {
	if testing.Short() { t.Skip("requires docker") }
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := action.New(db)
	ctx := context.Background()

	row := &action.Row{
		IdempotencyKey: "test:fail",
		Op:             "lockBet",
		ArgsJSON:       `{}`,
		Status:         business.StatusPending,
		SignerAddress:  "0x0000000000000000000000000000000000000001",
	}
	id, _, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)

	require.NoError(t, repo.MarkFailed(ctx, id, "sim_failed", &business.ErrSimulationFailed{Method: "lockBet"}))
	got, err := repo.Get(ctx, id)
	require.NoError(t, err)
	require.Equal(t, business.StatusFailed, got.Status)
	require.True(t, got.LastError.Valid)
	require.Equal(t, "sim_failed", got.LastErrorKind.String)
}

func TestRepo_ClaimSubmittedRow_SkipLocked(t *testing.T) {
	if testing.Short() { t.Skip("requires docker") }
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := action.New(db)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		row := &action.Row{
			IdempotencyKey: "test:claim:" + time.Now().Format("20060102150405.000000") + "-" + string(rune('a'+i)),
			Op:             "lockBet",
			ArgsJSON:       `{}`,
			Status:         business.StatusSubmitted,
			SignerAddress:  "0x0000000000000000000000000000000000000001",
		}
		_, _, err := repo.InsertOrLoad(ctx, row)
		require.NoError(t, err)
	}

	claimed1, err := repo.ClaimSubmittedRow(ctx, "worker-1", 60*time.Second)
	require.NoError(t, err)
	require.NotNil(t, claimed1)
	require.True(t, claimed1.AssignedTo.Valid)
	require.Equal(t, "worker-1", claimed1.AssignedTo.String)

	claimed2, err := repo.ClaimSubmittedRow(ctx, "worker-2", 60*time.Second)
	require.NoError(t, err)
	require.NotNil(t, claimed2)
	require.NotEqual(t, claimed1.ID, claimed2.ID, "different worker should claim a different row")
}
```

- [ ] Note: tests will not run yet (testdb package not built); we'll wire that up next.

---

## Task 8: internal/testdb — testcontainers MySQL helper

**Files:**
- Create: `internal/testdb/testdb.go`

- [ ] Create `internal/testdb/testdb.go`:

```go
// Package testdb spins up a MySQL container for tests and runs the library's
// migrations against it.
package testdb

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migmysql "github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	tcmysql "github.com/testcontainers/testcontainers-go/modules/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/Crypto-Barrett/contracts-business-layer/migrations"
)

// NewMySQL starts a MySQL 8.4 container, runs migrations, returns a *gorm.DB
// and a cleanup func. Skip the test with -short if docker is unavailable.
func NewMySQL(t *testing.T) (*gorm.DB, func()) {
	t.Helper()
	ctx := context.Background()

	c, err := tcmysql.Run(ctx, "mysql:8.4.7",
		tcmysql.WithDatabase("oddfi"),
		tcmysql.WithUsername("root"),
		tcmysql.WithPassword("root"),
	)
	if err != nil {
		t.Skipf("mysql container failed: %v", err)
	}

	dsn, err := c.ConnectionString(ctx, "parseTime=true&multiStatements=true")
	if err != nil {
		t.Fatalf("conn string: %v", err)
	}

	gdb, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}

	sqlDB, err := gdb.DB()
	if err != nil {
		t.Fatalf("DB: %v", err)
	}
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	driver, err := migmysql.WithInstance(sqlDB, &migmysql.Config{})
	if err != nil {
		t.Fatalf("migrate driver: %v", err)
	}
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		t.Fatalf("migrate source: %v", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "mysql", driver)
	if err != nil {
		t.Fatalf("migrate new: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate up: %v", err)
	}

	cleanup := func() {
		_ = c.Terminate(context.Background())
	}
	return gdb, cleanup
}

// MustMustNotBeNil compile-time guard.
var _ = fmt.Sprintf
```

- [ ] Run `go build ./...` — Expected: builds, but tests with `-short` skipped, full tests need docker.

---

## Task 9: proposal package (multisig_proposals Repo)

**Files:**
- Create: `proposal/model.go`, `proposal/repo.go`, `proposal/repo_test.go`

- [ ] Create `proposal/model.go`:

```go
// Package proposal holds the multisig_proposals row model and Repo.
package proposal

import (
	"database/sql"
	"time"

	business "github.com/Crypto-Barrett/contracts-business-layer"
)

// Row maps to the multisig_proposals table.
type Row struct {
	ID                     int64                    `gorm:"column:id;primaryKey"`
	IdempotencyKey         string                   `gorm:"column:idempotency_key;uniqueIndex"`
	Op                     string                   `gorm:"column:op"`
	ArgsJSON               string                   `gorm:"column:args_json"`
	SafeAddress            string                   `gorm:"column:safe_address"`
	SafeTxHash             string                   `gorm:"column:safe_tx_hash;uniqueIndex"`
	SafeNonce              uint64                   `gorm:"column:safe_nonce"`
	ProposerAddress        string                   `gorm:"column:proposer_address"`
	Status                 business.ProposalStatus  `gorm:"column:status"`
	ConfirmationsRequired  sql.NullInt64            `gorm:"column:confirmations_required"`
	ConfirmationsCount     sql.NullInt64            `gorm:"column:confirmations_count"`
	OnChainTxHash          sql.NullString           `gorm:"column:on_chain_tx_hash"`
	SafeUIURL              string                   `gorm:"column:safe_ui_url"`
	LastPolledAt           sql.NullTime             `gorm:"column:last_polled_at"`
	CreatedAt              time.Time                `gorm:"column:created_at"`
	ProposedAt             time.Time                `gorm:"column:proposed_at"`
	ExecutedAt             sql.NullTime             `gorm:"column:executed_at"`
	UpdatedAt              time.Time                `gorm:"column:updated_at"`
}

func (Row) TableName() string { return "multisig_proposals" }
```

- [ ] Create `proposal/repo.go`:

```go
package proposal

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
)

// Repo persists multisig_proposals rows.
type Repo struct{ db *gorm.DB }

// New constructs a Repo bound to db.
func New(db *gorm.DB) *Repo { return &Repo{db: db} }

// InsertOrLoad inserts a new proposal; on idempotency_key collision returns
// the existing row's ID with existed=true.
func (r *Repo) InsertOrLoad(ctx context.Context, row *Row) (id int64, existed bool, err error) {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return 0, false, &business.ErrDB{Op: "Begin", Cause: tx.Error}
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	now := time.Now().UTC()
	if row.CreatedAt.IsZero() {
		row.CreatedAt = now
	}
	if row.ProposedAt.IsZero() {
		row.ProposedAt = now
	}
	row.UpdatedAt = now

	res := tx.Exec(`
		INSERT IGNORE INTO multisig_proposals
		  (idempotency_key, op, args_json, safe_address, safe_tx_hash, safe_nonce,
		   proposer_address, status, confirmations_count, safe_ui_url,
		   created_at, proposed_at, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
	`,
		row.IdempotencyKey, row.Op, row.ArgsJSON, row.SafeAddress, row.SafeTxHash, row.SafeNonce,
		row.ProposerAddress, row.Status, row.ConfirmationsCount, row.SafeUIURL,
		row.CreatedAt, row.ProposedAt, row.UpdatedAt)
	if res.Error != nil {
		return 0, false, &business.ErrDB{Op: "InsertIgnore", Cause: res.Error}
	}
	if res.RowsAffected == 0 {
		var existing Row
		if e := tx.Where("idempotency_key = ?", row.IdempotencyKey).First(&existing).Error; e != nil {
			return 0, false, &business.ErrDB{Op: "SelectExisting", Cause: e}
		}
		if e := tx.Commit().Error; e != nil {
			return 0, false, &business.ErrDB{Op: "Commit", Cause: e}
		}
		return existing.ID, true, nil
	}
	var inserted Row
	if e := tx.Where("idempotency_key = ?", row.IdempotencyKey).First(&inserted).Error; e != nil {
		return 0, false, &business.ErrDB{Op: "SelectInserted", Cause: e}
	}
	if e := tx.Commit().Error; e != nil {
		return 0, false, &business.ErrDB{Op: "Commit", Cause: e}
	}
	return inserted.ID, false, nil
}

// Get fetches a proposal by ID.
func (r *Repo) Get(ctx context.Context, id int64) (*Row, error) {
	var row Row
	err := r.db.WithContext(ctx).First(&row, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, business.ErrProposalNotFound
	}
	if err != nil {
		return nil, &business.ErrDB{Op: "Get", Cause: err}
	}
	return &row, nil
}

// GetBySafeTxHash fetches by EIP-712 safeTxHash.
func (r *Repo) GetBySafeTxHash(ctx context.Context, h string) (*Row, error) {
	var row Row
	err := r.db.WithContext(ctx).Where("safe_tx_hash = ?", h).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, business.ErrProposalNotFound
	}
	if err != nil {
		return nil, &business.ErrDB{Op: "GetBySafeTxHash", Cause: err}
	}
	return &row, nil
}

// SelectNonTerminal returns up to limit proposals in non-terminal status whose
// last_polled_at is older than minAge ago (or null).
func (r *Repo) SelectNonTerminal(ctx context.Context, limit int, minAge time.Duration) ([]Row, error) {
	cutoff := time.Now().UTC().Add(-minAge)
	var rows []Row
	err := r.db.WithContext(ctx).
		Where("status = ? AND (last_polled_at IS NULL OR last_polled_at < ?)",
			business.ProposalProposed, cutoff).
		Order("updated_at").
		Limit(limit).
		Find(&rows).Error
	if err != nil {
		return nil, &business.ErrDB{Op: "SelectNonTerminal", Cause: err}
	}
	return rows, nil
}

// MarkExecuted transitions a proposal to executed and records the on-chain tx.
func (r *Repo) MarkExecuted(ctx context.Context, id int64, onChainTxHash string) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE multisig_proposals
		   SET status='executed', on_chain_tx_hash=?, executed_at=?, updated_at=?, last_polled_at=?
		 WHERE id=?
	`, onChainTxHash, now, now, now, id).Error; err != nil {
		return &business.ErrDB{Op: "MarkExecuted", Cause: err}
	}
	return nil
}

// MarkExecutedFailed transitions to executed_failed.
func (r *Repo) MarkExecutedFailed(ctx context.Context, id int64, onChainTxHash string) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE multisig_proposals
		   SET status='executed_failed', on_chain_tx_hash=?, executed_at=?, updated_at=?, last_polled_at=?
		 WHERE id=?
	`, onChainTxHash, now, now, now, id).Error; err != nil {
		return &business.ErrDB{Op: "MarkExecutedFailed", Cause: err}
	}
	return nil
}

// MarkRejected transitions to rejected.
func (r *Repo) MarkRejected(ctx context.Context, id int64) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE multisig_proposals
		   SET status='rejected', updated_at=?, last_polled_at=?
		 WHERE id=?
	`, now, now, id).Error; err != nil {
		return &business.ErrDB{Op: "MarkRejected", Cause: err}
	}
	return nil
}

// UpdateConfirmations refreshes the confirmation counts and last_polled_at.
func (r *Repo) UpdateConfirmations(ctx context.Context, id int64, count, required uint) error {
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Exec(`
		UPDATE multisig_proposals
		   SET confirmations_count=?, confirmations_required=?, last_polled_at=?, updated_at=?
		 WHERE id=?
	`, count, required, now, now, id).Error; err != nil {
		return &business.ErrDB{Op: "UpdateConfirmations", Cause: err}
	}
	return nil
}
```

- [ ] Create minimal smoke test `proposal/repo_test.go`:

```go
package proposal_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/testdb"
	"github.com/Crypto-Barrett/contracts-business-layer/proposal"
)

func TestRepo_InsertOrLoad(t *testing.T) {
	if testing.Short() { t.Skip("requires docker") }
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	repo := proposal.New(db)
	ctx := context.Background()

	row := &proposal.Row{
		IdempotencyKey:  "settle:m_1:run-1",
		Op:              "settle",
		ArgsJSON:        `{}`,
		SafeAddress:     "0xSAFE",
		SafeTxHash:      "0xHASH",
		SafeNonce:       42,
		ProposerAddress: "0xPROP",
		Status:          business.ProposalProposed,
		SafeUIURL:       "https://app.safe.global/...",
	}
	id1, existed1, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)
	require.False(t, existed1)
	id2, existed2, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)
	require.True(t, existed2)
	require.Equal(t, id1, id2)

	got, err := repo.Get(ctx, id1)
	require.NoError(t, err)
	require.Equal(t, business.ProposalProposed, got.Status)
}
```

---

## Task 10: internal/nonce — signer_lease lock + chain query

**Files:**
- Create: `internal/nonce/lease.go`, `internal/nonce/lease_test.go`

- [ ] Create `internal/nonce/lease.go`:

```go
// Package nonce serializes nonce assignment for a single admin EOA across
// multiple pods using a row-lock on signer_lease + eth_getTransactionCount on
// the chain. There is no counter to drift from — the chain is the source of
// truth.
package nonce

import (
	"context"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
)

// EthClient is the narrow surface nonce.Lease needs from the RPC. The full
// *ethclient.Client satisfies it.
type EthClient interface {
	PendingNonceAt(ctx context.Context, addr common.Address) (uint64, error)
}

// Lease is the lock-and-query gate for nonce assignment. Construct one per
// signer address.
type Lease struct {
	db   *gorm.DB
	eth  EthClient
	addr common.Address
}

// New constructs a Lease.
func New(db *gorm.DB, eth EthClient, addr common.Address) *Lease {
	return &Lease{db: db, eth: eth, addr: addr}
}

// EnsureRow makes sure the signer_lease row exists. Call once at startup.
func (l *Lease) EnsureRow(ctx context.Context) error {
	now := time.Now().UTC()
	if err := l.db.WithContext(ctx).Exec(`
		INSERT IGNORE INTO signer_lease (signer_address, updated_at) VALUES (?, ?)
	`, l.addr.Hex(), now).Error; err != nil {
		return &business.ErrDB{Op: "EnsureSignerLeaseRow", Cause: err}
	}
	return nil
}

// WithLockedNonce runs fn inside a single DB transaction that holds an
// exclusive row lock on signer_lease for this address. fn receives the next
// nonce (queried fresh from the chain inside the lock) and a *gorm.DB scoped
// to the transaction so additional updates atomically commit/rollback with the
// lock release.
//
// The lock is held for the full duration of fn (typically the broadcast RPC
// call). Throughput is therefore ~ 1 / (PendingNonceAt + broadcast latency).
func (l *Lease) WithLockedNonce(ctx context.Context, fn func(tx *gorm.DB, nonce uint64) error) error {
	return l.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Acquire the row lock. SKIP LOCKED would defeat the purpose — we MUST serialize.
		if err := tx.Exec(`
			SELECT 1 FROM signer_lease WHERE signer_address = ? FOR UPDATE
		`, l.addr.Hex()).Error; err != nil {
			return &business.ErrDB{Op: "AcquireSignerLease", Cause: err}
		}

		// 2. Ask the chain for the next pending nonce.
		nonce, err := l.eth.PendingNonceAt(ctx, l.addr)
		if err != nil {
			return &business.ErrRPC{Op: "PendingNonceAt", Cause: err}
		}

		// 3. Caller broadcasts and updates rows still inside this tx.
		if err := fn(tx, nonce); err != nil {
			return err
		}

		// 4. Refresh the lease's updated_at as a heartbeat.
		now := time.Now().UTC()
		if err := tx.Exec(`
			UPDATE signer_lease SET updated_at = ? WHERE signer_address = ?
		`, now, l.addr.Hex()).Error; err != nil {
			return &business.ErrDB{Op: "TouchSignerLease", Cause: err}
		}
		return nil
	})
}
```

- [ ] Create `internal/nonce/lease_test.go`:

```go
package nonce_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/nonce"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/testdb"
)

type fakeEth struct{ next uint64 }

func (f *fakeEth) PendingNonceAt(ctx context.Context, addr common.Address) (uint64, error) {
	return atomic.AddUint64(&f.next, 1) - 1, nil
}

type errEth struct{ err error }

func (e *errEth) PendingNonceAt(ctx context.Context, addr common.Address) (uint64, error) {
	return 0, e.err
}

func TestLease_EnsureRow(t *testing.T) {
	if testing.Short() { t.Skip("requires docker") }
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	l := nonce.New(db, &fakeEth{}, common.HexToAddress("0x1"))
	require.NoError(t, l.EnsureRow(context.Background()))
	require.NoError(t, l.EnsureRow(context.Background())) // idempotent
}

func TestLease_WithLockedNonce_Serializes(t *testing.T) {
	if testing.Short() { t.Skip("requires docker") }
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	addr := common.HexToAddress("0xCAFE")
	eth := &fakeEth{}
	l := nonce.New(db, eth, addr)
	require.NoError(t, l.EnsureRow(context.Background()))

	const N = 10
	nonces := make([]uint64, N)
	var wg sync.WaitGroup
	wg.Add(N)
	for i := 0; i < N; i++ {
		i := i
		go func() {
			defer wg.Done()
			require.NoError(t, l.WithLockedNonce(context.Background(), func(tx *gorm.DB, nn uint64) error {
				nonces[i] = nn
				return nil
			}))
		}()
	}
	wg.Wait()

	// Each nonce should be unique because the lock serialized them.
	seen := map[uint64]bool{}
	for _, n := range nonces {
		require.False(t, seen[n], "nonce %d seen twice", n)
		seen[n] = true
	}
}

func TestLease_RPCError_RollsBack(t *testing.T) {
	if testing.Short() { t.Skip("requires docker") }
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()

	addr := common.HexToAddress("0xBEEF")
	rpcErr := errors.New("rpc dead")
	l := nonce.New(db, &errEth{err: rpcErr}, addr)
	require.NoError(t, l.EnsureRow(context.Background()))

	err := l.WithLockedNonce(context.Background(), func(tx *gorm.DB, nn uint64) error {
		t.Fatal("fn should not run when PendingNonceAt fails")
		return nil
	})
	var rpc *business.ErrRPC
	require.True(t, errors.As(err, &rpc))
	require.ErrorIs(t, err, rpcErr)
}
```

---

## Task 11: client package (sdk.Connection wrap + per-RPC ctx + OTEL)

**Files:**
- Create: `client/connection.go`

- [ ] Create `client/connection.go`:

```go
// Package client wraps oddfi-contracts-sdk/sdk/client.Connection and exposes
// a tightly-scoped surface for the rest of the library. It owns the per-RPC
// timeout policy and OTEL span helpers.
package client

import (
	"context"
	"errors"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	sdkclient "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/client"
)

const tracerName = "github.com/Crypto-Barrett/contracts-business-layer/client"

// Connection wraps sdkclient.Connection.
type Connection struct {
	conn       *sdkclient.Connection
	rpcTimeout time.Duration
	tracer     trace.Tracer
}

// New constructs a wrapped Connection. rpcTimeout is the per-individual-RPC
// deadline applied to every call this library makes.
func New(conn *sdkclient.Connection, rpcTimeout time.Duration) *Connection {
	if rpcTimeout <= 0 {
		rpcTimeout = 5 * time.Second
	}
	return &Connection{conn: conn, rpcTimeout: rpcTimeout, tracer: otel.Tracer(tracerName)}
}

// SDK exposes the underlying connection for consumers that need it (admin /
// reader / multisig clients are constructed against it).
func (c *Connection) SDK() *sdkclient.Connection { return c.conn }

// RPCTimeout returns the configured per-RPC timeout.
func (c *Connection) RPCTimeout() time.Duration { return c.rpcTimeout }

// CtxRPC derives a child ctx with min(parent.Deadline, now+RPCTimeout).
// Always defer the returned cancel.
func (c *Connection) CtxRPC(parent context.Context) (context.Context, context.CancelFunc) {
	if c.rpcTimeout <= 0 {
		return context.WithCancel(parent)
	}
	return context.WithTimeout(parent, c.rpcTimeout)
}

// StartSpan opens an OTEL span named "<op>" with op as an attribute. Returns
// the child ctx and the span; the caller defers span.End().
func (c *Connection) StartSpan(ctx context.Context, op string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	return c.tracer.Start(ctx, op, trace.WithAttributes(append([]attribute.KeyValue{attribute.String("op", op)}, attrs...)...))
}

// ErrSDKMissing is returned by accessors that require a non-nil sdk Connection.
var ErrSDKMissing = errors.New("client: no sdk Connection (is the library closed?)")
```

---

## Task 12: internal/signerload — env+file → Signer (hidden helper)

**Files:**
- Create: `internal/signerload/load.go`

- [ ] Create `internal/signerload/load.go`:

```go
// Package signerload constructs a sdk/signer.Signer from declarative inputs
// (env var name, secret file path) so the consumer never holds a Signer
// directly.
package signerload

import (
	"errors"
	"log/slog"

	sdkclient "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/client"
	sdksigner "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/signer"
)

// Opts is the input to Load.
type Opts struct {
	EnvVar     string
	SecretFile string
	Logger     *slog.Logger
}

// Load returns a Signer following sdk/signer.NewAuto's environment-aware
// resolution (testnet: env var first then file; mainnet: file only, fail if
// env var is set). Either EnvVar or SecretFile must be non-empty (or both).
func Load(conn *sdkclient.Connection, opts Opts) (sdksigner.Signer, error) {
	if opts.EnvVar == "" && opts.SecretFile == "" {
		return nil, errors.New("signerload: neither EnvVar nor SecretFile set")
	}
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return sdksigner.NewAuto(conn, sdksigner.AutoOpts{
		EnvVar:   opts.EnvVar,
		FilePath: opts.SecretFile,
		Logger:   logger,
	})
}
```

---

## Task 13: Config + minimal Service skeleton + adapter for zap → slog

**Files:**
- Create: `config.go`, `service.go`, `internal/zapslog/adapter.go`

- [ ] Create `internal/zapslog/adapter.go`:

```go
// Package zapslog provides a minimal adapter that wraps a *zap.Logger so it
// can be passed where the SDK expects *log/slog.Logger.
package zapslog

import (
	"context"
	"log/slog"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Adapt returns a *slog.Logger that writes through the supplied zap logger.
// If z is nil, returns a no-op slog logger.
func Adapt(z *zap.Logger) *slog.Logger {
	if z == nil {
		return slog.New(noopHandler{})
	}
	return slog.New(&handler{z: z})
}

type handler struct {
	z     *zap.Logger
	attrs []zap.Field
}

func (h *handler) Enabled(_ context.Context, _ slog.Level) bool { return true }

func (h *handler) Handle(_ context.Context, r slog.Record) error {
	fields := append([]zap.Field{}, h.attrs...)
	r.Attrs(func(a slog.Attr) bool {
		fields = append(fields, zap.Any(a.Key, a.Value.Any()))
		return true
	})
	switch {
	case r.Level >= slog.LevelError:
		h.z.Error(r.Message, fields...)
	case r.Level >= slog.LevelWarn:
		h.z.Warn(r.Message, fields...)
	case r.Level >= slog.LevelInfo:
		h.z.Info(r.Message, fields...)
	default:
		h.z.Debug(r.Message, fields...)
	}
	return nil
}

func (h *handler) WithAttrs(as []slog.Attr) slog.Handler {
	out := &handler{z: h.z, attrs: append([]zap.Field{}, h.attrs...)}
	for _, a := range as {
		out.attrs = append(out.attrs, zap.Any(a.Key, a.Value.Any()))
	}
	return out
}

func (h *handler) WithGroup(_ string) slog.Handler { return h }

type noopHandler struct{}

func (noopHandler) Enabled(_ context.Context, _ slog.Level) bool  { return false }
func (noopHandler) Handle(_ context.Context, _ slog.Record) error { return nil }
func (noopHandler) WithAttrs(_ []slog.Attr) slog.Handler          { return noopHandler{} }
func (noopHandler) WithGroup(_ string) slog.Handler               { return noopHandler{} }

// suppress unused import lint
var _ = zapcore.DebugLevel
```

- [ ] Create `config.go`:

```go
package business

import (
	"errors"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/contracts-business-layer/resolver"
)

// Config is the declarative configuration consumers pass to New.
type Config struct {
	// Required
	Env      string // "testnet" | "mainnet"
	RPC      string
	MySQLDSN string

	// Admin signer
	SignerEnvVar     string
	SignerSecretFile string

	// Token metadata (caller-provided; library does not bundle addresses).
	Tokens map[TokenSymbol]TokenInfo

	// Optional escape hatch — pre-opened DB. If set, MySQLDSN is ignored.
	DB *gorm.DB

	// Optional observability
	Logger *zap.Logger

	// Optional timeouts
	RPCTimeout time.Duration
	TxTimeout  time.Duration

	// Optional Watcher knobs
	WatcherWorkers       int
	WatcherPollInterval  time.Duration
	DefaultConfirmations int
	OrphanPendingAfter   time.Duration
	SkipMigrations       bool

	// Optional multisig
	SafeTxServiceURL         string
	ProposerSignerEnvVar     string
	ProposerSignerSecretFile string
	EnableDirectExecute      bool
	MultisigPollInterval     time.Duration

	// Optional resolver overrides
	UserResolver  resolver.UserResolver
	MatchResolver resolver.MatchResolver
	OddsResolver  resolver.OddsResolver
	BetIDResolver resolver.BetIDResolver
}

// validate fills defaults and checks required fields. Mutates the receiver.
func (c *Config) validate() error {
	if c.Env != "testnet" && c.Env != "mainnet" {
		return errors.New("business: Config.Env must be \"testnet\" or \"mainnet\"")
	}
	if c.RPC == "" {
		return errors.New("business: Config.RPC required")
	}
	if c.DB == nil && c.MySQLDSN == "" {
		return errors.New("business: either Config.DB or Config.MySQLDSN required")
	}
	if c.SignerEnvVar == "" && c.SignerSecretFile == "" {
		return errors.New("business: either Config.SignerEnvVar or Config.SignerSecretFile required")
	}
	if c.RPCTimeout <= 0 {
		c.RPCTimeout = 5 * time.Second
	}
	if c.TxTimeout <= 0 {
		c.TxTimeout = 30 * time.Second
	}
	if c.WatcherWorkers <= 0 {
		c.WatcherWorkers = 4
	}
	if c.WatcherPollInterval <= 0 {
		c.WatcherPollInterval = 500 * time.Millisecond
	}
	if c.DefaultConfirmations <= 0 {
		c.DefaultConfirmations = 2
	}
	if c.OrphanPendingAfter <= 0 {
		c.OrphanPendingAfter = 5 * time.Minute
	}
	if c.MultisigPollInterval <= 0 {
		c.MultisigPollInterval = 30 * time.Second
	}
	if c.Logger == nil {
		c.Logger = zap.NewNop()
	}
	return nil
}
```

- [ ] Create stub `service.go` (full assembly comes in Task 16):

```go
package business

// Service is the single handle returned by New(). It owns all infrastructure:
// DB, sdk Connection, signer, repos, watcher, multisig poller. Construct one
// per process, defer Close().
//
// Methods are added in writes/, reads/, and multisig/ via this same struct.
// Composition is done in service.go's wire-up (see Task 16).
type Service struct {
	cfg    Config
	closed bool
	// fields filled in Task 16
}

// New is implemented in Task 16; this stub keeps callers compiling early.
func New(cfg Config) (*Service, error) {
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return &Service{cfg: cfg}, nil
}

// Close is implemented in Task 16; this stub returns nil.
func (s *Service) Close() error { s.closed = true; return nil }
```

- [ ] Run `go build ./...` — Expected: builds cleanly.

---

## Task 14: Watcher (chain_actions tracker)

**Files:**
- Create: `watcher/ethclient.go`, `watcher/watcher.go`, `watcher/tracker.go`, `watcher/watcher_test.go`

- [ ] Create `watcher/ethclient.go`:

```go
// Package watcher tracks chain_actions rows from 'submitted' to 'confirmed'.
package watcher

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// EthClient is the narrow surface the Watcher needs. *ethclient.Client
// satisfies it.
type EthClient interface {
	TransactionReceipt(ctx context.Context, hash common.Hash) (*types.Receipt, error)
	BlockNumber(ctx context.Context) (uint64, error)
	HeaderByNumber(ctx context.Context, n *big.Int) (*types.Header, error)
}
```

- [ ] Create `watcher/watcher.go`:

```go
package watcher

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/Crypto-Barrett/contracts-business-layer/action"
)

// Watcher is the in-process pool that progresses chain_actions rows.
type Watcher struct {
	repo            *action.Repo
	eth             EthClient
	workers         int
	pollInterval    time.Duration
	rpcTimeout      time.Duration
	confirmations   int
	staleHeartbeat  time.Duration
	heartbeatPeriod time.Duration
	orphanAfter     time.Duration
	logger          *zap.Logger

	wg     sync.WaitGroup
	cancel context.CancelFunc
	id     string
}

// Config tunes the Watcher.
type Config struct {
	Workers              int
	PollInterval         time.Duration
	RPCTimeout           time.Duration
	Confirmations        int
	StaleHeartbeatAfter  time.Duration
	HeartbeatPeriod      time.Duration
	OrphanPendingAfter   time.Duration
}

// New constructs (but does not start) a Watcher.
func New(repo *action.Repo, eth EthClient, cfg Config, logger *zap.Logger) *Watcher {
	if cfg.Workers <= 0 {
		cfg.Workers = 4
	}
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = 500 * time.Millisecond
	}
	if cfg.RPCTimeout <= 0 {
		cfg.RPCTimeout = 5 * time.Second
	}
	if cfg.Confirmations <= 0 {
		cfg.Confirmations = 2
	}
	if cfg.StaleHeartbeatAfter <= 0 {
		cfg.StaleHeartbeatAfter = 60 * time.Second
	}
	if cfg.HeartbeatPeriod <= 0 {
		cfg.HeartbeatPeriod = 20 * time.Second
	}
	if cfg.OrphanPendingAfter <= 0 {
		cfg.OrphanPendingAfter = 5 * time.Minute
	}
	host, _ := os.Hostname()
	return &Watcher{
		repo:            repo,
		eth:             eth,
		workers:         cfg.Workers,
		pollInterval:    cfg.PollInterval,
		rpcTimeout:      cfg.RPCTimeout,
		confirmations:   cfg.Confirmations,
		staleHeartbeat:  cfg.StaleHeartbeatAfter,
		heartbeatPeriod: cfg.HeartbeatPeriod,
		orphanAfter:     cfg.OrphanPendingAfter,
		logger:          logger,
		id:              fmt.Sprintf("%s/%d", host, os.Getpid()),
	}
}

// Start launches the worker pool + orphan sweeper. Returns immediately.
// Call Stop() to shut down (or cancel the supplied ctx).
func (w *Watcher) Start(parent context.Context) {
	ctx, cancel := context.WithCancel(parent)
	w.cancel = cancel
	for i := 0; i < w.workers; i++ {
		w.wg.Add(1)
		workerID := fmt.Sprintf("%s/w%d", w.id, i)
		go func() {
			defer w.wg.Done()
			w.workerLoop(ctx, workerID)
		}()
	}
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.orphanSweepLoop(ctx)
	}()
}

// Stop cancels and waits for all goroutines.
func (w *Watcher) Stop() {
	if w.cancel != nil {
		w.cancel()
	}
	w.wg.Wait()
}

func (w *Watcher) workerLoop(ctx context.Context, workerID string) {
	t := time.NewTicker(w.pollInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		w.tickOnce(ctx, workerID)
	}
}

func (w *Watcher) tickOnce(ctx context.Context, workerID string) {
	row, err := w.repo.ClaimSubmittedRow(ctx, workerID, w.staleHeartbeat)
	if err != nil {
		w.logger.Warn("watcher: claim failed", zap.Error(err))
		return
	}
	if row == nil {
		return
	}
	w.track(ctx, row.ID, workerID, row.TxHash.String, row.Op)
}

func (w *Watcher) orphanSweepLoop(ctx context.Context) {
	t := time.NewTicker(w.orphanAfter / 2)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		n, err := w.repo.SweepOrphanPending(ctx, w.orphanAfter)
		if err != nil {
			w.logger.Warn("watcher: orphan sweep failed", zap.Error(err))
			continue
		}
		if n > 0 {
			w.logger.Info("watcher: swept orphan pending rows", zap.Int64("rows", n))
		}
	}
}
```

- [ ] Create `watcher/tracker.go`:

```go
package watcher

import (
	"context"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"go.uber.org/zap"
)

// track owns the lifecycle of a single claimed row from 'submitted' onwards.
func (w *Watcher) track(ctx context.Context, id int64, workerID, txHash, op string) {
	hbCtx, hbCancel := context.WithCancel(ctx)
	defer hbCancel()
	go w.heartbeatLoop(hbCtx, id, workerID)

	hash := common.HexToHash(txHash)

	// Phase 1: poll for receipt
	receipt, err := w.waitReceipt(ctx, hash)
	if err != nil {
		w.logger.Warn("watcher: waitReceipt failed", zap.Error(err), zap.Int64("id", id))
		return
	}

	if receipt.Status == 0 {
		// On-chain revert
		err := w.repo.MarkFailed(ctx, id, "revert", errors.New("on-chain revert (receipt.Status=0)"))
		if err != nil {
			w.logger.Warn("watcher: MarkFailed", zap.Error(err))
		}
		return
	}

	gasPrice := "0"
	if receipt.EffectiveGasPrice != nil {
		gasPrice = receipt.EffectiveGasPrice.String()
	}
	if err := w.repo.MarkMined(ctx, id, receipt.BlockNumber.Uint64(), receipt.BlockHash.Hex(), receipt.GasUsed, gasPrice); err != nil {
		w.logger.Warn("watcher: MarkMined", zap.Error(err))
		return
	}

	// Phase 2: wait for confirmations + reorg check
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(w.pollInterval):
		}
		head, err := w.blockNumber(ctx)
		if err != nil {
			continue
		}
		if head < receipt.BlockNumber.Uint64()+uint64(w.confirmations) {
			continue
		}
		// Reorg check: header at this block should still hash the same.
		hdrCtx, cancel := context.WithTimeout(ctx, w.rpcTimeout)
		hdr, err := w.eth.HeaderByNumber(hdrCtx, big.NewInt(int64(receipt.BlockNumber.Uint64())))
		cancel()
		if err != nil {
			w.logger.Debug("watcher: reorg check failed", zap.Error(err))
			continue
		}
		if hdr.Hash() != receipt.BlockHash {
			w.logger.Warn("watcher: reorg detected", zap.Int64("id", id), zap.Uint64("block", receipt.BlockNumber.Uint64()))
			if err := w.repo.MarkResubmittedAfterReorg(ctx, id); err != nil {
				w.logger.Warn("watcher: MarkResubmittedAfterReorg", zap.Error(err))
			}
			return
		}
		if err := w.repo.MarkConfirmed(ctx, id); err != nil {
			w.logger.Warn("watcher: MarkConfirmed", zap.Error(err))
		}
		return
	}
}

func (w *Watcher) waitReceipt(ctx context.Context, hash common.Hash) (receipt *recHolder, err error) {
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		rctx, cancel := context.WithTimeout(ctx, w.rpcTimeout)
		r, err := w.eth.TransactionReceipt(rctx, hash)
		cancel()
		if err == nil {
			return &recHolder{
				Status:            r.Status,
				BlockNumber:       r.BlockNumber,
				BlockHash:         r.BlockHash,
				GasUsed:           r.GasUsed,
				EffectiveGasPrice: r.EffectiveGasPrice,
			}, nil
		}
		// "not found" is the normal "tx not yet mined" case; loop.
		if !isNotFound(err) {
			w.logger.Debug("watcher: TransactionReceipt error", zap.Error(err))
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(w.pollInterval):
		}
	}
}

// recHolder is a receipt projection limited to fields the Watcher uses (so the
// mock client doesn't have to construct a full geth Receipt).
type recHolder struct {
	Status            uint64
	BlockNumber       *big.Int
	BlockHash         common.Hash
	GasUsed           uint64
	EffectiveGasPrice *big.Int
}

func (w *Watcher) blockNumber(ctx context.Context) (uint64, error) {
	bctx, cancel := context.WithTimeout(ctx, w.rpcTimeout)
	defer cancel()
	return w.eth.BlockNumber(bctx)
}

func isNotFound(err error) bool {
	if errors.Is(err, ethereum.NotFound) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "not found")
}

func (w *Watcher) heartbeatLoop(ctx context.Context, id int64, workerID string) {
	t := time.NewTicker(w.heartbeatPeriod)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		if err := w.repo.Heartbeat(ctx, id, workerID); err != nil {
			w.logger.Debug("watcher: heartbeat", zap.Error(err))
		}
	}
}
```

- [ ] Create `watcher/watcher_test.go`:

```go
package watcher_test

import (
	"context"
	"math/big"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/testdb"
	"github.com/Crypto-Barrett/contracts-business-layer/watcher"
)

type fakeEth struct {
	mu       sync.Mutex
	receipts map[common.Hash]*types.Receipt
	head     uint64
	headers  map[uint64]common.Hash
}

func (f *fakeEth) TransactionReceipt(ctx context.Context, h common.Hash) (*types.Receipt, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	r, ok := f.receipts[h]
	if !ok {
		return nil, ethereum.NotFound
	}
	return r, nil
}
func (f *fakeEth) BlockNumber(ctx context.Context) (uint64, error) {
	return atomic.LoadUint64(&f.head), nil
}
func (f *fakeEth) HeaderByNumber(ctx context.Context, n *big.Int) (*types.Header, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	h, ok := f.headers[n.Uint64()]
	if !ok {
		return nil, ethereum.NotFound
	}
	return &types.Header{Number: n, ParentHash: common.Hash{}, Root: h}, nil
}

func TestWatcher_HappyPath_PendingToConfirmed(t *testing.T) {
	if testing.Short() { t.Skip("requires docker") }
	db, cleanup := testdb.NewMySQL(t)
	defer cleanup()
	repo := action.New(db)
	ctx := context.Background()

	// Seed a submitted row
	hash := common.HexToHash("0x" + "ab"+"cd"+repeat("00", 30))
	row := &action.Row{
		IdempotencyKey: "wtest:1",
		Op:             "lockBet",
		ArgsJSON:       `{}`,
		Status:         business.StatusSubmitted,
		SignerAddress:  "0x" + repeat("11", 20),
	}
	id, _, err := repo.InsertOrLoad(ctx, row)
	require.NoError(t, err)
	require.NoError(t, repo.MarkSubmittedTx(db, id, hash.Hex(), 7))

	// Receipt available immediately, status=1, blockNumber=10
	receipt := &types.Receipt{
		Status:            1,
		BlockNumber:       big.NewInt(10),
		BlockHash:         common.HexToHash("0x" + repeat("aa", 32)),
		GasUsed:           21000,
		EffectiveGasPrice: big.NewInt(1_000_000_000),
	}
	eth := &fakeEth{
		receipts: map[common.Hash]*types.Receipt{hash: receipt},
		head:     12,
		headers:  map[uint64]common.Hash{10: receipt.BlockHash},
	}

	w := watcher.New(repo, eth, watcher.Config{
		Workers:              1,
		PollInterval:         50 * time.Millisecond,
		Confirmations:        2,
		StaleHeartbeatAfter:  10 * time.Second,
		HeartbeatPeriod:      5 * time.Second,
		OrphanPendingAfter:   1 * time.Hour,
	}, zap.NewNop())
	w.Start(ctx)
	defer w.Stop()

	// Poll for terminal status
	deadline := time.Now().Add(5 * time.Second)
	var got *action.Row
	for time.Now().Before(deadline) {
		got, err = repo.Get(ctx, id)
		require.NoError(t, err)
		if got.Status == business.StatusConfirmed { break }
		time.Sleep(100 * time.Millisecond)
	}
	require.Equal(t, business.StatusConfirmed, got.Status)
	require.True(t, got.ConfirmedAt.Valid)
}

func repeat(s string, n int) string {
	out := ""
	for i := 0; i < n; i++ { out += s }
	return out
}
```

- [ ] Run `go build ./watcher/...` — Expected: builds.

---

## Task 15: writes/shared.go + writes/lockbet.go + tests (LockBet end-to-end reference)

**Files:**
- Create: `writes/shared.go`, `writes/lockbet.go`, `writes/lockbet_test.go`

- [ ] Create `writes/shared.go`:

```go
// Package writes implements the business-library write operations
// (admin-role contract calls).
//
// Each operation has three forms:
//   - Simulate{Op}(ctx, req) error               // eth_call dry-run
//   - Submit{Op}(ctx, req) (TxHash, ActionID, error)   // broadcast-and-go
//   - {Op}(ctx, req, opts...) (Result, error)    // sync wait for confirmation
//
// The shared submit pipeline below wires Insert→Sim→Lease+Broadcast→MarkSubmitted.
package writes

import (
	"context"
	"encoding/json"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/nonce"
)

// SubmitDeps groups the dependencies a write operation needs from the Service.
// Constructed once at Service.New time and reused for every Submit call.
type SubmitDeps struct {
	Repo   *action.Repo
	Lease  *nonce.Lease
	Signer common.Address // admin EOA, for chain_actions.signer_address
}

// SubmitInput is what each per-op Submit{Op} fills in to drive the shared
// pipeline.
type SubmitInput struct {
	Op             string                                              // "lockBet" / "settle" / ...
	IdempotencyKey string                                              // caller-provided
	Args           any                                                 // serialised into args_json
	Simulate       func(ctx context.Context) error                    // eth_call dry-run
	Broadcast      func(ctx context.Context, nonce uint64) (*types.Transaction, error)
}

// SubmitPipeline runs the standard pipeline. Returns (txHash, actionID, error).
func SubmitPipeline(ctx context.Context, d SubmitDeps, in SubmitInput) (business.TxHash, business.ActionID, error) {
	argsJSON, err := json.Marshal(in.Args)
	if err != nil {
		return "", 0, &business.ErrDB{Op: "MarshalArgs", Cause: err}
	}

	row := &action.Row{
		IdempotencyKey: in.IdempotencyKey,
		Op:             in.Op,
		ArgsJSON:       string(argsJSON),
		Status:         business.StatusPending,
		SignerAddress:  d.Signer.Hex(),
		CreatedAt:      time.Now().UTC(),
	}
	id, existed, err := d.Repo.InsertOrLoad(ctx, row)
	if err != nil {
		return "", 0, err
	}
	if existed {
		// Idempotent return: load row, return its tx_hash if already broadcast.
		ex, err := d.Repo.Get(ctx, id)
		if err != nil {
			return "", 0, err
		}
		// (v1: do not strict-compare args. Same key = same outcome.)
		return business.TxHash(ex.TxHash.String), business.ActionID(id), nil
	}

	if err := in.Simulate(ctx); err != nil {
		_ = d.Repo.MarkFailed(ctx, id, "sim_failed", err)
		return "", business.ActionID(id), &business.ErrSimulationFailed{Method: in.Op, Cause: err}
	}

	var (
		txHash common.Hash
		nonceUsed uint64
	)
	err = d.Lease.WithLockedNonce(ctx, func(tx *gorm.DB, n uint64) error {
		nonceUsed = n
		txn, berr := in.Broadcast(ctx, n)
		if berr != nil {
			return berr
		}
		txHash = txn.Hash()
		return d.Repo.MarkSubmittedTx(tx, id, txHash.Hex(), n)
	})
	if err != nil {
		_ = d.Repo.MarkFailed(ctx, id, "rpc", err)
		return "", business.ActionID(id), err
	}
	_ = nonceUsed
	return business.TxHash(txHash.Hex()), business.ActionID(id), nil
}

// WaitTerminal polls the row until it reaches a terminal status or ctx is done.
func WaitTerminal(ctx context.Context, repo *action.Repo, id business.ActionID, opts ...business.WaitOption) (business.Result, error) {
	cfg := business.DefaultWaitConfig()
	for _, o := range opts {
		o(&cfg)
	}
	t := time.NewTicker(cfg.PollInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return business.Result{}, business.ErrTimeout
		case <-t.C:
		}
		row, err := repo.Get(ctx, int64(id))
		if err != nil {
			return business.Result{}, err
		}
		switch row.Status {
		case business.StatusConfirmed:
			return rowToResult(row), nil
		case business.StatusFailed:
			return rowToResult(row), &business.ErrReverted{Method: row.Op, TxHash: business.TxHash(row.TxHash.String), Revert: nil}
		case business.StatusDropped:
			return rowToResult(row), business.ErrDropped
		}
	}
}

func rowToResult(r *action.Row) business.Result {
	res := business.Result{
		ActionID: business.ActionID(r.ID),
		TxHash:   business.TxHash(r.TxHash.String),
		Status:   r.Status,
	}
	if r.BlockNumber.Valid {
		res.BlockNumber = uint64(r.BlockNumber.Int64)
	}
	if r.BlockHash.Valid {
		res.BlockHash = common.HexToHash(r.BlockHash.String)
	}
	if r.GasUsed.Valid {
		res.GasUsed = uint64(r.GasUsed.Int64)
	}
	if r.SubmittedAt.Valid {
		res.SubmittedAt = r.SubmittedAt.Time
	}
	if r.ConfirmedAt.Valid {
		res.ConfirmedAt = r.ConfirmedAt.Time
	}
	return res
}

// suppress unused import lint when Big is needed elsewhere.
var _ = big.NewInt
```

- [ ] Create `writes/lockbet.go`:

```go
package writes

import (
	"context"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/shopspring/decimal"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/money"

	sdkadmin "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/admin"
)

// LockBetReq is the low-level input — caller has already translated business
// IDs into on-chain values.
type LockBetReq struct {
	BetID          business.BetID
	User           common.Address
	Amount         decimal.Decimal
	Token          business.TokenSymbol
	MatchID        decimal.Decimal
	Market         business.MarketKind
	Outcome        uint8
	Line           decimal.Decimal
	LockedOdds     decimal.Decimal // 1.818 → ×1000 internally
	IdempotencyKey string
}

// LockBetService is the per-op handle holding the SDK admin client and shared
// deps. Constructed inside business.New (Task 16) and assigned to *Service.
type LockBetService struct {
	Admin  *sdkadmin.Client
	Deps   SubmitDeps
	Tokens map[business.TokenSymbol]business.TokenInfo
}

// scaleArgs converts the decimal-bearing req to the *big.Int values the SDK
// expects.
func (s *LockBetService) scaleArgs(req LockBetReq) (sdkadmin.LockBetArgs, error) {
	tok, ok := s.Tokens[req.Token]
	if !ok {
		return sdkadmin.LockBetArgs{}, &business.ErrConfigInvalid_Tokens{Symbol: req.Token}
	}
	return sdkadmin.LockBetArgs{
		BetID:      req.BetID,
		User:       req.User,
		Amount:     money.ScaleToBase(req.Amount, tok.Decimals),
		MatchID:    req.MatchID.BigInt(),
		Market:     uint8(req.Market),
		Outcome:    req.Outcome,
		Line:       req.Line.BigInt(),
		LockedOdds: req.LockedOdds.Mul(decimal.NewFromInt(1000)).Truncate(0).BigInt(),
	}, nil
}

// Simulate runs an eth_call dry-run.
func (s *LockBetService) Simulate(ctx context.Context, req LockBetReq) error {
	args, err := s.scaleArgs(req)
	if err != nil {
		return err
	}
	if err := s.Admin.SimulateLockBet(ctx, args); err != nil {
		return &business.ErrSimulationFailed{Method: "lockBet", Cause: err}
	}
	return nil
}

// Submit broadcasts the tx and returns immediately. Watcher tracks the rest.
func (s *LockBetService) Submit(ctx context.Context, req LockBetReq) (business.TxHash, business.ActionID, error) {
	args, err := s.scaleArgs(req)
	if err != nil {
		return "", 0, err
	}
	return SubmitPipeline(ctx, s.Deps, SubmitInput{
		Op:             "lockBet",
		IdempotencyKey: req.IdempotencyKey,
		Args:           req,
		Simulate: func(ctx context.Context) error {
			return s.Admin.SimulateLockBet(ctx, args)
		},
		Broadcast: func(ctx context.Context, nonce uint64) (*types.Transaction, error) {
			// SDK admin.LockBet uses its own internal nonce via PendingNonceAt;
			// for v1 we rely on signer_lease's serialization to make that safe.
			// (A future SDK helper can take a nonce override.)
			_ = nonce
			return s.Admin.LockBet(ctx, args)
		},
	})
}

// LockBet broadcasts and blocks until terminal (or ctx).
func (s *LockBetService) LockBet(ctx context.Context, req LockBetReq, opts ...business.WaitOption) (business.Result, error) {
	_, id, err := s.Submit(ctx, req)
	if err != nil {
		return business.Result{}, err
	}
	return WaitTerminal(ctx, s.Deps.Repo, id, opts...)
}
```

- [ ] Add a typed Tokens-config error to `errors.go` (re-edit):

```go
// ErrConfigInvalid_Tokens is returned when an op references a TokenSymbol
// not declared in Config.Tokens.
type ErrConfigInvalid_Tokens struct {
	Symbol TokenSymbol
}

func (e *ErrConfigInvalid_Tokens) Error() string {
	return "business: unknown TokenSymbol " + string(e.Symbol) + " (add to Config.Tokens)"
}
```

(insert at the end of `errors.go`; remember to mark this in Task 3 if regenerating)

- [ ] Create `writes/lockbet_test.go`:

```go
package writes_test

import (
	"context"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/internal/money"
)

func TestScaleArgsRoundtrip(t *testing.T) {
	// This is a focused unit test on the scaling helpers used by LockBet.
	in, _ := decimal.NewFromString("100.5")
	scaled := money.ScaleToBase(in, 18)
	require.Equal(t, "100500000000000000000", scaled.String())

	back := money.ScaleFromBase(scaled, 18)
	require.True(t, back.Equal(in))

	// odds 1.818 → ×1000 → 1818
	odds, _ := decimal.NewFromString("1.818")
	scaledOdds := odds.Mul(decimal.NewFromInt(1000)).Truncate(0).BigInt()
	require.Equal(t, big.NewInt(1818).String(), scaledOdds.String())
}

func TestErrConfigInvalid_Tokens(t *testing.T) {
	err := &business.ErrConfigInvalid_Tokens{Symbol: "WETH"}
	require.Contains(t, err.Error(), "WETH")
}

// Note: a full end-to-end LockBet test that drives the SubmitPipeline +
// signer_lease + admin client + Watcher requires either anvil (e2e) or an
// elaborate set of mocks for sdkadmin.Client. Deferred to e2e/ in a later pass.
//
// The pipeline itself is exercised by:
//   - action/repo_test.go (InsertOrLoad / MarkFailed / MarkSubmitted)
//   - internal/nonce/lease_test.go (lease serialization)
//   - watcher/watcher_test.go (post-broadcast tracking)
// so the writes layer is composed of already-tested parts.

func _ctx() context.Context { return context.Background() }
func _addr() common.Address { return common.HexToAddress("0x1") }
```

- [ ] Run `go build ./...` — Expected: builds cleanly.

---

## Task 16: multisig/shared.go + ExecuteLargeWithdrawal + RejectLargeWithdrawal

**Files:**
- Create: `multisig/shared.go`, `multisig/executelargewithdrawal.go`, `multisig/rejectlargewithdrawal.go`, `multisig/withdrawals_test.go`

- [ ] Create `multisig/shared.go`:

```go
// Package multisig implements the multisig business operations.
//
// For each multisig method, the package exposes:
//   - Build{Op}Calldata(ctx, req) (CalldataPacket, error)   // pure local
//   - SubmitPropose{Op}(ctx, req) (*Proposal, error)        // POST to Safe Tx Service
//   - Propose{Op}(ctx, req, opts...) (*ProposalResult, error)  // sync wait for execution
//   - Simulate{Op}(ctx, req) error                          // eth_call as Safe sender
//   - Execute{Op}Direct(ctx, req, opts...) (Result, error)  // testnet 1-of-1 only
package multisig

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/proposal"

	sdkmultisig "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/multisig"
)

// SubmitDeps groups what a multisig op needs.
type SubmitDeps struct {
	MS   *sdkmultisig.Client
	Repo *proposal.Repo
}

// ProposeInput is the shape each per-op Propose passes to the shared pipeline.
type ProposeInput struct {
	Op             string
	IdempotencyKey string
	Args           any
	BuildHandle    func() *sdkmultisig.Handle  // returns the SDK Handle for this method
}

// ProposePipeline runs a Sim → Propose → INSERT proposal pipeline.
func ProposePipeline(ctx context.Context, d SubmitDeps, in ProposeInput) (*business.Proposal, error) {
	if d.MS.ProposerAddress() == (commonZero{}).Addr() || d.MS.SafeAddress() == (commonZero{}).Addr() {
		return nil, business.ErrModeNotConfigured
	}

	argsJSON, err := json.Marshal(in.Args)
	if err != nil {
		return nil, &business.ErrDB{Op: "MarshalArgs", Cause: err}
	}

	h := in.BuildHandle()
	if err := h.Simulate(ctx); err != nil {
		return nil, &business.ErrSimulationFailed{Method: in.Op, Cause: err}
	}

	prop, err := h.Propose(ctx)
	if err != nil {
		var modeErr *sdkmultisig.ErrModeNotConfigured
		if errors.As(err, &modeErr) {
			return nil, business.ErrModeNotConfigured
		}
		return nil, &business.ErrRPC{Op: "MultisigPropose", Cause: err}
	}

	row := &proposal.Row{
		IdempotencyKey:  in.IdempotencyKey,
		Op:              in.Op,
		ArgsJSON:        string(argsJSON),
		SafeAddress:     d.MS.SafeAddress().Hex(),
		SafeTxHash:      prop.SafeTxHash.Hex(),
		SafeNonce:       prop.Nonce,
		ProposerAddress: d.MS.ProposerAddress().Hex(),
		Status:          business.ProposalProposed,
		SafeUIURL:       prop.SafeUIURL,
		ProposedAt:      time.Now().UTC(),
	}
	if prop.ConfirmationsRequired > 0 {
		row.ConfirmationsRequired.Valid = true
		row.ConfirmationsRequired.Int64 = int64(prop.ConfirmationsRequired)
	}
	row.ConfirmationsCount.Valid = true
	row.ConfirmationsCount.Int64 = int64(prop.ConfirmationsCount)

	id, _, err := d.Repo.InsertOrLoad(ctx, row)
	if err != nil {
		return nil, err
	}

	return rowToProposal(row, id), nil
}

func rowToProposal(r *proposal.Row, id int64) *business.Proposal {
	out := &business.Proposal{
		ID:              business.ProposalID(id),
		Op:              r.Op,
		SafeTxHash:      hexToHashLocal(r.SafeTxHash),
		SafeNonce:       r.SafeNonce,
		Status:          r.Status,
		SafeUIURL:       r.SafeUIURL,
		ProposedAt:      r.ProposedAt,
	}
	if r.ConfirmationsRequired.Valid {
		out.ConfirmationsRequired = uint(r.ConfirmationsRequired.Int64)
	}
	if r.ConfirmationsCount.Valid {
		out.ConfirmationsCount = uint(r.ConfirmationsCount.Int64)
	}
	return out
}

// helpers (avoid pulling go-ethereum into shared.go header in a way that breaks
// import order on regen).
type commonZero struct{}

func (commonZero) Addr() commonAddr { return commonAddr{} }

type commonAddr struct{ /* equivalent to common.Address zero */ }
```

- [ ] **NOTE TO IMPLEMENTER:** the multisig shared file as above will not compile due to the `commonZero` placeholders. When implementing, replace them with proper `common.Address` zero comparisons:

```go
import "github.com/ethereum/go-ethereum/common"

// inside ProposePipeline:
if (d.MS.ProposerAddress() == common.Address{}) || (d.MS.SafeAddress() == common.Address{}) {
    return nil, business.ErrModeNotConfigured
}

// hexToHashLocal helper:
func hexToHashLocal(s string) common.Hash { return common.HexToHash(s) }
```

Also add to `business.Proposal` (in types.go, Task 2) — extend the type if it doesn't already have these fields:

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
	OnChainTxHash         *common.Hash
	SafeUIURL             string
	ProposedAt            time.Time
	ExecutedAt            *time.Time
}

type ProposalResult struct {
	Proposal      Proposal
	OnChainResult *Result
}
```

(amend types.go accordingly.)

- [ ] Create `multisig/executelargewithdrawal.go`:

```go
package multisig

import (
	"context"

	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"

	business "github.com/Crypto-Barrett/contracts-business-layer"

	sdkmultisig "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/multisig"
)

// ExecuteLargeWithdrawalReq approves a queued large withdrawal by RequestID.
type ExecuteLargeWithdrawalReq struct {
	RequestID      decimal.Decimal // contract uses uint256
	IdempotencyKey string
}

// ELWService is the per-op service.
type ELWService struct {
	MS   *sdkmultisig.Client
	Repo SubmitDeps // reuse for proposal repo plus ms client
}

// Build returns the calldata for offline signing in Safe UI.
func (s *ELWService) Build(ctx context.Context, req ExecuteLargeWithdrawalReq) (business.CalldataPacket, error) {
	h := s.MS.ExecuteLargeWithdrawal(sdkmultisig.ExecuteLargeWithdrawalArgs{
		RequestID: req.RequestID.BigInt(),
	})
	pkt, err := h.Calldata(ctx)
	if err != nil {
		return business.CalldataPacket{}, &business.ErrRPC{Op: "MultisigCalldata", Cause: err}
	}
	return business.CalldataPacket{
		To:        pkt.To,
		Value:     decimal.NewFromBigInt(pkt.Value, 0),
		Data:      pkt.Data,
		Operation: pkt.Operation,
	}, nil
}

// Simulate runs eth_call as msg.sender = Safe.
func (s *ELWService) Simulate(ctx context.Context, req ExecuteLargeWithdrawalReq) error {
	h := s.MS.ExecuteLargeWithdrawal(sdkmultisig.ExecuteLargeWithdrawalArgs{
		RequestID: req.RequestID.BigInt(),
	})
	return h.Simulate(ctx)
}

// SubmitPropose POSTs the proposal to Safe Tx Service.
func (s *ELWService) SubmitPropose(ctx context.Context, req ExecuteLargeWithdrawalReq) (*business.Proposal, error) {
	return ProposePipeline(ctx, s.Repo, ProposeInput{
		Op:             "executeLargeWithdrawal",
		IdempotencyKey: req.IdempotencyKey,
		Args:           req,
		BuildHandle: func() *sdkmultisig.Handle {
			return s.MS.ExecuteLargeWithdrawal(sdkmultisig.ExecuteLargeWithdrawalArgs{
				RequestID: req.RequestID.BigInt(),
			})
		},
	})
}

// suppress unused
var _ = common.Address{}
```

- [ ] Create `multisig/rejectlargewithdrawal.go`:

```go
package multisig

import (
	"context"

	"github.com/shopspring/decimal"

	business "github.com/Crypto-Barrett/contracts-business-layer"

	sdkmultisig "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/multisig"
)

// RejectLargeWithdrawalReq rejects a queued large withdrawal by RequestID.
type RejectLargeWithdrawalReq struct {
	RequestID      decimal.Decimal
	IdempotencyKey string
}

// RLWService is the per-op service.
type RLWService struct {
	MS   *sdkmultisig.Client
	Repo SubmitDeps
}

func (s *RLWService) Build(ctx context.Context, req RejectLargeWithdrawalReq) (business.CalldataPacket, error) {
	h := s.MS.RejectLargeWithdrawal(sdkmultisig.RejectLargeWithdrawalArgs{
		RequestID: req.RequestID.BigInt(),
	})
	pkt, err := h.Calldata(ctx)
	if err != nil {
		return business.CalldataPacket{}, &business.ErrRPC{Op: "MultisigCalldata", Cause: err}
	}
	return business.CalldataPacket{
		To:        pkt.To,
		Value:     decimal.NewFromBigInt(pkt.Value, 0),
		Data:      pkt.Data,
		Operation: pkt.Operation,
	}, nil
}

func (s *RLWService) Simulate(ctx context.Context, req RejectLargeWithdrawalReq) error {
	h := s.MS.RejectLargeWithdrawal(sdkmultisig.RejectLargeWithdrawalArgs{
		RequestID: req.RequestID.BigInt(),
	})
	return h.Simulate(ctx)
}

func (s *RLWService) SubmitPropose(ctx context.Context, req RejectLargeWithdrawalReq) (*business.Proposal, error) {
	return ProposePipeline(ctx, s.Repo, ProposeInput{
		Op:             "rejectLargeWithdrawal",
		IdempotencyKey: req.IdempotencyKey,
		Args:           req,
		BuildHandle: func() *sdkmultisig.Handle {
			return s.MS.RejectLargeWithdrawal(sdkmultisig.RejectLargeWithdrawalArgs{
				RequestID: req.RequestID.BigInt(),
			})
		},
	})
}
```

- [ ] Create `multisig/withdrawals_test.go`:

```go
package multisig_test

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"

	"github.com/Crypto-Barrett/contracts-business-layer/multisig"
)

func TestExecuteLargeWithdrawalReq_Construct(t *testing.T) {
	req := multisig.ExecuteLargeWithdrawalReq{
		RequestID:      decimal.NewFromInt(42),
		IdempotencyKey: "approve_lw:42:reviewer-1",
	}
	require.Equal(t, "42", req.RequestID.String())
	require.Equal(t, "approve_lw:42:reviewer-1", req.IdempotencyKey)
}

func TestRejectLargeWithdrawalReq_Construct(t *testing.T) {
	req := multisig.RejectLargeWithdrawalReq{
		RequestID:      decimal.NewFromInt(42),
		IdempotencyKey: "reject_lw:42:reviewer-1",
	}
	require.Equal(t, "42", req.RequestID.String())
}

// Full end-to-end (Propose → Safe Tx Service mock → poller → confirm) is in
// e2e/ tests; here we only smoke the request-construction surface.
```

- [ ] Run `go build ./multisig/...` — Expected: builds.

---

## Task 17: service.go full assembly (wire everything up)

**Files:**
- Modify: `service.go` (replace stub from Task 13)

- [ ] Replace `service.go` with the full implementation (drives DB open, migrations, sdk.Connection, signer load, repos, watcher start, multisig poller start, exposes business methods by composing the writes/reads/multisig service objects).

  Implementation outline (~200 lines): see `docs/superpowers/specs/2026-05-01-contracts-business-layer-design.md` §3.1 for the public surface. Key wire-up:

  1. `cfg.validate()`
  2. Open `*gorm.DB` (or use `cfg.DB`)
  3. Run `migrate.Up()` unless `cfg.SkipMigrations`
  4. `sdkclient.NewConnection(...)`
  5. `signerload.Load(...)` for admin
  6. If `cfg.SafeTxServiceURL != ""`: `signerload.Load(...)` for proposer; build `sdkmultisig.New(...)` with options
  7. `ethclient.NewClient(...)` from sdk Connection's RPC handle
  8. `nonce.New(db, ethClient, signer.Address()).EnsureRow(ctx)`
  9. `actionRepo := action.New(db); proposalRepo := proposal.New(db)`
  10. Build `LockBetService` (and any other writes services) with admin client + nonce lease + actionRepo
  11. Build `ELWService`, `RLWService` with multisig client + proposalRepo
  12. Construct `Watcher` and `Start(ctx)` (background ctx tied to Service)
  13. Construct `MultisigPoller` and `Start(ctx)` if multisig configured
  14. Resolver wiring: per resolver, prefer `cfg.{User,Match,Odds,BetID}Resolver` if non-nil, else use `resolver/stub` impls
  15. Return `*Service`

  Public methods on `*Service` simply delegate:
  ```go
  func (s *Service) SimulateLockBet(ctx context.Context, req writes.LockBetReq) error {
      return s.lockBet.Simulate(ctx, req)
  }
  func (s *Service) SubmitLockBet(ctx context.Context, req writes.LockBetReq) (TxHash, ActionID, error) {
      return s.lockBet.Submit(ctx, req)
  }
  func (s *Service) LockBet(ctx context.Context, req writes.LockBetReq, opts ...WaitOption) (Result, error) {
      return s.lockBet.LockBet(ctx, req, opts...)
  }
  // ... similar for ELW, RLW, GetAction, ListActions, etc.

  func (s *Service) Close() error {
      // cancel ctx → watcher.Stop, poller.Stop, drop sdk conn, close gorm
  }
  ```

- [ ] Run `go build ./...` — Expected: clean build.

---

## Task 18: Run the test suite, fix until green

- [ ] Run `go test -short ./...` (no docker required).
  Expected: `internal/money` and `resolver/stub` tests pass; everything else either passes (fast) or skips with `requires docker`.

- [ ] If docker available, run `go test ./...` to exercise testdb-backed tests.
  Expected: all green.

- [ ] If anything fails, fix in place — do NOT mark Task 18 done while red.

---

## Task 19: Verify documentation completeness

- [ ] Confirm presence of:
  - `docs/superpowers/specs/2026-05-01-contracts-business-layer-design.md`
  - `docs/superpowers/plans/2026-05-01-contracts-business-layer-v1-skeleton.md`
  - `docs/flows/bet-placement.md`
  - `docs/flows/settlement.md`
  - `docs/flows/withdrawal.md`
  - `README.md`

- [ ] Confirm `resolver/impl/` exists and contains a `README.md` with the
  business-team onboarding instructions (write that README as part of this
  task if missing).

- [ ] Update `README.md` with a "Getting started" section linking to spec and
  flow docs.

---

## Task 20: Final report (no commit, no push)

- [ ] Print:
  - Files created / modified count
  - Test result summary (`go test -short ./...`)
  - List of methods implemented end-to-end (LockBet, ExecuteLargeWithdrawal, RejectLargeWithdrawal)
  - List of methods scaffolded but NOT implemented (8 admin writes + 5 multisig methods)
  - Suggested next step for the user (replicate `writes/lockbet.go` shape for the remaining admin writes; replicate `multisig/executelargewithdrawal.go` shape for the remaining multisig methods)
