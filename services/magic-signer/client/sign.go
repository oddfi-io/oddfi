package client

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"
)

type signRequest struct {
	UserID string `json:"user_id"`
	Digest string `json:"digest"`
}

type signResponse struct {
	Signature string `json:"signature"`
	UserID    string `json:"user_id"`
	Address   string `json:"address"`
	Env       string `json:"env"`
}

// SignDigest asks the magic-signer service to sign a 32-byte digest with the
// private key associated with userID.
//
// Returns r(32) || s(32) || v(1) where v ∈ {27, 28}.
func (c *Client) SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error) {
	payload := signRequest{
		UserID: userID,
		Digest: "0x" + hex.EncodeToString(digest[:]),
	}
	var resp signResponse
	if err := c.doRequest(ctx, "POST", "/v1/wallet/sign", payload, &resp); err != nil {
		return Signature{}, err
	}

	sigHex := strings.TrimPrefix(resp.Signature, "0x")
	if len(sigHex) != 130 {
		return Signature{}, fmt.Errorf("invalid signature length from service: %d hex chars", len(sigHex))
	}
	raw, err := hex.DecodeString(sigHex)
	if err != nil {
		return Signature{}, fmt.Errorf("invalid signature hex: %w", err)
	}
	var sig Signature
	copy(sig[:], raw)
	return sig, nil
}
