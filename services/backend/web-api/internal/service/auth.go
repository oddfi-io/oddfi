package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/jwt"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/repository"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/google/uuid"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

var (
	ErrInvalidCredentials      = errors.New("invalid credentials")
	ErrUserNotFound            = errors.New("user not found")
	ErrUserAlreadyExists       = errors.New("user already exists")
	ErrInvalidToken            = errors.New("invalid token")
	ErrTokenExpired            = errors.New("token expired")
	ErrInvalidSignature        = errors.New("invalid signature")
	ErrInvalidSignatureAddress = errors.New("invalid signature eoa address")
	ErrInsufficientBalance     = errors.New("Insufficient balance")
	ErrInvalidMessage          = errors.New("invalid message")
	ErrInvalidNonce            = errors.New("invalid message nonce")
	ErrInvalidSession          = errors.New("invalid session")
	ErrSessionExpired          = errors.New("session expired")
)

type AuthService interface {
	Login(ctx context.Context, username, password string) (*model.LoginResponse, error)
	Register(ctx context.Context, req *model.RegisterRequest) (*model.UserProfileResponse, error)
	RefreshAccessTokenByRefreshToken(ctx context.Context, refreshToken string) (*model.TokenPair, error)
	Logout(ctx context.Context, accessToken string) error
	LoginByWallet(ctx context.Context, req *model.WalletLoginRequest) (*model.WalletLoginResponse, error)
	verifySignature(address, message, signature string) bool
	GetUserBalance(ctx context.Context, userId uint64) (*model.BalanceResponse, error)
	ValidateAccessToken(token string) (*jwt.Claims, error)
	GetUserDepositAddress(ctx context.Context, userId uint64, chain string) (*model.DepositAddressResponse, error)
	GetAssetLedger(ctx context.Context, userId uint64, param model.AssetLedgerRequest) (*model.AssetLedgersResponse, error)
	GetBetHistory(ctx context.Context, userId uint64, param model.GetBetHistoryRequest) (*model.BetHistoryResponse, error)

	// 提现操作
	WithDrawApply(ctx context.Context, userId uint64, param model.WithDrawApplyRequest) (*model.WithDrawApplyResponse, error)
	WithDrawCannel(ctx context.Context, userId uint64, order string) error
	GetWithDrawRecord(ctx context.Context, userId uint64) (*model.WithDrawRecordsRes, error)

	CancelBalance(ctx context.Context, userId uint64, betids []uint64) (*model.ModifyBalanceRespnse, error)
	GetBetHolding(ctx context.Context, userId uint64) (*model.BetHoldingResponse, error)

	GetBetClaim(ctx context.Context, userId uint64, betid uint64) (*model.BetClaimResponse, error)
	ClaimBet(ctx context.Context, userId uint64, betid uint64, expectedAmount decimal.Decimal) (*model.BetClaimResponse, error)

	BetPlaceSingle(ctx context.Context, userId uint64, req *model.ModifyBalanceRequest) (*model.ModifyBalanceRespnse, error)
	BetPlaceParlay(ctx context.Context, userId uint64, req *model.ModifyBalanceRequest) (*model.ModifyBalanceRespnse, error)
	// BannerBetPlace 首页 Banner 下注，当前只做轻量落库与查询。
	BannerBetPlace(ctx context.Context, userId uint64, req *model.BannerBetPlaceRequest) (*model.BannerBetPlaceResponse, error)
	// GetBannerBetHolding 查询当前用户的 Banner 注单记录。
	GetBannerBetHolding(ctx context.Context, userId uint64) (*model.BannerBetHoldingResponse, error)

	GetRecordByOrderSns(ctx context.Context, orders []string) (*model.OrderInfoResponse, error)
}

type authService struct {
	userRepo          repository.UserRepo
	tokenRepo         repository.TokenRepo
	walletSessionRepo repository.WalletSessionRepo
	jwtMgr            *jwt.JWTManager
	cfg               *config.Config
}

func NewAuthService(
	userRepo repository.UserRepo,
	tokenRepo repository.TokenRepo,
	walletSessionRepo repository.WalletSessionRepo,
	cfg *config.Config,
) AuthService {
	return &authService{
		userRepo:          userRepo,
		tokenRepo:         tokenRepo,
		walletSessionRepo: walletSessionRepo,
		jwtMgr:            jwt.NewJWTManager(cfg.JWT.Secret),
		cfg:               cfg,
	}
}

func (s *authService) Login(ctx context.Context, username, password string) (*model.LoginResponse, error) {
	user, err := s.userRepo.GetByEmail(ctx, username)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if !s.checkPassword(password, user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	userID := strconv.FormatUint(user.UserID, 10)
	accessToken, accessTokenID, err := s.jwtMgr.GenerateToken(userID, user.SigningAddress, s.cfg.JWT.AccessDuration())
	if err != nil {
		return nil, err
	}

	refreshToken, _, err := s.jwtMgr.GenerateToken(userID, user.SigningAddress, s.cfg.JWT.RefreshDuration())
	if err != nil {
		return nil, err
	}

	if err := s.tokenRepo.StoreRefreshToken(ctx, userID, accessTokenID, refreshToken, s.cfg.JWT.RefreshDuration()); err != nil {
		return nil, err
	}

	return &model.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.cfg.JWT.AccessExpiry),
		TokenType:    "Bearer",
	}, nil
}

func (s *authService) GetUserDepositAddress(ctx context.Context, userId uint64, chain string) (*model.DepositAddressResponse, error) {
	depositAddress, err := s.userRepo.GetUserDepositAddress(ctx, userId, chain)
	if err != nil {
		return nil, err
	}
	return &model.DepositAddressResponse{
		Address: depositAddress.Address,
		Chain:   chain,
	}, nil
}

func (s *authService) Register(ctx context.Context, req *model.RegisterRequest) (*model.UserProfileResponse, error) {
	existingUser, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err == nil && existingUser != nil {
		return nil, ErrUserAlreadyExists
	}

	hashedPassword := s.hashPassword(req.Password)

	user := &model.User{
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Nickname:     req.Nickname,
		Status:       1,
		KycLevel:     0,
		TwoFAEnable:  0,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	return &model.UserProfileResponse{
		UserID:   user.UserID,
		Email:    user.Email,
		Nickname: user.Nickname,
	}, nil
}

// 通过 refresh_token 刷新 access_token
func (s *authService) RefreshAccessTokenByRefreshToken(ctx context.Context, refreshToken string) (*model.TokenPair, error) {
	claims, err := s.jwtMgr.ValidateToken(refreshToken)
	if err != nil {
		if errors.Is(err, jwt.ErrExpiredToken) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}

	valid, err := s.tokenRepo.ValidateRefreshToken(ctx, claims.UserID, refreshToken)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, ErrInvalidToken
	}

	accessToken, _, err := s.jwtMgr.GenerateToken(claims.UserID, claims.Address, s.cfg.JWT.AccessDuration())
	if err != nil {
		return nil, err
	}

	newRefreshToken, _, err := s.jwtMgr.GenerateToken(claims.UserID, claims.Address, s.cfg.JWT.RefreshDuration())
	if err != nil {
		return nil, err
	}

	if err := s.tokenRepo.StoreRefreshToken(ctx, claims.UserID, claims.TokenID, newRefreshToken, s.cfg.JWT.RefreshDuration()); err != nil {
		return nil, err
	}

	return &model.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    int64(s.cfg.JWT.AccessExpiry),
	}, nil
}

func (s *authService) ValidateAccessToken(token string) (*jwt.Claims, error) {
	if len(token) == 0 {
		return nil, ErrInvalidToken
	}
	claims, err := s.jwtMgr.ValidateToken(token)
	if err != nil {
		return nil, err
	}
	return claims, nil
}

func (s *authService) Logout(ctx context.Context, token string) error {
	claims, err := s.jwtMgr.ValidateToken(token)
	if err != nil {
		return err
	}

	if err := s.tokenRepo.RevokeAccessToken(ctx, claims.TokenID, s.cfg.JWT.AccessDuration()); err != nil {
		return err
	}

	if err := s.tokenRepo.RevokeAllUserTokens(ctx, claims.UserID); err != nil {
		return err
	}

	return nil
}

func (s *authService) GetUserBalance(ctx context.Context, userId uint64) (*model.BalanceResponse, error) {
	balance, err := s.userRepo.GetBalanceByUserID(ctx, userId)
	if err != nil {
		return nil, err
	}

	// claimable 是结算后、用户领取前的资金承接账户；总资产必须包含它，否则延迟领取用户会看到资产短少。
	totalBalance := balance.AvailableBalance.
		Add(balance.ClaimableBalance).
		Add(balance.FrozenBalance).
		Add(balance.BetLockBalance).
		Add(balance.LiqLockBalance).
		Add(balance.StakeLockBalance)
	return &model.BalanceResponse{
		AvailableBalance: balance.AvailableBalance,
		ClaimableBalance: balance.ClaimableBalance,
		FrozenBalance:    balance.FrozenBalance,
		BetLockBalance:   balance.BetLockBalance,
		StakeLockBalance: balance.StakeLockBalance,
		LiqLockBalance:   balance.LiqLockBalance,
		TotalBalance:     totalBalance,
	}, nil
}

func (s *authService) hashPassword(password string) string {
	return password
}

func (s *authService) checkPassword(password, hashedPassword string) bool {
	return password == hashedPassword
}

