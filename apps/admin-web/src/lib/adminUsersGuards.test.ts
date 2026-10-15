/**
 * Tests for adminUsersGuards pure functions.
 *
 * Uses it.each table-driven approach for truth-table coverage.
 * No React/Refine setup needed — these are pure functions.
 *
 * Covers:
 *   - canDeleteAdminUser: self-delete, last-super_admin, allowed
 *   - canChangeAdminRole: self-demote, last-super_admin downgrade, allowed
 *   - Edge cases: empty list, target not in list, undefined currentUserId
 */
import { describe, it, expect } from "vitest";
import { canDeleteAdminUser, canChangeAdminRole } from "./adminUsersGuards";
import type { AdminUser, Role } from "@/types/admin-user";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<AdminUser> & { user_id: string; role: Role }): AdminUser {
  return {
    name: "Test User",
    email: "test@example.com",
    avatar: "",
    created_by: "system",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const SUPER1 = makeUser({ user_id: "super1", role: "super_admin" });
const SUPER2 = makeUser({ user_id: "super2", role: "super_admin" });
const OPERATOR1 = makeUser({ user_id: "op1", role: "operator" });
const FINANCE1 = makeUser({ user_id: "fin1", role: "finance" });
const CS1 = makeUser({ user_id: "cs1", role: "customer_service" });

// ── canDeleteAdminUser ────────────────────────────────────────────────────────

describe("canDeleteAdminUser — self-delete protection", () => {
  it.each([
    ["super_admin deletes self", SUPER1, "super1", [SUPER1, SUPER2], false, "self"],
    ["operator deletes self", OPERATOR1, "op1", [SUPER1, OPERATOR1], false, "self"],
    ["finance deletes self", FINANCE1, "fin1", [SUPER1, FINANCE1], false, "self"],
  ])("%s", (_label, target, currentUserId, allUsers, expectedOk, expectedReason) => {
    const result = canDeleteAdminUser(target, currentUserId, allUsers);
    expect(result.ok).toBe(expectedOk);
    expect(result.reason).toBe(expectedReason);
    expect(result.message).toBeTruthy();
  });
});

describe("canDeleteAdminUser — last super_admin protection", () => {
  it("blocks deletion when target is the only super_admin", () => {
    // Only one super_admin in the list; trying to delete them
    const result = canDeleteAdminUser(SUPER1, "some_other_user", [SUPER1, OPERATOR1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
    expect(result.message).toBeTruthy();
  });

  it("blocks deletion when allUsers list only has the target super_admin", () => {
    const result = canDeleteAdminUser(SUPER1, "another", [SUPER1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
  });

  it("blocks deletion when target is sole super_admin even with many other roles", () => {
    const result = canDeleteAdminUser(SUPER1, "op1", [SUPER1, OPERATOR1, FINANCE1, CS1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
  });

  it("allows deletion when there are 2 super_admins", () => {
    const result = canDeleteAdminUser(SUPER1, "super2", [SUPER1, SUPER2, OPERATOR1]);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("allows deletion of operator even if only 1 super_admin exists", () => {
    const result = canDeleteAdminUser(OPERATOR1, "super1", [SUPER1, OPERATOR1]);
    expect(result.ok).toBe(true);
  });
});

describe("canDeleteAdminUser — allowed cases", () => {
  it.each([
    ["super_admin deletes operator (2 supers)", OPERATOR1, "super1", [SUPER1, SUPER2, OPERATOR1], true],
    ["super_admin deletes finance", FINANCE1, "super1", [SUPER1, FINANCE1], true],
    ["super_admin deletes cs", CS1, "super1", [SUPER1, CS1], true],
    ["deletes other super when 2 exist", SUPER2, "super1", [SUPER1, SUPER2], true],
  ])("%s", (_label, target, currentUserId, allUsers, expectedOk) => {
    const result = canDeleteAdminUser(target, currentUserId, allUsers);
    expect(result.ok).toBe(expectedOk);
  });
});

describe("canDeleteAdminUser — edge cases", () => {
  it("returns ok:true when currentUserId is undefined (not yet loaded)", () => {
    // Self-delete check skipped when currentUserId is not available
    const result = canDeleteAdminUser(OPERATOR1, undefined, [SUPER1, OPERATOR1]);
    expect(result.ok).toBe(true);
  });

  it("still blocks last super_admin even when currentUserId is undefined", () => {
    const result = canDeleteAdminUser(SUPER1, undefined, [SUPER1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
  });

  it("handles empty allUsers list — target is super_admin → blocks", () => {
    // Empty list means super_admin count is 0, which is <= 1, so still blocked
    const result = canDeleteAdminUser(SUPER1, "other", []);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
  });

  it("handles target not in allUsers list — non-super_admin still ok", () => {
    // Target not in allUsers — should still allow deletion of non-super_admin
    const orphan = makeUser({ user_id: "orphan", role: "operator" });
    const result = canDeleteAdminUser(orphan, "super1", [SUPER1]);
    expect(result.ok).toBe(true);
  });

  it("self-check takes priority over last_super_admin check", () => {
    // If you try to delete yourself and you're the last super_admin, self-check fires first
    const result = canDeleteAdminUser(SUPER1, "super1", [SUPER1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("self");
  });
});

// ── canChangeAdminRole ────────────────────────────────────────────────────────

describe("canChangeAdminRole — self-demote protection", () => {
  it("blocks self-demote from super_admin to operator", () => {
    const result = canChangeAdminRole(SUPER1, "operator", "super1", [SUPER1, SUPER2]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("self");
    expect(result.message).toBeTruthy();
  });

  it("blocks self-demote from super_admin to finance", () => {
    const result = canChangeAdminRole(SUPER1, "finance", "super1", [SUPER1, SUPER2]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("self");
  });

  it("blocks self-demote from super_admin to customer_service", () => {
    const result = canChangeAdminRole(SUPER1, "customer_service", "super1", [SUPER1, SUPER2]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("self");
  });

  it("allows self-to-self super_admin assignment (no-op role change)", () => {
    // Changing yourself to the same role (super_admin → super_admin) is fine
    const result = canChangeAdminRole(SUPER1, "super_admin", "super1", [SUPER1, SUPER2]);
    expect(result.ok).toBe(true);
  });

  it("allows super_admin to change someone else's role to operator", () => {
    const result = canChangeAdminRole(SUPER2, "operator", "super1", [SUPER1, SUPER2, OPERATOR1]);
    expect(result.ok).toBe(true);
  });
});

describe("canChangeAdminRole — last super_admin downgrade protection", () => {
  it("blocks downgrade when target is the only super_admin", () => {
    const result = canChangeAdminRole(SUPER1, "operator", "super2_nonexistent", [SUPER1, OPERATOR1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
    expect(result.message).toBeTruthy();
  });

  it("blocks downgrade when allUsers has exactly 1 super_admin", () => {
    const result = canChangeAdminRole(SUPER1, "finance", "another", [SUPER1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
  });

  it("allows downgrade when 2 super_admins exist", () => {
    const result = canChangeAdminRole(SUPER1, "operator", "super2", [SUPER1, SUPER2]);
    expect(result.ok).toBe(true);
  });

  it("does NOT block upgrading non-super_admin to super_admin (last_super check only for downgrades)", () => {
    // Changing operator to super_admin when only 1 super_admin exists is fine
    const result = canChangeAdminRole(OPERATOR1, "super_admin", "super1", [SUPER1, OPERATOR1]);
    expect(result.ok).toBe(true);
  });

  it("does not block if target is not super_admin (last_super_admin check is irrelevant)", () => {
    const result = canChangeAdminRole(OPERATOR1, "finance", "super1", [SUPER1, OPERATOR1]);
    expect(result.ok).toBe(true);
  });

  it("does not block if newRole is super_admin (no downgrade happening)", () => {
    // Upgrading to super_admin when only 1 exists is always fine
    const result = canChangeAdminRole(SUPER1, "super_admin", "other", [SUPER1]);
    expect(result.ok).toBe(true);
  });
});

describe("canChangeAdminRole — allowed cases", () => {
  it.each([
    ["super changes operator to finance", OPERATOR1, "finance" as Role, "super1", [SUPER1, OPERATOR1], true],
    ["super changes cs to operator", CS1, "operator" as Role, "super1", [SUPER1, CS1], true],
    ["super promotes finance to super_admin", FINANCE1, "super_admin" as Role, "super1", [SUPER1, FINANCE1], true],
    ["super demotes SUPER2 (2 supers exist)", SUPER2, "operator" as Role, "super1", [SUPER1, SUPER2], true],
  ])("%s", (_label, target, newRole, currentUserId, allUsers, expectedOk) => {
    const result = canChangeAdminRole(target, newRole, currentUserId, allUsers);
    expect(result.ok).toBe(expectedOk);
  });
});

describe("canChangeAdminRole — edge cases", () => {
  it("allows when currentUserId is undefined (identity not yet loaded)", () => {
    // Self-check skipped; last_super check still runs
    const result = canChangeAdminRole(OPERATOR1, "finance", undefined, [SUPER1, OPERATOR1]);
    expect(result.ok).toBe(true);
  });

  it("still blocks last super_admin downgrade when currentUserId is undefined", () => {
    const result = canChangeAdminRole(SUPER1, "operator", undefined, [SUPER1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
  });

  it("handles empty allUsers — super_admin downgrade still blocked (count=0 <= 1)", () => {
    const result = canChangeAdminRole(SUPER1, "operator", "other", []);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("last_super_admin");
  });

  it("self-demote check takes priority over last_super check for self", () => {
    // Self demoting themselves when they are the only super_admin — self fires first
    const result = canChangeAdminRole(SUPER1, "operator", "super1", [SUPER1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("self");
  });
});
