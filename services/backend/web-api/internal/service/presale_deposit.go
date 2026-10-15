package service

import (
	"context"

	"everything_finance/org/web-api/internal/model"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ===========================
// Request/Response DTOs
// ===========================

// ReportTxRequest 前端上报 tx 请求 DTO
type ReportTxRequest struct {
	TxHash             string  `json:"txHash"             binding:"required"`
	ExpectedRoundID    *string `json:"expectedRoundId,omitempty"`
	ExpectedAmountUsdt *string `json:"expectedAmountUsdt,omitempty"` // string of decimal
}

// ReportTxResponse 上报结果
type ReportTxResponse struct {
	DepositID string `json:"depositId"`
	Status    string `json:"status"` // pending/confirmed/anomaly
	RoundID   string `json:"roundId"`
}

// DepositDetail 单笔入账查询响应
type DepositDetail struct {
	DepositID         string  `json:"depositId"`
	TxHash            string  `json:"txHash"`
	Status            string  `json:"status"`
	AnomalyReason     *string `json:"anomalyReason,omitempty"`
	RoundID           string  `json:"roundId"`
	AmountUsdt        string  `json:"amountUsdt"`
	PriceUsd          string  `json:"priceUsd"`
	SharesOdd         string  `json:"sharesOdd"`
	ReferrerEoa       *string `json:"referrerEoa,omitempty"`
	ReferralRewardOdd string  `json:"referralRewardOdd"`
	BlockNumber       uint64  `json:"blockNumber"`
	BlockTimestamp    int64   `json:"blockTimestamp"`
	Source            string  `json:"source"`
	ConfirmedAt       *int64  `json:"confirmedAt,omitempty"`
	CreatedAt         int64   `json:"createdAt"`
}

// DepositListItem 入账列表项（同 DepositDetail 字段子集）
type DepositListItem = DepositDetail

// DepositListResponse 分页响应
// 注意：响应字段名用 "list" 以对齐 02-api-contract.md §3.4 示例
type DepositListResponse struct {
	List  []DepositListItem `json:"list"`
	Total int64             `json:"total"`
	Page  int               `json:"page"`
	Size  int               `json:"size"`
}

// PerRoundItem 持仓按轮次明细
type PerRoundItem struct {
	RoundID        string `json:"roundId"`
	TotalOdd       string `json:"totalOdd"`
	InvestedUsd    string `json:"investedUsd"`
	LockedPriceAvg string `json:"lockedPriceAvg"`
	ReferralOdd    string `json:"referralOdd"`
}

// PositionResponse 持仓聚合
type PositionResponse struct {
	Holdings         string            `json:"holdings"`         // totalOdd 跨轮汇总
	HoldingsBySource map[string]string `json:"holdingsBySource"` // {"invest":"...", "referral":"..."}
	InvestedUsd      string            `json:"investedUsd"`
	LockedPriceAvg   string            `json:"lockedPriceAvg"`
	PerRound         []PerRoundItem    `json:"perRound"`
}

// ===========================
// 业务错误哨兵
// ===========================

// ErrInvalidTx 链上 receipt 不存在或 status=failed（40006）
var ErrInvalidTx = errPresale("invalid tx: receipt not found or reverted")

// ErrTxNotToVault 链上 tx 收款地址不在金库池（40007）
var ErrTxNotToVault = errPresale("tx not to vault: to address not in vault pool")

// ErrTxNotUsdt 链上 tx 不是 USDT 转账（40008）
var ErrTxNotUsdt = errPresale("tx not usdt: no USDT Transfer log found")

// ErrDepositWalletMismatch tx.from ≠ 登录态 EOA（40902）
var ErrDepositWalletMismatch = errPresale("wallet mismatch: tx.from does not match login eoa")

// ErrDepositTxNotFound deposit 记录不存在（40405）
var ErrDepositTxNotFound = errPresale("deposit not found")

// presaleError 预售业务错误类型，便于 errors.Is 精确匹配
type presaleError string

func (e presaleError) Error() string { return string(e) }

func errPresale(msg string) presaleError { return presaleError(msg) }

// ===========================
// PresaleDepositService 接口定义
// ===========================

// PresaleDepositService 双轨入金核心服务接口
// 实现由 Agent B 在 presale_deposit_impl.go 完成
type PresaleDepositService interface {
	// ReportTx 前端上报入口（双轨之一）
	// 1) eth_getTransactionReceipt 链上校验 4 项（INVALID_TX/NOT_TO_VAULT/NOT_USDT/WALLET_MISMATCH）
	// 2) 找归属轮次（边界容差）
	// 3) INSERT presale_deposit(pending, source=frontend)；uk_(tx_hash, log_index) 已存在则返回 existing
	// 4) 期望 vs 实际不符进 round_mismatch anomaly（信息流不阻塞）
	// 5) 返回 depositId + 当前 status（pending/confirmed/anomaly）
	ReportTx(ctx context.Context, userID uint64, eoa string, req ReportTxRequest) (*ReportTxResponse, error)

	// GetByTxHash 单笔查询（前端轮询 pending→confirmed）
	GetByTxHash(ctx context.Context, userID uint64, txHash string) (*DepositDetail, error)

	// ListByUser 历史分页（status 可空，page/size 必传）
	ListByUser(ctx context.Context, userID uint64, status string, page, size int) (*DepositListResponse, error)

	// GetPosition 持仓聚合（从 presale_holding 表，不实时 SUM presale_deposit）
	GetPosition(ctx context.Context, userID uint64) (*PositionResponse, error)

	// ConfirmDeposit 双轨会师核心（Worker 扫块达到 confirmBlocks 调用）
	// 同一事务内：UPDATE deposit(confirmed) + IncrSoldAndRaised + UpsertInvest/UpsertReferral holding
	// 幂等：已 confirmed 直接返回 nil；超额返回 ErrCapacityExceeded 由调用方走 overflow anomaly
	ConfirmDeposit(ctx context.Context, tx *gorm.DB, depositID uint64, confirmedAt int64) error

	// FindRound 按 block_timestamp 找归属轮次（含 ±tolerance 容差）
	// Agent B 实现内可能也需要这个；让接口暴露便于 Worker 直接复用
	FindRound(ctx context.Context, blockTsMs int64) (*model.PresaleRound, error)

	// NotifyDepositConfirmed 事务外发送 deposit_confirmed Lark 推送（ISSUE-005）。
	//
	// 必须在外层事务 commit 成功后调用。SendAnomalyAlert 虽然内部异步 + recover，
	// 但在事务内调用会出现「rollback 后推送已发出」的 race（与 doConfirm step 7
	// 注释描述的已知风险一致）。dep 须为最终落库状态。
	//
	// 注（TODO-014 M4）：service.ConfirmDeposit 内部 step 7 仍在事务内调用本方法，
	// 与原 race trade-off 一致（成熟未改）。外部新调用方（如 worker.processLog）
	// 请严格遵循"事务外"约束，事务 commit 成功后再 call。
	//
	// fire-and-forget：实现不返回错误，webhook 失败仅 warn 日志，不影响业务路径。
	NotifyDepositConfirmed(dep *model.PresaleDeposit)
}

// PresaleDepositServiceFromDeposit 将 model.PresaleDeposit 转换为 DepositDetail DTO
// 供 handler 和 service impl 共用，避免重复转换逻辑
func PresaleDepositServiceFromDeposit(d *model.PresaleDeposit) *DepositDetail {
	detail := &DepositDetail{
		DepositID:         depositIDStr(d.ID),
		TxHash:            d.TxHash,
		Status:            d.Status,
		AnomalyReason:     d.AnomalyReason,
		RoundID:           d.RoundID,
		AmountUsdt:        d.AmountUsdt.String(),
		PriceUsd:          d.PriceUsd.String(),
		SharesOdd:         d.SharesOdd.String(),
		ReferrerEoa:       d.ReferrerEoa,
		ReferralRewardOdd: d.ReferralRewardOdd.String(),
		BlockNumber:       d.BlockNumber,
		BlockTimestamp:    d.BlockTimestamp,
		Source:            d.Source,
		ConfirmedAt:       d.ConfirmedAt,
		CreatedAt:         d.CreatedAt,
	}
	return detail
}

// depositIDStr 将 uint64 deposit ID 转为字符串（防 JS 精度丢失）
func depositIDStr(id uint64) string {
	return decimal.NewFromUint64(id).String()
}

// Implementation in presale_deposit_impl.go (Agent B owns)
