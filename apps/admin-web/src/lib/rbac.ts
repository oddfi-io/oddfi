// RBAC 单一真值源：4 角色 + 资源→角色矩阵。
// rbac.md 要求权限矩阵单一来源；accessControlProvider / App.tsx resources / usePermissionRole 全引这里，
// 避免改矩阵时漏改某处导致"菜单可见性"与"路由守卫"不一致。
import type { Role } from "@/types/admin-user";

// 4 角色白名单：role 落在此集合外视作未授权（避免后端将来改枚举时前端静默全角色失效）。
export const VALID_ROLES: ReadonlySet<Role> = new Set<Role>([
  "super_admin",
  "operator",
  "customer_service",
  "finance",
]);

export function isValidRole(role: string | null | undefined): role is Role {
  return role != null && VALID_ROLES.has(role as Role);
}

// 预售可读角色（finance 本期无任何预售权限，占位角色）。
export const R_VIEW: Role[] = ["super_admin", "operator", "customer_service"];

// 资源 → 允许角色。一级分组 presale 与各二级页同源；admin-users 平台级仅 super_admin。
// config 为读 cs+ / 写 super_admin（写按钮级再用 <RoleGuard> 控）。
export const RESOURCE_ROLES: Record<string, Role[]> = {
  presale: R_VIEW,
  dashboard: R_VIEW,
  rounds: R_VIEW,
  deposits: R_VIEW,
  anomaly: R_VIEW,
  config: R_VIEW,
  audit: R_VIEW,
  // 特殊返佣：与其它预售页同源（查看 cs+），写操作按钮级再用 <RoleGuard> 限 super_admin。
  "kol-referral": R_VIEW,
  "admin-users": ["super_admin"],
  // 赛事风险（DD002）：四角色全读；决策按钮级 RoleGuard 限 operator/super_admin。
  // 与后端 T04 矩阵、rbac.md 三处同步。finance 首次获得 presale 之外的可见模块。
  events: ["super_admin", "operator", "finance", "customer_service"],
};