func (s *authService) generateNonce() (string, error) {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (s *authService) verifySignature(address, message, signature string) bool {
	sigBytes, err := hex.DecodeString(strings.TrimPrefix(signature, "0x"))
	if err != nil {
		return false
	}

	if len(sigBytes) != 65 {
		return false
	}

	data := []byte(message)
	msgHash := accounts.TextHash(data)

	if sigBytes[64] == 27 || sigBytes[64] == 28 {
		sigBytes[64] -= 27
	}

	pubKey, err := crypto.SigToPub(msgHash, sigBytes)
	if err != nil {
		return false
	}

	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	return strings.EqualFold(recoveredAddr.Hex(), address)
}

// 区分处理 step1 / step2
func (s *authService) LoginByWallet(ctx context.Context, req *model.WalletLoginRequest) (*model.WalletLoginResponse, error) {
	if len(req.SessionID) == 0 && len(req.Message) == 0 && len(req.Signature) == 0 {
		return s.handleWalletLoginStep1(ctx, req)
	}
	if len(req.SessionID) != 0 && len(req.Message) != 0 && len(req.Signature) != 0 {
		return s.handleWalletLoginStep2(ctx, req)
	}

	return nil, errors.New("invalid request by login ")

}

func (s *authService) handleWalletLoginStep1(ctx context.Context, req *model.WalletLoginRequest) (*model.WalletLoginResponse, error) {
	nonce, err := s.generateNonce()
	if err != nil {
		return nil, err
	}

	sessionID := uuid.New().String()

	sessionData := &repository.WalletSessionData{
		Address:    req.Address,
		WalletType: req.WalletType,
		Chain:      req.Chain,
		Nonce:      nonce,
		Message:    "",
		Step:       1,
		CreatedAt:  time.Now().Unix(),
	}

	if err := s.walletSessionRepo.StoreSession(ctx, sessionID, sessionData, 5*time.Minute); err != nil {
		return nil, err
	}

	return &model.WalletLoginResponse{
		Data: model.WalletLoginStep1Data{
			Nonce: nonce,
		},
		Done:      false,
		SessionID: sessionID,
		Step:      1,
		Require:   []string{"verify_wallet"},
	}, nil
}

func (s *authService) handleWalletLoginStep2(ctx context.Context, req *model.WalletLoginRequest) (*model.WalletLoginResponse, error) {
	if req.Message == "" || req.Signature == "" || req.SessionID == "" {
		return nil, ErrInvalidSession
	}

	session, err := s.walletSessionRepo.GetSession(ctx, req.SessionID)
	if err != nil {
		if errors.Is(err, repository.ErrSessionNotFound) {
			return nil, ErrInvalidSession
		}
		return nil, err
	}

	// 不管成功否，都删除，失败重新从step 1 开始
	defer s.walletSessionRepo.DeleteSession(ctx, req.SessionID)

	if session.Address != req.Address {
		return nil, ErrInvalidSession
	}

	// BUG-001 B2：原值 5*50 = 250s 是笔误（与 :339 StoreSession 5*time.Minute=300s 不一致）。
	// 现改为命名常量 5*60 = 300s 与 Redis TTL 对齐。
	// 250s 非经过设计的安全窗口值，修笔误的正确方向是与配置对齐而非迁就笔误值。
	const walletLoginStep2TTLSec = int64(5 * 60)
	if session.CreatedAt+walletLoginStep2TTLSec < time.Now().Unix() {
		return nil, ErrSessionExpired
	}

	if !s.verifySignature(req.Address, req.Message, req.Signature) {
		return nil, ErrInvalidSignature
	}

	// 校验msg
	msgData := matchMessage(req.Message)
	if msgData == nil {
		return nil, ErrInvalidMessage
	}

	if msgData["nonce"] != session.Nonce {
		return nil, ErrInvalidNonce
	}

	// 检查是否创建过用户
	user, err := s.userRepo.GetByWalletAddress(ctx, req.Address)
	if err != nil {
		return nil, err
	}

	// 没有用户，创建用户
	if user == nil {
		newUser, err := s.userRepo.CreateAllUserIDWithSigningAddress(ctx, strings.ToLower(req.Chain), req.Address)
		if err != nil {
			return nil, err
		}
		logger.Infof("222211111:%d", newUser.UserID)
		user = newUser
	}

	accessDuration := s.cfg.JWT.AccessDuration()
	refreshDuration := s.cfg.JWT.RefreshDuration()
	userIDStr := strconv.FormatUint(user.UserID, 10)
	logger.Infof("2222:%s", userIDStr)
	accessToken, accessTokenID, err := s.jwtMgr.GenerateToken(userIDStr, user.SigningAddress, accessDuration)
	if err != nil {
		return nil, err
	}

	logger.Infof("333:%d", len(accessToken))

	refreshToken, _, err := s.jwtMgr.GenerateToken(userIDStr, user.SigningAddress, refreshDuration)
	if err != nil {
		return nil, err
	}

	if err := s.tokenRepo.StoreRefreshToken(ctx, userIDStr, accessTokenID, refreshToken, refreshDuration); err != nil {
		return nil, err
	}

	now := time.Now()

	return &model.WalletLoginResponse{
		Data: map[string]interface{}{
			"access_token": model.TokenData{
				ExpireAt: now.Add(accessDuration).Unix(),
				Token:    accessToken,
			},
			"refresh_token": model.TokenData{
				ExpireAt: now.Add(refreshDuration).Unix(),
				Token:    refreshToken,
			},
		},
		Done:      true,
		SessionID: req.SessionID,
		Step:      2,
	}, nil
}

func matchMessage(message string) map[string]string {
	// 正则解析：匹配关键词后的内容，直到遇到空格或结尾
	// account:(\S+) 表示匹配 account: 后面的一串非空字符
	result := make(map[string]string)
	re := regexp.MustCompile(`account:(\S+)\s+ChainID:(\S+)\s+Nonce:(\S+)\s+Issued At:(\S+)\s+Expiration time:(\S+)`)

	match := re.FindStringSubmatch(message)

	for i, item := range match {
		if i == 0 {
			continue
		}
		if i == 1 {
			result["account"] = item
		}
		if i == 2 {
			result["chainID"] = item
		}
		if i == 3 {
			result["nonce"] = item
		}
		if i == 4 {
			result["issuedAt"] = item
		}
		if i == 5 {
			result["expireTime"] = item
		}
	}

	return result
}

// func (s *authService) BetBalance(ctx context.Context, userId uint64, req *model.ModifyBalanceRequest) (*model.ModifyBalanceRespnse, error) {
// 	err := s.userRepo.BetUserBalanceByUserID(ctx, userId, req.Stakes[0])
// 	if err != nil {
// 		return nil, err
// 	}
// 	return &model.ModifyBalanceRespnse{
// 		Msg: "SUCCESS",
// 	}, nil
// }

func (s *authService) BetPlaceSingle(ctx context.Context, userId uint64, req *model.ModifyBalanceRequest) (*model.ModifyBalanceRespnse, error) {
	// 校验下注金额是否为 decimal.Decimal 类型
	stakes := make([]decimal.Decimal, 0, len(req.Stakes))
	for _, stake := range req.Stakes {
		stakeDec, err := decimal.NewFromString(stake)
		if err != nil {
			logger.Errorf("BetPlaceSingle stake: %s, err: %v", stake, err)
			return nil, err
		}
		// 下注金额必须为正数，防止 0 金额下注或负数反向加余额。
		if !stakeDec.GreaterThan(decimal.Zero) {
			return nil, errors.New("stake must be greater than zero")
		}
		stakes = append(stakes, stakeDec)
	}

	logger.Infof("BetPlaceSingle stakes: %v, odds: %v", stakes, req.Odds)
	// 盘口线按 stake 数量预置长度，空盘口线保留 decimal.Zero，保持后续索引一致。
	handicapLines := make([]decimal.Decimal, len(req.Stakes))
	for i, handicapLine := range req.HandicapLine {
		if strings.TrimSpace(handicapLine) == "" {
			continue
		}
		handicapLineDec, err := decimal.NewFromString(handicapLine)
		if err != nil {
			logger.Errorf("BetPlaceSingle handicapLine: %s, err: %v", handicapLine, err)
			return nil, err
		}
		handicapLines[i] = handicapLineDec
	}

	//赔率快照转换
	odds := make([]decimal.Decimal, 0, len(req.Stakes))
	for _, odd := range req.Odds {
		oddDec, err := decimal.NewFromString(odd)
		if err != nil {
			logger.Errorf("BetPlaceSingle odd: %s, err: %v", odd, err)
			return nil, err
		}
		// 客户端传入的赔率也必须为正数；最终赔率仍以后续服务端 OddDB 校验为准。
		if !oddDec.GreaterThan(decimal.Zero) {
			return nil, errors.New("odds must be greater than zero")
		}
		odds = append(odds, oddDec)
	}

	logger.Infof("BetPlaceSingle handicapLines: %v, oddIDs: %v", handicapLines, req.OddIDs)
	resp, err := s.userRepo.BetUserBalance(ctx, userId, req.OddIDs, stakes, odds, "single", req.Market, req.Label, handicapLines, req.RefID)
	return resp, err
}

func (s *authService) BetPlaceParlay(ctx context.Context, userId uint64, req *model.ModifyBalanceRequest) (*model.ModifyBalanceRespnse, error) {
	// 校验下注金额是否为 decimal.Decimal 类型
	stakes := make([]decimal.Decimal, 0, len(req.Stakes))
	for _, stake := range req.Stakes {
		stakeDec, err := decimal.NewFromString(stake)
		if err != nil {
			logger.Errorf("BetPlaceParlay stake: %s, err: %v", stake, err)
			return nil, err
		}
		// 串关注单同样禁止 0 或负数金额，避免创建无效注单。
		if !stakeDec.GreaterThan(decimal.Zero) {
			return nil, errors.New("stake must be greater than zero")
		}
		stakes = append(stakes, stakeDec)
	}

	// 盘口线按 stake 数量预置长度，确保 parlay 多腿投注的索引保持稳定。
	handicapLines := make([]decimal.Decimal, len(req.Stakes))
	for i, handicapLine := range req.HandicapLine {
		if strings.TrimSpace(handicapLine) == "" {
			continue
		}
		handicapLineDec, err := decimal.NewFromString(handicapLine)
		if err != nil {
			logger.Errorf("BetPlaceParlay handicapLine: %s, err: %v", handicapLine, err)
			return nil, err
		}
		handicapLines[i] = handicapLineDec
	}

	//赔率快照转换
	odds := make([]decimal.Decimal, 0, len(req.Stakes))
	for _, odd := range req.Odds {
		oddDec, err := decimal.NewFromString(odd)
		if err != nil {
			logger.Errorf("BetPlaceParlay odd: %s, err: %v", odd, err)
			return nil, err
		}
		// 赔率先做基础正数校验，随后仓储层会和服务端赔率快照做强校验。
		if !oddDec.GreaterThan(decimal.Zero) {
			return nil, errors.New("odds must be greater than zero")
		}
		odds = append(odds, oddDec)
	}

	logger.Infof("BetPlaceParlay handicapLines: %v, oddIDs: %v", handicapLines, req.OddIDs)
	resp, err := s.userRepo.BetUserBalance(ctx, userId, req.OddIDs, stakes, odds, "parlay", req.Market, req.Label, handicapLines, req.RefID)
	return resp, err
}

// BannerBetPlace 处理首页 Banner 的单注请求。
// 这里不复用现有 bet_place 的比赛盘口校验，而是按 PRD 做轻量记录。
func (s *authService) BannerBetPlace(ctx context.Context, userId uint64, req *model.BannerBetPlaceRequest) (*model.BannerBetPlaceResponse, error) {
	req.BannerCode = strings.ToUpper(strings.TrimSpace(req.BannerCode))
	if !isSupportedBannerCode(req.BannerCode) {
		logger.Errorf("[BannerBetPlace] invalid banner_code, user_id:%d banner_code:%q", userId, req.BannerCode)
		return nil, errors.New("invalid banner_code")
	}
	if req.MarketID <= 0 {
		logger.Errorf("[BannerBetPlace] invalid market_id, user_id:%d market_id:%d", userId, req.MarketID)
		return nil, errors.New("market_id must be greater than zero")
	}
	if req.SelectionID <= 0 {
		logger.Errorf("[BannerBetPlace] invalid selection_id, user_id:%d selection_id:%d", userId, req.SelectionID)
		return nil, errors.New("selection_id must be greater than zero")
	}
	req.Market = strings.TrimSpace(req.Market)
	req.Selection = strings.TrimSpace(req.Selection)
	req.RefID = strings.TrimSpace(req.RefID)
	if req.Market == "" || req.Selection == "" || req.RefID == "" {
		logger.Errorf("[BannerBetPlace] market/selection/ref_id missing, user_id:%d market:%q selection:%q ref_id:%q", userId, req.Market, req.Selection, req.RefID)
		return nil, errors.New("market, selection, ref_id must be filled")
	}

	stake, err := decimal.NewFromString(strings.TrimSpace(req.Stake))
	if err != nil {
		logger.Errorf("[BannerBetPlace] parse stake failed, user_id:%d stake:%q err:%v", userId, req.Stake, err)
		return nil, err
	}
	if !stake.GreaterThan(decimal.Zero) {
		logger.Errorf("[BannerBetPlace] invalid stake, user_id:%d stake:%s", userId, stake.String())
		return nil, errors.New("stake must be greater than zero")
	}

	odds, err := decimal.NewFromString(strings.TrimSpace(req.Odds))
	if err != nil {
		logger.Errorf("[BannerBetPlace] parse odds failed, user_id:%d odds:%q err:%v", userId, req.Odds, err)
		return nil, err
	}
	if !odds.GreaterThan(decimal.Zero) {
		logger.Errorf("[BannerBetPlace] invalid odds, user_id:%d odds:%s", userId, odds.String())
		return nil, errors.New("odds must be greater than zero")
	}

	resp, err := s.userRepo.CreateBannerBetOrder(ctx, userId, req, stake, odds)
	if err != nil {
		logger.Errorf("[BannerBetPlace] create banner bet order failed, user_id:%d banner_code:%s market_id:%d selection_id:%d ref_id:%s err:%v", userId, req.BannerCode, req.MarketID, req.SelectionID, req.RefID, err)
		return nil, err
	}
	return resp, nil
}

// GetBannerBetHolding 查询当前用户最近 50 条 Banner 注单。
func (s *authService) GetBannerBetHolding(ctx context.Context, userId uint64) (*model.BannerBetHoldingResponse, error) {
	resp, err := s.userRepo.GetBannerBetHoldingByUserID(ctx, userId)
	if err != nil {
		logger.Errorf("[GetBannerBetHolding] query banner bet holding failed, user_id:%d err:%v", userId, err)
		return nil, err
	}
	return resp, nil
}

func (s *authService) GetRecordByOrderSns(ctx context.Context, orders []string) (*model.OrderInfoResponse, error) {
	records, err := s.userRepo.GetWithdrawRecordsByOrderSns(ctx, orders)
	if err != nil {
		return nil, err
	}

	items := make([]model.GetRecordByOrderSnsItemResponse, 0, len(records))
	for _, r := range records {
		items = append(items, model.GetRecordByOrderSnsItemResponse{
			OrderSn:    r.OrderSn,
			Chain:      r.Chain,
			Amount:     r.Amount,
			Fee:        r.Fee,
			RealAmount: r.RealAmount,
			ToAddress:  r.ToAddress,
			TxHash:     r.TxHash,
			Status:     r.Status,
			CreatedAt:  r.CreatedAt,
			AuditAt:    r.AuditAt,
			FinishedAt: r.FinishedAt,
			UpdatedAt:  r.UpdatedAt,
		})
	}

	return &model.OrderInfoResponse{
		List:  items,
		Total: int64(len(items)),
	}, nil
}

// isSupportedBannerCode 限制只接受 PRD 中定义的 5 个固定 Banner 槽位。
func isSupportedBannerCode(code string) bool {
	switch code {
	case "B1", "B2", "B3", "B4", "B5",
		"BNR_001", "BNR_002", "BNR_003", "BNR_004", "BNR_005":
		// 线上历史配置可能仍使用 BNR_00x，PRD 和前端测试使用 B1~B5；两套编码都映射到固定五个槽位。
		return true
	default:
		return false
	}
}

func (s *authService) CancelBalance(ctx context.Context, userId uint64, betids []uint64) (*model.ModifyBalanceRespnse, error) {
	resp, err := s.userRepo.CancelUserBet(ctx, userId, betids)
	return resp, err
}

func (s *authService) GetBetHolding(ctx context.Context, userId uint64) (*model.BetHoldingResponse, error) {
	betHolding, err := s.userRepo.GetBetHoldingByUserID(ctx, userId)
	return betHolding, err
}

func (s *authService) GetBetClaim(ctx context.Context, userId uint64, betid uint64) (*model.BetClaimResponse, error) {
	betClaim, err := s.userRepo.GetBetClaimByUserID(ctx, userId, betid)
	return betClaim, err
}

func (s *authService) ClaimBet(ctx context.Context, userId uint64, betid uint64, expectedAmount decimal.Decimal) (*model.BetClaimResponse, error) {
	betClaim, err := s.userRepo.ClaimBetByUserID(ctx, userId, betid, expectedAmount)
	return betClaim, err
}

// // My Bets 搜索与 History 搜索共用同一接口，通过参数区分场景。
// func (s *authService) GetBetHistory(ctx context.Context, userId uint64, param model.GetBetHistoryRequest) (*model.BetHistoryResponse, error) {

// 	page := param.Page
// 	if page <= 0 {
// 		page = 1
// 	}
// 	pageSize := param.PageSize
// 	if pageSize <= 0 {
// 		pageSize = 20
// 	}
// 	if pageSize > 50 {
// 		pageSize = 50 // 强制硬限制最大 50 条
// 	}

// 	parm := model.AssetLedgerRequest{
// 		OrderBy: param.OrderBy,
// 		Sort:    param.Sort,
// 	}
// 	history, err := s.userRepo.GetAssetLedgersByUserID(ctx, userId, parm, false)
// 	if err != nil {
// 		return nil, err
// 	}

// 	// 判空，提前返回
// 	if history == nil || len(history.AssetLedgers) == 0 {
// 		return &model.BetHistoryResponse{
// 			Total:        0,
// 			AssetLedgers: []model.AssetLedgerResponse{}, // 返回空 Ledger 列表
// 		}, nil
// 	}

// 	QSearch := strings.ToLower(param.Search) // 搜索关键词，转小写方便不区分大小写匹配
// 	Qtab := param.Tab                        // My Bets 场景传入：active / settled；History 场景不传
// 	Qtype := param.Type                      // （claim/Bet/withdraw/deposit/stake/unstake/addlp/removelp）
// 	Qresult := param.Result                  // 结算结果筛选：all（默认）/ won / lost
// 	QBeginDate := param.BeginDate            // 开始日期筛选，格式 YYYY-MM-DD
// 	QEndDate := param.EndDate                // 结束日期筛选，格式 YYYY-MM-DD

// 	//打印请求参数
// 	logger.Infof("[GetBetHistory] param: %v", param)

// 	// --- 阶段 1：基于 AssetLedger 自身字段的基础过滤 ---
// 	var firstPassLedgers []model.AssetLedgerResponse
// 	for _, item := range history.AssetLedgers {
// 		// 1. 过滤业务类型 (如果传入了 Type)
// 		if Qtype != "" {
// 			if strings.ToLower(Qtype) == "bet" {
// 				// 针对 bet 类型的特殊处理：匹配 single 和 parlay
// 				if item.BusinessType != "single" && item.BusinessType != "parlay" {
// 					continue
// 				}
// 			} else {
// 				// 其他类型 (claim/withdraw/deposit等) 严格匹配
// 				if item.BusinessType != Qtype {
// 					continue
// 				}
// 			}
// 		}

// 		// 2. 过滤时间区间
// 		dateStr := item.CreatedAt.Format("2006-01-02")
// 		if QBeginDate != "" && dateStr < QBeginDate {
// 			continue
// 		}
// 		if QEndDate != "" && dateStr > QEndDate {
// 			continue
// 		}

// 		firstPassLedgers = append(firstPassLedgers, item)
// 	}

// 	if len(firstPassLedgers) == 0 {
// 		return &model.BetHistoryResponse{
// 			Total:        0,
// 			AssetLedgers: []model.AssetLedgerResponse{}, // 返回空 Ledger 列表
// 		}, nil
// 	}

// 	// --- 阶段 2：提取下注 ID 并批量查询 Event Info ---
// 	betIds := make([]uint64, 0)
// 	for _, item := range firstPassLedgers {
// 		// 仅对 bet 相关的类型提取 RefID，非 Bet 类型（如 deposit）可能没有对应的 BetHolding
// 		if lo.Contains([]string{"single", "parlay"}, item.BusinessType) {
// 			id, err := strconv.Atoi(item.RefID)
// 			if err != nil {
// 				// 忽略格式错误的 ID，避免打断整个请求
// 				continue
// 			}
// 			betIds = append(betIds, uint64(id))
// 		}
// 	}

// 	betIdsInfoMap := make(map[string]model.BetHoldingResult)
// 	if len(betIds) > 0 {
// 		betIdsInfo, err := s.userRepo.GetBetHoldingByOrders(ctx, betIds)
// 		if err != nil {
// 			return nil, err
// 		}
// 		// 转换为 Map，方便 O(1) 查找
// 		betIdsInfoMap = lo.SliceToMap(betIdsInfo.Results, func(item model.BetHoldingResult) (string, model.BetHoldingResult) {
// 			return strconv.FormatUint(item.Id, 10), item
// 		})
// 	}

// 	// --- 阶段 3：深度过滤与数据组装 (合并 EventInfo) ---
// 	var filteredLedgers []model.AssetLedgerResponse
// 	for _, ledger := range firstPassLedgers {
// 		isBet := ledger.BusinessType == "single" || ledger.BusinessType == "parlay"
// 		if isBet {
// 			info, hasInfo := betIdsInfoMap[ledger.RefID]
// 			if !hasInfo {
// 				logger.Errorf("[GetBetHistory] hasInfo false, filter bet ledger, ledger: %v, refId: %v", ledger, ledger.RefID)
// 				continue // 注单数据丢失或异常，跳过展示
// 			}

// 			// 状态过滤 (仅对注单生效)
// 			if Qtab == "active" && info.Status != "PENDING" {
// 				logger.Errorf("[GetBetHistory] PENDING filter bet ledger, ledger: %v, status: %v", ledger, info.Status)
// 				continue
// 			}
// 			if Qtab == "settled" {
// 				if info.Status != "WON" && info.Status != "LOST" {
// 					logger.Errorf("[GetBetHistory] WON LOST filter bet ledger, ledger: %v, status: %v", ledger, info.Status)
// 					continue
// 				}
// 				if Qresult == "won" && info.Status != "WON" {
// 					logger.Errorf("[GetBetHistory] WON filter bet ledger, ledger: %v, status: %v", ledger, info.Status)
// 					continue
// 				}
// 				if Qresult == "lost" && info.Status != "LOST" {
// 					logger.Errorf("[GetBetHistory] LOST filter bet ledger, ledger: %v, status: %v", ledger, info.Status)
// 					continue
// 				}
// 			}

// 			// 关键词搜索 (仅对注单生效)
// 			if QSearch != "" {
// 				if !strings.Contains(strings.ToLower(info.FixtureName), QSearch) {
// 					logger.Errorf("[GetBetHistory] filter bet ledger, ledger: %v, search: %v", ledger, QSearch)
// 					continue
// 				}
// 			}
// 			// === 关键逻辑：将注单详情嵌套进 Ledger 的 EventInfo ===
// 			ledger.EventInfo = &info

// 		} else {
// 			// 对于非下注类型 (如 deposit, withdraw)
// 			// 如果用户在进行 My Bets 的 Tab 筛选或输入了关键词，显然不应该展示充提流水
// 			if Qtab == "active" || Qtab == "settled" || QSearch != "" {
// 				logger.Infof("[GetBetHistory] filter non bet ledger, ledger: %v", ledger)
// 				continue
// 			}
// 			//对于其他 history 类搜索 也需要关键词搜索
// 			if QSearch != "" {
// 				//需要判空，避免指针异常
// 				if ledger.EventInfo == nil {
// 					continue
// 				}
// 				if !strings.Contains(strings.ToLower(ledger.EventInfo.FixtureName), QSearch) {
// 					logger.Errorf("[GetBetHistory] filter non name ledger, ledger: %v, search: %v", ledger, QSearch)
// 					continue
// 				}
// 			}
// 		}

// 		// 将合并好信息的 Ledger 加入最终结果集
// 		filteredLedgers = append(filteredLedgers, ledger)
// 	}

// 	// --- 阶段 4：执行物理分页逻辑 ---
// 	total := len(filteredLedgers)
// 	startIndex := (page - 1) * pageSize
// 	endIndex := startIndex + pageSize

// 	// 边界检查
// 	if startIndex >= total {
// 		return &model.BetHistoryResponse{
// 			Total:        uint64(total),
// 			AssetLedgers: []model.AssetLedgerResponse{},
// 		}, nil
// 	}
// 	if endIndex > total {
// 		endIndex = total
// 	}

// 	// 切片操作
// 	pagedResults := filteredLedgers[startIndex:endIndex]
// 	return &model.BetHistoryResponse{
// 		Total:        uint64(total),
// 		AssetLedgers: pagedResults, // 返回嵌套了 EventInfo 的 Ledger 数组
// 	}, nil
// }

// // GetBetHistory My Bets 搜索与 History 搜索共用同一接口，通过参数区分场景。
// func (s *authService) GetBetHistory(ctx context.Context, userId uint64, param model.GetBetHistoryRequest) (*model.BetHistoryResponse, error) {

// 	// 1. 规范化分页参数
// 	page := param.Page
// 	if page <= 0 {
// 		page = 1
// 	}
// 	pageSize := param.PageSize
// 	if pageSize <= 0 {
// 		pageSize = 20
// 	}
// 	if pageSize > 50 {
// 		pageSize = 50 // 强制硬限制最大 50 条
// 	}

// 	// 2. 规范化搜索参数 (全部转小写，防止匹配失败)
// 	qSearch := strings.ToLower(strings.TrimSpace(param.Search))
// 	qTab := strings.ToLower(strings.TrimSpace(param.Tab)) // active / settled / 空
// 	if qTab == "" {
// 		// 兼容前端早期把 My Bets 页签放在 status 参数里的调用；内部仍统一使用 tab 语义，避免两套过滤逻辑分叉。
// 		qTab = strings.ToLower(strings.TrimSpace(param.Status))
// 	}
// 	qType := strings.ToLower(strings.TrimSpace(param.Type))     // claim/bet/withdraw/deposit...
// 	qResult := strings.ToLower(strings.TrimSpace(param.Result)) // all / won / lost
// 	if qResult == "" {
// 		qResult = "all"
// 	}
// 	qBeginDate := param.BeginDate
// 	qEndDate := param.EndDate

// 	logger.Infof("[GetBetHistory] userId: %d, param: %+v", userId, param)

// 	parm := model.AssetLedgerRequest{
// 		OrderBy: param.OrderBy,
// 		Sort:    param.Sort,
// 	}

// 	// ⚠️ 警告：当前为全量加载后在内存中过滤。当用户流水达到万级时，请务必改造为 SQL 层面的分页与过滤！
// 	history, err := s.userRepo.GetAssetLedgersByUserID(ctx, userId, parm, false)
// 	if err != nil {
// 		logger.Errorf("[GetBetHistory] 获取用户流水失败: %v", err)
// 		return nil, err
// 	}

// 	if history == nil || len(history.AssetLedgers) == 0 {
// 		logger.Infof("[GetBetHistory] 用户 %d 没有流水", userId)
// 		return &model.BetHistoryResponse{Total: 0, AssetLedgers: []model.AssetLedgerResponse{}}, nil
// 	}

// 	// --- 阶段 1：基础过滤 ---
// 	var firstPassLedgers []model.AssetLedgerResponse

// 	for _, item := range history.AssetLedgers {
// 		itemType := strings.ToLower(item.BusinessType)

// 		// 1.1 业务类型过滤
// 		if qType != "" && qType != "all" {
// 			if qType == "bet" {
// 				if itemType != "single" && itemType != "parlay" && itemType != model.AssetTypeBannerSingle {
// 					continue
// 				}
// 			} else {
// 				if itemType != qType {
// 					continue
// 				}
// 			}
// 		}

// 		// 1.2 时间区间过滤
// 		// 提醒：依赖 string 比较 YYYY-MM-DD 要求 CreatedAt 必须是对应时区的时间
// 		dateStr := item.CreatedAt.Format("2006-01-02")
// 		if qBeginDate != "" && dateStr < qBeginDate {
// 			continue
// 		}
// 		if qEndDate != "" && dateStr > qEndDate {
// 			continue
// 		}

// 		firstPassLedgers = append(firstPassLedgers, item)
// 	}

// 	// --- 阶段 2：批量查询 Event Info ---
// 	betIdsInfoMap, err := s.buildBetInfoMapByLedgers(ctx, firstPassLedgers)
// 	if err != nil {
// 		logger.Errorf("[GetBetHistory] 获取注单详情失败, parm: %+v, err: %v\n", parm.OrderBy, err)
// 		return nil, err // 此处获取失败直接抛错，保证数据完整性
// 	}

// 	// --- 阶段 3：深度过滤与数据组装 ---
// 	var filteredLedgers []model.AssetLedgerResponse
// 	for _, ledger := range firstPassLedgers {
// 		itemType := strings.ToLower(ledger.BusinessType)
// 		isBet := itemType == "single" || itemType == "parlay" || itemType == model.AssetTypeBannerSingle

// 		if isBet {
// 			info, hasInfo := betIdsInfoMap[ledger.RefID]
// 			if !hasInfo {
// 				// 注单详情丢失，属于严重的数据不一致，跳过展示并记录 Error
// 				logger.Errorf("[GetBetHistory] 找不到注单详情, 过滤该流水. RefID: %s, parm: %+v", ledger.RefID, parm.OrderBy)
// 				continue
// 			}

// 			// 3.1 状态过滤 (My Bets 场景)
// 			status := strings.ToLower(info.Status)
// 			if qTab == "active" && status != "live" {
// 				logger.Errorf("[GetBetHistory] filter active bet ledger %v, status: %v, parm: %+v", ledger, status, parm.OrderBy)
// 				continue
// 			}
// 			if qTab == "settled" {
// 				// 假设非 PENDING 即为 settled (需考虑 VOID/REFUND 走水情况)
// 				if status == "pending" || status == "live" {
// 					logger.Errorf("[GetBetHistory] filter settled pending or live userId: %d, param: %+v", userId, param)
// 					continue
// 				}
// 				// Settled 下的 Result 细分筛选
// 				if qResult == "won" && status != "won" {
// 					logger.Errorf("[GetBetHistory] filter settled won bet ledger %v, status: %v, parm: %+v", ledger, status, parm.OrderBy)
// 					continue
// 				}
// 				if qResult == "lost" && status != "lost" {
// 					logger.Errorf("[GetBetHistory] filter settled lost bet ledger %v, status: %v, parm: %+v", ledger, status, parm.OrderBy)
// 					continue
// 				}
// 			}

// 			// 3.2 关键词模糊搜索 (匹配 MarketName 需求)
// 			if qSearch != "" {
// 				// 需求：Market Name 搜索。这里使用 FixtureName/MarketName 作为匹配源，如有调整请修改字段
// 				targetName := strings.ToLower(strings.TrimSpace(info.FixtureName + " " + info.MarketType + " " + info.Selection))
// 				if !strings.Contains(targetName, qSearch) {
// 					logger.Errorf("[GetBetHistory] qSearch filter bet ledger, ledger: %v, search: %v, parm: %+v", ledger, qSearch, parm.OrderBy)
// 					continue
// 				}
// 			}

// 			// 注入注单详情
// 			ledger.EventInfo = &info

// 		} else {
// 			// 对于非注单类型 (Deposit, Withdraw 等)
// 			// 1. 如果用户处于 My Bets 页面 (传了 tab)，不展示非注单流水
// 			if qTab == "active" || qTab == "settled" {
// 				logger.Errorf("[GetBetHistory] filter no bet non bet ledger %v, tab: %v, parm: %+v", ledger, qTab, parm.OrderBy)
// 				continue
// 			}
// 			// 2. 核心修复：如果用户输入了关键词，而非注单根本没有“赛事/盘口”概念，直接过滤掉，绝不碰 EventInfo！
// 			if qSearch != "" {
// 				logger.Errorf("[GetBetHistory] qSearch filter non bet ledger %v, search: %v, parm: %+v", ledger, qSearch, parm.OrderBy)
// 				continue
// 			}
// 		}

// 		filteredLedgers = append(filteredLedgers, ledger)
// 	}
// 	logger.Infof("[GetBetHistory] 过滤后流水数量: %d", len(filteredLedgers))

// 	// --- 阶段 4：执行物理分页 ---
// 	total := len(filteredLedgers)
// 	startIndex := (page - 1) * pageSize
// 	endIndex := startIndex + pageSize

// 	// 越界安全防护
// 	if startIndex >= total {
// 		return &model.BetHistoryResponse{
// 			Total:        uint64(total),
// 			AssetLedgers: []model.AssetLedgerResponse{},
// 		}, nil
// 	}
// 	if endIndex > total {
// 		endIndex = total
// 	}

// 	return &model.BetHistoryResponse{
// 		Total:        uint64(total),
// 		AssetLedgers: filteredLedgers[startIndex:endIndex],
// 	}, nil
// }

// GetBetHistory My Bets 搜索与 History 搜索共用同一接口，通过参数区分场景。
func (s *authService) GetBetHistory(ctx context.Context, userId uint64, param model.GetBetHistoryRequest) (*model.BetHistoryResponse, error) {

	// 1. 规范化分页参数
	page := param.Page
	if page <= 0 {
		page = 1
	}
	pageSize := param.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 50 {
		pageSize = 50 // 强制硬限制最大 50 条
	}

	// 2. 规范化搜索参数 (全部转小写，防止匹配失败)
	qSearch := strings.ToLower(strings.TrimSpace(param.Search))
	qTab := strings.ToLower(strings.TrimSpace(param.Tab)) // active / settled / 空
	if qTab == "" {
		// 兼容前端早期把 My Bets 页签放在 status 参数里的调用；内部仍统一使用 tab 语义，避免两套过滤逻辑分叉。
		qTab = strings.ToLower(strings.TrimSpace(param.Status))
	}
	qTypes := model.NormalizeBetHistoryTypes(param.Type)        // bet 是“全部下注”筛选；bet_cancel/bet_won/bet_lost/claim_prize 等继续支持逗号分隔并集查询。
	qResult := strings.ToLower(strings.TrimSpace(param.Result)) // all / won / lost / push / void
	if qResult == "" {
		qResult = "all"
	}
	qBeginDate := strings.TrimSpace(param.BeginDate)
	qEndDate := strings.TrimSpace(param.EndDate)
	qOrderBy := strings.ToLower(strings.TrimSpace(param.OrderBy))
	if qOrderBy == "" {
		qOrderBy = "created_at"
	}
	qSort := strings.ToLower(strings.TrimSpace(param.Sort))
	if qSort == "" {
		qSort = "desc"
	}

	logger.Infof("[GetBetHistory] userId: %d, param: %+v", userId, param)

	parm := model.AssetLedgerRequest{
		OrderBy: qOrderBy,
		Sort:    qSort,
	}

	// ⚠️ 警告：当前为全量加载后在内存中过滤。当用户流水达到万级时，请务必改造为 SQL 层面的分页与过滤！
	history, err := s.userRepo.GetAssetLedgersByUserID(ctx, userId, parm, false)
	if err != nil {
		logger.Errorf("[GetBetHistory] 获取用户流水失败: %v", err)
		return nil, err
	}

	if history == nil || len(history.AssetLedgers) == 0 {
		logger.Infof("[GetBetHistory] 用户 %d 没有流水", userId)
		return &model.BetHistoryResponse{Total: 0, AssetLedgers: []model.AssetLedgerResponse{}}, nil
	}

	// --- 阶段 1：基础过滤 ---
	var firstPassLedgers []model.AssetLedgerResponse

	for _, item := range history.AssetLedgers {
		itemType := strings.ToLower(item.BusinessType)

		// 1.1 业务类型过滤
		if !matchHistoryLedgerTypes(qTypes, itemType) {
			continue
		}

		firstPassLedgers = append(firstPassLedgers, item)
	}

	// --- 阶段 2：批量查询 Event Info ---
	betIdsInfoMap, err := s.buildBetInfoMapByLedgers(ctx, firstPassLedgers)
	if err != nil {
		logger.Errorf("[GetBetHistory] 获取注单详情失败, parm: %+v, err: %v\n", parm.OrderBy, err)
		return nil, err // 此处获取失败直接抛错，保证数据完整性
	}

	// --- 阶段 3：深度过滤与数据组装 ---
	var filteredLedgers []model.AssetLedgerResponse
	for _, ledger := range firstPassLedgers {
		itemType := strings.ToLower(ledger.BusinessType)
		isBet := isBetHistoryLedgerType(itemType)

		if isBet {
			info, hasInfo := betIdsInfoMap[ledger.RefID]
			if !hasInfo {
				// 注单详情丢失，属于严重的数据不一致，跳过展示并记录 Error
				logger.Errorf("[GetBetHistory] 找不到注单详情, 过滤该流水. RefID: %s, parm: %+v", ledger.RefID, parm.OrderBy)
				continue
			}

			// 3.1 状态过滤 (My Bets 场景)
			status := strings.ToLower(strings.TrimSpace(info.Status))
			if !matchHistoryBetTypes(qTypes, itemType, status) {
				// 多选 type 是多个筛选条件的并集；bet_won/bet_lost/bet_cancel 仍需结合注单状态判断，不能只看流水 business_type。
				logger.Errorf("[GetBetHistory] filter history bet type ledger %v, status: %v, types: %v, parm: %+v", ledger, status, qTypes, parm.OrderBy)
				continue
			}
			if qTab == "active" && !isActiveBetStatus(status) {
				logger.Errorf("[GetBetHistory] filter active bet ledger %v, status: %v, parm: %+v", ledger, status, parm.OrderBy)
				continue
			}
			if qTab == "settled" {
				if !isSettledBetStatus(status) {
					logger.Errorf("[GetBetHistory] filter non settled bet ledger %v, status: %v, parm: %+v", ledger, status, parm.OrderBy)
					continue
				}
				if !matchSettledResult(qResult, status) {
					logger.Errorf("[GetBetHistory] filter settled result bet ledger %v, status: %v, result: %v, parm: %+v", ledger, status, qResult, parm.OrderBy)
					continue
				}
			}
			if !betHistoryDateAllowedForTypes(ledger, &info, qTypes, qTab, qBeginDate, qEndDate) {
				// won/lost 类型代表结算结果，日期筛选要按 settled_at；cancel 和普通流水仍按流水创建时间。
				logger.Errorf("[GetBetHistory] bet history date filter ledger %v, status: %v, types: %v, parm: %+v", ledger, status, qTypes, parm.OrderBy)
				continue
			}

			// 3.2 关键词模糊搜索 (匹配 MarketName 需求)
			if qSearch != "" {
				// 需求：Market Name 搜索。这里使用 FixtureName/MarketName 作为匹配源，如有调整请修改字段
				targetName := strings.ToLower(strings.TrimSpace(info.FixtureName + " " + info.MarketType + " " + info.Selection))
				if !strings.Contains(targetName, qSearch) {
					logger.Errorf("[GetBetHistory] qSearch filter bet ledger, ledger: %v, search: %v, parm: %+v", ledger, qSearch, parm.OrderBy)
					continue
				}
			}

			// 注入注单详情
			ledger.EventInfo = &info

		} else {
			// 对于非注单类型 (Deposit, Withdraw 等)
			// 1. 如果用户处于 My Bets 页面 (传了 tab)，不展示非注单流水
			if qTab == "active" || qTab == "settled" {
				logger.Errorf("[GetBetHistory] filter no bet non bet ledger %v, tab: %v, parm: %+v", ledger, qTab, parm.OrderBy)
				continue
			}
			// 2. 核心修复：如果用户输入了关键词，而非注单根本没有“赛事/盘口”概念，直接过滤掉，绝不碰 EventInfo！
			if qSearch != "" {
				logger.Errorf("[GetBetHistory] qSearch filter non bet ledger %v, search: %v, parm: %+v", ledger, qSearch, parm.OrderBy)
				continue
			}
			if !betHistoryDateAllowed(ledger, nil, qTab, qBeginDate, qEndDate) {
				logger.Errorf("[GetBetHistory] non bet date filter ledger %v, types: %v, parm: %+v", ledger, qTypes, parm.OrderBy)
				continue
			}
			// claim_prize 不参与 bet 的状态/搜索过滤，但 ref_id 指向原注单，需要把比赛信息回填到 event_info，
			// 让前端 History 在领取流水上能展示对应比赛；找不到注单详情时保持 nil，不阻断整页展示。
			if itemType == model.AssetTypeClaimPrize {
				if info, has := betIdsInfoMap[ledger.RefID]; has {
					ledger.EventInfo = &info
				}
			}
		}

		normalizeBetHistoryLedgerForResponse(&ledger)
		filteredLedgers = append(filteredLedgers, ledger)
	}
	logger.Infof("[GetBetHistory] 过滤后流水数量: %d", len(filteredLedgers))
	sortTab := qTab
	if historyTypesUseSettledDate(qTypes) {
		// 只要多选条件里包含 bet_won/bet_lost，下注结果流水的展示顺序就应贴近结算发生时间。
		sortTab = "settled"
	}

	// 根据active过滤条目
	if param.Tab == "active" {
		newLedgers := make([]model.AssetLedgerResponse, 0, len(filteredLedgers))
		cancelMap := make(map[int64]struct{})
		bannerMap := make(map[int64]struct{})
		for _, item := range filteredLedgers {
			if item.BusinessType == "cancel_bet" && item.EventInfo != nil {
				cancelMap[item.EventInfo.OddID] = struct{}{}
			}
			if item.BusinessType == "banner_single" && item.EventInfo != nil {
				bannerMap[item.EventInfo.OddID] = struct{}{}
			}
		}
		for _, item := range filteredLedgers {
			if item.EventInfo != nil {
				_, has := cancelMap[item.EventInfo.OddID]
				if has {
					continue
				}
			}
			if item.BusinessType == "single" {
				_, has := bannerMap[item.EventInfo.OddID]
				if has {
					continue
				}
			}
			newLedgers = append(newLedgers, item)
		}
		filteredLedgers = newLedgers
	}

	sortBetHistoryLedgers(filteredLedgers, sortTab, qOrderBy, qSort)

	// --- 阶段 4：执行物理分页 ---
	total := len(filteredLedgers)
	startIndex := (page - 1) * pageSize
	endIndex := startIndex + pageSize

	// 越界安全防护
	if startIndex >= total {
		return &model.BetHistoryResponse{
			Total:        uint64(total),
			AssetLedgers: []model.AssetLedgerResponse{},
		}, nil
	}
	if endIndex > total {
		endIndex = total
	}

	pagedLedgers := filteredLedgers[startIndex:endIndex]
	if err := s.hydrateHistoryLedgerStatuses(ctx, userId, pagedLedgers); err != nil {
		logger.Errorf("[GetBetHistory] 补齐流水状态失败, user_id:%d err:%v", userId, err)
		return nil, err
	}
	if err := s.hydrateHistoryClaimFlags(ctx, userId, pagedLedgers); err != nil {
		logger.Errorf("[GetBetHistory] 补齐领取入口状态失败, user_id:%d err:%v", userId, err)
		return nil, err
	}

	return &model.BetHistoryResponse{
		Total:        uint64(total),
		AssetLedgers: pagedLedgers,
	}, nil
}

func (s *authService) hydrateHistoryLedgerStatuses(ctx context.Context, userID uint64, ledgers []model.AssetLedgerResponse) error {
	if len(ledgers) == 0 {
		return nil
	}

	withdrawOrderSns := make([]string, 0)
	withdrawOrderSet := make(map[string]struct{})
	for i := range ledgers {
		ledgers[i].Status = int8(defaultHistoryLedgerStatus(ledgers[i].BusinessType))

		if !isWithdrawHistoryLedgerType(ledgers[i].BusinessType) {
			continue
		}
		orderSn := strings.TrimSpace(ledgers[i].RefID)
		if orderSn == "" {
			continue
		}
		if _, exists := withdrawOrderSet[orderSn]; exists {
			continue
		}
		withdrawOrderSet[orderSn] = struct{}{}
		withdrawOrderSns = append(withdrawOrderSns, orderSn)
	}

	if len(withdrawOrderSns) == 0 {
		return nil
	}

	records, err := s.userRepo.GetWithdrawRecordsByUserIDAndOrderSns(ctx, userID, withdrawOrderSns)
	if err != nil {
		logger.Errorf("[hydrateHistoryLedgerStatuses] get withdraw records failed, user_id:%d err:%v", userID, err)
		return err
	}
	withdrawMap := make(map[string]model.WithdrawRecord, len(records))
	for _, record := range records {
		withdrawMap[record.OrderSn] = record
	}

	for i := range ledgers {
		if !isWithdrawHistoryLedgerType(ledgers[i].BusinessType) {
			continue
		}
		record, exists := withdrawMap[strings.TrimSpace(ledgers[i].RefID)]
		if !exists {
			// 提现流水和提现单理论上同事务写入；遇到历史脏数据时保留上面的默认展示状态，避免整页 History 因单条异常不可用。
			logger.Errorf("[hydrateHistoryLedgerStatuses] withdraw record missing, user_id:%d ref_id:%s business_type:%s", userID, ledgers[i].RefID, ledgers[i].BusinessType)
			continue
		}

		status, errorMsg := historyStatusFromWithdrawRecord(record)
		ledgers[i].Status = int8(status)
		ledgers[i].ErrorMsg = errorMsg
	}

	return nil
}

// 补齐历史领取入口状态，根据用户已领取的注单ID判断是否可领取当前注单
func (s *authService) hydrateHistoryClaimFlags(ctx context.Context, userID uint64, ledgers []model.AssetLedgerResponse) error {
	if len(ledgers) == 0 {
		return nil
	}

	candidates := make(map[int]uint64)
	candidateBetIDs := make([]uint64, 0)
	seenBetIDs := make(map[uint64]struct{})
	for i := range ledgers {
		ledgers[i].EnableClaim = false

		betID, ok := historyClaimCandidateBetID(ledgers[i])
		if !ok {
			continue
		}
		candidates[i] = betID
		if _, exists := seenBetIDs[betID]; exists {
			continue
		}
		seenBetIDs[betID] = struct{}{}
		candidateBetIDs = append(candidateBetIDs, betID)
	}
	if len(candidateBetIDs) == 0 {
		return nil
	}

	claimedBetIDs, err := s.userRepo.GetClaimedBetIDsByUserIDAndBetIDs(ctx, userID, candidateBetIDs)
	if err != nil {
		return err
	}
	for index, betID := range candidates {
		if _, alreadyClaimed := claimedBetIDs[betID]; alreadyClaimed {
			continue
		}
		// 这里不把注单状态改成 CLAIMED，是为了继续保留比赛结算结果；领取按钮只由 enable_claim 控制。
		ledgers[index].EnableClaim = true
	}
	return nil
}

func historyClaimCandidateBetID(ledger model.AssetLedgerResponse) (uint64, bool) {
	if !isClaimableHistoryLedgerType(ledger.BusinessType) || ledger.EventInfo == nil {
		return 0, false
	}
	if !isClaimableHistoryBetStatus(ledger.EventInfo.Status) {
		return 0, false
	}
	actualPayout, err := decimal.NewFromString(strings.TrimSpace(ledger.EventInfo.ActualPayout))
	if err != nil || !actualPayout.IsPositive() {
		if err != nil && strings.TrimSpace(ledger.EventInfo.ActualPayout) != "" {
			logger.Errorf("[historyClaimCandidateBetID] invalid actual_payout, ref_id:%s actual_payout:%s err:%v", ledger.RefID, ledger.EventInfo.ActualPayout, err)
		}
		// actual_payout 是结算 worker 写入的真实可领取金额；没有正数金额时不能开放领取，避免前端用预计派彩误导用户。
		return 0, false
	}
	betID, err := strconv.ParseUint(strings.TrimSpace(ledger.RefID), 10, 64)
	if err != nil || betID == 0 {
		if err != nil {
			logger.Errorf("[historyClaimCandidateBetID] invalid bet ref_id, ref_id:%s err:%v", ledger.RefID, err)
		}
		return 0, false
	}
	return betID, true
}

func isClaimableHistoryLedgerType(businessType string) bool {
	switch strings.ToLower(strings.TrimSpace(businessType)) {
	case model.AssetTypeSingle, model.AssetTypeParlay:
		return true
	default:
		return false
	}
}

func isClaimableHistoryBetStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "won", "push", "void":
		// 与领取接口保持同一批终局状态，避免 History 露出的领取入口和真实领取状态机不一致。
		return true
	default:
		return false
	}
}

