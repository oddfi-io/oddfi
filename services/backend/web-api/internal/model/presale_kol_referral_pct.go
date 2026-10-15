package model

import "github.com/shopspring/decimal"

// PresaleKolReferralPct 是 KOL 独立返佣比例白名单（REQ-004）。
//
// 业务语义：
//   - admin 后台维护：CRUD 通过 /internal/admin/presale/kol-referral
//   - deposit 落 confirmed 时按 referrer_eoa 查此表；命中则用 referral_pct
//     覆盖 round.referral_reward_pct，未命中走全局轮次比例
//   - 仅影响新增 deposit；历史 deposit 已快照 referral_reward_pct 不回填
//   - referrer_eoa 强制小写（写入侧 strings.ToLower），匹配 deposit.referrer_eoa
//     存储约定
type PresaleKolReferralPct struct {
	ReferrerEoa string          `gorm:"column:referrer_eoa;primaryKey;size:42"            json:"referrerEoa"`
	ReferralPct decimal.Decimal `gorm:"column:referral_pct;not null;type:decimal(10,4)"   json:"referralPct"`
	Note        *string         `gorm:"column:note;size:256"                              json:"note,omitempty"`
	CreatedBy   string          `gorm:"column:created_by;size:64;not null"                json:"createdBy"`
	CreatedAt   int64           `gorm:"column:created_at;not null;autoCreateTime:milli"   json:"createdAt"`
	UpdatedAt   int64           `gorm:"column:updated_at;not null;autoUpdateTime:milli"   json:"updatedAt"`
}

// TableName 固定表名，沿用 admin 路径不走 dev/prod 分表的约定（DD-003 同语义）。
func (PresaleKolReferralPct) TableName() string { return "presale_kol_referral_pct" }
