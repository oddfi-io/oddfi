package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"
)

// 用户 登录 记录表
type UserLoginLog struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `gorm:"column:user_id;index" json:"user_id"`
	LoginIP   string    `gorm:"column:login_ip;size:45" json:"login_ip,omitempty"`
	Location  string    `gorm:"column:location;size:100" json:"location,omitempty"`
	DeviceID  string    `gorm:"column:device_id;size:128" json:"device_id,omitempty"`
	UserAgent string    `gorm:"column:user_agent;type:text" json:"user_agent,omitempty"`
	Status    int8      `gorm:"column:status" json:"status"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (UserLoginLog) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "user_login_log_dev"
	}
	return "user_login_log"
}

type LoginStatus int8

const (
	LoginStatusSuccess       LoginStatus = 1 // 成功
	LoginStatusWrongPassword LoginStatus = 2 // 密码错误
	LoginStatus2FAFailed     LoginStatus = 3 // 2FA失败
)
