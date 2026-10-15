package magicapi

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
)

type signDataRequest struct {
	RawDataHash string `json:"raw_data_hash"`
}

type signatureResponse struct {
	R string `json:"r"`
	S string `json:"s"`
	V string `json:"v"`
}

// Signature is the canonical 65-byte ECDSA signature: r(32) || s(32) || v(1)
// where v ∈ {27, 28} (EIP-155 v, suitable for OZ ECDSA.recover and similar).
type Signature [65]byte

// SignData calls POST /v1/wallet/sign/data to sign the 32-byte digest.
//
// Magic returns r and s as big-integer strings — decimal by default, or
// 0x-prefixed hex — and v either as parity ("0"/"1") or already in EIP-155
// form ("27"/"28"). This function normalizes all of these to a canonical
// 65-byte signature with v ∈ {27, 28}.
func (c *Client) SignData(ctx context.Context, jwtToken string, digest [32]byte) (Signature, *CallResult, error) {
	payload := signDataRequest{
		RawDataHash: "0x" + hex.EncodeToString(digest[:]),
	}
	result, err := c.doRequest(ctx, jwtToken, "POST", "/v1/wallet/sign/data", payload)
	if err != nil {
		return Signature{}, nil, err
	}

	// bodyPreview is attached to every parse/validation failure so the
	// access log can show exactly what Magic returned on a 200 (the most
	// common cause of a spurious 502 MAGIC_API_ERROR is a contract drift
	// in this body shape).
	bodyPreview := truncate(string(result.Body), 512)

	var resp signatureResponse
	if err := json.Unmarshal(result.Body, &resp); err != nil {
		return Signature{}, result, fmt.Errorf("%w: json unmarshal: %v (status=%d body=%q)", ErrInvalidResponse, err, result.StatusCode, bodyPreview)
	}

	rBytes, ok := decodeScalar32(resp.R)
	if !ok {
		return Signature{}, result, fmt.Errorf("%w: r=%q is not a 256-bit integer (body=%q)", ErrInvalidResponse, resp.R, bodyPreview)
	}
	sBytes, ok := decodeScalar32(resp.S)
	if !ok {
		return Signature{}, result, fmt.Errorf("%w: s=%q is not a 256-bit integer (body=%q)", ErrInvalidResponse, resp.S, bodyPreview)
	}

	vByte, ok := normalizeV(resp.V)
	if !ok {
		return Signature{}, result, fmt.Errorf("%w: v=%q, expected 0/1 (parity) or 27/28 (EIP-155) (body=%q)", ErrInvalidResponse, resp.V, bodyPreview)
	}

	var sig Signature
	copy(sig[0:32], rBytes[:])
	copy(sig[32:64], sBytes[:])
	sig[64] = vByte

	return sig, result, nil
}

// decodeScalar32 parses a signature scalar (r or s) that Magic may send as a
// decimal integer string (current contract) or a 0x-prefixed hex string
// (legacy), returning it right-aligned and zero-padded to 32 bytes.
// ok is false for empty, negative, malformed, or >256-bit values.
func decodeScalar32(s string) ([32]byte, bool) {
	var out [32]byte
	s = strings.TrimSpace(s)
	if s == "" {
		return out, false
	}

	n := new(big.Int)
	var parsed bool
	if len(s) >= 2 && (s[:2] == "0x" || s[:2] == "0X") {
		_, parsed = n.SetString(s[2:], 16)
	} else {
		_, parsed = n.SetString(s, 10)
	}
	if !parsed || n.Sign() < 0 || n.BitLen() > 256 {
		return out, false
	}

	n.FillBytes(out[:]) // big-endian, right-aligned into the 32-byte buffer
	return out, true
}

// normalizeV maps Magic's recovery id to the canonical EIP-155 byte (27 or 28).
// It accepts both parity form ("0"/"1") and already-EIP-155 form ("27"/"28").
func normalizeV(v string) (byte, bool) {
	vInt, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil {
		return 0, false
	}
	switch vInt {
	case 0, 1:
		return byte(0x1b + vInt), true // 27 + parity
	case 27, 28:
		return byte(vInt), true
	default:
		return 0, false
	}
}
