package handler

import (
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/addrcache"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/jwt"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/magicapi"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/metrics"
)

// SignHandler serves POST /v1/wallet/sign.
type SignHandler struct {
	Env       string
	JWTCache  *jwt.Cache
	MagicCli  *magicapi.Client
	AddrCache *addrcache.Cache
	Metrics   *metrics.Registry
}

type signRequest struct {
	UserID string `json:"user_id"`
	Digest string `json:"digest"`
}

type signResponse struct {
	Signature string `json:"signature"`
	UserID    string `json:"user_id"`
	Address   string `json:"address"`
	Env       string `json:"env"`
	RequestID string `json:"request_id"`
}

// Handle implements the digest signing endpoint.
func (h *SignHandler) Handle(w http.ResponseWriter, r *http.Request) {
	var req signRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, h.Env, http.StatusBadRequest, "BAD_REQUEST", "malformed JSON body")
		return
	}
	req.UserID = strings.TrimSpace(req.UserID)
	req.Digest = strings.TrimSpace(req.Digest)

	if req.UserID == "" {
		writeError(w, r, h.Env, http.StatusBadRequest, "USER_ID_REQUIRED", "user_id must be non-empty")
		return
	}
	if len(req.UserID) > 128 {
		writeError(w, r, h.Env, http.StatusBadRequest, "USER_ID_TOO_LONG", "user_id exceeds 128 chars")
		return
	}
	if req.Digest == "" {
		writeError(w, r, h.Env, http.StatusBadRequest, "DIGEST_REQUIRED", "digest must be non-empty")
		return
	}

	digestBytes, ok := parseDigest(req.Digest)
	if !ok {
		writeError(w, r, h.Env, http.StatusBadRequest, "DIGEST_FORMAT", "digest must be 0x + 64 hex chars (32 bytes)")
		return
	}

	setLogExtra(r.Context(), logExtra{
		Op:           "sign",
		UserID:       req.UserID,
		DigestPrefix: "0x" + hex.EncodeToString(digestBytes[:4]),
	})

	// 1. Mint JWT.
	jwtToken, err := h.JWTCache.Get(req.UserID)
	if err != nil {
		writeError(w, r, h.Env, http.StatusInternalServerError, "INTERNAL_ERROR", "JWT mint failed: "+err.Error())
		return
	}

	// 2. Call Magic to sign.
	sig, callRes, err := h.MagicCli.SignData(r.Context(), jwtToken, digestBytes)
	if callRes != nil {
		setLogExtra(r.Context(), logExtra{
			MagicLatencyMs: callRes.UpstreamLatency.Milliseconds(),
			MagicStatus:    callRes.StatusCode,
			// Verbatim Magic response body — full content, for diagnosing
			// contract drift (e.g. a 200 whose {r,s,v} shape changed).
			MagicRawResponse: string(callRes.Body),
		})
		h.Metrics.ObserveMagicLatency(h.Env, "sign", callRes.UpstreamLatency.Seconds())
	}
	if err != nil {
		status, code, msg := mapMagicAPIError(err)
		// Record the full underlying error (includes the body preview that
		// SignData attaches) so the access log shows exactly why parsing failed.
		setLogExtra(r.Context(), logExtra{ErrorDetail: err.Error()})
		h.Metrics.MagicAPIError(h.Env, code)
		writeError(w, r, h.Env, status, code, msg)
		return
	}

	// 3. Resolve the address for inclusion in response (helpful sanity check
	//    for callers; we use the addrcache, so this is free if hot).
	addrHex := ""
	if addr, ok := h.AddrCache.Get(req.UserID); ok {
		addrHex = addr.Hex()
	} else {
		// Not fatal — sign worked. We could look it up but skip to avoid
		// extra Magic call inside sign path.
		addrHex = ""
	}

	setLogExtra(r.Context(), logExtra{Address: addrHex, Result: "success"})
	writeJSON(w, http.StatusOK, signResponse{
		Signature: "0x" + hex.EncodeToString(sig[:]),
		UserID:    req.UserID,
		Address:   addrHex,
		Env:       h.Env,
		RequestID: requestIDFromCtx(r.Context()),
	})
}

// parseDigest accepts "0x" + 64 hex chars and returns the 32-byte digest.
func parseDigest(s string) ([32]byte, bool) {
	var out [32]byte
	if !strings.HasPrefix(s, "0x") && !strings.HasPrefix(s, "0X") {
		return out, false
	}
	rest := s[2:]
	if len(rest) != 64 {
		return out, false
	}
	b, err := hex.DecodeString(rest)
	if err != nil {
		return out, false
	}
	copy(out[:], b)
	return out, true
}

// silence unused common import warning when this file is read in isolation
var _ = common.Address{}
