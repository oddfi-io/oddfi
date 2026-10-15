package client

import (
	"context"
	"fmt"

	"github.com/ethereum/go-ethereum/common"
)

type addressRequest struct {
	UserID string `json:"user_id"`
}

type addressResponse struct {
	Address string `json:"address"`
	UserID  string `json:"user_id"`
	Env     string `json:"env"`
	Cached  bool   `json:"cached"`
}

// WalletAddress returns the Magic-managed EOA address for the given userID.
//
// The service caches addresses, so this call is fast for repeat lookups.
func (c *Client) WalletAddress(ctx context.Context, userID string) (common.Address, error) {
	var resp addressResponse
	if err := c.doRequest(ctx, "POST", "/v1/wallet/address", addressRequest{UserID: userID}, &resp); err != nil {
		return common.Address{}, err
	}
	if !common.IsHexAddress(resp.Address) {
		return common.Address{}, fmt.Errorf("invalid address from service: %q", resp.Address)
	}
	return common.HexToAddress(resp.Address), nil
}
