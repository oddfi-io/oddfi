package model

import (
	"everything_finance/org/web-api/internal/config"

	"github.com/shopspring/decimal"
)

// OpsEventStatus 异常事件处理状态
// pending   → 落库待 Lark 推送
// notified  → Lark webhook 推送成功
// resolved  → 运营已处理（预案脚本执行完毕）
// rejected  → 运营判断无需处理（如重复告警）
const (
	OpsEventStatusPending  = "pending"
	OpsEventStatusNotified = "notified"
	OpsEventStatusResolved = "resolved"
	OpsEventStatusRejected = "rejected"
)

// PresaleOpsEvent 预售异常事件
// 所有业务校验失败（overflow/unclaimed/round_mismatch/...）都落此表
// 运营通过 admin 后台查看 + 预案脚本（scripts/presale-ops/）处理
type PresaleOpsEvent struct {
	ID          uint64           `gorm:"column:id;primaryKey;autoIncrement"`
	EventType   string           `gorm:"column:event_type;not null;type:varchar(32)"`
	DepositID   *uint64          `gorm:"column:deposit_id"`
	TxHash      *string          `gorm:"column:tx_hash;type:varchar(66)"`
	EoaAddress  *string          `gorm:"column:eoa_address;type:varchar(42)"`
	AmountUsdt  *decimal.Decimal `gorm:"column:amount_usdt;type:decimal(38,18)"`
	PayloadJson *string          `gorm:"column:payload_json;type:text"`
	Status      string           `gorm:"column:status;not null;default:pending;type:varchar(16)"`
	LarkMsgID   *string          `gorm:"column:lark_msg_id;type:varchar(64)"`
	ResolvedBy  *string          `gorm:"column:resolved_by;type:varchar(64)"`
	ResolvedAt  *int64           `gorm:"column:resolved_at"`
	ResolveNote *string          `gorm:"column:resolve_note;type:text"`
	CreatedAt   int64            `gorm:"column:created_at;not null;autoCreateTime:milli"`
	UpdatedAt   int64            `gorm:"column:updated_at;not null;autoUpdateTime:milli"`
}

func (PresaleOpsEvent) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "presale_ops_event_dev"
	}
	return "presale_ops_event"
}
