# Settlement flow (multisig)

End-to-end: a match has ended, the platform's scorer has determined the winning outcome, and the settle operation needs to be executed via the Gnosis Safe multisig (3-of-5 in the example).

## Actors

| Actor | Role |
|---|---|
| Scorer / oracle | Off-chain process that determines `WinningOutcome` |
| Ops / scoring service | Triggers `SubmitProposeSettle`; holds the proposer key |
| `contracts-business-layer` (this lib) | Builds Safe transaction, signs with proposer, POSTs to Safe Tx Service, persists to `multisig_proposals`; poller tracks status |
| `oddfi-contracts-sdk/sdk/multisig` | EIP-712 hashing, signing, Safe Tx Service HTTP client |
| Safe Transaction Service | Hosted at `safe-transaction-bsc.safe.global`; collects signatures from owners |
| Safe owners (humans) | 5 people with hardware wallets / phones; sign in Safe UI |
| Gnosis Safe contract | On-chain N-of-M wallet that calls `BettingPool.settle(...)` after threshold met |

## Sequence

```
Ops              business              sdk/multisig       Safe Tx Svc      Safe owners       Safe contract     BettingPool       MySQL          RPC
 │                  │                      │                  │                  │                  │                  │             │             │
 │── trigger ──────►│                      │                  │                  │                  │                  │             │             │
 │ settle(matchID)  │                      │                  │                  │                  │                  │             │             │
 │                  │── SimulateSettle (optional dry-run) ───►│                  │                  │                  │             │             │
 │                  │                      │── eth_call as Safe (msg.sender=Safe) ────────────────────────────────────►│             │             │
 │                  │◄── ok ───            │                  │                  │                  │                  │             │             │
 │                  │                      │                  │                  │                  │                  │             │             │
 │                  │── SubmitProposeSettle│                  │                  │                  │                  │             │             │
 │                  │  (ctx, SettleReq)    │                  │                  │                  │                  │             │             │
 │                  │── INSERT multisig_proposals(status='proposed', count=1, ...) ──────────────────────────────────────────────►│             │
 │                  │                      │                  │                  │                  │                  │             │             │
 │                  │── multisig.Settle(args).Propose(ctx) ──►│                  │                  │                  │             │             │
 │                  │                      │── pack BettingPool.settle(...) calldata                                                │             │
 │                  │                      │── eth_call: safe.nonce() ────────────────────────────────────────────────►│             │
 │                  │                      │◄── nonce=42 ──   │                  │                  │                  │             │             │
 │                  │                      │── compute safeTxHash via EIP-712                                                       │             │
 │                  │                      │── proposer.SignHash(safeTxHash) → 65-byte sig                                           │             │
 │                  │                      │── POST /api/v1/safes/0xSAFE/multisig-transactions/                                      │             │
 │                  │                      │     {to, value, data, ..., contractTransactionHash, sender, signature} ─►│             │             │
 │                  │                      │◄── 201 ──────    │                  │                  │                  │             │             │
 │                  │◄── Proposal{safeTxHash, safeUIURL, ...}─│                  │                  │                  │             │             │
 │◄── Proposal ──── │                      │                  │                  │                  │                  │             │             │
 │ {safeTxHash,     │                      │                  │                  │                  │                  │             │             │
 │  safeUIURL,      │                      │                  │                  │                  │                  │             │             │
 │  status:'proposed', confirmations_count=1}                 │                  │                  │                  │             │             │
 │                                                                                                                                                  │
 │── #ops-multisig: "Please sign: <safeUIURL>" ────────────────────────────────►│ owner_2 / 3 / 4 / 5                  │             │             │
 │                                                                                                                                                  │
 │                                          (10-30 minutes of human time)                                                                           │
 │                                                                                                                                                  │
 │                                                            ◄── owner_2 sign ─│ (in Safe UI, signs with hw wallet)                                │
 │                                                            ◄── owner_3 sign ─│                  │                                                │
 │                                                                              │                  │                                                │
 │                                                            owner_5 clicks "Execute" in Safe UI                                                  │
 │                                                                              │── Safe.execTransaction(...) ──────►│                              │
 │                                                                              │                  │── BettingPool.settle(matchID, ...) ──►│       │
 │                                                                              │                  │◄── ok ──────────│              │             │
 │                                                                              │◄── tx_hash=0xexec ─                │                              │
 │                                                                                                                                                  │
 │                  ─── Multisig poller (background, 30s tick) ───              │                  │                  │             │             │
 │                  │── poller tick ──     │                  │                  │                  │                  │             │             │
 │                  │── SELECT non-terminal proposals (50 max) ──────────────────────────────────────────────────────────────────►│             │
 │                  │── for each: GetProposal(safeTxHash) ──►│                  │                  │                  │             │             │
 │                  │                      │── GET /api/v1/multisig-transactions/{safeTxHash}/ ──►│                  │             │             │
 │                  │                      │◄── isExecuted=true, success=true, transactionHash=0xexec ──             │             │             │
 │                  │◄── Proposal{Status:'executed', OnChainTxHash:0xexec} ──   │                  │                  │             │             │
 │                  │── UPDATE multisig_proposals SET status='executed', on_chain_tx_hash=0xexec ─────────────────────────────────►│             │
 │                  │── INSERT chain_actions(op='multisig_executed:settle', status='submitted', tx_hash=0xexec) ────────────────►│             │
 │                  │                                                                                                                              │
 │                  ─── Standard chain_actions Watcher takes over ───                                                                              │
 │                  │── Watcher: claim row, eth_getTransactionReceipt(0xexec) ──────────────────────────────────────────────────────────────────►│
 │                  │◄── receipt.Status=1, blockNumber=N ──                                                                                       │
 │                  │── UPDATE chain_actions SET status='mined' ──────────────────────────────────────────────────────────────────►│             │
 │                  │── (wait DefaultConfirmations blocks) ──                                                                                     │
 │                  │── UPDATE chain_actions SET status='confirmed' ──────────────────────────────────────────────────────────────►│             │
```

