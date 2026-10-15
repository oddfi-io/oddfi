import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "@/types/api";

// ── Hoist mocks ───────────────────────────────────────────────────────────────
const { mockApiPost, mockUnwrap, mockApiGet, mockIsJwtExpired } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockApiGet: vi.fn(),
  mockUnwrap: vi.fn(),
  mockIsJwtExpired: vi.fn<(t: string) => boolean>(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
  },
  unwrap: mockUnwrap,
}));

vi.mock("@/lib/jwt", () => ({
  isJwtExpired: mockIsJwtExpired,
}));

import { authProvider } from "./authProvider";

// ── localStorage helpers ──────────────────────────────────────────────────────
const JWT_KEY = "oddfi_admin_jwt";

function setToken(token: string) {
  localStorage.setItem(JWT_KEY, token);
}
function clearToken() {
  localStorage.removeItem(JWT_KEY);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  clearToken();
});

afterEach(() => {
  clearToken();
});

// ── login ─────────────────────────────────────────────────────────────────────

describe("authProvider.login", () => {
  it("sets window.location.href to /auth/lark/login", async () => {
    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, set href(v: string) { hrefSetter(v); } },
      writable: true,
      configurable: true,
    });
    await authProvider.login!({});
    expect(hrefSetter).toHaveBeenCalledWith("/auth/lark/login");
  });

  it("returns { success: true }", async () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, set href(_v: string) {} },
      writable: true,
      configurable: true,
    });
    const result = await authProvider.login!({});
    expect(result).toEqual({ success: true });
  });
});

// ── check ─────────────────────────────────────────────────────────────────────

describe("authProvider.check", () => {
  it("returns unauthenticated + redirect when no token in localStorage", async () => {
    const result = await authProvider.check!({});
    expect(result).toEqual({ authenticated: false, redirectTo: "/login" });
  });

  it("returns unauthenticated + redirect when token is expired", async () => {
    setToken("expired.token.here");
    mockIsJwtExpired.mockReturnValue(true);
    const result = await authProvider.check!({});
    expect(result).toEqual({ authenticated: false, redirectTo: "/login" });
    expect(localStorage.getItem(JWT_KEY)).toBeNull();
  });

  it("returns authenticated when token exists and is not expired", async () => {
    setToken("valid.token.here");
    mockIsJwtExpired.mockReturnValue(false);
    const result = await authProvider.check!({});
    expect(result).toEqual({ authenticated: true });
  });
});

// ── onError ───────────────────────────────────────────────────────────────────

describe("authProvider.onError", () => {
  it.each([
    ["UNAUTHORIZED"],
    ["TOKEN_EXPIRED"],
    ["TOKEN_INVALID"],
  ])("triggers logout for errorCode %s", async (code) => {
    setToken("some.token");
    const err = new ApiError(code, 401, "session dead");
    const result = await authProvider.onError!(err);
    expect(result).toMatchObject({ logout: true, redirectTo: "/login" });
    expect(localStorage.getItem(JWT_KEY)).toBeNull();
  });

  it("does NOT logout for unrelated ApiError codes", async () => {
    setToken("some.token");
    const err = new ApiError("VALIDATION_FAILED", 400, "bad input");
    const result = await authProvider.onError!(err);
    expect(result).toEqual({});
    expect(localStorage.getItem(JWT_KEY)).toBe("some.token");
  });

  it("does NOT logout for non-ApiError errors", async () => {
    setToken("some.token");
    const result = await authProvider.onError!(new Error("network timeout"));
    expect(result).toEqual({});
  });
});

// ── getIdentity ───────────────────────────────────────────────────────────────

describe("authProvider.getIdentity", () => {
  it("returns null when no token", async () => {
    const result = await authProvider.getIdentity!();
    expect(result).toBeNull();
  });

  it("returns Identity from /auth/me when token present", async () => {
    setToken("valid.token");
    const identity = { user_id: "u1", name: "Alice", email: "a@b.com", avatar: "", role: "super_admin" };
    mockUnwrap.mockResolvedValueOnce(identity);
    const result = await authProvider.getIdentity!();
    expect(result).toEqual(identity);
  });

  it("returns null if /auth/me call throws", async () => {
    setToken("valid.token");
    mockUnwrap.mockRejectedValueOnce(new Error("network error"));
    const result = await authProvider.getIdentity!();
    expect(result).toBeNull();
  });
});

// ── getPermissions ────────────────────────────────────────────────────────────

describe("authProvider.getPermissions", () => {
  it("returns null when no token (getIdentity returns null)", async () => {
    const result = await authProvider.getPermissions!();
    expect(result).toBeNull();
  });

  it("returns the role string from identity", async () => {
    setToken("valid.token");
    mockUnwrap.mockResolvedValueOnce({
      user_id: "u2", name: "Bob", email: "b@c.com", avatar: "", role: "finance",
    });
    const result = await authProvider.getPermissions!();
    expect(result).toBe("finance");
  });

  it.each([
    ["super_admin"],
    ["operator"],
    ["customer_service"],
    ["finance"],
  ] as const)("returns role %s correctly", async (role) => {
    setToken("valid.token");
    mockUnwrap.mockResolvedValueOnce({
      user_id: "u3", name: "Test", email: "t@t.com", avatar: "", role,
    });
    const result = await authProvider.getPermissions!();
    expect(result).toBe(role);
  });
});
