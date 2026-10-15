package magicapi

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ethereum/go-ethereum/common"
)

type walletResponse struct {
	PublicAddress string `json:"public_address"`
}

// GetOrCreateWallet calls POST /v1/wallet to query/create the EOA address
// for the user identified by the sub claim of jwtToken.
func (c *Client) GetOrCreateWallet(ctx context.Context, jwtToken string) (common.Address, *CallResult, error) {
	result, err := c.doRequest(ctx, jwtToken, "POST", "/v1/wallet", struct{}{})
	if err != nil {
		return common.Address{}, nil, err
	}

	var resp walletResponse
	if err := json.Unmarshal(result.Body, &resp); err != nil {
		return common.Address{}, result, fmt.Errorf("%w: %v", ErrInvalidResponse, err)
	}
	if !common.IsHexAddress(resp.PublicAddress) {
		return common.Address{}, result, fmt.Errorf("%w: invalid address %q", ErrInvalidResponse, resp.PublicAddress)
	}
	return common.HexToAddress(resp.PublicAddress), result, nil
}