func defaultHistoryLedgerStatus(businessType string) model.HistoryLedgerStatus {
	switch strings.ToLower(strings.TrimSpace(businessType)) {
	case model.AssetTypeWithDraw:
		// 提现流水创建时原始状态是待审核；真正状态会在同页批量查 withdraw_record 后覆盖。
		return model.HistoryLedgerStatusReviewing
	case string(model.BusinessTypeCancelWithdraw):
		return model.HistoryLedgerStatusCanceled
	case model.AssetTypeStake, model.AssetTypeUnstake, model.AssetTypeAddLp, model.AssetTypeRemoveLp:
		// stake/lp 链路本期还未接入状态表，先保持成功占位，后续有链上任务状态后在这里统一映射。
		return model.HistoryLedgerStatusCompleted
	case model.AssetTypeDeposit:
		// 当前充值流水只在入账后进入 asset_ledger；pending/failed 需要后续明确 deposit_record 与流水的关联后再补。
		return model.HistoryLedgerStatusCompleted
	default:
		// bet/cancel_bet/claim_prize 当前都是成功资产变动后才写 asset_ledger，失败不会留下可展示流水。
		return model.HistoryLedgerStatusCompleted
	}
}

func isWithdrawHistoryLedgerType(businessType string) bool {
	switch strings.ToLower(strings.TrimSpace(businessType)) {
	case model.AssetTypeWithDraw, string(model.BusinessTypeCancelWithdraw):
		return true
	default:
		return false
	}
}

