# Bet placement flow

End-to-end: a user clicks "Place bet" in the frontend, the backend submits an on-chain `lockBet` transaction, the user gets confirmed status.

## Actors

| Actor | Role |
|---|---|
| Frontend (web/mobile) | Sends HTTP POST `/bets`, subscribes to status via WS (separate WS service) |
| `oddfi-bets-api` | HTTP service that holds a `*business.Service` |
| `contracts-business-layer` (this lib) | Translates business IDs → on-chain params; owns idempotency / broadcast / Watcher |
| `oddfi-contracts-sdk/sdk` | Pure L1 SDK; signs and broadcasts the `lockBet(...)` tx |
| MySQL | Holds `chain_actions`, `signer_lease`; also holds business tables (`users`, `matches`, `odds`) |
| EVM RPC node | Single endpoint configured at startup |
| Background WS service | Reads `chain_actions` updates and pushes status to frontend (NOT in this library) |

## Sequence

```
User                Frontend            oddfi-bets-api       business              SDK admin       MySQL          RPC
 │                    │                      │                  │                     │              │             │
 │── click "Place" ──►│                      │                  │                     │              │             │
 │                    │── POST /bets ───────►│                  │                     │              │             │
 │                    │   {userID, matchID,  │                  │                     │              │             │
 │                    │    market, outcome,  │                  │                     │              │             │
 │                    │    stake}            │                  │                     │              │             │
 │                    │                      │                  │                     │              │             │
 │                    │                      │── SubmitPlaceBet(ctx, req) ──────────► │                     │              │             │
 │                    │                      │                  │── UserResolver.OnchainAddress(userID) ─►│              │             │
 │                    │                      │                  │     SELECT wallet_address FROM users    │──read──►│             │
 │                    │                      │                  │◄── 0xUSER ──        │                     │              │             │
 │                    │                      │                  │── MatchResolver, OddsResolver, BetIDResolver (similar) │             │
 │                    │                      │                  │                     │                     │              │             │
 │                    │                      │                  │── INSERT chain_actions(status=pending) ─►│              │             │
 │                    │                      │                  │     ON UNIQUE → SELECT existing row     │──write──►│             │
 │                    │                      │                  │◄── action_id ──     │                     │              │             │
 │                    │                      │                  │                     │                     │              │             │
 │                    │                      │                  │── SimulateLockBet(ctx, args) ───────────►│             │             │
 │                    │                      │                  │                     │── eth_call ─────────────────────►│             │
 │                    │                      │                  │                     │◄── ok ──            │              │             │
 │                    │                      │                  │                     │                     │              │             │
 │                    │                      │                  │── BEGIN tx ───────►│              │             │
 │                    │                      │                  │── SELECT 1 FROM signer_lease WHERE addr=? FOR UPDATE ──►│             │
 │                    │                      │                  │   (other Submits queue here)            │              │             │
 │                    │                      │                  │◄── locked ──        │                     │              │             │
 │                    │                      │                  │── eth_getTransactionCount(addr,"pending") ────────────►│             │
 │                    │                      │                  │◄── nonce=N ──       │                     │              │             │
 │                    │                      │                  │── admin.LockBetWithNonce(args, N) ──────►│             │             │
 │                    │                      │                  │                     │── eth_sendRawTx ────────────────►│             │
 │                    │                      │                  │                     │◄── tx_hash=0xabc ──│              │             │
 │                    │                      │                  │── UPDATE chain_actions status='submitted', tx_hash, nonce ──►│       │
 │                    │                      │                  │── COMMIT ──────────►│              │             │
 │                    │                      │                  │   (lock released)   │                     │              │             │
 │                    │                      │                  │                     │                     │              │             │
 │                    │                      │◄── (tx_hash=0xabc, action_id) ────────│                     │              │             │
 │                    │◄── 202 Accepted ────│                      │                  │                     │              │             │
 │                    │   {tx_hash, action_id}                     │                  │                     │              │             │
 │◄── "Submitted" UI ─│                      │                      │                  │                     │              │             │
 │                    │                      │                      │                  │                     │              │             │
 │                    │── WS connect; subscribe(action_id) ─► WS service                                    │              │             │
 │                                                                                                            │              │             │
 │                                          ─── Watcher (background, in-process) takes over ───                              │              │             │
 │                                                                                                            │              │             │
 │                                          Worker every 500ms: SELECT submitted FOR UPDATE SKIP LOCKED ────►│              │             │
 │                                          eth_getTransactionReceipt(0xabc) ─────────────────────────────────────────────►│             │
 │                                          ... eventually receipt arrives, status=1, blockNum=N ────                       │              │             │
 │                                          UPDATE chain_actions SET status='mined', block_number=N ───────►│              │             │
 │                                                                                                            │              │             │
 │                                          loop: eth_blockNumber ────────────────────────────────────────────────────────►│             │
 │                                                if head ≥ N+confirmations and same blockHash:                              │              │             │
 │                                          UPDATE chain_actions SET status='confirmed' ────────────────────►│              │             │
 │                                                                                                            │              │             │
 │                                          WS service detects update (DB poll / future hook) ────────────────│              │             │
 │◄── "Confirmed" via WS ──────────────────────────────────────────                                                                          │
```

