// Package config loads and validates magic-signer service configuration
// strictly from environment variables.
//
// All configuration MUST come from env vars (or a .env file loaded by godotenv
// in development only). Production deployments inject env vars via K8s Secret
// + ConfigMap; no config files are read at runtime.
package config

import (
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Env represents the deployment environment.
type Env string

const (
	EnvProd Env = "prod"
	EnvTest Env = "test"
)

// Config is the fully resolved, validated configuration.
type Config struct {
	Env        Env
	ListenAddr string

	MagicAPI MagicAPIConfig
	OIDC     OIDCConfig

	JWTLifetime       time.Duration
	JWTRefreshSafety  time.Duration
	AddressCacheTTL   time.Duration
	AddressCacheMax   int
	HealthInterval    time.Duration
	LogLevel          string

	AuthTable AuthTable
}

// MagicAPIConfig is everything needed to call Magic TEE.
type MagicAPIConfig struct {
	APIKey         string
	OIDCProviderID string
	Referrer       string
	Chain          string
	Endpoint       string
	Timeout        time.Duration
	MaxRetries     int
	RetryBaseDelay time.Duration
}

// OIDCConfig is everything needed to mint OIDC JWTs for Magic.
type OIDCConfig struct {
	PrivateKey *rsa.PrivateKey
	Kid        string
	Issuer     string
	Audience   string
}

// AuthTable maps token-sha256 -> caller info.
type AuthTable struct {
	entries map[string]CallerInfo // key: sha256 hex of token
}

// CallerInfo identifies a calling service.
type CallerInfo struct {
	Name       string
	AllowedOps []string // empty = all ops allowed
}

// Lookup returns the caller for a given raw token. ok=false if not found.
func (t AuthTable) Lookup(rawToken string) (CallerInfo, bool) {
	sum := sha256.Sum256([]byte(rawToken))
	info, ok := t.entries[hex.EncodeToString(sum[:])]
	return info, ok
}

// CallerNames returns sorted caller names for logging.
func (t AuthTable) CallerNames() []string {
	names := make([]string, 0, len(t.entries))
	for _, e := range t.entries {
		names = append(names, e.Name)
	}
	return names
}

// HasOp returns true if the caller is allowed to perform op.
func (c CallerInfo) HasOp(op string) bool {
	if len(c.AllowedOps) == 0 {
		return true
	}
	for _, allowed := range c.AllowedOps {
		if allowed == op {
			return true
		}
	}
	return false
}

// LoadFromEnv reads all configuration from environment variables and validates it.
// Returns the fully resolved Config or an error describing the first validation failure.
func LoadFromEnv() (*Config, error) {
	cfg := &Config{
		ListenAddr:       getEnvOrDefault("LISTEN_ADDR", ":8443"),
		JWTLifetime:      mustParseDuration("JWT_LIFETIME", "30m"),
		JWTRefreshSafety: mustParseDuration("JWT_REFRESH_SAFETY", "1m"),
		AddressCacheTTL:  mustParseDuration("ADDR_CACHE_TTL", "24h"),
		AddressCacheMax:  mustParseInt("ADDR_CACHE_MAX", 100000),
		HealthInterval:   mustParseDuration("HEALTH_CHECK_INTERVAL", "30s"),
		LogLevel:         getEnvOrDefault("LOG_LEVEL", "info"),
	}

	// APP_ENV strict validation
	envStr := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	switch envStr {
	case "prod":
		cfg.Env = EnvProd
	case "test":
		cfg.Env = EnvTest
	default:
		return nil, fmt.Errorf("APP_ENV must be 'prod' or 'test', got %q", envStr)
	}

	// Magic API config
	cfg.MagicAPI = MagicAPIConfig{
		APIKey:         strings.TrimSpace(os.Getenv("MAGIC_API_KEY")),
		OIDCProviderID: strings.TrimSpace(os.Getenv("MAGIC_OIDC_PROVIDER_ID")),
		Referrer:       strings.TrimSpace(os.Getenv("MAGIC_REFERRER")),
		Chain:          getEnvOrDefault("MAGIC_CHAIN", "ETH"),
		Endpoint:       getEnvOrDefault("MAGIC_ENDPOINT", "https://tee.express.magiclabs.com"),
		Timeout:        mustParseDuration("MAGIC_TIMEOUT", "5s"),
		MaxRetries:     mustParseInt("MAGIC_MAX_RETRIES", 3),
		RetryBaseDelay: mustParseDuration("MAGIC_RETRY_BASE_DELAY", "200ms"),
	}

	// OIDC config
	oidcKey, err := loadRSAFromEnv("OIDC_PRIVATE_KEY_PEM")
	if err != nil {
		return nil, fmt.Errorf("OIDC_PRIVATE_KEY_PEM: %w", err)
	}
	cfg.OIDC = OIDCConfig{
		PrivateKey: oidcKey,
		Kid:        strings.TrimSpace(os.Getenv("OIDC_KID")),
		Issuer:     strings.TrimSpace(os.Getenv("OIDC_ISSUER")),
		Audience:   strings.TrimSpace(os.Getenv("OIDC_AUDIENCE")),
	}

	// Auth table from CALLER_TOKEN_* env vars
	table, err := loadAuthTableFromEnv()
	if err != nil {
		return nil, fmt.Errorf("auth table: %w", err)
	}
	cfg.AuthTable = table

	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// Validate runs all strict checks. Returns the first error found.
func (c *Config) Validate() error {
	// 1. APP_ENV / API key prefix interlock (防止生产用测试 key)
	if err := validateEnvKeyInterlock(c.Env, c.MagicAPI.APIKey); err != nil {
		return err
	}

	// 2. Listen addr safety
	if isPublicListenAddr(c.ListenAddr) && os.Getenv("ALLOW_PUBLIC_LISTEN") != "1" {
		return fmt.Errorf("LISTEN_ADDR %q binds to public interface; set ALLOW_PUBLIC_LISTEN=1 to override", c.ListenAddr)
	}

	// 3. Magic API
	if c.MagicAPI.APIKey == "" {
		return errors.New("MAGIC_API_KEY is required")
	}
	if c.MagicAPI.OIDCProviderID == "" {
		return errors.New("MAGIC_OIDC_PROVIDER_ID is required")
	}
	if c.MagicAPI.Referrer == "" {
		return errors.New("MAGIC_REFERRER is required")
	}
	if _, err := url.Parse(c.MagicAPI.Referrer); err != nil {
		return fmt.Errorf("MAGIC_REFERRER invalid URL: %w", err)
	}
	if c.MagicAPI.MaxRetries < 0 || c.MagicAPI.MaxRetries > 10 {
		return fmt.Errorf("MAGIC_MAX_RETRIES must be in [0, 10], got %d", c.MagicAPI.MaxRetries)
	}

	// 4. OIDC
	if c.OIDC.PrivateKey == nil {
		return errors.New("OIDC_PRIVATE_KEY_PEM failed to parse")
	}
	if c.OIDC.PrivateKey.N.BitLen() < 2048 {
		return fmt.Errorf("OIDC private key must be >= 2048 bits, got %d", c.OIDC.PrivateKey.N.BitLen())
	}
	if c.OIDC.Kid == "" {
		return errors.New("OIDC_KID is required")
	}
	if c.OIDC.Issuer == "" {
		return errors.New("OIDC_ISSUER is required")
	}
	if u, err := url.Parse(c.OIDC.Issuer); err != nil || u.Scheme != "https" {
		return fmt.Errorf("OIDC_ISSUER must be a valid https URL, got %q", c.OIDC.Issuer)
	}
	if c.OIDC.Audience == "" {
		return errors.New("OIDC_AUDIENCE is required")
	}

	// 5. Auth table
	if len(c.AuthTable.entries) == 0 {
		return errors.New("at least one CALLER_TOKEN_* env var must be set")
	}

	// 6. Cache sanity
	if c.AddressCacheMax <= 0 {
		return fmt.Errorf("ADDR_CACHE_MAX must be > 0, got %d", c.AddressCacheMax)
	}
	if c.JWTLifetime < 1*time.Minute {
		return fmt.Errorf("JWT_LIFETIME must be >= 1m, got %s", c.JWTLifetime)
	}
	if c.JWTRefreshSafety >= c.JWTLifetime {
		return fmt.Errorf("JWT_REFRESH_SAFETY (%s) must be < JWT_LIFETIME (%s)", c.JWTRefreshSafety, c.JWTLifetime)
	}

	return nil
}

// ─── helpers ──────────────────────────────────────────────────────────────

func getEnvOrDefault(key, def string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	return v
}

func mustParseDuration(key, def string) time.Duration {
	v := getEnvOrDefault(key, def)
	d, err := time.ParseDuration(v)
	if err != nil {
		// parsing failure here means programmer error in default; we return zero
		// and let Validate() catch the consequence (e.g. JWTLifetime check)
		return 0
	}
	return d
}

func mustParseInt(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return -1 // negative triggers validation error downstream
	}
	return n
}

func loadRSAFromEnv(key string) (*rsa.PrivateKey, error) {
	pemStr := strings.TrimSpace(os.Getenv(key))
	if pemStr == "" {
		return nil, errors.New("not set")
	}
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("invalid PEM data")
	}

	// Try PKCS8 first (most common), fall back to PKCS1.
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("key is not RSA")
		}
		return rsaKey, nil
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("failed to parse as PKCS8 or PKCS1")
}

