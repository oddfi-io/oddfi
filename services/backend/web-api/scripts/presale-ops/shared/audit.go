package shared

import (
	"time"

	"gorm.io/gorm"
)

// AuditEntry 预案脚本执行时写入 presale_admin_audit 的字段集合
// 调用方填充所有字段后传入 WriteAudit；WriteAudit 负责填充固定字段（operator_role/source/created_at）
type AuditEntry struct {
	// ScriptName 脚本文件名（不含 .go 后缀），e.g. "unclaimed-credit"
	ScriptName string
	// Action 操作类型，e.g. "anomaly_resolve" / "migrate_round_id" / "round_pause"
	Action string
	// TargetType 操作对象类型，e.g. "anomaly" / "deposit" / "round"
	TargetType string
	// TargetID 操作对象 ID 字符串
	TargetID string
	// BeforeJSON 变更前快照（JSON 字符串）
	BeforeJSON string
	// AfterJSON 变更后快照（JSON 字符串）
	AfterJSON string
	// Note 操作原因（来自 --note flag，已经过 ValidateNote 校验）
	Note string
}

// WriteAudit 在传入的事务 tx 内写一行 presale_admin_audit。
// 调用方负责 tx.Commit() / tx.Rollback()。
// 使用原生 Exec 而非 GORM AutoMigrate，兼容 admin-backend 建表的 schema（不依赖 model struct）。
func WriteAudit(tx *gorm.DB, entry AuditEntry) error {
	// created_at 使用毫秒时间戳，与 presale_admin_audit schema 一致
	now := time.Now().UnixMilli()
	return tx.Exec(`
		INSERT INTO presale_admin_audit
			(operator, operator_role, action, target_type, target_id,
			 before_json, after_json, source, note, created_at)
		VALUES (?, 'script', ?, ?, ?, ?, ?, 'script', ?, ?)`,
		"script:"+entry.ScriptName, // operator = "script:filename"，与 admin audit 规范一致
		entry.Action,
		entry.TargetType,
		entry.TargetID,
		entry.BeforeJSON,
		entry.AfterJSON,
		entry.Note,
		now,
	).Error
}
