package model

import "time"

// EarlyAccessRegistration 早鸟登记记录（对应数据库 early_access_registrations 表）
type EarlyAccessRegistration struct {
	ID                  uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"-"`
	BizID               string    `gorm:"column:biz_id;size:32;uniqueIndex" json:"id"`          // 业务 ID：ea_xxxxxxxxxxxx
	Email               string    `gorm:"column:email;size:128;uniqueIndex" json:"email"`
	WalletAddress       string    `gorm:"column:wallet_address;size:64;uniqueIndex" json:"wallet_address"`
	ExpectedFeature     string    `gorm:"column:expected_feature;type:text" json:"expected_feature"`
	ReferralSource      string    `gorm:"column:referral_source;size:32" json:"referral_source"`
	ReferralSourceOther string    `gorm:"column:referral_source_other;size:64" json:"referral_source_other"`
	Source              string    `gorm:"column:source;size:32" json:"source"`
	UTMSource           string    `gorm:"column:utm_source;size:64" json:"utm_source"`
	UTMCampaign         string    `gorm:"column:utm_campaign;size:64" json:"utm_campaign"`
	IPAddress           string    `gorm:"column:ip_address;size:64" json:"-"`   // 不对外暴露
	UserAgent           string    `gorm:"column:user_agent;type:text" json:"-"` // 不对外暴露
	Status              int8      `gorm:"column:status;default:1" json:"status"` // 1=正常 / 0=拉黑
	CreatedAt           time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time `gorm:"column:updated_at;autoUpdateTime" json:"-"`
}

// TableName 指定表名，单表不加 _dev 后缀，dev/prod 用 DB/Schema 隔离
func (EarlyAccessRegistration) TableName() string {
	return "early_access_registrations"
}

// RegisterEarlyAccessReq 早鸟登记请求体
type RegisterEarlyAccessReq struct {
	Email               string `json:"email" binding:"required"`
	WalletAddress       string `json:"wallet_address" binding:"required"`
	ExpectedFeature     string `json:"expected_feature"`
	ReferralSource      string `json:"referral_source"`
	ReferralSourceOther string `json:"referral_source_other"`
	Source              string `json:"source"`
	UTMSource           string `json:"utm_source"`
	UTMCampaign         string `json:"utm_campaign"`
}

// RegisterEarlyAccessResp 早鸟登记响应体
type RegisterEarlyAccessResp struct {
	ID        string    `json:"id"`
	Rank      int64     `json:"rank"`
	CreatedAt time.Time `json:"created_at"`
}
