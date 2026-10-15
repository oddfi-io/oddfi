package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"
)

type User struct {
	UserID          uint64    `gorm:"column:user_id;primaryKey;autoIncrement:false" json:"user_id"`
	Email           string    `gorm:"column:email;size:100" json:"email"`
	Phone           string    `gorm:"column:phone;size:20" json:"phone"`
	SigningAddress  string    `gorm:"column:signing_address;size:255;uniqueIndex" json:"signing_address"`
	PasswordHash    string    `gorm:"column:password_hash;size:255" json:"-"`
	PayPasswordHash string    `gorm:"column:pay_password_hash;size:255" json:"-"`
	Nickname        string    `gorm:"column:nickname;size:50" json:"nickname"`
	Status          int8      `gorm:"column:status;default:1" json:"status"`
	KycLevel        int8      `gorm:"column:kyc_level;default:0" json:"kyc_level"`
	TwoFASecret     string    `gorm:"column:two_fa_secret;size:64" json:"-"`
	TwoFAEnable     int8      `gorm:"column:two_fa_enable;default:0" json:"two_fa_enable"`
	CreatedAt       time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	// IsAdmin         bool      `gorm:"default:false"` // 或用 Role string 具体看hank能不能用管理后台登录eoa
}

func (User) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "user_dev"
	}
	return "user"
}

type UserProfile struct {
	UserID   uint64 `json:"user_id"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Nickname string `json:"nickname"`
}

func (u *User) ToProfile() UserProfile {
	return UserProfile{
		UserID:   u.UserID,
		Email:    u.Email,
		Phone:    u.Phone,
		Nickname: u.Nickname,
	}
}
