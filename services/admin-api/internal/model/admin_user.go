package model

import "time"

// AdminUser 对应 admin_users 表。
// 表 DDL 见 migrations/0001_create_admin_users.sql。
type AdminUser struct {
	LarkUserID string    `gorm:"column:lark_user_id;primaryKey" json:"user_id"`
	LarkName   string    `gorm:"column:lark_name"                json:"name"`
	LarkEmail  string    `gorm:"column:lark_email"               json:"email"`
	LarkAvatar string    `gorm:"column:lark_avatar"              json:"avatar"`
	Role       Role      `gorm:"column:role"                     json:"role"`
	CreatedBy  string    `gorm:"column:created_by"               json:"created_by"`
	CreatedAt  time.Time `gorm:"column:created_at"               json:"created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at"               json:"updated_at"`
}

// TableName 显式声明，避免 GORM 自动复数化误差。
func (AdminUser) TableName() string { return "admin_users" }
