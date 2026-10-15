package admin

import (
	"context"

	"github.com/ethereum/go-ethereum/core/types"
)

// CreditDeposit credits `amount` USDT to `user`'s in-contract balance.
//
// txHash should be the off-chain deposit tx hash; the contract enforces
// at-most-once semantics on this value.
func (c *Client) CreditDeposit(ctx context.Context, a CreditDepositArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.CreditDeposit(opts, a.User, a.Amount, a.TxHash)
	if err != nil {
		return nil, c.wrapWriteErr(err, "creditDeposit")
	}
	return tx, nil
}

// SimulateCreditDeposit eth_call dry-run.
func (c *Client) SimulateCreditDeposit(ctx context.Context, a CreditDepositArgs) error {
	return c.simulateCall(ctx, "creditDeposit", a.User, a.Amount, a.TxHash)
}
