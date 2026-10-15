package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"everything_finance/org/web-api/internal/pkg/redis"

	redisgo "github.com/redis/go-redis/v9"
)

var ErrSessionNotFound = errors.New("session not found")

const walletSessionPrefix = "wallet_session:"

type WalletSessionData struct {
	Address    string `json:"address"`
	WalletType string `json:"wallet_type"`
	Chain      string `json:"chain"`
	Nonce      string `json:"nonce"`
	Message    string `json:"message"`
	Step       int    `json:"step"`
	CreatedAt  int64  `json:"created_at"`
}

type WalletSessionRepo interface {
	StoreSession(ctx context.Context, sessionID string, data *WalletSessionData, expiry time.Duration) error
	GetSession(ctx context.Context, sessionID string) (*WalletSessionData, error)
	DeleteSession(ctx context.Context, sessionID string) error
}

type walletSessionRepo struct {
	rdb *redis.Client
}

func NewWalletSessionRepo(rdb *redis.Client) WalletSessionRepo {
	return &walletSessionRepo{rdb: rdb}
}

func (r *walletSessionRepo) sessionKey(sessionID string) string {
	return walletSessionPrefix + sessionID
}

func (r *walletSessionRepo) StoreSession(ctx context.Context, sessionID string, data *WalletSessionData, expiry time.Duration) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	key := r.sessionKey(sessionID)
	return r.rdb.Set(ctx, key, string(jsonData), expiry)
}

func (r *walletSessionRepo) GetSession(ctx context.Context, sessionID string) (*WalletSessionData, error) {
	key := r.sessionKey(sessionID)
	jsonStr, err := r.rdb.Get(ctx, key)
	if err != nil {
		if err.Error() == redisgo.Nil.Error() {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	var data WalletSessionData
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		return nil, err
	}

	return &data, nil
}

func (r *walletSessionRepo) DeleteSession(ctx context.Context, sessionID string) error {
	key := r.sessionKey(sessionID)
	return r.rdb.Del(ctx, key)
}
