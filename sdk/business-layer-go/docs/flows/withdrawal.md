# Withdrawal flow

End-to-end: a user wants to withdraw USDT from their in-contract balance. Two paths depending on amount.

## Path 1 — Small withdrawal (below contract threshold)

The user's frontend signs a `withdraw(amount)` transaction with the user's own key (typically via WalletConnect / MetaMask) and broadcasts directly. **This library does NOT participate** in this path. Only documented here for completeness.

```
User → Frontend (wallet) → BettingPool.withdraw(amount) → on-chain immediately
```

The library may surface this withdrawal as a balance change via `GetUserBalance` reads later, but it's not a "tx the library issued".

## Path 2 — Large withdrawal (above threshold)

When `amount > contract's largeWithdrawalThreshold`, the contract enqueues a request and emits a `LargeWithdrawalRequested(requestID, user, amount)` event. The Safe multisig must approve (via `executeLargeWithdrawal`) or refuse (via `rejectLargeWithdrawal`) before the funds move.

This library is responsible for:
- Detecting pending requests (typically ops dashboard polls a contract view; out of scope here)
- Posting the multisig proposal to approve or reject
- Tracking the proposal through to on-chain execution

### Actors

| Actor | Role |
|---|---|
| User + frontend | Initiates the user-side `requestWithdraw(amount)` tx (NOT through this library) |
| BettingPool contract | Enqueues request, emits `LargeWithdrawalRequested` event |
| Ops dashboard | Lists pending requests (queries contract view); ops decides approve/reject per request |
| `contracts-business-layer` | Posts `executeLargeWithdrawal` or `rejectLargeWithdrawal` proposal to Safe |
| Safe owners | Sign in Safe UI |
| Safe contract | Calls `BettingPool.executeLargeWithdrawal(requestID)` once N signatures collected |

### Sequence (approval path)

```
User           Frontend       BettingPool     ops dashboard       business             sdk/multisig    Safe Tx Svc    Safe owners    Safe contract
 │                │                │                │                 │                     │                │              │              │
 │ click          │                │                │                 │                     │                │              │              │
 │ "Withdraw $5M"─►│                │                │                 │                     │                │              │              │
 │                │── requestWithdraw(amount) ──────►│                 │                     │                │              │              │
 │                │                │── LargeWithdrawalRequested(req_id=42, user, $5M) ─────►│                │              │              │
 │                │                │                │ (event listener │                     │                │              │              │
 │                │                │                │  picks up event)│                     │                │              │              │
 │                │                │                │                 │                     │                │              │              │
 │                │                │                │ ops reviews:    │                     │                │              │              │
 │                │                │                │ - KYC ok        │                     │                │              │              │
 │                │                │                │ - balance ok    │                     │                │              │              │
 │                │                │                │ - no fraud      │                     │                │              │              │
 │                │                │                │ → APPROVE       │                     │                │              │              │
 │                │                │                │                 │                     │                │              │              │
 │                │                │                │── svc.SubmitProposeExecuteLargeWithdrawal(req_id=42) ──►              │              │              │
 │                │                │                │                 │                                                                                  │
 │                │                │                │                 │── INSERT multisig_proposals(op='executeLargeWithdrawal', count=1)                │
 │                │                │                │                 │── multisig.ExecuteLargeWithdrawal(req_id=42).Propose(ctx) ─►                      │
 │                │                │                │                 │                     │── compute safeTxHash, sign, POST ─►│              │              │
 │                │                │                │                 │                     │◄── 201 ─       │              │              │              │
 │                │                │                │                 │◄── Proposal ──      │                │              │              │              │
 │                │                │                │◄── Proposal ────│                     │                │              │              │              │
 │                │                │                │ (notify owners) │                     │                │              │              │              │
 │                │                │                │                                       │                │              │              │              │
 │                │                │                │                                       │                │ owner_2,3,4,5 sign in Safe UI                 │
 │                │                │                │                                       │                │              │              │              │
 │                │                │                │                                       │                │ owner_5 clicks Execute       │              │
 │                │                │                │                                       │                │              │── BettingPool.executeLargeWithdrawal(42) ►
 │                │                │                │                                       │                │              │              │── transfer USDT to user
 │                │                │                │                                       │                │              │              │── emit LargeWithdrawalExecuted(42)
 │                │                │                │                                       │                │              │◄── tx_hash=0xexec
 │                │                │                │                                       │                │              │              │              │
 │                │                │                │                 (multisig poller detects executed; mirrors to chain_actions; Watcher confirms)        │
 │                │                │                │                                                                                                       │
 │                │                │ (User's contract balance dropped; off-chain wallet credited via the on-chain transfer)                                  │
 │◄── funds in wallet ──                                                                                                                                     │
```

