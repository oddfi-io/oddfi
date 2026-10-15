// RoleGuard：仅控制操作级 UI 可见性，不做安全保证（后端 RoleRequired 兜底）。
// 契约：rbac.md「RoleGuard 组件用法」，01-auth-rbac.md §3。
import type { ReactNode } from "react";
import { usePermissionRole } from "@/hooks/usePermissionRole";
import type { Role } from "@/types/admin-user";

interface Props {
  allow: Role[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGuard({ allow, fallback = null, children }: Props) {
  const { role } = usePermissionRole();
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