## Caller code

```go
type placeBetReq struct {
    UserID  string          `json:"user_id"`
    MatchID string          `json:"match_id"`
    Market  business.MarketKind `json:"market"`
    Outcome uint8           `json:"outcome"`
    Stake   decimal.Decimal `json:"stake"`
    Token   business.TokenSymbol `json:"token"`
}

func (h *handler) PlaceBet(w http.ResponseWriter, r *http.Request) {
    var req placeBetReq
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { /* 400 */ }

    idemKey := r.Header.Get("Idempotency-Key")
    if idemKey == "" { /* 400 */ }

    txHash, actionID, err := h.svc.SubmitPlaceBet(r.Context(), business.PlaceBetReq{
        UserID:         req.UserID,
        MatchID:        req.MatchID,
        Market:         req.Market,
        Outcome:        req.Outcome,
        Stake:          req.Stake,
        Token:          req.Token,
        IdempotencyKey: idemKey,
    })

    switch {
    case errors.Is(err, business.ErrIdempotencyConflict):
        http.Error(w, "duplicate", http.StatusConflict); return
    case err != nil:
        var simErr *business.ErrSimulationFailed
        var resErr *business.ErrResolver
        switch {
        case errors.As(err, &simErr):
            http.Error(w, fmt.Sprintf("on-chain check failed: %s", simErr.Revert.Name),
                http.StatusUnprocessableEntity)
        case errors.As(err, &resErr):
            http.Error(w, fmt.Sprintf("validation: %v", resErr.Cause),
                http.StatusBadRequest)
        default:
            http.Error(w, "internal", http.StatusInternalServerError)
        }
        return
    }

    json.NewEncoder(w).Encode(map[string]any{
        "tx_hash":   txHash,
        "action_id": actionID,
        "status":    "submitted",
    })
}
```

## Idempotency contract

The caller MUST supply `IdempotencyKey`. Recommended: `bet:<userID>:<matchID>:<client-generated UUID>`.

- Same key + same args → same `action_id`, same `tx_hash` returned (no double-spend).
- Same key + different args → `ErrIdempotencyConflict`.
- The library does NOT auto-generate keys; callers know their request boundaries (HTTP request id, Kafka offset, etc.).

## Failure modes

| Failure | Where | Response |
|---|---|---|
| Resolver returns `ErrNotImplemented` | Pre-INSERT | Error to caller; chain_actions row NOT created |
| Resolver business validation fails | Pre-INSERT | `ErrResolver` to caller; row NOT created |
| Sim revert (e.g., `InsufficientBalance`) | Post-INSERT | Row marked `failed`; `ErrSimulationFailed` to caller; nonce NOT consumed |
| RPC error during broadcast | Post-INSERT | Row marked `failed`; `ErrRPC` to caller; nonce NOT consumed (lease released without bump) |
| Receipt status=0 (on-chain revert) | Watcher | Row marked `failed` with `ErrReverted`; sync waiter (if any) wakes with the error |
| Tx never mined (>5min) | Watcher | Row marked `dropped`; `ErrDropped` to sync waiter; ops can re-issue with new key |
| Reorg | Watcher | Row reverted to `submitted`, re-tracked; sync waiter waits longer |
