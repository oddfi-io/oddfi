package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/addrcache"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/jwt"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/magicapi"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/metrics"
)

// AddressHandler serves POST /v1/wallet/address.
type AddressHandler struct {
	Env       string
	JWTCache  *jwt.Cache
	MagicCli  *magicapi.Client
	AddrCache *addrcache.Cache
	Metrics   *metrics.Registry
}

type addressRequest struct {
	UserID string `json:"user_id"`
}

type addressResponse struct {
	Address   string `json:"address"`
	UserID    string `json:"user_id"`
	Env       string `json:"env"`
	Cached    bool   `json:"cached"`
	RequestID string `json:"request_id"`
}

// Handle implements the address lookup endpoint.
func (h *AddressHandler) Handle(w http.ResponseWriter, r *http.Request) {
	var req addressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, h.Env, http.StatusBadRequest, "BAD_REQUEST", "malformed JSON body")
		return
	}
	req.UserID = strings.TrimSpace(req.UserID)
	if req.UserID == "" {
		writeError(w, r, h.Env, http.StatusBadRequest, "USER_ID_REQUIRED", "user_id must be non-empty")
		return
	}
	if len(req.UserID) > 128 {
		writeError(w, r, h.Env, http.StatusBadRequest, "USER_ID_TOO_LONG", "user_id exceeds 128 chars")
		return
	}

	setLogExtra(r.Context(), logExtra{Op: "address", UserID: req.UserID})

	// 1. Try cache.
	if addr, ok := h.AddrCache.Get(req.UserID); ok {
		h.Metrics.AddrCacheHit(h.Env)
		setLogExtra(r.Context(), logExtra{Cached: true, Address: addr.Hex(), Result: "success"})
		writeJSON(w, http.StatusOK, addressResponse{
			Address:   addr.Hex(),
			UserID:    req.UserID,
			Env:       h.Env,
			Cached:    true,
			RequestID: requestIDFromCtx(r.Context()),
		})
		return
	}
	h.Metrics.AddrCacheMiss(h.Env)

	// 2. Mint JWT.
	jwtToken, err := h.JWTCache.Get(req.UserID)
	if err != nil {
		writeError(w, r, h.Env, http.StatusInternalServerError, "INTERNAL_ERROR", "JWT mint failed: "+err.Error())
		return
	}

	// 3. Call Magic.
	addr, callRes, err := h.MagicCli.GetOrCreateWallet(r.Context(), jwtToken)
	if callRes != nil {
		setLogExtra(r.Context(), logExtra{
			MagicLatencyMs: callRes.UpstreamLatency.Milliseconds(),
			MagicStatus:    callRes.StatusCode,
		})
		h.Metrics.ObserveMagicLatency(h.Env, "address", callRes.UpstreamLatency.Seconds())
	}
	if err != nil {
		status, code, msg := mapMagicAPIError(err)
		h.Metrics.MagicAPIError(h.Env, code)
		writeError(w, r, h.Env, status, code, msg)
		return
	}

	// 4. Cache and respond.
	h.AddrCache.Put(req.UserID, addr)
	setLogExtra(r.Context(), logExtra{Cached: false, Address: addr.Hex(), Result: "success"})
	writeJSON(w, http.StatusOK, addressResponse{
		Address:   addr.Hex(),
		UserID:    req.UserID,
		Env:       h.Env,
		Cached:    false,
		RequestID: requestIDFromCtx(r.Context()),
	})
}