func historyStatusFromWithdrawRecord(record model.WithdrawRecord) (model.HistoryLedgerStatus, string) {
	switch record.Status {
	case 1:
		return model.HistoryLedgerStatusReviewing, ""
	case 2:
		return model.HistoryLedgerStatusProcessing, ""
	case 3:
		return model.HistoryLedgerStatusCompleted, ""
	case 4, 5:
		// 提现审核驳回和打款失败都面向 History 展示为失败，remark 是当前唯一稳定失败原因来源。
		return model.HistoryLedgerStatusFailed, strings.TrimSpace(record.Remark)
	case 6:
		return model.HistoryLedgerStatusCanceled, ""
	default:
		// 未知状态不应伪装成成功；按进行中展示能提示前端保守处理，同时保留日志排查空间。
		logger.Errorf("[historyStatusFromWithdrawRecord] unknown withdraw status, order_sn:%s status:%d", record.OrderSn, record.Status)
		return model.HistoryLedgerStatusProcessing, ""
	}
}

func isActiveBetStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "live", "pending":
		return true
	default:
		return false
	}
}

func isSettledBetStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "won", "lost", "push", "void":
		return true
	default:
		return false
	}
}

func matchSettledResult(result string, status string) bool {
	result = strings.ToLower(strings.TrimSpace(result))
	status = strings.ToLower(strings.TrimSpace(status))
	if result == "" || result == "all" {
		return true
	}
	// result 只接受结算服务会写入的终局状态，避免 CLAIMED/CANCELLED 等资金流程状态混进比赛结果筛选。
	if !isSettledBetStatus(result) {
		return false
	}
	return status == result
}

