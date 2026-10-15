// Package model 包含 DTO 和 GORM 模型。
package model

// Role 表示管理员角色。值与 DB CHECK 约束、前端 rbac.md 矩阵一一对应。
type Role string

const (
	RoleSuperAdmin      Role = "super_admin"
	RoleOperator        Role = "operator"
	RoleCustomerService Role = "customer_service"
	RoleFinance         Role = "finance"
)

// Valid 用于 repository 写入前的兜底校验（DB CHECK 是最后一道防线）。
func (r Role) Valid() bool {
	switch r {
	case RoleSuperAdmin, RoleOperator, RoleCustomerService, RoleFinance:
		return true
	}
	return false
}

// String 实现 fmt.Stringer。
func (r Role) String() string { return string(r) }
