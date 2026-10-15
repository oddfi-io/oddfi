package model

import (
	"time"

	"github.com/shopspring/decimal"
)

type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

type UserProfileResponse struct {
	UserID   uint64 `json:"user_id"`
	Email    string `json:"email"`
	Nickname string `json:"nickname"`
	Phone    string `json:"phone,omitempty"`
}

type LogoutResponse struct {
	Message string `json:"message"`
}

type WalletLoginStep1Data struct {
	Nonce string `json:"nonce"`
}

type WalletLoginStep2Data struct {
	AccessToken  *TokenData `json:"access_token"`
	RefreshToken *TokenData `json:"refresh_token"`
}

type TokenData struct {
	ExpireAt int64  `json:"expire_at"`
	Token    string `json:"token"`
}

type WalletLoginResponse struct {
	Data      interface{} `json:"data"`
	Done      bool        `json:"done"`
	SessionID string      `json:"session_id"`
	Step      int         `json:"step"`
	Require   []string    `json:"require,omitempty"`
}

type BalanceResponse struct {
	// UserID           uint64          `json:"user_id"`
	AvailableBalance decimal.Decimal `json:"available_balance" swaggertype:"string"`
	FrozenBalance    decimal.Decimal `json:"frozen_balance" swaggertype:"string"`
	ClaimableBalance decimal.Decimal `json:"claimable_balance" swaggertype:"string"`
	BetLockBalance   decimal.Decimal `json:"bet_lock_balance" swaggertype:"string"`
	StakeLockBalance decimal.Decimal `json:"stake_lock_balance" swaggertype:"string"`
	LiqLockBalance   decimal.Decimal `json:"liq_lock_balance" swaggertype:"string"`
	TotalBalance     decimal.Decimal `json:"total_balance" swaggertype:"string"`
}

type DepositAddressResponse struct {
	Address string `json:"address"`
	Chain   string `json:"chain"`
}

type AssetLedgersResponse struct {
	AssetLedgers []AssetLedgerResponse `json:"asset_ledgers"`
}

type AssetLedgerResponse struct {
	BusinessType  string            `json:"business_type"`
	Amount        decimal.Decimal   `json:"amount" swaggertype:"string"`
	BalanceBefore decimal.Decimal   `json:"balance_before" swaggertype:"string"`
	BalanceAfter  decimal.Decimal   `json:"balance_after" swaggertype:"string"`
	RefID         string            `json:"ref_id,omitempty"`
	Status        int8              `json:"status,omitempty"`
	ErrorMsg      string            `json:"error_msg,omitempty"`
	EnableClaim   bool              `json:"enable_claim"` // History 领取入口开关；默认 false，只有 service 确认注单未领取且金额可领时才置 true。
	EventInfo     *BetHoldingResult `json:"event_info"`
	CreatedAt     time.Time         `json:"created_at"`
}

type WithDrawApplyResponse struct {
	WithdrawAddress string          `json:"withdraw_address"`
	RealAmount      decimal.Decimal `json:"real_amount" swaggertype:"string"`
	Fee             decimal.Decimal `json:"fee" swaggertype:"string"`
	OrderSn         string          `json:"order_sn"`
}

type WithDrawRecordsRes struct {
	Records []WithDrawRecordRes `json:"records"`
}

type WithDrawRecordRes struct {
	OrderSn    string          `json:"order_sn"`
	Chain      string          `json:"chain"`
	Amount     decimal.Decimal `json:"amount" swaggertype:"string"`
	Fee        decimal.Decimal `json:"fee" swaggertype:"string"`
	RealAmount decimal.Decimal `json:"real_amount" swaggertype:"string"`
	ToAddress  string          `json:"to_address"` // 提现地址
	TxHash     string          `json:"tx_hash"`
	Status     int8            `json:"status"` //审核状态
	CreatedAt  time.Time       `json:"created_at"`
}

type WithdrawCancelResponse struct {
	Status string `json:"status"`
}

// BetHistoryResponse 资产 History 响应。
// 注意：AssetLedgers.Status 是 History 表格展示用的统一状态；event_info.status 仍保留注单/赛果语义，
// service 层会统一转成大写，屏蔽数据库里 live 小写、结算状态大写的历史差异。
type BetHistoryResponse struct {
	Total        uint64                `json:"total"`
	AssetLedgers []AssetLedgerResponse `json:"asset_ledgers"`
}
type BetHoldingResponse struct {
	UserID  uint64             `json:"user_id"`
	Results []BetHoldingResult `json:"results"`
}

