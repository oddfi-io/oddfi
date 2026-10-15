// Package client 封装 admin-backend 到 web-api internal endpoint 的 HTTP 调用。
//
// DTO 设计原则：
//   - 出入参对齐 web-api /internal/admin/* handler（DD-003 v3.1 §3.1）
//   - 金额字段统一用 string（shopspring/decimal 序列化结果），避免 JSON 浮点精度丢失
//   - 所有 ID 字段用 string，避免 JS int64 精度丢失
package client

// ─── 通用 ───────────────────────────────────────────────────────────────────

// ApiResponse 对应 web-api 统一响应格式 {code, message, data}。
// code 成功为 0 (int)，失败为业务错误码字符串。
type ApiResponse[T any] struct {
	Code    any    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

// ─── Round DTO ───────────────────────────────────────────────────────────────

// RoundItem 对应 web-api PresaleRound model 序列化。
type RoundItem struct {
	ID                string `json:"id"`
	Status            string `json:"status"`
	PriceUsd          string `json:"priceUsd"`
	SupplyOdd         string `json:"supplyOdd"`
	SoldOdd           string `json:"soldOdd"`
	RaisedUsd         string `json:"raisedUsd"`
	StartTs           int64  `json:"startTs"`
	EndTs             int64  `json:"endTs"`
	MinPerOrderUsd    string `json:"minPerOrderUsd"`
	MaxPerWalletUsd   string `json:"maxPerWalletUsd"`
	TgeReleasePct     string `json:"tgeReleasePct"`
	LinearReleaseDays int    `json:"linearReleaseDays"`
	ReferralRewardPct string `json:"referralRewardPct"`
	ManualOverride    bool   `json:"manualOverride"`
	CreatedAt         int64  `json:"createdAt"`
	UpdatedAt         int64  `json:"updatedAt"`
}

// ListRoundsResponse GET /internal/admin/presale/rounds 响应 data 部分。
type ListRoundsResponse struct {
	List  []RoundItem `json:"list"`
	Total int         `json:"total"`
}

// UpdateRoundRequest PATCH /internal/admin/presale/rounds/:id 请求体。
type UpdateRoundRequest struct {
	PriceUsd          *string `json:"priceUsd,omitempty"`
	SupplyOdd         *string `json:"supplyOdd,omitempty"`
	EndTs             *int64  `json:"endTs,omitempty"`
	MinPerOrderUsd    *string `json:"minPerOrderUsd,omitempty"`
	MaxPerWalletUsd   *string `json:"maxPerWalletUsd,omitempty"`
	TgeReleasePct     *string `json:"tgeReleasePct,omitempty"`
	LinearReleaseDays *int    `json:"linearReleaseDays,omitempty"`
	Note              string  `json:"note"`
}

// UpdateReferralPctRequest PATCH /internal/admin/presale/rounds/:id/referral-pct 请求体。
type UpdateReferralPctRequest struct {
	ReferralRewardPct string `json:"referralRewardPct"`
	Note              string `json:"note"`
}

// StateTransitionRequest POST /internal/admin/presale/rounds/:id/{pause|resume|reopen|close} 请求体。
type StateTransitionRequest struct {
	Note string `json:"note"`
}

// ─── Deposit DTO ─────────────────────────────────────────────────────────────

// DepositItem 对应 web-api PresaleDeposit model 序列化。
type DepositItem struct {
	TxHash       string `json:"txHash"`
	RoundID      string `json:"roundId"`
	EoaAddress   string `json:"eoaAddress"`
	VaultAddress string `json:"vaultAddress"`
	AmountUsdt   string `json:"amountUsdt"`
	SharesOdd    string `json:"sharesOdd"`
	Status       string `json:"status"`
	BlockTs      int64  `json:"blockTs"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

// ListDepositsResponse GET /internal/admin/presale/deposits 响应 data 部分。
type ListDepositsResponse struct {
	List  []DepositItem `json:"list"`
	Total int           `json:"total"`
	Page  int           `json:"page"`
	Size  int           `json:"size"`
}

// MigrateRoundRequest POST /internal/admin/presale/deposits/:txHash/migrate-round 请求体。
type MigrateRoundRequest struct {
	TargetRoundID string `json:"targetRoundId"`
	Note          string `json:"note"`
}

// MigrateRoundResponse migrate-round 响应 data 部分。
type MigrateRoundResponse struct {
	TxHash       string      `json:"txHash"`
	OldRoundID   string      `json:"oldRoundId"`
	NewRoundID   string      `json:"newRoundId"`
	OldSharesOdd string      `json:"oldSharesOdd"`
	NewSharesOdd string      `json:"newSharesOdd"`
	Deposit      DepositItem `json:"deposit"`
}

// ─── Config DTO ──────────────────────────────────────────────────────────────

// ConfigItem 对应 web-api PresaleConfig model 序列化。
type ConfigItem struct {
	TgeTs                int64  `json:"tgeTs"`
	TgeOpenPriceUsd      string `json:"tgeOpenPriceUsd"`
	VaultAddress         string `json:"vaultAddress"`
	MinSubscribeUsd      string `json:"minSubscribeUsd"`
	BoundaryToleranceMin int    `json:"boundaryToleranceMin"`
	TotalTargetUsd       string `json:"totalTargetUsd"`
	AuditLabel           string `json:"auditLabel"`
	LarkWebhookUrl       string `json:"larkWebhookUrl"`
	UpdatedAt            int64  `json:"updatedAt"`
}

// UpdateConfigRequest PATCH /internal/admin/presale/config 请求体。
type UpdateConfigRequest struct {
	TgeTs                *int64  `json:"tgeTs,omitempty"`
	TgeOpenPriceUsd      *string `json:"tgeOpenPriceUsd,omitempty"`
	VaultAddress         *string `json:"vaultAddress,omitempty"`
	MinSubscribeUsd      *string `json:"minSubscribeUsd,omitempty"`
	BoundaryToleranceMin *int    `json:"boundaryToleranceMin,omitempty"`
	TotalTargetUsd       *string `json:"totalTargetUsd,omitempty"`
	AuditLabel           *string `json:"auditLabel,omitempty"`
	LarkWebhookUrl       *string `json:"larkWebhookUrl,omitempty"`
	Note                 string  `json:"note"`
}

// UpdateConfigResponse update-config 响应 data 部分。
type UpdateConfigResponse struct {
	Config  ConfigItem `json:"config"`
	Warning string     `json:"warning,omitempty"`
}

// ─── Anomaly DTO ─────────────────────────────────────────────────────────────

// AnomalyItem 对应 web-api PresaleOpsEvent model 序列化。
type AnomalyItem struct {
	ID         uint64 `json:"id"`
	EventType  string `json:"eventType"`
	TxHash     string `json:"txHash"`
	EoaAddress string `json:"eoaAddress"`
	AmountUsdt string `json:"amountUsdt"`
	Status     string `json:"status"`
	Resolution string `json:"resolution"`
	Note       string `json:"note"`
	OperatorID string `json:"operatorId"`
	CreatedAt  int64  `json:"createdAt"`
	UpdatedAt  int64  `json:"updatedAt"`
}

// ListAnomalyResponse GET /internal/admin/presale/anomaly 响应 data 部分。
type ListAnomalyResponse struct {
	List  []AnomalyItem `json:"list"`
	Total int           `json:"total"`
	Page  int           `json:"page"`
	Size  int           `json:"size"`
}

// ResolveRequest POST /internal/admin/presale/anomaly/:id/resolve 请求体。
type ResolveRequest struct {
	Resolution    string  `json:"resolution"`
	TargetRoundID *string `json:"targetRoundId,omitempty"`
	Note          string  `json:"note"`
}

// ─── KOL 特殊返佣 DTO（REQ-004）────────────────────────────────────────────────

// KolReferralItem 单条 KOL 自定义返佣比例记录。
type KolReferralItem struct {
	ReferrerEoa string `json:"referrerEoa"`
	ReferralPct string `json:"referralPct"` // decimal string，如 "8.0000"
	Note        string `json:"note"`
	CreatedBy   string `json:"createdBy"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

// ListKolReferralResponse GET /internal/admin/presale/kol-referral 响应 data 部分。
type ListKolReferralResponse struct {
	List  []KolReferralItem `json:"list"`
	Total int               `json:"total"`
}

// CreateKolReferralRequest POST /internal/admin/presale/kol-referral 请求体。
type CreateKolReferralRequest struct {
	ReferrerEoa string `json:"referrerEoa"`
	ReferralPct string `json:"referralPct"`
	Note        string `json:"note"`
}

// UpdateKolReferralRequest PATCH /internal/admin/presale/kol-referral/:eoa 请求体。
type UpdateKolReferralRequest struct {
	ReferralPct string `json:"referralPct"`
	Note        string `json:"note"`
}

// KolReferralResponse 写操作响应 data 部分（包含更新后的记录）。
type KolReferralResponse struct {
	Kol KolReferralItem `json:"kol"`
}

// ─── Audit DTO ───────────────────────────────────────────────────────────────

// AuditItem 对应 web-api PresaleAdminAudit model 序列化。
type AuditItem struct {
	// web-api 的 PresaleAdminAudit.ID 用 `json:"id,string"` 序列化（uint64 统一走字符串，
	// 防 JS 端读 bigint 精度丢失），故反序列化 tag 必须带 ,string，否则
	// json.Unmarshal 把字符串 "2" 解进无 ,string 的 uint64 字段会报错，
	// 导致整条 list 请求 500（生产 audit 表非空时必现）。
	ID           uint64  `json:"id,string"`
	Operator     string  `json:"operator"`
	OperatorRole string  `json:"operatorRole"`
	Action       string  `json:"action"`
	TargetType   string  `json:"targetType"`
	TargetID     string  `json:"targetId"`
	BeforeJSON   *string `json:"beforeJson"`
	AfterJSON    *string `json:"afterJson"`
	Source       string  `json:"source"`
	IP           *string `json:"ip"`
	Note         string  `json:"note"`
	CreatedAt    int64   `json:"createdAt"`
}

// ListAuditResponse GET /internal/admin/presale/audit 响应 data 部分。
type ListAuditResponse struct {
	List  []AuditItem `json:"list"`
	Total int         `json:"total"`
	Page  int         `json:"page"`
	Size  int         `json:"size"`
}
