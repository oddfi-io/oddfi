// admin-user DTO（snake_case，与 presale 的 camelCase 不同）。
// 契约：03-pages.md §8（api.md §3.4 /auth/me、§3.6 列表）。

// 4 角色枚举。前端 RBAC 全建立在此 union 上。getPermissions 拿到 role 后做运行时白名单校验，
// 落在 4 枚举外的视作未授权（见 accessControlProvider）。
export type Role = "super_admin" | "operator" | "customer_service" | "finance";

// /auth/me 返回的当前登录身份（权威来源，不解本地 JWT 取 role）。
export interface Identity {
  user_id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
}

// admin-users 列表/详情记录（snake_case）。created_at/updated_at 是 RFC3339 字符串。
export interface AdminUser {
  user_id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  created_by: string;
  created_at: string; // RFC3339
  updated_at: string; // RFC3339
}

// create 入参（created_by 后端自动填，前端不传）。
export interface CreateAdminUserInput {
  lark_user_id: string;
  lark_name: string;
  lark_email?: string;
  lark_avatar?: string;
  role: Role;
}

// 角色中文展示名。
export const ROLE_NAMES: Record<Role, string> = {
  super_admin: "超级管理员",
  operator: "运营",
  customer_service: "客服",
  finance: "财务",
};
