package model

import (
	"encoding/json"
	"time"

	"github.com/shopspring/decimal"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6,max=100"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6,max=100"`
	Email    string `json:"email" binding:"required,email"`
	Nickname string `json:"nickname" binding:"max=50"`
}

type UpdateProfileRequest struct {
	Nickname string `json:"nickname" binding:"max=50"`
	Email    string `json:"email" binding:"omitempty,email"`
	Avatar   string `json:"avatar" binding:"omitempty,url"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6,max=100"`
}

type WalletLoginRequest struct {
	Address    string `json:"address" binding:"required"`
	WalletType string `json:"wallet_type" binding:"required"`
	Chain      string `json:"chain" binding:"required"`
	SessionID  string `json:"session_id"`
	Message    string `json:"message"`
	Signature  string `json:"signature"`
}

type RefreshAccessTokenByAccessRequest struct {
	AccessToken string `json:"access_token" binding:"required"`
}

type RefreshAccessTokenByRefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type ModifyBalanceRequest struct {
	Stakes []string `json:"stakes" binding:"required"`  // 下注金额:  单位 odd 代币
	Type   string   `json:"type" binding:"required"`    // 下注类型 单注（single）;串注（parlay）
	OddIDs []int64  `json:"odd_ids" binding:"required"` // 下注投注的市场ID

	// 【新增】玩法与盘口特征（对应文档 judgeBet 依赖）
	Market       []string `json:"market" binding:"required"` // 玩法：fulltime_result, asian_handicap, asian_over_under
	Label        []string `json:"label" binding:"required"`  // 投注项：1(主), 2(客), over(大), under(小)
	HandicapLine []string `json:"handicap_line"`             // 盘口线：例如 -0.5, 2.5 (大小球线也复用此字段)
	Odds         []string `json:"odds" binding:"required"`   // 下注的赔率

	RefID string `json:"ref_id" binding:"required"` // 相关id ref_id
}