func loadAuthTableFromEnv() (AuthTable, error) {
	table := AuthTable{entries: map[string]CallerInfo{}}

	for _, kv := range os.Environ() {
		idx := strings.IndexByte(kv, '=')
		if idx < 0 {
			continue
		}
		key := kv[:idx]
		val := strings.TrimSpace(kv[idx+1:])

		if !strings.HasPrefix(key, "CALLER_TOKEN_") {
			continue
		}
		nameSuffix := strings.TrimPrefix(key, "CALLER_TOKEN_")
		if nameSuffix == "" || val == "" {
			continue
		}

		// Validate sha256 hex format (64 chars, [0-9a-f])
		if len(val) != 64 {
			return AuthTable{}, fmt.Errorf("%s value must be 64-char sha256 hex, got len %d", key, len(val))
		}
		if _, err := hex.DecodeString(val); err != nil {
			return AuthTable{}, fmt.Errorf("%s value is not valid hex: %w", key, err)
		}

		callerName := strings.ToLower(strings.ReplaceAll(nameSuffix, "_", "-"))

		// Load allowed ops if set
		opsKey := "CALLER_OPS_" + nameSuffix
		opsStr := strings.TrimSpace(os.Getenv(opsKey))
		var ops []string
		if opsStr != "" {
			for _, o := range strings.Split(opsStr, ",") {
				o = strings.TrimSpace(o)
				if o != "" {
					ops = append(ops, o)
				}
			}
		}

		table.entries[strings.ToLower(val)] = CallerInfo{
			Name:       callerName,
			AllowedOps: ops,
		}
	}

	return table, nil
}