## Caller code

```go
// Async (preferred — proposals can take hours)
func (h *handler) Settle(matchID string, winningOutcome uint8, betIDs [][32]byte) error {
    prop, err := h.svc.SubmitProposeSettle(ctx, business.SettleReq{
        MatchID:        someOnchainMatchID,
        Market:         business.MarketSpread,
        Line:           decimal.Zero,
        WinningOutcome: winningOutcome,
        BetIDs:         betIDs,
        IdempotencyKey: fmt.Sprintf("settle:%s:%d", matchID, time.Now().UnixNano()),
    })
    if err != nil {
        // sentinels: ErrModeNotConfigured (proposer key/SafeTxServiceURL missing),
        //            ErrIdempotencyConflict
        // wrappers:  ErrSimulationFailed (Sim was implicit), ErrRPC, ErrDB
        return err
    }
    log.Infof("proposal posted: safeTxHash=%s ui=%s", prop.SafeTxHash.Hex(), prop.SafeUIURL)
    // Notify owners via Slack/email/etc.
    return notifyOwners(prop.SafeUIURL)
}

// Sync (only when caller can wait hours)
func (h *handler) SettleAndWait(...) (*business.ProposalResult, error) {
    waitCtx, cancel := context.WithTimeout(ctx, 4*time.Hour)
    defer cancel()
    res, err := h.svc.ProposeSettle(waitCtx, req, business.WaitForConfirmations(2))
    if errors.Is(err, business.ErrTimeout) {
        // Proposal still pending; ops should chase owners
        return nil, fmt.Errorf("not enough signatures yet")
    }
    return res, err
}

// Pure offline (no signer, no RPC) — for ops who paste calldata into Safe UI manually
func (h *handler) SettleCalldataForOpsUI(...) (business.CalldataPacket, error) {
    return h.svc.BuildSettleCalldata(ctx, req)
}
```

## Idempotency contract

`IdempotencyKey` ensures the SAME proposal isn't posted twice. Same key returns the existing `Proposal` (with current status from `multisig_proposals`).

Recommended key format: `settle:<onchainMatchID>:<scoringRunID>` (so re-running the scorer with the same input returns the existing proposal, but a corrected scoring run uses a different key).

## Failure modes

| Failure | Where | Response |
|---|---|---|
| `ErrModeNotConfigured` | Pre-Submit | Caller forgot to set `SafeTxServiceURL` or `ProposerSignerEnvVar` |
| Sim fails | Implicit Simulate before propose | `ErrSimulationFailed`; no proposal posted |
| Safe Tx Service 4xx | propose POST | `ErrRPC` wrapping the HTTP error; row NOT INSERT'd |
| Owner rejects in UI | post-propose, human action | poller eventually sees `rejected` status; `ProposalStatus="rejected"` |
| Execute reverts on chain | post-execute | poller sees `executed_failed`; `ChainActions` row marks `failed` with `ErrReverted` |
| Safe nonce skipped | rare; proposal becomes obsolete | poller marks `rejected` (Safe Tx Service indicates) |
| Poller down | n/a | proposals stay `proposed`; on poller restart, picks up where left off |

## Operations notes

- **Safe owners must use Safe UI**: this library does NOT collect additional signatures. Once the proposal is POSTed, all collection happens in `app.safe.global`.
- **`WithdrawPlatform` is NOT in v1**: defer to v2.
- **For testnet 1-of-1 Safes**: use `Execute{Op}Direct` instead of Propose; faster, no UI dance. Mainnet rejects this at `New()`.
- **Multiple proposals for same op are allowed**: just use different `IdempotencyKey`s. The poller tracks each independently.
