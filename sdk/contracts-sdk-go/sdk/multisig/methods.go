package multisig

// Method constructors. Each returns a *Handle on which the caller picks a
// mode (Calldata / Execute / Propose / Simulate).

// Settle settles a market bucket given the winning outcome and the full list
// of bets on it.
func (c *Client) Settle(a SettleArgs) *Handle {
	return &Handle{c: c, methodName: "settle", callArgs: []interface{}{
		a.MatchID, uint8(a.Market), a.Line, a.WinningOutcome, a.BetIDs,
	}}
}

// CancelMatch cancels one (matchId, market, line) and refunds bets.
func (c *Client) CancelMatch(a CancelMatchArgs) *Handle {
	return &Handle{c: c, methodName: "cancelMatch", callArgs: []interface{}{
		a.MatchID, uint8(a.Market), a.Line, a.BetIDs,
	}}
}

// BatchCancelMatch cancels multiple markets of the same match in one tx.
func (c *Client) BatchCancelMatch(a BatchCancelMatchArgs) *Handle {
	return &Handle{c: c, methodName: "batchCancelMatch", callArgs: []interface{}{
		a.MatchID, marketTypesToUint8(a.Markets), a.Lines, a.BetIDsByMarket,
	}}
}

// ReopenMarket reopens a closed but unsettled market.
func (c *Client) ReopenMarket(a ReopenMarketArgs) *Handle {
	return &Handle{c: c, methodName: "reopenMarket", callArgs: []interface{}{
		a.MatchID, uint8(a.Market), a.Line,
	}}
}

// ReleaseOrForfeiture decides a frozen credit-bet payout (release vs forfeit).
func (c *Client) ReleaseOrForfeiture(a ReleaseOrForfeitureArgs) *Handle {
	return &Handle{c: c, methodName: "releaseOrForfeiture", callArgs: []interface{}{
		a.CreditBetID,
	}}
}

// WithdrawPlatform sweeps platform USDT to `to`.
func (c *Client) WithdrawPlatform(a WithdrawPlatformArgs) *Handle {
	return &Handle{c: c, methodName: "withdrawPlatform", callArgs: []interface{}{
		a.To, a.Amount,
	}}
}

// SetMaxMarketsPerMatch updates the per-match cap.
func (c *Client) SetMaxMarketsPerMatch(a SetMaxMarketsPerMatchArgs) *Handle {
	return &Handle{c: c, methodName: "setMaxMarketsPerMatch", callArgs: []interface{}{
		a.Max,
	}}
}

// SetRedLightThreshold updates the heavy-side red-light threshold.
func (c *Client) SetRedLightThreshold(a SetRedLightThresholdArgs) *Handle {
	return &Handle{c: c, methodName: "setRedLightThreshold", callArgs: []interface{}{
		a.Threshold,
	}}
}

// SetAdmin rotates the admin role.
func (c *Client) SetAdmin(a SetAdminArgs) *Handle {
	return &Handle{c: c, methodName: "setAdmin", callArgs: []interface{}{
		a.NewAdmin,
	}}
}

// SetLpShareBps updates LP share basis points (0..10_000).
func (c *Client) SetLpShareBps(a SetLpShareBpsArgs) *Handle {
	return &Handle{c: c, methodName: "setLpShareBps", callArgs: []interface{}{
		a.NewBps,
	}}
}

// Pause halts all bet/market operations until Unpause.
func (c *Client) Pause(_ PauseArgs) *Handle {
	return &Handle{c: c, methodName: "pause", callArgs: []interface{}{}}
}

// Unpause lifts a pause.
func (c *Client) Unpause(_ UnpauseArgs) *Handle {
	return &Handle{c: c, methodName: "unpause", callArgs: []interface{}{}}
}

// ExecuteLargeWithdrawal approves and executes a queued large withdrawal.
func (c *Client) ExecuteLargeWithdrawal(a ExecuteLargeWithdrawalArgs) *Handle {
	return &Handle{c: c, methodName: "executeLargeWithdrawal", callArgs: []interface{}{
		a.RequestID,
	}}
}

// RejectLargeWithdrawal rejects a queued large withdrawal.
func (c *Client) RejectLargeWithdrawal(a RejectLargeWithdrawalArgs) *Handle {
	return &Handle{c: c, methodName: "rejectLargeWithdrawal", callArgs: []interface{}{
		a.RequestID,
	}}
}
