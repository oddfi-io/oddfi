// Package repository 封装数据访问。每个 repository 接口一个文件，便于 mock。
//
// 约定：
//   - 所有方法第一个参数 ctx context.Context，DB 调用都 WithContext(ctx)
//   - 业务错误用本包 Error 类型携带 errcode，handler 直接翻译响应
//   - GORM ErrRecordNotFound 原样返回，让 service 层显式判断（避免 nil pointer）
package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	mysqldriver "github.com/go-sql-driver/mysql"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
)

// Error 是 repository 层返回的业务错误（带 code）。
// handler 用 errors.As 提取 code 直接走 response 包装。
type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func newError(code, msg string) *Error { return &Error{Code: code, Message: msg} }

// AsError 把 err 翻成 *Error；不是业务错误时返回 nil。
func AsError(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return nil
}

// AdminUserRepository 是 admin_users 表的访问接口。
type AdminUserRepository interface {
	FindByLarkUserID(ctx context.Context, larkUserID string) (*model.AdminUser, error)
	List(ctx context.Context, page, pageSize int, roleFilter, q string) ([]model.AdminUser, int64, error)
	Create(ctx context.Context, u *model.AdminUser) error
	UpdateRole(ctx context.Context, larkUserID string, role model.Role) error
	Delete(ctx context.Context, larkUserID string) error
	CountSuperAdmin(ctx context.Context) (int64, error)
}

type adminUserRepo struct {
	db *gorm.DB
}

// NewAdminUser 构造默认实现。
func NewAdminUser(db *gorm.DB) AdminUserRepository {
	return &adminUserRepo{db: db}
}

func (r *adminUserRepo) FindByLarkUserID(ctx context.Context, larkUserID string) (*model.AdminUser, error) {
	var u model.AdminUser
	err := r.db.WithContext(ctx).Where("lark_user_id = ?", larkUserID).First(&u).Error
	if err != nil {
		// ErrRecordNotFound 透传给 service 层翻译成 NotAdmin
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		return nil, fmt.Errorf("admin_users find lark_user_id=%s: %w", larkUserID, err)
	}
	return &u, nil
}

func (r *adminUserRepo) List(ctx context.Context, page, pageSize int, roleFilter, q string) ([]model.AdminUser, int64, error) {
	if page < 1 {
		page = 1
	}
	// 兜底 pageSize：handler 也会校验上限 100，这里再防一次
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	tx := r.db.WithContext(ctx).Model(&model.AdminUser{})
	if roleFilter != "" {
		if !model.Role(roleFilter).Valid() {
			return nil, 0, newError(errcode.InvalidParam, "invalid role filter: "+roleFilter)
		}
		tx = tx.Where("role = ?", roleFilter)
	}
	if q != "" {
		like := "%" + q + "%"
		tx = tx.Where("lark_name LIKE ? OR lark_email LIKE ?", like, like)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("admin_users count: %w", err)
	}
	var items []model.AdminUser
	if err := tx.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("admin_users list: %w", err)
	}
	return items, total, nil
}

func (r *adminUserRepo) Create(ctx context.Context, u *model.AdminUser) error {
	if u == nil {
		return errors.New("admin user is nil")
	}
	if !u.Role.Valid() {
		return newError(errcode.InvalidParam, "invalid role: "+u.Role.String())
	}
	if err := r.db.WithContext(ctx).Create(u).Error; err != nil {
		if isUniqueViolation(err) {
			return newError(errcode.AdminUserExists, "admin user already exists")
		}
		return fmt.Errorf("admin_users create: %w", err)
	}
	return nil
}

// UpdateRole 修改角色。
// 事务内多做一道"最后一个 super_admin 不能降级"校验，
// 防止两个 super_admin 被先后改成低权角色后表内出现零 super_admin 的死锁。
func (r *adminUserRepo) UpdateRole(ctx context.Context, larkUserID string, role model.Role) error {
	if !role.Valid() {
		return newError(errcode.InvalidParam, "invalid role: "+role.String())
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var target model.AdminUser
		if err := tx.Where("lark_user_id = ?", larkUserID).First(&target).Error; err != nil {
			return err
		}
		// super_admin → 其他角色 时校验：必须留至少一个 super_admin
		if target.Role == model.RoleSuperAdmin && role != model.RoleSuperAdmin {
			var cnt int64
			if err := tx.Model(&model.AdminUser{}).
				Where("role = ?", model.RoleSuperAdmin).Count(&cnt).Error; err != nil {
				return fmt.Errorf("admin_users count super_admin: %w", err)
			}
			if cnt <= 1 {
				return newError(errcode.LastSuperAdmin, "cannot demote the last super_admin")
			}
		}
		res := tx.Model(&model.AdminUser{}).
			Where("lark_user_id = ?", larkUserID).
			Update("role", role)
		if res.Error != nil {
			return fmt.Errorf("admin_users update_role: %w", res.Error)
		}
		return nil
	})
}

// Delete 在事务里检查并删除：
//  1. 找到目标记录
//  2. 若目标是 super_admin，统计其余 super_admin 数，==1 时拒绝（避免删完最后一个没人能添加管理员）
//  3. 删除
func (r *adminUserRepo) Delete(ctx context.Context, larkUserID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var target model.AdminUser
		if err := tx.Where("lark_user_id = ?", larkUserID).First(&target).Error; err != nil {
			return err
		}
		if target.Role == model.RoleSuperAdmin {
			var cnt int64
			if err := tx.Model(&model.AdminUser{}).
				Where("role = ?", model.RoleSuperAdmin).Count(&cnt).Error; err != nil {
				return fmt.Errorf("admin_users count super_admin: %w", err)
			}
			if cnt <= 1 {
				return newError(errcode.LastSuperAdmin, "cannot remove the last super_admin")
			}
		}
		if err := tx.Delete(&target).Error; err != nil {
			return fmt.Errorf("admin_users delete: %w", err)
		}
		return nil
	})
}

func (r *adminUserRepo) CountSuperAdmin(ctx context.Context) (int64, error) {
	var cnt int64
	if err := r.db.WithContext(ctx).Model(&model.AdminUser{}).
		Where("role = ?", model.RoleSuperAdmin).Count(&cnt).Error; err != nil {
		return 0, fmt.Errorf("admin_users count super_admin: %w", err)
	}
	return cnt, nil
}

// isUniqueViolation 跨数据库识别唯一约束冲突。
// MySQL：优先类型断言（不依赖 error 文案变化）；sqlite 测试场景退化为字符串匹配。
func isUniqueViolation(err error) bool {
	var me *mysqldriver.MySQLError
	if errors.As(err, &me) && me.Number == 1062 {
		return true
	}
	// sqlite in-memory（仅测试）以及非典型驱动兜底
	return strings.Contains(err.Error(), "UNIQUE constraint failed")
}
