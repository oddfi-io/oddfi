package model

// AdminIdempotency 是 admin internal endpoint 的幂等记录表。
// 与 presale_admin_audit 通过 audit_id 关联（admin_audit middleware 在 commit 前回填）。
//
// 设计要点（DD-003 v3.1 §4.3）：
//   - INSERT 与 audit / business 在同一 tx → 原子性
//   - 同 key 同 body 命中 → 返 response_snapshot（带 _replayed: true 标记）
//   - 同 key 不同 body → 409 IDEMPOTENCY_BODY_MISMATCH
//   - 90 天 TTL，cron 清理仅删本表，audit 永不删
type AdminIdempotency struct {
	ID                uint64  `gorm:"primarykey;column:id"                                 json:"id,string"`
	IdempotencyKey    string  `gorm:"column:idempotency_key;size:64;not null;uniqueIndex"  json:"idempotencyKey"`
	AuditID           *uint64 `gorm:"column:audit_id"                                      json:"auditId,omitempty"`
	RequestPath       string  `gorm:"column:request_path;size:255;not null"                json:"requestPath"`
	RequestBodyHash   string  `gorm:"column:request_body_hash;size:64;not null"            json:"requestBodyHash"`
	ResponseStatus    *int    `gorm:"column:response_status"                               json:"responseStatus,omitempty"`
	ResponseSnapshot  *string `gorm:"column:response_snapshot;type:MEDIUMTEXT"             json:"responseSnapshot,omitempty"`
	OriginalRequestID *string `gorm:"column:original_request_id;size:64"                   json:"originalRequestId,omitempty"`
	CreatedAt         int64   `gorm:"column:created_at;not null"                           json:"createdAt"`
	ExpiresAt         int64   `gorm:"column:expires_at;not null"                           json:"expiresAt"`
}

func (AdminIdempotency) TableName() string {
	return "admin_idempotency"
}
