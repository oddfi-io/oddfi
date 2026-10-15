package model

// UserReferralCode 邀请码（站点级，无 presale_ 前缀，后续其他业务可复用）
// 格式: 0x + 6 位 [2-9A-HJ-NP-Z]（30 字符集，去 0/O/1/I/L），30^6 ≈ 729M 空间
// 用户首次钱包登录时由 JWT middleware hook 自动 INSERT IGNORE（CSPRNG + 5 次重试）
// 大写存储；查询时输入统一归一为大写比对（前后端两层）
type UserReferralCode struct {
	UserID     uint64 `gorm:"column:user_id;primaryKey"`
	EoaAddress string `gorm:"column:eoa_address;not null;uniqueIndex:uk_eoa;type:varchar(42)"`
	Code       string `gorm:"column:code;not null;uniqueIndex:uk_code;type:varchar(8)"`
	CreatedAt  int64  `gorm:"column:created_at;not null;autoCreateTime:milli"`
}

func (UserReferralCode) TableName() string {
	// 邀请码是站点级基础设施，不区分 dev/prod 表名（与用户表同级）
	return "user_referral_code"
}
