// Package errcode 定义业务错误码常量。
//
// 错误码作为 HTTP 响应 body 的 code 字段（字符串），便于前端按 string 分支处理。
// 不用数字是为了让 grep 直接定位含义。
package errcode

const (
	// 通用
	InvalidParam     = "INVALID_PARAM"
	Unauthorized     = "UNAUTHORIZED"
	TokenExpired     = "TOKEN_EXPIRED"
	TokenInvalid     = "TOKEN_INVALID"
	InsufficientRole = "INSUFFICIENT_ROLE"
	InternalError    = "INTERNAL_ERROR"
	RateLimited      = "RATE_LIMITED"

	// Lark OAuth
	LarkStateMismatch  = "LARK_STATE_MISMATCH"
	LarkExchangeFailed = "LARK_EXCHANGE_FAILED"
	LarkUserInfoFailed = "LARK_USER_INFO_FAILED"
	NotAdmin           = "NOT_ADMIN" // Lark 用户不在 admin_users 白名单

	// 业务
	WithdrawalAlreadyApproved = "WITHDRAWAL_ALREADY_APPROVED"
	WithdrawalNotPending      = "WITHDRAWAL_NOT_PENDING"
	AdminUserExists           = "ADMIN_USER_EXISTS"
	AdminUserNotFound         = "ADMIN_USER_NOT_FOUND" // 目标 admin 不存在（管理 CRUD 场景，区别于登录 NotAdmin）
	LastSuperAdmin            = "LAST_SUPER_ADMIN"     // 拒绝删除/降级最后一个超级管理员
	CannotRemoveSelf          = "CANNOT_REMOVE_SELF"

	// 预售模块（B3）
	// 对应 03-admin-api-contract.md §3 错误码字典
	NoteRequired                   = "NOTE_REQUIRED"                       // 40010: mutate 接口缺少 note 或 note < 10 字符
	InvalidTargetRound             = "INVALID_TARGET_ROUND"                // 40011: migrate-round 目标轮次不存在或不允许
	VaultAddressInvalid            = "VAULT_ADDRESS_INVALID"               // 40012: 金库地址格式错误
	PresaleRoundNotFound           = "ROUND_NOT_FOUND"                     // 40404: 轮次不存在
	PresaleDepositNotFound         = "DEPOSIT_NOT_FOUND"                   // 40404: 入账记录不存在
	PresaleAnomalyNotFound         = "ANOMALY_NOT_FOUND"                   // 40404: 异常事件不存在
	InvalidStateTransition         = "INVALID_STATE_TRANSITION"            // 40901: 状态机非法转换
	BlockTimestampNotInTargetRound = "BLOCK_TIMESTAMP_NOT_IN_TARGET_ROUND" // 42201: migrate-round 时间窗不匹配
	InvalidResolution              = "INVALID_RESOLUTION"                  // 400: anomaly resolve 类型无效
	MigrateRoundLimitExceeded      = "MIGRATE_ROUND_LIMIT_EXCEEDED"        // 40013: 同一 deposit 迁移次数超上限，需人工处理（M1）

	// KOL 特殊返佣（REQ-004）
	KolNotFound           = "KOL_NOT_FOUND"            // PATCH/DELETE 指定 EOA 无对应 KOL 记录
	KolReferralPctInvalid = "KOL_REFERRAL_PCT_INVALID" // 返佣比例超出 [0,100] 范围或格式非法

	// 赛事风险信号灯（DD002）
	EventNotFound        = "EVENT_NOT_FOUND"        // 指定 event_id 不存在（web-api 透传）
	EventNotRedSignal    = "EVENT_NOT_RED_SIGNAL"   // 仅红灯允许人工决策（PRD §5.5，web-api 透传）
	RiskDecisionConflict = "RISK_DECISION_CONFLICT" // admin_risk_decisions 唯一约束冲突 = 重复决策（web-api 透传）
	UpstreamUnavailable  = "UPSTREAM_UNAVAILABLE"   // web-api internal 不可达 / 5xx，前端 badge 保持上次值不弹错
)
