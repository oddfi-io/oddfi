// Package magicapi implements the HTTP client that calls Magic TEE Express.
//
// Reference impl: D:\everything_finance\magic_alchmey\internal\magic\client.go
//
// Magic TEE exposes two endpoints we use:
//   - POST /v1/wallet            → returns {"public_address": "0x..."}
//   - POST /v1/wallet/sign/data  → returns {"r": "0x..", "s": "0x..", "v": "0|1"}
//
// All requests require 6 headers (see buildHeaders below).
package magicapi

import (
	"net/http"
)

// buildHeaders assembles the 6 required Magic TEE headers.
//
// Reference: magic_alchmey/internal/magic/client.go:50-58 and 111-119.
func (c *Client) buildHeaders(jwtToken string) http.Header {
	h := http.Header{}
	h.Set("Authorization", "Bearer "+jwtToken)
	h.Set("X-Magic-API-Key", c.apiKey)
	h.Set("X-OIDC-Provider-ID", c.oidcProviderID)
	h.Set("X-Magic-Chain", c.chain)
	h.Set("X-Magic-Referrer", c.referrer)
	h.Set("Content-Type", "application/json")
	return h
}