### Sequence (rejection path)

Same shape, but `SubmitProposeRejectLargeWithdrawal` instead. Once the multisig executes, the contract typically zeros the request and refunds whatever was reserved (contract-specific; check `BettingPool.rejectLargeWithdrawal` semantics).

### Caller code

```go
type approveReq struct {
    RequestID      uint64 `json:"request_id"`
    Reviewer       string `json:"reviewer_id"`     // who approved (audit only)
}

func (h *handler) ApproveLargeWithdrawal(w http.ResponseWriter, r *http.Request) {
    var req approveReq
    json.NewDecoder(r.Body).Decode(&req)

    prop, err := h.svc.SubmitProposeExecuteLargeWithdrawal(r.Context(),
        business.ExecuteLargeWithdrawalReq{
            RequestID:      decimal.NewFromUint64(req.RequestID),
            IdempotencyKey: fmt.Sprintf("approve_lw:%d:%s", req.RequestID, req.Reviewer),
        })
    if err != nil {
        // see settlement.md for full error handling
        http.Error(w, err.Error(), 500)
        return
    }
    json.NewEncoder(w).Encode(map[string]any{
        "safe_tx_hash":   prop.SafeTxHash.Hex(),
        "safe_ui_url":    prop.SafeUIURL,
        "status":         "proposed",
        "confirmations":  fmt.Sprintf("%d/%d", prop.ConfirmationsCount, prop.ConfirmationsRequired),
    })
}

func (h *handler) RejectLargeWithdrawal(w http.ResponseWriter, r *http.Request) {
    // identical shape, calls SubmitProposeRejectLargeWithdrawal
}
```

### Listing pending withdrawals (ops dashboard)

```go
// Pending proposals
proposals, err := svc.ListProposals(ctx, business.ProposalFilter{
    Op:     []string{"executeLargeWithdrawal", "rejectLargeWithdrawal"},
    Status: []business.ProposalStatus{business.ProposalProposed},
    Limit:  100,
})

// Detecting pending on-chain requests not yet proposed → ops needs a separate
// component that listens for LargeWithdrawalRequested events and cross-references
// against multisig_proposals. NOT in v1 of this library — the listener belongs in
// chain_consumer or chain_crawler.
```

### Idempotency contract

Recommended key: `approve_lw:<request_id>:<reviewer_id>` so each reviewer can't accidentally propose twice for the same request, but a different reviewer can intentionally propose if the first was withdrawn.

If you want strict "one proposal per request, period", use `approve_lw:<request_id>` with no reviewer suffix; second proposal for same request returns the existing one.

### Failure modes

| Failure | Where | Response |
|---|---|---|
| Sim reverts (e.g., request_id doesn't exist) | Pre-Submit | `ErrSimulationFailed` |
| Request was already executed by another channel | Sim | `ErrSimulationFailed` |
| Owner declines in UI | post-propose | poller marks `rejected` |
| Same request gets BOTH execute and reject proposals | Multiple proposals | Whichever Safe nonce executes first wins; the other becomes obsolete |

### Operations notes

- **Detecting pending requests is out of scope** for v1 of this library. Either:
  - `chain_consumer` listens for `LargeWithdrawalRequested` events and inserts a row into your own `pending_withdrawals` table, or
  - Ops dashboard polls a contract view (e.g., `getPendingLargeWithdrawals()`) on a timer.
- **Speed**: Large withdrawals are deliberately slow (multisig + N owners signing). Set user expectations. SLA is typically 1-24h depending on owner availability.
- **Audit trail**: Every approval/rejection is recorded in `multisig_proposals` with `proposer_address` (and via `args_json`, the `request_id` and any reviewer metadata). Use `ListProposals` for ops dashboards and weekly reviews.
