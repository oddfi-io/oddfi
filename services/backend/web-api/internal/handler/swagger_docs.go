package handler

import "everything_finance/org/web-api/internal/model"

type swaggerHealthResponse struct {
	Status string `json:"status"`
}

type swaggerEmptyResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type swaggerWalletLoginResponse struct {
	Code    int                       `json:"code"`
	Message string                    `json:"message"`
	Data    model.WalletLoginResponse `json:"data"`
}

type swaggerTokenPairResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    model.TokenPair `json:"data"`
}

type swaggerLogoutResponse struct {
	Code    int                  `json:"code"`
	Message string               `json:"message"`
	Data    model.LogoutResponse `json:"data"`
}

type swaggerBalanceResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	// 金额字段统一按字符串展示，避免前端误用浮点数处理资产精度。
	Data model.BalanceResponse `json:"data"`
}

type swaggerDepositAddressResponse struct {
	Code    int                          `json:"code"`
	Message string                       `json:"message"`
	Data    model.DepositAddressResponse `json:"data"`
}

type swaggerAssetLedgersResponse struct {
	Code    int                        `json:"code"`
	Message string                     `json:"message"`
	Data    model.AssetLedgersResponse `json:"data"`
}

type swaggerBetHistoryResponse struct {
	Code    int                      `json:"code"`
	Message string                   `json:"message"`
	Data    model.BetHistoryResponse `json:"data"`
}

type swaggerOrderInfoResponse struct {
	Code    int                     `json:"code"`
	Message string                  `json:"message"`
	Data    model.OrderInfoResponse `json:"data"`
}

type swaggerWithdrawApplyResponse struct {
	Code    int                         `json:"code"`
	Message string                      `json:"message"`
	Data    model.WithDrawApplyResponse `json:"data"`
}

type swaggerWithdrawFeeResponse struct {
	Code    int                       `json:"code"`
	Message string                    `json:"message"`
	Data    model.WithdrawFeeResponse `json:"data"`
}

type swaggerWithdrawRecordsResponse struct {
	Code    int                      `json:"code"`
	Message string                   `json:"message"`
	Data    model.WithDrawRecordsRes `json:"data"`
}

type swaggerWithdrawCancelResponse struct {
	Code    int                          `json:"code"`
	Message string                       `json:"message"`
	Data    model.WithdrawCancelResponse `json:"data"`
}

type swaggerModifyBalanceResponse struct {
	Code    int                        `json:"code"`
	Message string                     `json:"message"`
	Data    model.ModifyBalanceRespnse `json:"data"`
}

type swaggerBetHoldingResponse struct {
	Code    int                      `json:"code"`
	Message string                   `json:"message"`
	Data    model.BetHoldingResponse `json:"data"`
}

type swaggerBetClaimResponse struct {
	Code    int                    `json:"code"`
	Message string                 `json:"message"`
	Data    model.BetClaimResponse `json:"data"`
}

type swaggerBannerBetPlaceResponse struct {
	Code    int                          `json:"code"`
	Message string                       `json:"message"`
	Data    model.BannerBetPlaceResponse `json:"data"`
}

type swaggerBannerBetHoldingResponse struct {
	Code    int                            `json:"code"`
	Message string                         `json:"message"`
	Data    model.BannerBetHoldingResponse `json:"data"`
}

type swaggerPendingOrdersResponse struct {
	Code    int                         `json:"code"`
	Message string                      `json:"message"`
	Data    model.PendingOrdersResponse `json:"data"`
}

type swaggerGetPriceResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	// 行情价格来自 Redis decimal 字符串，文档保持字符串语义，减少前端精度损失。
	Data model.GetPriceResponse `json:"data"`
}

// @Summary 健康检查
// @Tags health
// @Produce json
// @Success 200 {object} swaggerHealthResponse
// @Router /health [get]
func swaggerHealthDoc() {}

// @Summary 钱包登录
// @Description 第一次请求生成登录 nonce 和 session_id；第二次携带 message/signature 完成签名校验并返回 token。
// @Tags account
// @Accept json
// @Produce json
// @Param request body model.WalletLoginRequest true "钱包登录请求"
// @Success 200 {object} swaggerWalletLoginResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/login_by_wallet [post]
func swaggerLoginByWalletDoc() {}

