// Package middleware — admin internal endpoint 的同 tx 审计 middleware。
//
// 设计要点（DD-003 v3.1 §4.4 + M3 修复）：
//
//   - business + audit + idempotency 三写同 tx，原子性保证
//   - tx 开在本 middleware，注入 ctx，下游用 gormtx.From(ctx) 拿
//   - handler abort → tx 回滚 → 业务 / audit / idempotency 三者都不落
//   - handler 成功 → 同 tx 内 INSERT audit + 回填 idempotency.audit_id → Commit
//   - 中间件栈顺序（DD-003 §4.3）：
//     ServiceAuth → AdminJWT → AdminAudit(开 tx) → Idempotency(同 tx INSERT) → handler
//     after-next LIFO：Idempotency 先回填 response → AdminAudit 写 audit + Commit
//
// 依赖：
//   - 上游 AdminJWT middleware 已注入 CtxAdminOperatorID / CtxAdminOperatorRole
//   - handler 必须在响应前 c.Set("audit_action", ...) / c.Set("audit_target_type", ...) /
//     c.Set("audit_target_id", ...) + 可选 c.Set("audit_before", ...) / c.Set("audit_after", ...)
//   - peek note 字段：≥ 10 字符，否则 400
package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/gormtx"
	"everything_finance/org/web-api/internal/repository"
)

const (
	// CtxAuditAction handler 设置的操作类型，audit 落库
	CtxAuditAction = "audit_action"
	// CtxAuditTargetType handler 设置的对象类型（round / deposit / config / anomaly）
	CtxAuditTargetType = "audit_target_type"
	// CtxAuditTargetID handler 设置的对象 ID
	CtxAuditTargetID = "audit_target_id"
	// CtxAuditBefore handler 设置的变更前 JSON 字符串（可选）
	CtxAuditBefore = "audit_before"
	// CtxAuditAfter handler 设置的变更后 JSON 字符串（可选）
	CtxAuditAfter = "audit_after"
	// CtxAuditRowID middleware 写完 audit 后回填，供 idempotency 取
	CtxAuditRowID = "audit_row_id"
)

// adminAuditNoteOnlyReq peek note 字段；与 admin-backend presale_audit 兼容
type adminAuditNoteOnlyReq struct {
	Note string `json:"note"`
}

// AdminAuditConfig 是 admin_audit middleware 配置
type AdminAuditConfig struct {
	// DB 业务 GORM 实例（presale_* / audit / idempotency 全表同 DB）
	DB *gorm.DB
	// AuditRepo audit 表 repo
	AuditRepo repository.PresaleAdminAuditRepository
	// Now 单测注入
	Now func() time.Time
}

// AdminAudit 返回开启 tx + 同 tx 写 audit 的 gin middleware。
//
// GET/HEAD/OPTIONS 跳过（只读不审计）。
// POST/PUT/PATCH/DELETE 必带 note ≥ 10 字符。
func AdminAudit(cfg AdminAuditConfig) gin.HandlerFunc {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return func(c *gin.Context) {
		// 只读请求跳过
		if c.Request.Method == http.MethodGet ||
			c.Request.Method == http.MethodHead ||
			c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		// peek note（≥ 10 字符）
		var peek adminAuditNoteOnlyReq
		if err := c.ShouldBindBodyWith(&peek, binding.JSON); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"code":    "INVALID_BODY",
				"message": "request body must be valid JSON",
			})
			return
		}
		if len([]rune(peek.Note)) < 10 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"code":    "NOTE_REQUIRED",
				"message": "note must be at least 10 characters",
			})
			return
		}

		// 开启 tx 并注入 ctx
		ctx := gormtx.WithTx(c.Request.Context(), cfg.DB)
		c.Request = c.Request.WithContext(ctx)

		c.Next()

		// handler abort / errors → 回滚 tx，audit 不写
		if c.IsAborted() || len(c.Errors) > 0 {
			if err := gormtx.Rollback(ctx); err != nil {
				_ = err // logger 由 caller 处理
			}
			return
		}

		// 构造 audit entry
		tx := gormtx.From(ctx)
		if tx == nil {
			// 不应发生（WithTx 已经注入）；防御性 fail-fast
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "AUDIT_NO_TX",
				"message": "internal error: missing tx context",
			})
			return
		}

		ip := c.ClientIP()
		// admin-backend 透传的 operator IP（如果存在），优先用透传的
		if forwardedOpIP := c.GetHeader("X-Admin-Operator-IP"); forwardedOpIP != "" {
			ip = forwardedOpIP
		}

		actionVal, _ := c.Get(CtxAuditAction)
		targetTypeVal, _ := c.Get(CtxAuditTargetType)
		targetIDVal, _ := c.Get(CtxAuditTargetID)
		beforeVal, _ := c.Get(CtxAuditBefore)
		afterVal, _ := c.Get(CtxAuditAfter)

		operatorID := c.GetString(CtxAdminOperatorID)
		role := c.GetString(CtxAdminOperatorRole)
		secretID := c.GetString(CtxServiceSecretID)
		reqID := c.GetHeader("X-Request-ID")

		var secretIDPtr, reqIDPtr, ipPtr *string
		if secretID != "" {
			s := secretID
			secretIDPtr = &s
		}
		if reqID != "" {
			r := reqID
			reqIDPtr = &r
		}
		if ip != "" {
			i := ip
			ipPtr = &i
		}

		audit := &model.PresaleAdminAudit{
			Operator:          operatorID,
			OperatorRole:      role,
			Action:            asString(actionVal),
			TargetType:        asString(targetTypeVal),
			TargetID:          asString(targetIDVal),
			BeforeJSON:        ptrIfNonEmpty(asString(beforeVal)),
			AfterJSON:         ptrIfNonEmpty(asString(afterVal)),
			Source:            "api",
			IP:                ipPtr,
			Note:              peek.Note,
			ServiceSecretID:   secretIDPtr,
			OriginalRequestID: reqIDPtr,
			CreatedAt:         cfg.Now().UnixMilli(),
		}

		if err := cfg.AuditRepo.Create(tx, audit); err != nil {
			_ = gormtx.Rollback(ctx)
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "AUDIT_INSERT_FAILED",
				"message": "audit insert failed",
			})
			return
		}

		// 暴露 audit_row_id 供 idempotency middleware 回填
		c.Set(CtxAuditRowID, audit.ID)

		// 触发 idempotency middleware 的 audit_id 回填回调（如果设置了）
		if cb, ok := c.Get("idem_fill_audit_id"); ok {
			if fn, ok := cb.(func(uint64) error); ok {
				if err := fn(audit.ID); err != nil {
					_ = gormtx.Rollback(ctx)
					c.JSON(http.StatusInternalServerError, gin.H{
						"code":    "AUDIT_LINK_FAILED",
						"message": "audit-idempotency link failed",
					})
					return
				}
			}
		}

		// 同 tx 提交
		if err := gormtx.Commit(ctx); err != nil {
			_ = gormtx.Rollback(ctx)
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "COMMIT_FAILED",
				"message": "transaction commit failed",
			})
			return
		}
	}
}

func asString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	// 非 string 类型（int / struct 等）— JSON 序列化兜底
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

func ptrIfNonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// _ 编译期约束，避免 unused
var _ io.Reader = (*bytes.Reader)(nil)