func normalizeBetHistoryStatus(status string) string {
	return strings.ToUpper(strings.TrimSpace(status))
}

func normalizeBetHistoryLedgerForResponse(ledger *model.AssetLedgerResponse) {
	if ledger == nil {
		return
	}
	// History 对外时间统一使用 UTC，避免 Go 按 time.Location 输出 +08:00 等偏移后前端展示口径不一致。
	ledger.CreatedAt = ledger.CreatedAt.UTC()
	if ledger.EventInfo != nil {
		normalizeBetHistoryEventInfoForResponse(ledger.EventInfo)
	}
}

func normalizeBetHistoryEventInfoForResponse(info *model.BetHoldingResult) {
	if info == nil {
		return
	}
	// History 面向前端统一返回大写状态；数据库里 live 是小写、结算状态多为大写，直接透传会增加前端分支成本。
	info.Status = normalizeBetHistoryStatus(info.Status)
	info.FixtureTime = normalizeBetHistoryFixtureTime(info.FixtureTime)
	if info.SettledAt != nil {
		settledAt := info.SettledAt.UTC()
		info.SettledAt = &settledAt
	}
}

func normalizeBetHistoryFixtureTime(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if fixtureAt, ok := parseBetHistoryFixtureTime(raw); ok {
		// 赛事时间来自外部赔率源，历史数据里混有无时区字符串；无时区时按 UTC 解释，避免前端按本地时区二次偏移。
		return fixtureAt.UTC().Format(time.RFC3339)
	}
	return raw
}

