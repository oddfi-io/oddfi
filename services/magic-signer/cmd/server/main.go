// magic-signer is a minimal HTTP service that fronts Magic TEE Express,
// providing internal callers with WalletAddress and SignDigest endpoints
// scoped to a single environment (prod or test).
//
// All configuration is loaded from environment variables; see ../../DESIGN.md.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/addrcache"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/config"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/handler"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/healthcheck"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/jwt"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/magicapi"
	"github.com/Crypto-Barrett/oddfi-magic-client/internal/metrics"
)

// Set by linker flags at build time:
//
//	go build -ldflags "-X main.gitSHA=$(git rev-parse HEAD) -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
var (
	gitSHA    = "dev"
	buildTime = "unknown"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	// Best-effort .env loading for local dev. In production, env vars come
	// from K8s Secret + ConfigMap; .env file should be absent.
	_ = godotenv.Load()

	cfg, err := config.LoadFromEnv()
	if err != nil {
		log.Error("config load failed", "err", err.Error())
		os.Exit(1)
	}

	startedAt := time.Now()
	log.Info("magic-signer starting",
		"env", string(cfg.Env),
		"listen", cfg.ListenAddr,
		"git_sha", gitSHA,
		"build_time", buildTime,
		"oidc_provider_id_prefix", safePrefix(cfg.MagicAPI.OIDCProviderID, 8),
		"magic_api_key_prefix", safePrefix(cfg.MagicAPI.APIKey, 10),
		"callers", cfg.AuthTable.CallerNames(),
		"magic_endpoint", cfg.MagicAPI.Endpoint,
		"jwt_lifetime", cfg.JWTLifetime.String(),
		"addr_cache_ttl", cfg.AddressCacheTTL.String(),
		"max_retries", cfg.MagicAPI.MaxRetries,
	)

	// Build collaborators.
	jwtMinter := jwt.NewMinter(jwt.MintConfig{
		PrivateKey: cfg.OIDC.PrivateKey,
		Kid:        cfg.OIDC.Kid,
		Issuer:     cfg.OIDC.Issuer,
		Audience:   cfg.OIDC.Audience,
		Lifetime:   cfg.JWTLifetime,
	})
	jwtCache := jwt.NewCache(string(cfg.Env), jwtMinter, cfg.JWTRefreshSafety)

	magicCli := magicapi.New(magicapi.ClientConfig{
		APIKey:         cfg.MagicAPI.APIKey,
		OIDCProviderID: cfg.MagicAPI.OIDCProviderID,
		Referrer:       cfg.MagicAPI.Referrer,
		Chain:          cfg.MagicAPI.Chain,
		Endpoint:       cfg.MagicAPI.Endpoint,
		Timeout:        cfg.MagicAPI.Timeout,
		MaxRetries:     cfg.MagicAPI.MaxRetries,
		RetryBaseDelay: cfg.MagicAPI.RetryBaseDelay,
	})

	addrCache := addrcache.New(string(cfg.Env), cfg.AddressCacheTTL, cfg.AddressCacheMax)

	metricsReg := metrics.NewRegistry(string(cfg.Env))

	monitor := healthcheck.New(magicCli, jwtCache, "magic-signer-healthcheck", cfg.HealthInterval)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go monitor.Start(ctx)

	mux := handler.NewRouter(handler.Deps{
		Env:       string(cfg.Env),
		AuthTable: cfg.AuthTable,
		JWTCache:  jwtCache,
		MagicCli:  magicCli,
		AddrCache: addrCache,
		Metrics:   metricsReg,
		Monitor:   monitor,
		Log:       log,
		GitSHA:    gitSHA,
		BuildTime: buildTime,
		StartedAt: startedAt,
	})

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Graceful shutdown.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-sigCh
		log.Info("shutdown signal received")
		shCtx, shCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer shCancel()
		if err := srv.Shutdown(shCtx); err != nil {
			log.Error("shutdown error", "err", err.Error())
		}
		cancel() // stops the health monitor
	}()

	log.Info("listening", "addr", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("listen failed", "err", err.Error())
		os.Exit(1)
	}
	log.Info("magic-signer stopped cleanly")
}

func safePrefix(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
