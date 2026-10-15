package model

import (
	"everything_finance/org/web-api/internal/config"

	"github.com/shopspring/decimal"
)

// PresaleDepositStatus 预售入账三态（V3 Deposit-first，无 expired/mismatch 中间态）：
// pending   = 区块确认数 < confirmBlocks，链上事件已落库但未达安全确认数
// confirmed = 达到 confirmBlocks + 校验通过 + holding 已 upsert，这是业务真相
// anomaly   = 链上 receipt 存在但业务校验失败，进 presale_ops_event 待人工处理
// 注意：与 deposit_record.go 中旧版 DepositStatus（int8 类型）不同，
// 本预售模块使用字符串状态，故前缀加 Presale 区分
const (
	PresaleDepositStatusPending   = "pending"
	PresaleDepositStatusConfirmed = "confirmed"
	PresaleDepositStatusAnomaly   = "anomaly"
)

// AnomalyReason 枚举：deposit 落 anomaly 时必须填写原因，供运营快速分流处理
// 各 reason 触发场景见 01-data-model.md §3.2
const (
	AnomalyOverflow      = "overflow"       // 到账超轮次剩余容量（A4 场景）
	AnomalyFromMismatch  = "from_mismatch"  // tx.from 不是登录态 EOA（禁止合约钱包代付）
	AnomalyNonUsdt       = "non_usdt"       // log.address 不是 USDT 合约（用户误转其他 token）
	AnomalyBelowMin      = "below_min"      // 低于全局 minSubscribeUsd
	AnomalyRoundMismatch = "round_mismatch" // 前端期望轮次 ≠ 实际所属轮次（边界切轮信号）
	AnomalyLateArrival   = "late_arrival"   // block_timestamp 超出所有轮次容差范围（无法归属轮次）
	AnomalyPausedArrival = "paused_arrival" // 到账时轮次处于 paused（信息流，仍正常入账 + Lark 通知）
	AnomalyUnclaimed     = "unclaimed"      // tx.from EOA 无对应 user 记录（用户绕前端直转金库）
	AnomalyFakeReferrer  = "fake_referrer"  // report-tx 携带的 referrerCode 不存在
)

// PresaleDepositSource 双轨上报来源，用于排查"前端上报但 Worker 没扫到"或反之的问题
const (
	PresaleDepositSourceFrontend = "frontend"
	PresaleDepositSourceWorker   = "worker"
)

// PresaleDeposit 预售入账记录（链上 USDT Transfer 真相）
// uk_(tx_hash, log_index) 保证双轨幂等：同一链上事件只入账一次
// referrer_* 字段在 deposit 落库时一次性快照（不动态计算）
type PresaleDeposit struct {
	ID               uint64           `gorm:"column:id;primaryKey;autoIncrement"`
	TxHash           string           `gorm:"column:tx_hash;not null;uniqueIndex:uk_tx_log;type:varchar(66)"`
	LogIndex         uint             `gorm:"column:log_index;not null;uniqueIndex:uk_tx_log"`
	BlockNumber      uint64           `gorm:"column:block_number;not null"`
	BlockTimestamp   int64            `gorm:"column:block_timestamp;not null"`
	UserID           uint64           `gorm:"column:user_id;not null;index:idx_user_block"`
	EoaAddress       string           `gorm:"column:eoa_address;not null;index:idx_eoa_block;type:varchar(42)"`
	VaultAddress     string           `gorm:"column:vault_address;not null;type:varchar(42)"`
	RoundID          string           `gorm:"column:round_id;not null;index:idx_round_status;type:varchar(32)"`
	AmountUsdt       decimal.Decimal  `gorm:"column:amount_usdt;not null;type:decimal(38,18)"`
	PriceUsd         decimal.Decimal  `gorm:"column:price_usd;not null;type:decimal(38,18)"`
	SharesOdd        decimal.Decimal  `gorm:"column:shares_odd;not null;type:decimal(38,18)"`
	ReferrerUserID   *uint64          `gorm:"column:referrer_user_id"`
	ReferrerEoa      *string          `gorm:"column:referrer_eoa;type:varchar(42)"`
	ReferralRewardPct *decimal.Decimal `gorm:"column:referral_reward_pct;type:decimal(10,4)"`
	ReferralRewardOdd decimal.Decimal  `gorm:"column:referral_reward_odd;not null;default:0;type:decimal(38,18)"`
	// Status 用 index:idx_round_status 与 round_id 复合，加速 Worker 按轮次查 pending 订单
	Status          string           `gorm:"column:status;not null;default:pending;index:idx_round_status;type:varchar(16)"`
	AnomalyReason   *string          `gorm:"column:anomaly_reason;type:varchar(64)"`
	ConfirmedAt     *int64           `gorm:"column:confirmed_at"`
	ExpectedRoundID *string          `gorm:"column:expected_round_id;type:varchar(32)"`
	ExpectedAmount  *decimal.Decimal `gorm:"column:expected_amount;type:decimal(38,18)"`
	Source          string           `gorm:"column:source;not null;default:frontend;type:varchar(16)"`
	CreatedAt       int64            `gorm:"column:created_at;not null;autoCreateTime:milli"`
	UpdatedAt       int64            `gorm:"column:updated_at;not null;autoUpdateTime:milli"`
}

func (PresaleDeposit) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "presale_deposit_dev"
	}
	return "presale_deposit"
}
