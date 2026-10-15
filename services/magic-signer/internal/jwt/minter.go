// Package jwt mints and caches OIDC JWTs used to authenticate to Magic TEE.
//
// Magic TEE accepts a Bearer token signed by an OIDC provider registered in
// the Magic dashboard. The provider is identified by the JWKS we publish, and
// each user is identified by the JWT's `sub` claim.
//
// The minter creates a fresh RS256 JWT per call; the Cache memoizes it per
// userID with a safety margin before expiry.
package jwt

import (
	"crypto/rsa"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// MintConfig is everything Minter needs to sign a JWT.
type MintConfig struct {
	PrivateKey *rsa.PrivateKey
	Kid        string
	Issuer     string
	Audience   string
	Lifetime   time.Duration
}

// Minter signs OIDC RS256 JWTs.
type Minter struct {
	cfg MintConfig
}

// NewMinter creates a Minter. Caller must have validated the config.
func NewMinter(cfg MintConfig) *Minter {
	return &Minter{cfg: cfg}
}

// Mint signs a fresh JWT for the given userID.
//
// Claims:
//   - sub: userID
//   - aud: cfg.Audience
//   - iss: cfg.Issuer
//   - iat: now
//   - exp: now + cfg.Lifetime
//
// Header:
//   - kid: cfg.Kid (Magic uses this to look up the public key in JWKS)
//   - alg: RS256
//
// Returns the signed JWT string and its absolute expiry time.
func (m *Minter) Mint(userID string) (token string, expiresAt time.Time, err error) {
	if userID == "" {
		return "", time.Time{}, fmt.Errorf("userID is empty")
	}
	now := time.Now()
	expiresAt = now.Add(m.cfg.Lifetime)

	t := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": userID,
		"aud": m.cfg.Audience,
		"iss": m.cfg.Issuer,
		"iat": now.Unix(),
		"exp": expiresAt.Unix(),
	})
	t.Header["kid"] = m.cfg.Kid

	signed, err := t.SignedString(m.cfg.PrivateKey)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign JWT: %w", err)
	}
	return signed, expiresAt, nil
}
