package model

// PresaleAdminAudit 是 admin 运营操作的审计记录。
// 与 admin_idempotency 表通过 audit_id 关联（事务内同时写入，保证 1:1）。
//
// 写入路径：DD-003 v3.1 §4.4 admin_audit middleware
//   - middleware 在 tx 内 build entry + Create + 填 idempotency.audit_id + Commit
//   - tx 失败时 entry 不落，与 business / idempotency 整体回滚
type PresaleAdminAudit struct {
	ID                  uint64  `gorm:"primarykey;column:id"                       json:"id,string"`
	Operator            string  `gorm:"column:operator;size:64;not null"           json:"operator"`            // lark_user_id
	OperatorRole        string  `gorm:"column:operator_role;size:32"               json:"operatorRole"`
	Action              string  `gorm:"column:action;size:48;not null"             json:"action"`
	TargetType          string  `gorm:"column:target_type;size:32;not null"        json:"targetType"`
	TargetID            string  `gorm:"column:target_id;size:64;not null"          json:"targetId"`
	BeforeJSON          *string `gorm:"column:before_json;type:TEXT"               json:"beforeJson,omitempty"`
	AfterJSON           *string `gorm:"column:after_json;type:TEXT"                json:"afterJson,omitempty"`
	Source              string  `gorm:"column:source;size:16;not null;default:api" json:"source"`
	IP                  *string `gorm:"column:ip;size:64"                          json:"ip,omitempty"`
	Note                string  `gorm:"column:note;type:TEXT;not null"             json:"note"`
	ServiceSecretID     *string `gorm:"column:service_secret_id;size:16"           json:"serviceSecretId,omitempty"`
	OriginalRequestID   *string `gorm:"column:original_request_id;size:64"         json:"originalRequestId,omitempty"`
	CreatedAt           int64   `gorm:"column:created_at;not null;autoCreateTime:milli" json:"createdAt"`
}

func (PresaleAdminAudit) TableName() string {
	// 与 admin-backend 历史命名一致，不加 _dev 后缀（DD-003 admin 路径不需要 dev/prod 表名切换；
	// dev/test 通过独立 DB 而非表名隔离）
	return "presale_admin_audit"
}
