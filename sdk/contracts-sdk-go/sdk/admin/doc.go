// Package admin exposes the BettingPool methods callable by the admin role:
// creditDeposit, lockBet, lockCreditBet, lockParlay, unlockBet, unlockParlay,
// updateSignal, openMarket, closeMarket, batch variants.
//
// Each write method has a SimulateXxx counterpart for dry-run via eth_call.
package admin