func parseBetHistoryFixtureTime(raw string) (time.Time, bool) {
	if fixtureAt, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return fixtureAt, true
	}
	for _, layout := range []string{
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05 Z07:00",
		"2006-01-02 15:04:05 -0700",
		"2006-01-02 15:04:05 MST",
	} {
		if fixtureAt, err := time.Parse(layout, raw); err == nil {
			return fixtureAt, true
		}
	}
	for _, layout := range []string{
		time.DateTime,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02T15:04:05.999999999",
		"2006-01-02 15:04",
		"2006-01-02T15:04",
	} {
		if fixtureAt, err := time.ParseInLocation(layout, raw, time.UTC); err == nil {
			return fixtureAt, true
		}
	}
	return time.Time{}, false
}

func historyTypesAllowAll(historyTypes []string) bool {
	return len(historyTypes) == 0 || lo.Contains(historyTypes, model.HistoryTypeAll)
}

func matchHistoryLedgerTypes(historyTypes []string, ledgerType string) bool {
	ledgerType = strings.ToLower(strings.TrimSpace(ledgerType))
	if historyTypesAllowAll(historyTypes) {
		return true
	}
	for _, historyType := range historyTypes {
		if isHistoryBetType(historyType) {
			if matchHistoryBetLedgerType(historyType, ledgerType) {
				return true
			}
			continue
		}
		if ledgerType == historyType {
			return true
		}
	}
	return false
}

