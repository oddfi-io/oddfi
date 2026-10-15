// 包 usePermissions，返回类型安全的当前 role。落在 4 枚举外视作 null（未授权）。
// 契约：01-auth-rbac.md §1（role 运行时白名单校验）。
import { usePermissions } from "@refinedev/core";
import type { Role } from "@/types/admin-user";
import { isValidRole } from "@/lib/rbac";

export function usePermissionRole(): { role: Role | null; isLoading: boolean } {
  const { data, isLoading } = usePermissions<string | null>({});
  const role = isValidRole(data) ? data : null;
  return { role, isLoading };
}