// UnmarshalJSON 兼容旧前端的 handicapline 字段名。
// 线上已有客户端使用无下划线字段，若只绑定 handicap_line，亚让/大小球会拿到默认 0 盘口并被风控校验拒单。
func (r *ModifyBalanceRequest) UnmarshalJSON(data []byte) error {
	type modifyBalanceRequestAlias ModifyBalanceRequest
	aux := struct {
		*modifyBalanceRequestAlias
		LegacyHandicapLine []string `json:"handicapline"`
	}{
		modifyBalanceRequestAlias: (*modifyBalanceRequestAlias)(r),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	if len(r.HandicapLine) == 0 && len(aux.LegacyHandicapLine) > 0 {
		r.HandicapLine = aux.LegacyHandicapLine
	}
	return nil
}

// 新增的五种 market banner 下注玩法
// BannerBetPlaceRequest 首页 Banner 专用下注请求。
// PRD 中的 5 个固定 Banner 都统一走这一个轻量接口。
type BannerBetPlaceRequest struct {
	BannerCode  string `json:"banner_code" binding:"required"`  // B1~B5
	MarketID    int64  `json:"market_id" binding:"required"`    // Banner 对应 market_id
	SelectionID int64  `json:"selection_id" binding:"required"` // Banner 对应 selection_id
	Market      string `json:"market" binding:"required"`       // 玩法: champion_winner / golden_ball / golden_boot ...
	Selection   string `json:"selection" binding:"required"`    // 用户实际下注对象
	Stake       string `json:"stake" binding:"required"`        // 下注金额
	Odds        string `json:"odds" binding:"required"`         // 赔率快照
	RefID       string `json:"ref_id" binding:"required"`       // 幂等键
}

type ModifyBalanceRespnse struct {
	Results []BetResult `json:"results"`
	Msg     string      `json:"msg"` // "ALL_SUCCESS", "PARTIAL_SUCCESS", "FAILED"
	Error   string      `json:"error,omitempty"`
}

// BetResult 用于返回每一笔（或整笔）的处理结果
type BetResult struct {
	OddID  int64  `json:"odd_id"`
	BetID  uint64 `json:"bet_id,omitempty"`
	Status string `json:"status"` // "SUCCESS" 或 "FAILED"
	Error  string `json:"error,omitempty"`
}

type AssetLedgerRequest struct {
	OrderBy string `form:"order_by"`
	Sort    string `form:"sort"`
}

// 撤单请求
type CancelBalanceRequest struct {
	BetIds []uint64 `json:"bet_ids" binding:"required"`
}

// 查询持仓请求
type BetHoldingRequest struct {
	UserID uint64 `json:"user_id" binding:"required"`
}

type BetHoldingResult struct {
	Id     uint64          `json:"-"`                          // 下注递增 ID
	OddID  int64           `json:"odd_id"`                     // 下注的市场ID
	Stake  decimal.Decimal `json:"stake" swaggertype:"string"` // 下注金额:  单位 odd 代币
	Status string          `json:"status"`                     // 注单状态：live/pending=未结算；WON/LOST/PUSH/VOID=已结算；CANCELLED=已撤单；CLAIMED=历史领取状态；History 响应会统一转大写
	Type   string          `json:"type"`                       // 下注类型 单注（single）;串注（parlay）

	Odds         string     `json:"odds"`           // 下注时锁定的服务端赔率快照，不能用赛后赔率表当前值覆盖
	Payout       string     `json:"payout"`         // 下注时预计回报，用于 active 阶段展示
	ActualPayout string     `json:"actual_payout"`  // worker 结算后的实际派彩，WON/PUSH/VOID/LOST 展示以它为准
	FixtureName  string     `json:"fixture_name"`   // 下注的赛事名称
	FixtureTime  string     `json:"fixture_time"`   // 下注的赛事时间
	HomeTeamLogo string     `json:"home_team_logo"` // 下注的主队logo
	AwayTeamLogo string     `json:"away_team_logo"` // 下注的客队logo
	MarketType   string     `json:"market_type"`    // 下注的市场类型
	Selection    string     `json:"selection"`      // 下注的选项
	SettledAt    *time.Time `json:"settled_at"`     // worker 写入结算状态的时间；未结注单也返回 null，方便前端列展示保持稳定

}

type BetHoldingMock struct {
	OddID       int64  `json:"odd_id"`
	Odds        string `json:"value"`        // 下注的赔率
	FixtureName string `json:"fixture_name"` // 下注的赛事名称
	FixtureTime string `json:"fixture_time"` // 下注的赛事时间
	MarketType  string `json:"market_type"`  // 下注的市场类型
	Selection   string `json:"selection"`    // 下注的选项
}

// 查询领取请求
type BetClaimRequest struct {
	UserID uint64          `json:"user_id"` // 兼容旧请求体；实际用户以 JWT 鉴权上下文为准
	BetID  uint64          `json:"bet_id" binding:"required"`
	Amount decimal.Decimal `json:"amount" swaggertype:"string"` // 前端可传展示金额做一致性校验，实际入账金额以后端 actual_payout 为准
}

// BetClaimStatus* 是领取接口对前端暴露的稳定状态码，避免前端依赖后端错误字符串做分支判断。
const (
	BetClaimStatusClaimed                      = "CLAIMED"
	BetClaimStatusBetNotFound                  = "BET_NOT_FOUND"
	BetClaimStatusInvalidBetStatus             = "INVALID_BET_STATUS_FOR_CLAIM"
	BetClaimStatusInvalidClaimAmount           = "INVALID_CLAIM_AMOUNT"
	BetClaimStatusClaimAmountMismatch          = "CLAIM_AMOUNT_MISMATCH"
	BetClaimStatusInsufficientClaimableBalance = "INSUFFICIENT_CLAIMABLE_BALANCE"
	BetClaimStatusConcurrencyClaimError        = "CONCURRENCY_CLAIM_ERROR"
	BetClaimStatusMultipleClaimableBalanceRows = "MULTIPLE_CLAIMABLE_BALANCE_ROWS"
	BetClaimStatusDatabaseError                = "DATABASE_ERROR"
)

type BetClaimResponse struct {
	BetID          uint64          `json:"bet_id"`
	Amount         decimal.Decimal `json:"amount" swaggertype:"string"`
	Status         string          `json:"status"`
	AlreadyClaimed bool            `json:"already_claimed"`
}

type WithDrawApplyRequest struct {
	WithDrawAddress string          `json:"withdraw_address" binding:"required"`
	WithdrawSig     string          `json:"withdraw_sign" binding:"required"` // 提现地址签名，使用注册 eoa 钱包签名
	SigTime         uint64          `json:"sig_time"  binding:"required"`
	Amount          decimal.Decimal `json:"amount" binding:"required" swaggertype:"string"`
	Chain           string          `json:"chain" binding:"required"`
}

// 取消提现请求
type WithdrawCancelReqest struct {
	Order string `json:"order" binding:"required"`
}

type GetPriceRequest struct {
	Chain  string `form:"chain" binding:"required"`
	Symbol string `form:"symbol" binding:"required"`
}

type GetPriceResponse struct {
	Price decimal.Decimal `json:"price" swaggertype:"string"`
}

// search
// string
// 搜索关键词，min 2 chars，模糊匹配 market_name
// tab
// enum
// My Bets 场景传入：active / settled；History 场景不传
// type
// string
// 交易类型筛选（History 场景使用）
// result
// enum
// 结算结果筛选（仅 tab=settled 时生效）：all（默认）/ won / lost
// date
// string
// 日期筛选，格式 YYYY-MM-DD
// page
// int
// 页码，default 1
// page_size
// int
// 每页条数，default 20，max 50
type GetBetHistoryRequest struct {
	OrderBy string `form:"order_by"`
	Sort    string `form:"sort"`

	Search string `form:"search"` // 搜索关键词，min 2 chars，模糊匹配 market_name
	Type   string `form:"type"`   // 交易类型筛选（History 场景使用），支持逗号分隔多选：all / bet / bet_cancel / bet_won / bet_lost / bet_banner / claim_prize / withdraw / deposit / stake / unstake / add_lp / remove_lp / cancel_withdraw；bet 表示所有下注流水，不按结算状态过滤。
	Result string `form:"result"` // 结算结果筛选（仅 tab=settled 时生效）：all（默认）/ won / lost

	BeginDate string `form:"begin_date"` // 开始日期筛选，格式 YYYY-MM-DD
	EndDate   string `form:"end_date"`   // 结束日期筛选，格式 YYYY-MM-DD
	Page      int    `form:"page"`       // 页码，default 1
	PageSize  int    `form:"page_size"`  // 每页条数，default 20，max 50
	Tab       string `form:"tab"`        // active / settled；History 场景不传
	Status    string `form:"status"`     // 兼容旧前端 status=active/settled，服务端会映射到 tab 语义
}

// 获取提现手续费请求
type WithdrawFeeRequest struct {
	Amount decimal.Decimal `form:"amount" binding:"required" swaggertype:"string"` // 提现金额
}

// 获取 Pending 订单请求（管理后台）
type GetPendingOrdersRequest struct {
	User     string `form:"user" binding:"required"`
	Password string `form:"password" binding:"required"`
	Type     string `form:"type"` // 空或不传：全部；"risk"：高风险
}

// ApproveOrder 管理员审批提现订单请求
type ApproveOrderRequest struct {
	User     string `json:"user" binding:"required"`
	Password string `json:"password" binding:"required"`
	Order    string `json:"order" binding:"required"` // 对应 WithdrawRecord.OrderSn
	Remark   string `json:"remark" binding:"required"`
	Approve  bool   `json:"approve"` // true=批准, false=拒绝
}

// OrderInfo 管理员查询指定订单详情请求
type OrderInfoRequest struct {
	User     string   `json:"user" binding:"required"`
	Password string   `json:"password" binding:"required"`
	Orders   []string `json:"orders" binding:"required,min=1"` // OrderSn 数组
}

// OrderInfoResponse 管理员查询指定订单详情响应
type OrderInfoResponse struct {
	List  interface{} `json:"list"`
	Total int64       `json:"total"`
}

type GetRecordByOrderSnsRequest struct {
	Orders []string `json:"orders" binding:"required,min=1"` // OrderSn 数组
}
