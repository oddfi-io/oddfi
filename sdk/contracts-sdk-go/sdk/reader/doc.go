// Package reader exposes BettingPool view methods and the three-layer event
// API:
//   - Layer 0: bare abigen Filter*/Watch*
//   - Layer 1: per-event helper that hides bind.FilterOpts/WatchOpts pitfalls
//   - Layer 2: unified Stream that handles backfill→live transition
package reader