// BannerBetPlaceResponse Banner 下注成功后的返回结构。
type BannerBetPlaceResponse struct {
	BetID       uint64          `json:"bet_id"`
	Status      string          `json:"status"`
	BannerCode  string          `json:"banner_code"`
	MarketID    int64           `json:"market_id"`
	SelectionID int64           `json:"selection_id"`
	Stake       decimal.Decimal `json:"stake" swaggertype:"string"`
	Odds        decimal.Decimal `json:"odds" swaggertype:"string"`
	Payout      decimal.Decimal `json:"payout" swaggertype:"string"`
}

// BannerBetHoldingItem Banner 注单查询项。
type BannerBetHoldingItem struct {
	BetID       uint64          `json:"bet_id"`
	BannerCode  string          `json:"banner_code"`
	MarketID    int64           `json:"market_id"`
	SelectionID int64           `json:"selection_id"`
	Market      string          `json:"market"`
	Selection   string          `json:"selection"`
	Type        string          `json:"type"`
	Status      string          `json:"status"`
	Stake       decimal.Decimal `json:"stake" swaggertype:"string"`
	Odds        string          `json:"odds"`
	Payout      string          `json:"payout"`
	RefID       string          `json:"ref_id"`
	CreatedAt   time.Time       `json:"created_at"`
}

// BannerBetHoldingResponse Banner 注单列表查询响应。
type BannerBetHoldingResponse struct {
	UserID  uint64                 `json:"user_id"`
	Results []BannerBetHoldingItem `json:"results"`
}

type WithdrawFeeResponse struct {
	TotalAmount decimal.Decimal `json:"total_amount" swaggertype:"string"` // 总提现金额
	Fee         decimal.Decimal `json:"fee" swaggertype:"string"`          // 手续费
	RealAmount  decimal.Decimal `json:"real_amount" swaggertype:"string"`  // 实际提现金额
}

type PendingOrdersResponse struct {
	List  []WithdrawRecordItem `json:"list"`
	Total int64                `json:"total"`
}

type WithdrawRecordItem struct {
	ID         uint64          `json:"id"`
	UserID     uint64          `json:"user_id"`
	OrderSn    string          `json:"order_sn"`
	CoinSymbol string          `json:"coin_symbol"`
	Chain      string          `json:"chain"`
	Amount     decimal.Decimal `json:"amount" swaggertype:"string"`
	Fee        decimal.Decimal `json:"fee" swaggertype:"string"`
	RealAmount decimal.Decimal `json:"real_amount" swaggertype:"string"`
	ToAddress  string          `json:"to_address"`
	RiskLevel  int8            `json:"risk_level"`
	Status     int8            `json:"status"`
	CreatedAt  time.Time       `json:"created_at"`
}

// WithdrawalItem 管理员查询提现订单的投影结构体
type WithdrawalItem struct {
	OrderSn    string          `json:"order_sn"`
	Chain      string          `json:"chain"`
	Amount     decimal.Decimal `json:"amount" swaggertype:"string"`
	Fee        decimal.Decimal `json:"fee" swaggertype:"string"`
	RealAmount decimal.Decimal `json:"real_amount" swaggertype:"string"`
	ToAddress  string          `json:"to_address"`
	TxHash     string          `json:"tx_hash"`
	Status     int8            `json:"status"`
	CreatedAt  time.Time       `json:"created_at"`
	AuditAt    *time.Time      `json:"audit_at"`
	FinishedAt *time.Time      `json:"finished_at"`
}

type GetRecordByOrderSnsItemResponse struct {
	OrderSn    string          `json:"order_sn"`                         //业务流水号
	Chain      string          `json:"chain"`                            //提现链名称
	Amount     decimal.Decimal `json:"amount" swaggertype:"string"`      //提现数量
	Fee        decimal.Decimal `json:"fee" swaggertype:"string"`         //手续费
	RealAmount decimal.Decimal `json:"real_amount" swaggertype:"string"` //实际到账数量
	ToAddress  string          `json:"to_address"`                       //提现地址
	TxHash     string          `json:"tx_hash"`                          //区块链交易哈希
	Status     int8            `json:"status"`                           //提现状态 1:待审核, 2:审核通过(处理中), 3:已完成, 4:审核驳回, 5:提现失败(打款失败), 6:用户取消
	CreatedAt  time.Time       `json:"created_at"`                       //申请时间
	AuditAt    *time.Time      `json:"audit_at"`                         //审核时间
	FinishedAt *time.Time      `json:"finished_at"`                      //完成时间
	UpdatedAt  *time.Time      `json:"updated_at"`                       //更新时间
}
