/**
 * useAdminUsersActions — stateless async action functions for admin-user CRUD.
 *
 * No idempotency header — admin-users handlers do NOT use requireIdempotencyKey middleware
 * (confirmed from internal/router/router.go: admin-users group has no idempotency MW).
 *
 * Contract:
 *   - POST   /admin/admin-users           — createUser (body: lark_user_id/lark_name/lark_email/lark_avatar/role)
 *   - PATCH  /admin/admin-users/:id/role  — changeRole (path param: lark_user_id; body: { role })
 *   - DELETE /admin/admin-users/:id       — deleteUser (path param: lark_user_id)
 *   - All errors propagate as ApiError; caller owns UI notification.
 *   - Envelope unpacking: unwrap<T>() from @/lib/api (throws ApiError on code !== 0)
 *   - Path param is lark_user_id (not the DB user_id) — confirmed from router.go + handler source
 *
 * docs/spa-presale-admin/02-data-layer.md §3
 * docs/spa-presale-admin/06-acceptance-and-tasks.md M4 T22/T23/T24
 */
import { api, unwrap } from "@/lib/api";
import type { AdminUser, Role } from "@/types/admin-user";

// ── Argument types ────────────────────────────────────────────────────────────

/**
 * POST /admin/admin-users body.
 * JSON tags from backend createAdminUserReq struct (admin_users.go):
 *   lark_user_id (required), lark_name (required), lark_email, lark_avatar, role (required).
 */
export interface CreateAdminUserArgs {
  /** Maps to JSON tag `lark_user_id` (binding:"required"). */
  lark_user_id: string;
  /** Maps to JSON tag `lark_name` (binding:"required"). */
  lark_name: string;
  /** Maps to JSON tag `lark_email` (optional). */
  lark_email?: string;
  /** Maps to JSON tag `lark_avatar` (optional). */
  lark_avatar?: string;
  /** Maps to JSON tag `role` (binding:"required"). */
  role: Role;
}

/** PATCH /admin/admin-users/:lark_user_id/role body. */
export interface ChangeRoleArgs {
  /** Maps to JSON tag `role` (binding:"required" in updateRoleReq). */
  role: Role;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AdminUsersActionsApi {
  /** POST /admin/admin-users — create a new admin user. */
  createUser: (args: CreateAdminUserArgs) => Promise<AdminUser>;
  /** PATCH /admin/admin-users/:lark_user_id/role — change an admin user's role. */
  changeRole: (larkUserId: string, args: ChangeRoleArgs) => Promise<void>;
  /** DELETE /admin/admin-users/:lark_user_id — delete an admin user. */
  deleteUser: (larkUserId: string) => Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Returns CRUD action functions for admin-users.
 * No state held — errors propagate as-is to the caller.
 *
 * Note: path param is lark_user_id (NOT the auto-increment DB user_id).
 * Confirmed from router.go: `au.PATCH("/:lark_user_id/role", ...)` and handler source.
 */
export function useAdminUsersActions(): AdminUsersActionsApi {
  return {
    createUser: async (args: CreateAdminUserArgs): Promise<AdminUser> => {
      const result = await unwrap<AdminUser>(
        api.post("admin/admin-users", {
          json: {
            lark_user_id: args.lark_user_id,
            lark_name: args.lark_name,
            ...(args.lark_email !== undefined && { lark_email: args.lark_email }),
            ...(args.lark_avatar !== undefined && { lark_avatar: args.lark_avatar }),
            role: args.role,
          },
        }),
      );
      console.log(`[useAdminUsersActions] createUser ok — lark_user_id=${args.lark_user_id} role=${args.role}`);
      return result;
    },

    changeRole: async (larkUserId: string, args: ChangeRoleArgs): Promise<void> => {
      const encoded = encodeURIComponent(larkUserId);
      await unwrap<{ updated: boolean }>(
        api.patch(`admin/admin-users/${encoded}/role`, {
          json: { role: args.role },
        }),
      );
      console.log(`[useAdminUsersActions] changeRole ok — lark_user_id=${larkUserId} role=${args.role}`);
    },

    deleteUser: async (larkUserId: string): Promise<void> => {
      const encoded = encodeURIComponent(larkUserId);
      await unwrap<{ deleted: boolean }>(
        api.delete(`admin/admin-users/${encoded}`),
      );
      console.log(`[useAdminUsersActions] deleteUser ok — lark_user_id=${larkUserId}`);
    },
  };
}