// @Summary 使用 refresh token 刷新 access token
// @Tags account
// @Accept json
// @Produce json
// @Param request body model.RefreshAccessTokenByRefreshRequest true "刷新 token 请求"
// @Success 200 {object} swaggerTokenPairResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/refresh_access_token_by_refresh [post]
func swaggerRefreshAccessTokenByRefreshDoc() {}

// @Summary 退出登录
// @Description 将当前 access token 加入黑名单，并撤销用户 refresh token。
// @Tags account
// @Produce json
// @Security BearerAuth
// @Success 200 {object} swaggerLogoutResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/logout [post]
func swaggerLogoutDoc() {}

// @Summary 查询用户余额
// @Tags account
// @Produce json
// @Security BearerAuth
// @Success 200 {object} swaggerBalanceResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/balance [get]
func swaggerGetBalanceDoc() {}

// @Summary 查询用户充值地址
// @Tags account
// @Produce json
// @Security BearerAuth
// @Success 200 {object} swaggerDepositAddressResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/deposit_address [get]
func swaggerGetUserDepositAddressDoc() {}

// @Summary 查询用户资产流水
// @Tags account
// @Produce json
// @Security BearerAuth
// @Param order_by query string false "排序字段，可选 created_at / amount，默认 created_at"
// @Param sort query string false "排序方向，可选 asc / desc，默认 desc"
// @Success 200 {object} swaggerAssetLedgersResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/asset_ledger [get]
func swaggerGetAssetLedgerDoc() {}

// @Summary 查询 Portfolio History
// @Description 聚合资金流水、普通注单和 Banner 注单，用于前端资产 History 列表。
// @Tags account
// @Produce json
// @Security BearerAuth
// @Param order_by query string false "排序字段，可选 created_at / amount"
// @Param sort query string false "排序方向，可选 asc / desc"
// @Param search query string false "搜索关键词，模糊匹配赛事或市场信息"
// @Param type query string false "交易类型筛选，支持逗号分隔多选；合法枚举：all / bet / bet_cancel / bet_won / bet_lost / bet_banner / claim_prize / withdraw / deposit / stake / unstake / add_lp / remove_lp / cancel_withdraw。type=bet 表示所有下注流水，不按结算状态过滤；示例：type=bet,bet_cancel,claim_prize"
// @Param result query string false "赛果筛选，可选 all / won / lost / push / void"
// @Param begin_date query string false "开始日期，格式 YYYY-MM-DD"
// @Param end_date query string false "结束日期，格式 YYYY-MM-DD"
// @Param page query int false "页码，默认 1"
// @Param page_size query int false "每页条数，默认 20，最大 50"
// @Param tab query string false "My Bets 场景：active / settled"
// @Param status query string false "兼容旧前端 status=active/settled"
// @Success 200 {object} swaggerBetHistoryResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/portfolio/history [get]
func swaggerGetHistoryDoc() {}

// @Summary 查询提现订单详情
// @Tags withdraw
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body model.GetRecordByOrderSnsRequest true "提现订单号数组"
// @Success 200 {object} swaggerOrderInfoResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/withdraw/get_record_info [post]
func swaggerGetRecordByOrderSnsDoc() {}

// @Summary 申请提现
// @Description 提现金额、手续费和实际到账都按 decimal 字符串处理，避免链上资产精度损失。
// @Tags withdraw
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body model.WithDrawApplyRequest true "提现申请"
// @Success 200 {object} swaggerWithdrawApplyResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/withdraw/apply [post]
func swaggerWithDrawApplyDoc() {}

// @Summary 预估提现手续费
// @Tags withdraw
// @Produce json
// @Security BearerAuth
// @Param amount query string true "提现金额"
// @Success 200 {object} swaggerWithdrawFeeResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Router /account/withdraw/fee [get]
func swaggerGetWithdrawFeeDoc() {}