func matchHistoryBetTypes(historyTypes []string, ledgerType string, status string) bool {
	if historyTypesAllowAll(historyTypes) {
		return true
	}
	for _, historyType := range historyTypes {
		if !isHistoryBetType(historyType) {
			continue
		}
		if matchHistoryBetLedgerType(historyType, ledgerType) && matchHistoryBetStatus(historyType, status) {
			return true
		}
	}
	return false
}

func historyTypesUseSettledDate(historyTypes []string) bool {
	for _, historyType := range historyTypes {
		if historyTypeUsesSettledDate(historyType) {
			return true
		}
	}
	return false
}

func betHistoryDateAllowedForTypes(ledger model.AssetLedgerResponse, info *model.BetHoldingResult, historyTypes []string, tab string, beginDate string, endDate string) bool {
	if beginDate == "" && endDate == "" {
		return true
	}
	if strings.ToLower(strings.TrimSpace(tab)) == "settled" {
		return betHistoryDateAllowed(ledger, info, tab, beginDate, endDate)
	}
	if info != nil && historyBetUsesSettledDate(historyTypes, ledger.BusinessType, info.Status) {
		// bet_won/bet_lost 是按比赛结算结果筛选，用户传日期时应看 settled_at，而不是下注流水创建时间。
		return betHistoryDateAllowed(ledger, info, "settled", beginDate, endDate)
	}
	return betHistoryDateAllowed(ledger, nil, tab, beginDate, endDate)
}

func historyBetUsesSettledDate(historyTypes []string, ledgerType string, status string) bool {
	if lo.Contains(historyTypes, model.HistoryTypeBetBanner) && matchHistoryBetLedgerType(model.HistoryTypeBetBanner, ledgerType) {
		// bet_banner 是按 Banner 下注流水查询历史记录；即使未来 Banner 有结算状态，也不能因为缺少 settled_at 把下注历史过滤掉。
		return false
	}
	for _, historyType := range historyTypes {
		if !historyTypeUsesSettledDate(historyType) {
			continue
		}
		if matchHistoryBetLedgerType(historyType, ledgerType) && matchHistoryBetStatus(historyType, status) {
			return true
		}
	}
	return false
}

func isHistoryBetType(historyType string) bool {
	switch strings.ToLower(strings.TrimSpace(historyType)) {
	case model.HistoryTypeBet, model.HistoryTypeBetCancel, model.HistoryTypeBetWon, model.HistoryTypeBetLost, model.HistoryTypeBetBanner:
		return true
	default:
		return false
	}
}

func isBetPlaceLedgerType(ledgerType string) bool {
	switch strings.ToLower(strings.TrimSpace(ledgerType)) {
	case model.AssetTypeSingle, model.AssetTypeParlay, model.AssetTypeBannerSingle:
		return true
	default:
		return false
	}
}

func isBetHistoryLedgerType(ledgerType string) bool {
	ledgerType = strings.ToLower(strings.TrimSpace(ledgerType))
	return isBetPlaceLedgerType(ledgerType) || ledgerType == model.AssetTypeCancelBet
}

func matchHistoryBetLedgerType(historyType string, ledgerType string) bool {
	historyType = strings.ToLower(strings.TrimSpace(historyType))
	ledgerType = strings.ToLower(strings.TrimSpace(ledgerType))
	switch historyType {
	case model.HistoryTypeBet:
		// type=bet 是 Portfolio“全部投注”的基础枚举，只看下注流水类型，不看注单结算状态，避免 pending/live/PUSH/VOID 注单被旧的 win/loss 聚合漏掉。
		return isBetPlaceLedgerType(ledgerType)
	case model.HistoryTypeBetWon, model.HistoryTypeBetLost:
		// 输赢不是 asset_ledger 的原生业务类型，只能先取下注流水，再用注单状态做二次过滤。
		return isBetPlaceLedgerType(ledgerType)
	case model.HistoryTypeBetCancel:
		return ledgerType == model.AssetTypeCancelBet
	case model.HistoryTypeBetBanner:
		// Banner 下注在资产流水里使用 banner_single，前端通过 bet_banner 这个业务枚举筛选，避免暴露内部流水命名。
		return ledgerType == model.AssetTypeBannerSingle
	default:
		return false
	}
}

func matchHistoryBetStatus(historyType string, status string) bool {
	historyType = strings.ToLower(strings.TrimSpace(historyType))
	status = strings.ToLower(strings.TrimSpace(status))
	switch historyType {
	case model.HistoryTypeBetWon:
		return status == "won"
	case model.HistoryTypeBetLost:
		return status == "lost"
	case model.HistoryTypeBetCancel:
		return status == "cancelled"
	default:
		return true
	}
}

func historyTypeUsesSettledDate(historyType string) bool {
	switch strings.ToLower(strings.TrimSpace(historyType)) {
	case model.HistoryTypeBetWon, model.HistoryTypeBetLost:
		return true
	default:
		return false
	}
}

