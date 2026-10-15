package handler

import (
	"encoding/json"
	"net/http"
	"runtime/debug"
	"time"
)

// HealthMonitor tracks whether Magic is reachable. Implementation in
// internal/healthcheck, but the handler accepts the interface so we can mock.
type HealthMonitor interface {
	Reachable() bool
	LastCheck() time.Time
}

// HealthHandler serves GET /healthz (no auth).
type HealthHandler struct {
	Env       string
	StartedAt time.Time
	GitSHA    string
	Monitor   HealthMonitor
}

type healthResponse struct {
	Status            string `json:"status"`
	Env               string `json:"env"`
	UptimeSeconds     int64  `json:"uptime_seconds"`
	GitSHA            string `json:"git_sha"`
	MagicReachable    bool   `json:"magic_reachable"`
	LastMagicCheckAt  string `json:"last_magic_check_at"`
}

func (h *HealthHandler) Handle(w http.ResponseWriter, r *http.Request) {
	reachable := false
	last := time.Time{}
	if h.Monitor != nil {
		reachable = h.Monitor.Reachable()
		last = h.Monitor.LastCheck()
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(healthResponse{
		Status:            "ok",
		Env:               h.Env,
		UptimeSeconds:     int64(time.Since(h.StartedAt).Seconds()),
		GitSHA:            h.GitSHA,
		MagicReachable:    reachable,
		LastMagicCheckAt:  formatTimeOrEmpty(last),
	})
}

// VersionHandler serves GET /version (no auth).
type VersionHandler struct {
	Env       string
	GitSHA    string
	BuildTime string
}

type versionResponse struct {
	GitSHA    string `json:"git_sha"`
	BuildTime string `json:"build_time"`
	Env       string `json:"env"`
	GoVersion string `json:"go_version"`
}

func (h *VersionHandler) Handle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	goVer := ""
	if bi, ok := debug.ReadBuildInfo(); ok {
		goVer = bi.GoVersion
	}
	_ = json.NewEncoder(w).Encode(versionResponse{
		GitSHA:    h.GitSHA,
		BuildTime: h.BuildTime,
		Env:       h.Env,
		GoVersion: goVer,
	})
}

func formatTimeOrEmpty(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}
