/**
 * Tests for useAdminUsersActions hook.
 *
 * Strategy:
 *   - vi.mock('@/lib/api') intercepts all network calls.
 *   - mockUnwrap controls success/failure: success returns typed data;
 *     failure rejects with ApiError (simulating what the real unwrap throws).
 *   - We inspect the arguments passed to mockApiPost / mockApiPatch / mockApiDelete
 *     to verify path, method, JSON body shape, and absence of idempotency header
 *     (admin-users routes do NOT use requireIdempotencyKey middleware).
 *
 * Backend truth (admin_users.go + router.go):
 *   POST   /admin/admin-users            — createAdminUserReq: lark_user_id/lark_name/lark_email/lark_avatar/role
 *   PATCH  /admin/admin-users/:id/role   — updateRoleReq: { role }
 *   DELETE /admin/admin-users/:id        — no body; path param is lark_user_id
 *   No X-Idempotency-Key required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/types/api";

// ── Hoist mocks before vi.mock factories run ──────────────────────────────────
const { mockUnwrap, mockApiPost, mockApiPatch, mockApiDelete } = vi.hoisted(() => ({
  mockUnwrap: vi.fn(),
  mockApiPost: vi.fn(() => Promise.resolve(new Response("{}"))),
  mockApiPatch: vi.fn(() => Promise.resolve(new Response("{}"))),
  mockApiDelete: vi.fn(() => Promise.resolve(new Response("{}"))),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: mockApiPost,
    patch: mockApiPatch,
    put: vi.fn(),
    delete: mockApiDelete,
  },
  unwrap: mockUnwrap,
}));

// Import AFTER mocking so the hook receives the mocked module.
import { useAdminUsersActions } from "./useAdminUsersActions";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LARK_USER_ID = "ou_abc123def456";
const LARK_NAME = "Alice Admin";
const LARK_EMAIL = "alice@example.com";
const LARK_AVATAR = "https://example.com/avatar.png";

const ADMIN_USER_DATA = {
  user_id: LARK_USER_ID,
  name: LARK_NAME,
  email: LARK_EMAIL,
  avatar: LARK_AVATAR,
  role: "operator" as const,
  created_by: "ou_creator123",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockSuccess(data: unknown = ADMIN_USER_DATA) {
  mockUnwrap.mockResolvedValueOnce(data);
}

function mockApiErrorOnce(code: string, message = "error", status = 400) {
  mockUnwrap.mockRejectedValueOnce(new ApiError(code, status, message));
}

type KyPostCallArgs = [string, { json?: unknown; headers?: Record<string, string> }];
type KyPatchCallArgs = [string, { json?: unknown; headers?: Record<string, string> }];
type KyDeleteCallArgs = [string, { json?: unknown; headers?: Record<string, string> }?];

function lastPostUrl(): string {
  const calls = mockApiPost.mock.calls as unknown as KyPostCallArgs[];
  if (calls.length === 0) throw new Error("api.post was not called");
  return calls[calls.length - 1][0];
}

function lastPostOptions(): { json?: unknown; headers?: Record<string, string> } {
  const calls = mockApiPost.mock.calls as unknown as KyPostCallArgs[];
  if (calls.length === 0) throw new Error("api.post was not called");
  return calls[calls.length - 1][1] ?? {};
}

function lastPatchUrl(): string {
  const calls = mockApiPatch.mock.calls as unknown as KyPatchCallArgs[];
  if (calls.length === 0) throw new Error("api.patch was not called");
  return calls[calls.length - 1][0];
}

function lastPatchOptions(): { json?: unknown; headers?: Record<string, string> } {
  const calls = mockApiPatch.mock.calls as unknown as KyPatchCallArgs[];
  if (calls.length === 0) throw new Error("api.patch was not called");
  return calls[calls.length - 1][1] ?? {};
}

function lastDeleteUrl(): string {
  const calls = mockApiDelete.mock.calls as unknown as KyDeleteCallArgs[];
  if (calls.length === 0) throw new Error("api.delete was not called");
  return calls[calls.length - 1][0];
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── hook construction ─────────────────────────────────────────────────────────

describe("useAdminUsersActions — hook construction", () => {
  it("returns an object with all three action functions", () => {
    const actions = useAdminUsersActions();
    expect(typeof actions.createUser).toBe("function");
    expect(typeof actions.changeRole).toBe("function");
    expect(typeof actions.deleteUser).toBe("function");
  });

  it("does not make any network calls on construction", () => {
    useAdminUsersActions();
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockApiPatch).not.toHaveBeenCalled();
    expect(mockApiDelete).not.toHaveBeenCalled();
  });
});

// ── createUser — happy path ───────────────────────────────────────────────────

describe("useAdminUsersActions — createUser happy path", () => {
  it("calls api.post with correct path admin/admin-users", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" });
    expect(lastPostUrl()).toBe("admin/admin-users");
  });

  it("uses POST method (not PATCH or DELETE)", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "finance" });
    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPatch).not.toHaveBeenCalled();
    expect(mockApiDelete).not.toHaveBeenCalled();
  });

  it("sends lark_user_id in JSON body (snake_case, matching backend JSON tag)", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(body.lark_user_id).toBe(LARK_USER_ID);
  });

  it("sends lark_name in JSON body (snake_case, matching backend JSON tag)", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(body.lark_name).toBe(LARK_NAME);
  });

  it("sends role in JSON body", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "finance" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(body.role).toBe("finance");
  });

  it("includes lark_email in body when provided", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator", lark_email: LARK_EMAIL });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(body.lark_email).toBe(LARK_EMAIL);
  });

  it("includes lark_avatar in body when provided", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({
      lark_user_id: LARK_USER_ID,
      lark_name: LARK_NAME,
      role: "operator",
      lark_avatar: LARK_AVATAR,
    });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(body.lark_avatar).toBe(LARK_AVATAR);
  });

  it("omits lark_email from body when not provided", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(body, "lark_email")).toBe(false);
  });

  it("omits lark_avatar from body when not provided", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(body, "lark_avatar")).toBe(false);
  });

  it("does NOT send X-Idempotency-Key header (admin-users has no idempotency middleware)", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" });
    // headers should not include X-Idempotency-Key
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBeUndefined();
  });

  it("resolves with the created AdminUser on success", async () => {
    mockSuccess(ADMIN_USER_DATA);
    const { createUser } = useAdminUsersActions();
    const result = await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" });
    expect(result).toEqual(ADMIN_USER_DATA);
  });

  it("calls unwrap exactly once", async () => {
    mockSuccess();
    const { createUser } = useAdminUsersActions();
    await createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" });
    expect(mockUnwrap).toHaveBeenCalledTimes(1);
  });
});

// ── createUser — error propagation ───────────────────────────────────────────

describe("useAdminUsersActions — createUser error propagation", () => {
  it("propagates ADMIN_USER_EXISTS (400) without swallowing", async () => {
    mockApiErrorOnce("ADMIN_USER_EXISTS", "duplicate lark user", 400);
    const { createUser } = useAdminUsersActions();
    await expect(
      createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" }),
    ).rejects.toMatchObject({ errorCode: "ADMIN_USER_EXISTS", statusCode: 400 });
  });

  it("propagates INSUFFICIENT_ROLE (403) without swallowing", async () => {
    mockApiErrorOnce("INSUFFICIENT_ROLE", "forbidden", 403);
    const { createUser } = useAdminUsersActions();
    await expect(
      createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "super_admin" }),
    ).rejects.toMatchObject({ errorCode: "INSUFFICIENT_ROLE", statusCode: 403 });
  });

  it("propagates INVALID_PARAM (400) without swallowing", async () => {
    mockApiErrorOnce("INVALID_PARAM", "invalid role", 400);
    const { createUser } = useAdminUsersActions();
    await expect(
      createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("does not swallow errors — rejects instead of resolving on failure", async () => {
    mockApiErrorOnce("ADMIN_USER_EXISTS");
    const { createUser } = useAdminUsersActions();
    await expect(
      createUser({ lark_user_id: LARK_USER_ID, lark_name: LARK_NAME, role: "operator" }),
    ).rejects.toThrow();
  });
});

// ── changeRole — happy path ───────────────────────────────────────────────────

describe("useAdminUsersActions — changeRole happy path", () => {
  it("calls api.patch with correct path including lark_user_id", async () => {
    mockSuccess({ updated: true });
    const { changeRole } = useAdminUsersActions();
    await changeRole(LARK_USER_ID, { role: "finance" });
    expect(lastPatchUrl()).toBe(`admin/admin-users/${LARK_USER_ID}/role`);
  });

  it("uses PATCH method (not POST or DELETE)", async () => {
    mockSuccess({ updated: true });
    const { changeRole } = useAdminUsersActions();
    await changeRole(LARK_USER_ID, { role: "finance" });
    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockApiDelete).not.toHaveBeenCalled();
  });

  it("sends { role } in JSON body (matching backend updateRoleReq JSON tag)", async () => {
    mockSuccess({ updated: true });
    const { changeRole } = useAdminUsersActions();
    await changeRole(LARK_USER_ID, { role: "customer_service" });
    expect(lastPatchOptions().json).toEqual({ role: "customer_service" });
  });

  it("does NOT include any extra fields in body", async () => {
    mockSuccess({ updated: true });
    const { changeRole } = useAdminUsersActions();
    await changeRole(LARK_USER_ID, { role: "operator" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    const keys = Object.keys(body);
    expect(keys).toEqual(["role"]);
  });

  it("does NOT send X-Idempotency-Key header", async () => {
    mockSuccess({ updated: true });
    const { changeRole } = useAdminUsersActions();
    await changeRole(LARK_USER_ID, { role: "finance" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBeUndefined();
  });

  it("resolves void on success", async () => {
    mockSuccess({ updated: true });
    const { changeRole } = useAdminUsersActions();
    await expect(changeRole(LARK_USER_ID, { role: "finance" })).resolves.toBeUndefined();
  });

  it("URL-encodes lark_user_id with special characters", async () => {
    mockSuccess({ updated: true });
    const weirdId = "ou/with spaces";
    const { changeRole } = useAdminUsersActions();
    await changeRole(weirdId, { role: "operator" });
    expect(lastPatchUrl()).toBe(`admin/admin-users/${encodeURIComponent(weirdId)}/role`);
  });

  it("plain lark_user_id (ou_xxx) is not altered by encodeURIComponent", async () => {
    mockSuccess({ updated: true });
    const { changeRole } = useAdminUsersActions();
    await changeRole(LARK_USER_ID, { role: "operator" });
    // encodeURIComponent("ou_abc123def456") === "ou_abc123def456" (all safe chars)
    expect(lastPatchUrl()).toBe(`admin/admin-users/${LARK_USER_ID}/role`);
  });
});

// ── changeRole — error propagation ───────────────────────────────────────────

describe("useAdminUsersActions — changeRole error propagation", () => {
  it("propagates LAST_SUPER_ADMIN (400) without swallowing", async () => {
    mockApiErrorOnce("LAST_SUPER_ADMIN", "cannot demote last super admin", 400);
    const { changeRole } = useAdminUsersActions();
    await expect(changeRole(LARK_USER_ID, { role: "operator" })).rejects.toMatchObject({
      errorCode: "LAST_SUPER_ADMIN",
      statusCode: 400,
    });
  });

  it("propagates ADMIN_USER_NOT_FOUND (404) without swallowing", async () => {
    mockApiErrorOnce("ADMIN_USER_NOT_FOUND", "not found", 404);
    const { changeRole } = useAdminUsersActions();
    await expect(changeRole("nonexistent_id", { role: "operator" })).rejects.toMatchObject({
      errorCode: "ADMIN_USER_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("propagates INSUFFICIENT_ROLE (403) without swallowing", async () => {
    mockApiErrorOnce("INSUFFICIENT_ROLE", "forbidden", 403);
    const { changeRole } = useAdminUsersActions();
    await expect(changeRole(LARK_USER_ID, { role: "operator" })).rejects.toBeInstanceOf(ApiError);
  });

  it("does not swallow — rejects instead of resolving on failure", async () => {
    mockApiErrorOnce("LAST_SUPER_ADMIN");
    const { changeRole } = useAdminUsersActions();
    await expect(changeRole(LARK_USER_ID, { role: "operator" })).rejects.toThrow();
  });
});

// ── deleteUser — happy path ───────────────────────────────────────────────────

describe("useAdminUsersActions — deleteUser happy path", () => {
  it("calls api.delete with correct path including lark_user_id", async () => {
    mockSuccess({ deleted: true });
    const { deleteUser } = useAdminUsersActions();
    await deleteUser(LARK_USER_ID);
    expect(lastDeleteUrl()).toBe(`admin/admin-users/${LARK_USER_ID}`);
  });

  it("uses DELETE method (not POST or PATCH)", async () => {
    mockSuccess({ deleted: true });
    const { deleteUser } = useAdminUsersActions();
    await deleteUser(LARK_USER_ID);
    expect(mockApiDelete).toHaveBeenCalledTimes(1);
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it("resolves void on success", async () => {
    mockSuccess({ deleted: true });
    const { deleteUser } = useAdminUsersActions();
    await expect(deleteUser(LARK_USER_ID)).resolves.toBeUndefined();
  });

  it("URL-encodes lark_user_id with special characters", async () => {
    mockSuccess({ deleted: true });
    const weirdId = "ou/id with spaces";
    const { deleteUser } = useAdminUsersActions();
    await deleteUser(weirdId);
    expect(lastDeleteUrl()).toBe(`admin/admin-users/${encodeURIComponent(weirdId)}`);
  });

  it("plain lark_user_id (ou_xxx) is not altered by encodeURIComponent", async () => {
    mockSuccess({ deleted: true });
    const { deleteUser } = useAdminUsersActions();
    await deleteUser(LARK_USER_ID);
    expect(lastDeleteUrl()).toBe(`admin/admin-users/${LARK_USER_ID}`);
  });

  it("calls unwrap exactly once", async () => {
    mockSuccess({ deleted: true });
    const { deleteUser } = useAdminUsersActions();
    await deleteUser(LARK_USER_ID);
    expect(mockUnwrap).toHaveBeenCalledTimes(1);
  });
});

// ── deleteUser — error propagation ───────────────────────────────────────────

describe("useAdminUsersActions — deleteUser error propagation", () => {
  it("propagates CANNOT_REMOVE_SELF (400) without swallowing", async () => {
    mockApiErrorOnce("CANNOT_REMOVE_SELF", "cannot remove yourself", 400);
    const { deleteUser } = useAdminUsersActions();
    await expect(deleteUser(LARK_USER_ID)).rejects.toMatchObject({
      errorCode: "CANNOT_REMOVE_SELF",
      statusCode: 400,
    });
  });

  it("propagates LAST_SUPER_ADMIN (400) without swallowing", async () => {
    mockApiErrorOnce("LAST_SUPER_ADMIN", "last super admin", 400);
    const { deleteUser } = useAdminUsersActions();
    await expect(deleteUser(LARK_USER_ID)).rejects.toMatchObject({
      errorCode: "LAST_SUPER_ADMIN",
      statusCode: 400,
    });
  });

  it("propagates ADMIN_USER_NOT_FOUND (404) without swallowing", async () => {
    mockApiErrorOnce("ADMIN_USER_NOT_FOUND", "not found", 404);
    const { deleteUser } = useAdminUsersActions();
    await expect(deleteUser("nonexistent")).rejects.toMatchObject({
      errorCode: "ADMIN_USER_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("propagates INSUFFICIENT_ROLE (403) without swallowing", async () => {
    mockApiErrorOnce("INSUFFICIENT_ROLE", "forbidden", 403);
    const { deleteUser } = useAdminUsersActions();
    await expect(deleteUser(LARK_USER_ID)).rejects.toBeInstanceOf(ApiError);
  });

  it("does not swallow — rejects instead of resolving on failure", async () => {
    mockApiErrorOnce("CANNOT_REMOVE_SELF");
    const { deleteUser } = useAdminUsersActions();
    await expect(deleteUser(LARK_USER_ID)).rejects.toThrow();
  });
});
