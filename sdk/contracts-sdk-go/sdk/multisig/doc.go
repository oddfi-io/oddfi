// Package multisig exposes the BettingPool methods callable by the Gnosis Safe
// multisig role: settle, cancelMatch, batchCancelMatch, releaseOrForfeiture,
// withdrawPlatform, setMaxMarketsPerMatch, setRedLightThreshold, setAdmin,
// setLpShareBps, pause, unpause, reopenMarket, executeLargeWithdrawal,
// rejectLargeWithdrawal.
//
// Three execution modes are supported:
//   - Propose: submit a SafeTx to Safe Transaction Service (mainnet default)
//   - Direct:  pack execTransaction and broadcast (testnet 1-of-1 only)
//   - Calldata: emit raw {to, value, data} for manual paste into Safe UI
package multisig
