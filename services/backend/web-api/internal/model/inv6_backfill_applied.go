package model

// Inv6BackfillApplied 是 BUG-001 INV-6 跨时钟域容差修复历史回填的去重表行。
//
// PK=DepositID 保证同一笔 deposit 跨多次工具运行只能被回填一次：
// cmd/inv6-backfill 工具在事务内先 INSERT IGNORE 本表，rows_affected=0 即跳过本笔
// （deposit UPDATE + holding UpsertReferral 都不会执行），杜绝"误重跑 apply"导致
// holding 总值翻倍的资金风险。
//
// 表设计 + 字段语义详见 migrations/0011_create_inv6_backfill_applied.sql。
type Inv6BackfillApplied struct {
	DepositID      uint64  `gorm:"column:deposit_id;primaryKey"`
	AppliedAt      int64   `gorm:"column:applied_at;not null"`
	DiffMs         int64   `gorm:"column:diff_ms;not null"`
	ReferrerUserID uint64  `gorm:"column:referrer_user_id;not null"`
	RewardOdd      string  `gorm:"column:reward_odd;not null;size:64"`
	Actor          string  `gorm:"column:actor;not null;size:64"`
	Reason         *string `gorm:"column:reason;size:255"`
}

func (Inv6BackfillApplied) TableName() string {
	return "inv6_backfill_applied"
}
