package model

import "everything_finance/org/web-api/internal/config"

// PresaleEventCursor 监听器游标（每个金库地址一行）
// Worker 启动时通过 EnsureAll 按 env PRESALE_VAULT_POOL 初始化游标行
// 游标和 deposit 在同一事务内提交，保证漏块/重放时能安全 replay
// 多金库地址池：新金库上线后追加一行游标，老金库地址游标继续跟踪历史入账
type PresaleEventCursor struct {
	VaultAddress    string `gorm:"column:vault_address;primaryKey;type:varchar(42)"`
	LastBlockNumber uint64 `gorm:"column:last_block_number;not null;default:0"`
	LastLogIndex    uint   `gorm:"column:last_log_index;not null;default:0"`
	UpdatedAt       int64  `gorm:"column:updated_at;not null;autoUpdateTime:milli"`
}

func (PresaleEventCursor) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "presale_event_cursor_dev"
	}
	return "presale_event_cursor"
}
