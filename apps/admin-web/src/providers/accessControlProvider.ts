// accessControlProvider：基于 role 的资源级可见性（菜单/资源）。
// 操作级（按钮）用 <RoleGuard> 控制，两层配合。契约：01-auth-rbac.md §4。
import type { AccessControlProvider } from "@refinedev/core";
import { authProvider } from "@/providers/authProvider";
import { RESOURCE_ROLES, isValidRole } from "@/lib/rbac";

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource }) => {
    const role = (await authProvider.getPermissions?.()) as string | null;
    if (!isValidRole(role)) return { can: false };
    const allowed = RESOURCE_ROLES[resource ?? ""] ?? [];
    return { can: allowed.includes(role) };
  },
  options: { buttons: { enableAccessControl: true, hideIfUnauthorized: true } },
};
