/**
 * adminUsersGuards — pure guard functions for admin-user delete/role-change protection.
 *
 * These are intentionally framework-free pure functions so they can be unit-tested
 * without any React or Refine setup.
 *
 * Guards:
 *   - canDeleteAdminUser: blocks self-delete and last-super_admin delete
 *   - canChangeAdminRole: blocks self-demote from super_admin and last-super_admin downgrade
 *
 * The primary key used for user identity matching is `lark_user_id` (the Lark external ID),
 * which is also the path param in backend routes (/:lark_user_id). The Identity type from
 * authProvider.getIdentity() returns `user_id` (the internal DB ID), but since we compare
 * against what the backend uses for self-checks (lark_user_id in middleware.CtxAdminUserID),
 * callers should pass the current user's lark_user_id from Identity.
 *
 * Note: AdminUser DTO uses `user_id` as the DB primary key but the backend's CtxAdminUserID
 * stores the lark_user_id. The authProvider.getIdentity() returns Identity.user_id which is
 * populated from the JWT claim `user_id` — which maps to admin_users.lark_user_id in the DB.
 * Confirmed from handler: `currentID := c.GetString(middleware.CtxAdminUserID)` and
 * `targetID := c.Param("lark_user_id")` — both are lark_user_id values.
 *
 * docs/spa-presale-admin/06-acceptance-and-tasks.md M4 T24
 */
import type { AdminUser, Role } from "@/types/admin-user";

// ── Result type ───────────────────────────────────────────────────────────────

/** Guard result: ok=true means the operation is allowed. */
export interface AdminUserGuardResult {
  ok: boolean;
  /** Why the operation is blocked (only set when ok=false). */
  reason?: "self" | "last_super_admin";
  /** Human-readable Chinese message for UI display (only set when ok=false). */
  message?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count super_admins in the full user list. */
function countSuperAdmins(allUsers: AdminUser[]): number {
  return allUsers.filter((u) => u.role === "super_admin").length;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether the target admin user can be deleted.
 *
 * Blocked if:
 *   1. target.user_id === currentUserId  (self-delete)
 *   2. target is super_admin AND is the last super_admin in allUsers
 *
 * @param target        - The AdminUser record to be deleted.
 * @param currentUserId - The logged-in user's identity ID (from Identity.user_id / authProvider.getIdentity).
 * @param allUsers      - Full current list of admin users (used for last-super_admin check).
 */
export function canDeleteAdminUser(
  target: AdminUser,
  currentUserId: string | undefined,
  allUsers: AdminUser[],
): AdminUserGuardResult {
  // Self-delete check
  if (currentUserId !== undefined && target.user_id === currentUserId) {
    return {
      ok: false,
      reason: "self",
      message: "不能删除当前登录的自己",
    };
  }

  // Last super_admin check
  if (target.role === "super_admin" && countSuperAdmins(allUsers) <= 1) {
    return {
      ok: false,
      reason: "last_super_admin",
      message: "不能删除最后一个超级管理员",
    };
  }

  return { ok: true };
}

/**
 * Check whether the target admin user's role can be changed to newRole.
 *
 * Blocked if:
 *   1. target.user_id === currentUserId AND newRole !== "super_admin"
 *      (self-demote blocked — mirrors backend: targetID == currentID && role != super_admin)
 *   2. target is super_admin AND newRole !== "super_admin" AND they are the last super_admin
 *      (last-super_admin downgrade blocked)
 *
 * @param target        - The AdminUser record whose role is being changed.
 * @param newRole       - The proposed new role.
 * @param currentUserId - The logged-in user's identity ID (from Identity.user_id / authProvider.getIdentity).
 * @param allUsers      - Full current list of admin users (used for last-super_admin check).
 */
export function canChangeAdminRole(
  target: AdminUser,
  newRole: Role,
  currentUserId: string | undefined,
  allUsers: AdminUser[],
): AdminUserGuardResult {
  // Self-demote check (mirrors backend handler logic)
  if (
    currentUserId !== undefined &&
    target.user_id === currentUserId &&
    newRole !== "super_admin"
  ) {
    return {
      ok: false,
      reason: "self",
      message: "不能降级当前登录的自己",
    };
  }

  // Last super_admin downgrade check
  if (
    target.role === "super_admin" &&
    newRole !== "super_admin" &&
    countSuperAdmins(allUsers) <= 1
  ) {
    return {
      ok: false,
      reason: "last_super_admin",
      message: "不能降级最后一个超级管理员",
    };
  }

  return { ok: true };
}
