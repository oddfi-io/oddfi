package jwt

import (
	"errors"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token has expired")
)

type Claims struct {
	UserID  string `json:"user_id"`
	Address string `json:"address"`
	TokenID string `json:"jti"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secret []byte
}

var (
	manager  *JWTManager
	initOnce sync.Once
)

func Init(secret string) *JWTManager {
	initOnce.Do(func() {
		manager = &JWTManager{secret: []byte(secret)}
	})
	return manager
}

func GetJWTManager() *JWTManager {
	if manager == nil {
		panic("jwt manager not initialized, call Init() first")
	}
	return manager
}

func NewJWTManager(secret string) *JWTManager {
	return &JWTManager{
		secret: []byte(secret),
	}
}

func (m *JWTManager) GenerateToken(userID string, address string, expiry time.Duration) (string, string, error) {
	tokenID := uuid.New().String()
	now := time.Now()

	claims := &Claims{
		UserID:  userID,
		Address: address,
		TokenID: tokenID,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(expiry)),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(m.secret)
	if err != nil {
		return "", "", err
	}

	return tokenString, tokenID, nil
}

func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