// @Summary 查询提现记录
// @Tags withdraw
// @Produce json
// @Security BearerAuth
// @Success 200 {object} swaggerWithdrawRecordsResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/withdraw/get_record [get]
func swaggerGetWithDrawRecordDoc() {}

// @Summary 取消提现
// @Tags withdraw
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body model.WithdrawCancelReqest true "取消提现请求"
// @Success 200 {object} swaggerWithdrawCancelResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/withdraw/cancel [post]
func swaggerWithDrawStatusCancelDoc() {}

// @Summary 用户下注
// @Description 创建单注或串关注单，赔率快照、盘口线和余额扣减均由后端校验。
// @Tags bet
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body model.ModifyBalanceRequest true "下注请求"
// @Success 200 {object} swaggerModifyBalanceResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/bet_place [post]
func swaggerBetPlaceDoc() {}

// @Summary 用户撤单
// @Description 撤单用户以 JWT 鉴权上下文为准，不能信任请求体里的用户身份。
// @Tags bet
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body model.CancelBalanceRequest true "撤单请求"
// @Success 200 {object} swaggerModifyBalanceResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/bet_cancel [post]
func swaggerBetCancleDoc() {}

// @Summary 查询用户持仓
// @Tags bet
// @Produce json
// @Security BearerAuth
// @Success 200 {object} swaggerBetHoldingResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/bet_holding [get]
func swaggerBetHoldingDoc() {}

// @Summary 领取已结算注单派奖
// @Description 实际领取金额以后端结算写入的 actual_payout 为准，避免前端传入金额影响资金结果。
// @Tags bet
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body model.BetClaimRequest true "领取请求"
// @Success 200 {object} swaggerBetClaimResponse
// @Failure 400 {object} swaggerBetClaimResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 409 {object} swaggerBetClaimResponse
// @Failure 500 {object} swaggerBetClaimResponse
// @Router /account/bet_claim [post]
func swaggerBetClaimDoc() {}

// @Summary 首页 Banner 下注
// @Description Banner 下注使用独立市场配置，不复用普通赛事盘口表。
// @Tags bet
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body model.BannerBetPlaceRequest true "Banner 下注请求"
// @Success 200 {object} swaggerBannerBetPlaceResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/banner_bet_place [post]
func swaggerBannerBetPlaceDoc() {}

// @Summary 查询 Banner 下注记录
// @Tags bet
// @Produce json
// @Security BearerAuth
// @Success 200 {object} swaggerBannerBetHoldingResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /account/banner_bet_holding [get]
func swaggerBannerBetHoldingDoc() {}

// @Summary 管理后台查询待审核提现订单
// @Tags admin
// @Produce json
// @Param user query string true "管理员用户名"
// @Param password query string true "管理员密码"
// @Param type query string false "空或不传为全部，risk 为高风险"
// @Success 200 {object} swaggerPendingOrdersResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /admin/order/pending_orders [get]
func swaggerGetPendingOrdersDoc() {}

// @Summary 管理后台审批提现订单
// @Tags admin
// @Accept json
// @Produce json
// @Param request body model.ApproveOrderRequest true "审批请求"
// @Success 200 {object} swaggerEmptyResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /admin/order/approve_order [post]
func swaggerApproveOrderDoc() {}

// @Summary 管理后台查询订单详情
// @Tags admin
// @Accept json
// @Produce json
// @Param request body model.OrderInfoRequest true "订单详情请求"
// @Success 200 {object} swaggerOrderInfoResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 401 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /admin/order/order_info [post]
func swaggerOrderInfoDoc() {}

// @Summary 查询市场价格
// @Description 从 Redis 查询指定链和 token 的价格，当前只支持 chain=bsc、symbol=odd。
// @Tags market
// @Produce json
// @Param chain query string true "链名称，例如 bsc"
// @Param symbol query string true "token 符号，例如 odd"
// @Success 200 {object} swaggerGetPriceResponse
// @Failure 400 {object} swaggerEmptyResponse
// @Failure 500 {object} swaggerEmptyResponse
// @Router /market/price [get]
func swaggerGetPriceDoc() {}
