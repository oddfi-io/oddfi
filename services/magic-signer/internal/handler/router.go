package handler

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/addrcache"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/auth"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/config"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/jwt"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/magicapi"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/metrics"
)

// Deps bundles everything the router needs to construct handlers.
type Deps struct {
	Env       string
	AuthTable config.AuthTable
	JWTCache  *jwt.Cache
	MagicCli  *magicapi.Client
	AddrCache *addrcache.Cache
	Metrics   *metrics.Registry
	Monitor   HealthMonitor
	Log       *slog.Logger
	GitSHA    string
	BuildTime string
	StartedAt time.Time
}

// NewRouter wires up all middleware + handlers and returns the root mux.
func NewRouter(d Deps) http.Handler {
	mux := http.NewServeMux()

	addrH := &AddressHandler{
		Env: d.Env, JWTCache: d.JWTCache, MagicCli: d.MagicCli,
		AddrCache: d.AddrCache, Metrics: d.Metrics,
	}
	signH := &SignHandler{
		Env: d.Env, JWTCache: d.JWTCache, MagicCli: d.MagicCli,
		AddrCache: d.AddrCache, Metrics: d.Metrics,
	}
	healthH := &HealthHandler{
		Env: d.Env, StartedAt: d.StartedAt, GitSHA: d.GitSHA, Monitor: d.Monitor,
	}
	versionH := &VersionHandler{
		Env: d.Env, GitSHA: d.GitSHA, BuildTime: d.BuildTime,
	}

	onAuthErr := func(w http.ResponseWriter, r *http.Request, status int, code, msg string) {
		writeError(w, r, d.Env, status, code, msg)
	}

	// Op-level wrap.
	addrEndpoint := auth.RequireOp("address", onAuthErr, addrH.Handle)
	signEndpoint := auth.RequireOp("sign", onAuthErr, signH.Handle)

	mux.HandleFunc("POST /v1/wallet/address", addrEndpoint)
	mux.HandleFunc("POST /v1/wallet/sign", signEndpoint)
	mux.HandleFunc("GET /healthz", healthH.Handle)
	mux.HandleFunc("GET /version", versionH.Handle)
	mux.Handle("GET /metrics", d.Metrics.HTTPHandler())

	// Middleware chain (outermost first):
	//   request_id → logging → auth (skipping public paths)
	authMW := auth.Middleware(auth.MiddlewareConfig{
		Table:     d.AuthTable,
		OnError:   onAuthErr,
		SkipPaths: []string{"/healthz", "/version"},
	})
	return RequestIDMiddleware(LoggingMiddleware(d.Env, d.Log)(authMW(mux)))
}