func betHistoryDateAllowed(ledger model.AssetLedgerResponse, info *model.BetHoldingResult, tab string, beginDate string, endDate string) bool {
	if beginDate == "" && endDate == "" {
		return true
	}

	dateAt := ledger.CreatedAt
	if strings.ToLower(strings.TrimSpace(tab)) == "settled" {
		if info == nil || info.SettledAt == nil {
			// settled 页必须按结算时间过滤；缺少 settled_at 的历史脏数据不能用下注流水时间冒充结算时间。
			return false
		}
		dateAt = *info.SettledAt
	}

	// 这里继续使用 YYYY-MM-DD 字符串比较，前提是 CreatedAt/SettledAt 已经是服务端统一时区。
	dateStr := dateAt.Format("2006-01-02")
	if beginDate != "" && dateStr < beginDate {
		return false
	}
	if endDate != "" && dateStr > endDate {
		return false
	}
	return true
}

func sortBetHistoryLedgers(ledgers []model.AssetLedgerResponse, tab string, orderBy string, sortOrder string) {
	if strings.ToLower(strings.TrimSpace(tab)) != "settled" || strings.ToLower(strings.TrimSpace(orderBy)) != "created_at" {
		return
	}
	desc := strings.ToLower(strings.TrimSpace(sortOrder)) != "asc"
	sort.SliceStable(ledgers, func(i, j int) bool {
		left := betHistorySettledSortTime(ledgers[i])
		right := betHistorySettledSortTime(ledgers[j])
		if desc {
			return left.After(right)
		}
		return left.Before(right)
	})
}

func betHistorySettledSortTime(ledger model.AssetLedgerResponse) time.Time {
	if ledger.EventInfo != nil && ledger.EventInfo.SettledAt != nil {
		return *ledger.EventInfo.SettledAt
	}
	// 理论上 settled 列表都应该有 settled_at；这里回退到流水时间只为兼容历史脏数据，避免排序 panic 或完全不可预期。
	return ledger.CreatedAt
}

func (s *authService) GetAssetLedger(ctx context.Context, userId uint64, param model.AssetLedgerRequest) (*model.AssetLedgersResponse, error) {
	assetLedgers, err := s.userRepo.GetAssetLedgersByUserID(ctx, userId, param, true)
	if err != nil {
		return nil, err
	}

	// 返回空
	if assetLedgers == nil || len(assetLedgers.AssetLedgers) == 0 {
		return &model.AssetLedgersResponse{AssetLedgers: []model.AssetLedgerResponse{}}, nil
	}

	betsLedgers := lo.Filter(assetLedgers.AssetLedgers, func(item model.AssetLedgerResponse, index int) bool {
		return lo.Contains([]string{model.AssetTypeSingle, model.AssetTypeParlay, model.AssetTypeBannerSingle}, item.BusinessType)
	})
	betIdsInfoMap, err := s.buildBetInfoMapByLedgers(ctx, betsLedgers)
	if err != nil {
		return nil, err
	}

	for i := range assetLedgers.AssetLedgers {
		if info, has := betIdsInfoMap[assetLedgers.AssetLedgers[i].RefID]; has {
			assetLedgers.AssetLedgers[i].EventInfo = &info
		}
	}

	return assetLedgers, nil
}

// buildBetInfoMapByLedgers 根据流水里的业务类型，分别查询常规注单和 Banner 注单详情。
func (s *authService) buildBetInfoMapByLedgers(ctx context.Context, ledgers []model.AssetLedgerResponse) (map[string]model.BetHoldingResult, error) {
	normalBetIDs := make([]uint64, 0, len(ledgers))
	bannerBetIDs := make([]uint64, 0, len(ledgers))
	// 同一个 bet_id 经常同时出现 single/claim_prize 两条流水；这里去重避免 IN 查询里重复 ID。
	seenNormal := make(map[uint64]struct{}, len(ledgers))
	seenBanner := make(map[uint64]struct{}, len(ledgers))

	for _, item := range ledgers {
		id, err := strconv.ParseUint(item.RefID, 10, 64)
		if err != nil {
			logger.Errorf("[buildBetInfoMapByLedgers] str conv ref id error, id:%s business_type:%s err:%v", item.RefID, item.BusinessType, err)
			continue
		}
		switch strings.ToLower(item.BusinessType) {
		case model.AssetTypeSingle, model.AssetTypeParlay, model.AssetTypeCancelBet, model.AssetTypeClaimPrize:
			// cancel_bet / claim_prize 的 ref_id 同样指向 user_bet_holding.id，查询普通注单详情后才能支持搜索和前端展示赛事信息。
			if _, ok := seenNormal[id]; ok {
				continue
			}
			seenNormal[id] = struct{}{}
			normalBetIDs = append(normalBetIDs, id)
		case model.AssetTypeBannerSingle:
			if _, ok := seenBanner[id]; ok {
				continue
			}
			seenBanner[id] = struct{}{}
			bannerBetIDs = append(bannerBetIDs, id)
		}
	}

	betInfoMap := make(map[string]model.BetHoldingResult, len(normalBetIDs)+len(bannerBetIDs))
	if len(normalBetIDs) > 0 {
		betInfo, err := s.userRepo.GetBetHoldingByOrders(ctx, normalBetIDs)
		if err != nil {
			logger.Errorf("[buildBetInfoMapByLedgers] query normal bets failed, ids:%v err:%v", normalBetIDs, err)
			return nil, err
		}
		for _, item := range betInfo.Results {
			betInfoMap[strconv.FormatUint(item.Id, 10)] = item
		}
	}

	if len(bannerBetIDs) > 0 {
		bannerInfo, err := s.userRepo.GetBannerBetHoldingByOrders(ctx, bannerBetIDs)
		if err != nil {
			logger.Errorf("[buildBetInfoMapByLedgers] query banner bets failed, ids:%v err:%v", bannerBetIDs, err)
			return nil, err
		}
		for _, item := range bannerInfo.Results {
			betInfoMap[strconv.FormatUint(item.Id, 10)] = item
		}
	}

	return betInfoMap, nil
}

// 提现申请
func (s *authService) WithDrawApply(ctx context.Context, userId uint64, param model.WithDrawApplyRequest) (*model.WithDrawApplyResponse, error) {
	// 1. 获取user_id 对应的eoa地址
	user, err := s.userRepo.GetUserInfoByID(ctx, userId)
	if err != nil {
		logger.Errorf("withdraw apply get user info by user_id error: %v", err)
		return nil, err
	}
	if user == nil {
		logger.Errorf("withdraw apply get user info by user_id not found, userId : %d", userId)
		return nil, ErrUserNotFound
	}

	// 2. 校验私钥签名msg中的地址是否为提现地址
	msg := fmt.Sprintf("Oddfi withdraw amount: %s, withdraw address: %s, sig time: %d", param.Amount.String(), strings.ToLower(param.WithDrawAddress), param.SigTime)
	if !s.verifySignature(user.SigningAddress, msg, param.WithdrawSig) {
		return nil, ErrInvalidSignature
	}

	// // 3. 校验eoa地址是否与签名地址相同
	// if !strings.EqualFold(param.WithDrawAddress, user.SigningAddress) {
	// 	logger.Errorf("withdraw apply eoa address is not the same as the signing address, eoa address: %s, signing address: %s", param.WithDrawAddress, user.SigningAddress)
	// 	return nil, ErrInvalidSignatureAddress
	// }

	// 4. 检查 提现金额是否ok，是否能支持提现
	balInfo, err := s.GetUserBalance(ctx, userId)
	if err != nil {
		logger.Errorf("withdraw apply get user balance error: %v", err)
		return nil, err
	}

	if balInfo.AvailableBalance.LessThan(param.Amount) {
		logger.Errorf("withdraw apply available balance is less than the amount, available balance: %s, amount: %s", balInfo.AvailableBalance.String(), param.Amount.String())
		return nil, ErrInsufficientBalance
	}

	// 5. 生成业务流水号id
	uuid := uuid.NewSHA1(uuid.New(), []byte(fmt.Sprintf("%d", userId))).String()

	// 6. 计算手续费和实际到账
	fee := decimal.NewFromFloat(0.5)
	realAmount := param.Amount.Sub(fee)

	// 7.识别风险等级
	var riskLevel int8
	if param.Amount.GreaterThan(decimal.NewFromInt(5000)) {
		riskLevel = 1
	}

	// 7.  执行库操作
	err = s.userRepo.WithdrawApply(ctx, userId, model.WithdrawRecord{
		UserID:     userId,                //用户ID
		OrderSn:    uuid,                  //业务流水号
		Chain:      param.Chain,           //提现链名称
		Amount:     param.Amount,          //提现数量
		Fee:        fee,                   //手续费
		RealAmount: realAmount,            //实际到账数量
		ToAddress:  param.WithDrawAddress, //提现地址
		Status:     1,                     //提现状态 1:待审核, 2:审核通过(处理中), 3:已完成, 4:审核驳回, 5:提现失败(打款失败), 6:用户取消
		RiskLevel:  riskLevel,             //风险等级 0:正常, 1:高风险需人工
		CreatedAt:  time.Now(),            //申请时间
	})
	if err != nil {
		logger.Errorf("db with draw apply err, err:%v", err)
		return nil, err
	}

	return &model.WithDrawApplyResponse{
		WithdrawAddress: param.WithDrawAddress,
		RealAmount:      realAmount,
		Fee:             fee,
		OrderSn:         uuid,
	}, nil
}

// 提现记录查询
func (s *authService) GetWithDrawRecord(ctx context.Context, userId uint64) (*model.WithDrawRecordsRes, error) {
	records, err := s.userRepo.GetWithDrawRecordsByUserID(ctx, userId)
	if err != nil {
		logger.Errorf("db with draw apply err, err:%v", err)
		return nil, err
	}

	res := make([]model.WithDrawRecordRes, 0, len(records))
	for _, item := range records {
		res = append(res, model.WithDrawRecordRes{
			OrderSn:    item.OrderSn,
			Chain:      item.Chain,
			Amount:     item.Amount,
			Fee:        item.Fee,
			RealAmount: item.RealAmount,
			ToAddress:  item.ToAddress,
			TxHash:     item.TxHash,
			Status:     item.Status,
			CreatedAt:  item.CreatedAt,
		})
	}
	return &model.WithDrawRecordsRes{Records: res}, nil
}

// 取消提现
func (s *authService) WithDrawCannel(ctx context.Context, userId uint64, order string) error {
	return s.userRepo.WithDrawCannel(ctx, userId, order)
}
