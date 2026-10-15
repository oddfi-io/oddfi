package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
)

// AdminUsersHandler 提供管理员账号管理 API（super_admin 专属）。
type AdminUsersHandler struct {
	repo repository.AdminUserRepository
}

// NewAdminUsers 构造 handler。
func NewAdminUsers(repo repository.AdminUserRepository) *AdminUsersHandler {
	return &AdminUsersHandler{repo: repo}
}

// List GET /admin/admin-users?page=&page_size=&role=&q=
func (h *AdminUsersHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	// handler 层显式兜底，让响应里的 page/page_size 字段返回真实生效值，
	// 避免前端拿到 0/负数误以为没传成功。
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	role := c.Query("role")
	q := c.Query("q")

	items, total, err := h.repo.List(c.Request.Context(), page, pageSize, role, q)
	if err != nil {
		h.respondRepoError(c, err)
		return
	}
	response.OK(c, gin.H{
		"list":      items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

type createAdminUserReq struct {
	LarkUserID string `json:"lark_user_id" binding:"required"`
	LarkName   string `json:"lark_name" binding:"required"`
	LarkEmail  string `json:"lark_email"`
	LarkAvatar string `json:"lark_avatar"`
	Role       string `json:"role" binding:"required"`
}

// Create POST /admin/admin-users
func (h *AdminUsersHandler) Create(c *gin.Context) {
	var req createAdminUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		return
	}
	role := model.Role(req.Role)
	if !role.Valid() {
		response.BadRequest(c, errcode.InvalidParam, "invalid role: "+req.Role)
		return
	}
	creator := c.GetString(middleware.CtxAdminUserID)
	u := &model.AdminUser{
		LarkUserID: req.LarkUserID,
		LarkName:   req.LarkName,
		LarkEmail:  req.LarkEmail,
		LarkAvatar: req.LarkAvatar,
		Role:       role,
		CreatedBy:  creator,
	}
	if err := h.repo.Create(c.Request.Context(), u); err != nil {
		h.respondRepoError(c, err)
		return
	}
	logger.L().Info().
		Str("module", "admin_users").
		Str("admin_user_id", creator).
		Str("created", u.LarkUserID).
		Str("role", string(u.Role)).
		Msg("admin_user created")
	response.OK(c, u)
}

type updateRoleReq struct {
	Role string `json:"role" binding:"required"`
}

// UpdateRole PATCH /admin/admin-users/:lark_user_id/role
//
// 安全规则：
//   - 自降保护：不允许把自己降为非 super_admin（避免连环死锁）
func (h *AdminUsersHandler) UpdateRole(c *gin.Context) {
	targetID := c.Param("lark_user_id")
	currentID := c.GetString(middleware.CtxAdminUserID)

	var req updateRoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		return
	}
	role := model.Role(req.Role)
	if !role.Valid() {
		response.BadRequest(c, errcode.InvalidParam, "invalid role: "+req.Role)
		return
	}
	if targetID == currentID && role != model.RoleSuperAdmin {
		response.BadRequest(c, errcode.InvalidParam, "cannot demote yourself")
		return
	}
	if err := h.repo.UpdateRole(c.Request.Context(), targetID, role); err != nil {
		h.respondRepoError(c, err)
		return
	}
	logger.L().Info().
		Str("module", "admin_users").
		Str("admin_user_id", currentID).
		Str("target", targetID).
		Str("role", string(role)).
		Msg("admin_user role updated")
	response.OK(c, gin.H{"updated": true})
}

// Delete DELETE /admin/admin-users/:lark_user_id
//
// 安全规则：
//   - 自删保护：handler 层拦
//   - 最后一个 super_admin 阻断：repository 层在事务里拦（防 race condition）
func (h *AdminUsersHandler) Delete(c *gin.Context) {
	targetID := c.Param("lark_user_id")
	currentID := c.GetString(middleware.CtxAdminUserID)
	if targetID == currentID {
		response.BadRequest(c, errcode.CannotRemoveSelf, "cannot remove yourself")
		return
	}
	if err := h.repo.Delete(c.Request.Context(), targetID); err != nil {
		h.respondRepoError(c, err)
		return
	}
	logger.L().Info().
		Str("module", "admin_users").
		Str("admin_user_id", currentID).
		Str("target", targetID).
		Msg("admin_user deleted")
	response.OK(c, gin.H{"deleted": true})
}

// respondRepoError 把 repository 层错误翻译成 HTTP 响应。
// 用户可见 message 用 curated 文案；原始 error 进 zerolog。
func (h *AdminUsersHandler) respondRepoError(c *gin.Context, err error) {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		logger.L().Warn().Err(err).Str("module", "admin_users").Msg("request canceled")
		response.Error(c, http.StatusServiceUnavailable, errcode.InternalError, "request canceled")
		return
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 用专门的 ADMIN_USER_NOT_FOUND，避免与登录场景的 NOT_ADMIN 语义混淆
		response.Error(c, http.StatusNotFound, errcode.AdminUserNotFound, "admin user not found")
		return
	}
	if e := repository.AsError(err); e != nil {
		switch e.Code {
		case errcode.InvalidParam, errcode.AdminUserExists, errcode.LastSuperAdmin:
			response.BadRequest(c, e.Code, e.Message)
		default:
			logger.L().Error().Err(err).Str("module", "admin_users").Str("code", e.Code).Msg("unexpected biz error")
			response.Internal(c, errcode.InternalError, "internal error")
		}
		return
	}
	logger.L().Error().Err(err).Str("module", "admin_users").Msg("unexpected error")
	response.Internal(c, errcode.InternalError, "internal error")
}
