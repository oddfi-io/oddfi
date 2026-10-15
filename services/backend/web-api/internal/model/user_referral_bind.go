package model

// UserReferralBind 邀请绑定关系（站点级，一次绑定不可撤销/不可改）
// 单层关系：A 邀 B，B 邀 C，C 下单时只有 B 拿奖励（不递归到 A）
// bound_at < block_timestamp 才能算作有效邀请（deposit 落库时校验）
// business 字段扩展性设计：本期 business='presale'，后续投注/任务等业务接入时填自己的业务名
type UserReferralBind struct {
	UserID          uint64 `gorm:"column:user_id;primaryKey"`
	EoaAddress      string `gorm:"column:eoa_address;not null;type:varchar(42)"`
	ReferrerUserID  uint64 `gorm:"column:referrer_user_id;not null;index:idx_referrer"`
	ReferrerEoa     string `gorm:"column:referrer_eoa;not null;index:idx_referrer_eoa;type:varchar(42)"`
	ReferrerCode    string `gorm:"column:referrer_code;not null;type:varchar(8)"`
	Source          string `gorm:"column:source;not null;type:varchar(16)"`
	Business        string `gorm:"column:business;not null;default:presale;type:varchar(32)"`
	BoundAt         int64  `gorm:"column:bound_at;not null;index:idx_referrer"`
}

func (UserReferralBind) TableName() string {
	// 邀请绑定是站点级基础设施，不区分 dev/prod 表名（与用户表同级）
	return "user_referral_bind"
}
