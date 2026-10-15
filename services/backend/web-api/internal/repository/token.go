package repository

import (
	"context"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/pkg/redis"
)

const (
	refreshTokenPrefix = "refresh_token:"
	blacklistPrefix    = "token_blacklist:"
)

type TokenRepo interface {
	StoreRefreshToken(ctx context.Context, userID string, tokenID, token string, expiry time.Duration) error
	ValidateRefreshToken(ctx context.Context, userID string, token string) (bool, error)
	RevokeRefreshToken(ctx context.Context, userID string, token string) error
	RevokeAllUserTokens(ctx context.Context, userID string) error
	RevokeAccessToken(ctx context.Context, tokenID string, expiry time.Duration) error
	IsAccessTokenRevoked(ctx context.Context, tokenID string) (bool, error)
}

type tokenRepo struct {
	rdb *redis.Client
}

func NewTokenRepo(rdb *redis.Client) TokenRepo {
	return &tokenRepo{rdb: rdb}
}

func (r *tokenRepo) refreshTokenKey(userID string) string {
	return fmt.Sprintf("%s%s", refreshTokenPrefix, userID)
}

func (r *tokenRepo) blacklistKey(tokenID string) string {
	return fmt.Sprintf("%s%s", blacklistPrefix, tokenID)
}

func (r *tokenRepo) StoreRefreshToken(ctx context.Context, userID string, tokenID, token string, expiry time.Duration) error {
	key := r.refreshTokenKey(userID)
	return r.rdb.Set(ctx, key, token, expiry)
}

func (r *tokenRepo) ValidateRefreshToken(ctx context.Context, userID string, token string) (bool, error) {
	key := r.refreshTokenKey(userID)
	storedToken, err := r.rdb.Get(ctx, key)
	if err != nil {
		return false, nil
	}
	return storedToken == token, nil
}

func (r *tokenRepo) RevokeRefreshToken(ctx context.Context, userID string, token string) error {
	key := r.refreshTokenKey(userID)
	return r.rdb.Del(ctx, key)
}

func (r *tokenRepo) RevokeAllUserTokens(ctx context.Context, userID string) error {
	key := r.refreshTokenKey(userID)
	return r.rdb.Del(ctx, key)
}

func (r *tokenRepo) RevokeAccessToken(ctx context.Context, tokenID string, expiry time.Duration) error {
	key := r.blacklistKey(tokenID)
	return r.rdb.Set(ctx, key, "1", expiry)
}

func (r *tokenRepo) IsAccessTokenRevoked(ctx context.Context, tokenID string) (bool, error) {
	key := r.blacklistKey(tokenID)
	exists, err := r.rdb.Exists(ctx, key)
	if err != nil {
		return false, err
	}
	return exists > 0, nil
}
