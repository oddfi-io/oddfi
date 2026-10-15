package signer

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
)

// AutoOpts configures NewAuto's resolution order.
type AutoOpts struct {
	// EnvVar names the environment variable to consult on testnet
	// (the literal name; no leading "$"). Required.
	EnvVar string

	// FilePath names the secret file to read on mainnet (and as the
	// testnet fallback if EnvVar is empty). Required.
	FilePath string

	// Logger receives source-selection lines. Defaults to slog.Default().
	Logger *slog.Logger
}

// IsMainnetCheck is the predicate NewAuto uses to enforce mainnet safety.
// Connection.Env().IsMainnet() satisfies this; tests can substitute.
type IsMainnetCheck interface {
	IsMainnet() bool
}

// NewAuto picks a key source for the given environment:
//
//   - Testnet: env var first (if non-empty), file as fallback
//   - Mainnet: file ONLY. If the env var is set, return an error rather
//     than risk reading a misplaced testnet key on mainnet.
//
// The intended caller is `signer.NewAuto(conn, AutoOpts{...})` where conn is
// a *client.Connection.
func NewAuto(env IsMainnetCheck, opts AutoOpts) (Signer, error) {
	if env == nil {
		return nil, errors.New("signer: NewAuto: env must not be nil")
	}
	if opts.EnvVar == "" {
		return nil, errors.New("signer: NewAuto: AutoOpts.EnvVar required")
	}
	if opts.FilePath == "" {
		return nil, errors.New("signer: NewAuto: AutoOpts.FilePath required")
	}
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}

	envVal, envSet := os.LookupEnv(opts.EnvVar)

	if env.IsMainnet() {
		// Mainnet: env var is forbidden, period. Even if non-empty.
		if envSet {
			return nil, fmt.Errorf("signer: NewAuto: env var %q set on mainnet (forbidden); use file %q instead",
				opts.EnvVar, opts.FilePath)
		}
		s, err := NewFromSecretFile(opts.FilePath)
		if err != nil {
			return nil, err
		}
		logger.Info("signer.local loaded", "source", "file", "path", opts.FilePath, "addr", redactAddr(s.Address().Hex()))
		return s, nil
	}

	// Testnet: env > file
	if envSet && envVal != "" {
		s, err := NewFromHex(envVal)
		if err != nil {
			return nil, err
		}
		// Best-effort scrub: caller may also Unsetenv themselves.
		_ = os.Unsetenv(opts.EnvVar)
		logger.Info("signer.local loaded", "source", "env", "var", opts.EnvVar, "addr", redactAddr(s.Address().Hex()))
		return s, nil
	}
	s, err := NewFromSecretFile(opts.FilePath)
	if err != nil {
		return nil, err
	}
	logger.Info("signer.local loaded", "source", "file", "path", opts.FilePath, "addr", redactAddr(s.Address().Hex()))
	return s, nil
}

// redactAddr returns 0x prefix + 4 leading + ... + 4 trailing hex chars,
// suitable for logs (uniquely identifying without printing the full address).
func redactAddr(hex string) string {
	if len(hex) < 14 {
		return hex
	}
	return hex[:6] + "…" + hex[len(hex)-4:]
}
