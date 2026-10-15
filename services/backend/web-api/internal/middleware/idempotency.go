// Package middleware — admin internal endpoint 幂等中间件。
//
// 设计要点（DD-003 v3.1 §4.3 + M3 修复）：
//
//   - 与 admin_audit middleware 共享 tx（gormtx.From(ctx)），三写原子
//   - SELECT FOR UPDATE 防并发同 key 双写
//   - 命中 cache → rollback tx + 返 cached response（带 _replayed: true 标记）
//   - body hash 校验：同 key 不同 body → 409
//   - 失败回滚由 admin_audit middleware 自动处理（共用 tx）
package middleware

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/gormtx"
	"everything_finance/org/web-api/internal/repository"
)

// responseRecorder 截获 handler 写入的响应体 + 状态码
type responseRecorder struct {
	gin.ResponseWriter
	body   *bytes.Buffer
	status int
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func (r *responseRecorder) WriteString(s string) (int, error) {
	r.body.WriteString(s)
	return r.ResponseWriter.WriteString(s)
}

func (r *responseRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Status() int {
	if r.status == 0 {
		return http.StatusOK
	}
	return r.status
}

// IdempotencyConfig 是幂等中间件配置
type IdempotencyConfig struct {
	// IdemRepo idempotency repo
	IdemRepo repository.AdminIdempotencyRepository
	// TTL 默认 90 天
	TTL time.Duration
	// Now 单测注入
	Now func() time.Time
}

// Idempotency 返回幂等中间件。
//
// 流程：
//  1. 校验 X-Idempotency-Key 必填
//  2. 计算 body hash
//  3. tx 内 LookupForUpdate：
//     a. 命中 + body 一致 → rollback tx + 返 cached response + _replayed: true（防混淆）
//     b. 命中 + body 不一致 → rollback tx + 409 BODY_MISMATCH
//     c. 未命中 → 同 tx INSERT 新行 + 注册 audit_id 回填回调 + 注册 after-next 回填响应
//
// 必须挂在 AdminAudit 之后（依赖 ctx 内 tx）。
func Idempotency(cfg IdempotencyConfig) gin.HandlerFunc {
	if cfg.TTL <= 0 {
		cfg.TTL = 90 * 24 * time.Hour
	}
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

		key := c.GetHeader("X-Idempotency-Key")
		if key == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"code":    "IDEMPOTENCY_KEY_REQUIRED",
				"message": "X-Idempotency-Key header required for mutating operations",
			})
			return
		}

		// 读 body 做 hash。
		// 关键：AdminAudit middleware 已经用 ShouldBindBodyWith 读过 body 并缓存到 gin.BodyBytesKey；
		// 直接读 c.Request.Body 会拿到空字节流。优先从 BodyBytesKey 拿，否则读 + 还原。
		var body []byte
		if cached, exists := c.Get(gin.BodyBytesKey); exists {
			if b, ok := cached.([]byte); ok {
				body = b
			}
		}
		if body == nil {
			read, err := io.ReadAll(c.Request.Body)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"code":    "BODY_READ_FAILED",
					"message": "failed to read request body",
				})
				return
			}
			body = read
		}
		// 还原 c.Request.Body 供下游 handler 可重复读
		c.Request.Body = io.NopCloser(bytes.NewReader(body))
		bodyHashBytes := sha256.Sum256(body)
		bodyHash := hex.EncodeToString(bodyHashBytes[:])

		tx := gormtx.From(c.Request.Context())
		if tx == nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"code":    "IDEM_NO_TX",
				"message": "internal error: idempotency middleware requires tx context (AdminAudit must run first)",
			})
			return
		}

		// SELECT FOR UPDATE
		existing, hit, err := cfg.IdemRepo.LookupForUpdate(tx, key)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"code":    "IDEM_LOOKUP_FAILED",
				"message": "idempotency lookup failed",
			})
			return
		}
		if hit {
			// 校验 body 一致
			if existing.RequestBodyHash != bodyHash {
				_ = gormtx.Rollback(c.Request.Context())
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{
					"code":    "IDEMPOTENCY_BODY_MISMATCH",
					"message": "idempotency_key reused with different body",
				})
				return
			}
			// 命中 + body 一致：返 cached response，带 _replayed 标记
			_ = gormtx.Rollback(c.Request.Context())
			status := http.StatusOK
			if existing.ResponseStatus != nil {
				status = *existing.ResponseStatus
			}
			c.Header("X-Replayed", "true")
			if existing.OriginalRequestID != nil {
				c.Header("X-Original-Request-ID", *existing.OriginalRequestID)
			}
			body := ""
			if existing.ResponseSnapshot != nil {
				body = *existing.ResponseSnapshot
			}
			// 注入 _replayed: true 到 body（如果是 JSON 对象的话）
			replayed := injectReplayedFlag(body, derefOrEmpty(existing.OriginalRequestID))
			c.Data(status, "application/json", []byte(replayed))
			c.Abort()
			return
		}

		// 未命中 → INSERT 新行（同 tx）
		now := cfg.Now()
		origReqID := c.GetHeader("X-Request-ID")
		var origReqIDPtr *string
		if origReqID != "" {
			origReqIDPtr = &origReqID
		}
		row := &model.AdminIdempotency{
			IdempotencyKey:    key,
			RequestPath:       c.Request.URL.Path,
			RequestBodyHash:   bodyHash,
			OriginalRequestID: origReqIDPtr,
			CreatedAt:         now.UnixMilli(),
			ExpiresAt:         now.Add(cfg.TTL).UnixMilli(),
		}
		if err := cfg.IdemRepo.Create(tx, row); err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"code":    "IDEM_INSERT_FAILED",
				"message": "idempotency insert failed",
			})
			return
		}

		// 注册回调供 admin_audit middleware 写完 audit 后回填 audit_id
		c.Set("idem_fill_audit_id", func(auditID uint64) error {
			return cfg.IdemRepo.UpdateResponse(tx, row.ID, recRecorderStatus(c), recRecorderBody(c), auditID)
		})

		// 截获响应体（admin_audit Commit 之前会被读出）
		rw := &responseRecorder{
			ResponseWriter: c.Writer,
			body:           &bytes.Buffer{},
		}
		c.Writer = rw
		c.Set("idem_response_recorder", rw)

		c.Next()
	}
}

// recRecorderStatus / recRecorderBody 从 ctx 拿 recorder 当前状态。
func recRecorderStatus(c *gin.Context) int {
	if v, ok := c.Get("idem_response_recorder"); ok {
		if r, ok := v.(*responseRecorder); ok {
			return r.Status()
		}
	}
	return http.StatusOK
}

func recRecorderBody(c *gin.Context) string {
	if v, ok := c.Get("idem_response_recorder"); ok {
		if r, ok := v.(*responseRecorder); ok {
			return r.body.String()
		}
	}
	return ""
}

// injectReplayedFlag 把 _replayed: true 注入 JSON body 顶层（如果是 object）。
// 不是 object 时原样返回（保留向前兼容）。
func injectReplayedFlag(body, originalReqID string) string {
	var obj map[string]any
	if err := json.Unmarshal([]byte(body), &obj); err != nil {
		return body
	}
	obj["_replayed"] = true
	if originalReqID != "" {
		obj["_original_request_id"] = originalReqID
	}
	out, err := json.Marshal(obj)
	if err != nil {
		return body
	}
	return string(out)
}

func derefOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
