/**
 * Tests for useRoundEdit hook.
 *
 * Strategy:
 *   - vi.mock('@/lib/api') intercepts all network calls.
 *   - mockUnwrap controls success/failure: success returns Round-shaped data;
 *     failure rejects with ApiError (simulating what the real unwrap throws).
 *   - We inspect the arguments passed to mockApiPatch to verify
 *     path, method, JSON body shape, and X-Idempotency-Key header.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/types/api";

// ── Hoist mocks before vi.mock factories run ──────────────────────────────────
const { mockUnwrap, mockApiPatch } = vi.hoisted(() => ({
  mockUnwrap: vi.fn(),
  mockApiPatch: vi.fn(() => Promise.resolve(new Response("{}"))),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: mockApiPatch,
    put: vi.fn(),
    delete: vi.fn(),
  },
  unwrap: mockUnwrap,
}));

// Import AFTER mocking so the hook receives the mocked module.
import { useRoundEdit } from "./useRoundEdit";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ROUND_ID = "seed";
const IDEM_KEY = "test-idem-key-1234";
const NOTE = "This is a test note for audit log";

/** Minimal Round-shaped data — unwrap would return this on success. */
const ROUND_DATA = {
  id: ROUND_ID,
  status: "active",
  priceUsd: "0.05",
  supplyOdd: "1000000",
  soldOdd: "200000",
  raisedUsd: "10000",
  startTs: 1700000000000,
  endTs: 1700100000000,
  minPerOrderUsd: "10",
  maxPerWalletUsd: "5000",
  tgeReleasePct: "20",
  linearReleaseDays: 180,
  referralRewardPct: "10",
  manualOverride: false,
  createdAt: 1699000000000,
  updatedAt: 1700000000000,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type KyCallArgs = [string, { json?: unknown; headers?: Record<string, string> }];

function lastPatchOptions(): { json?: unknown; headers?: Record<string, string> } {
  const calls = mockApiPatch.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.patch was not called");
  return calls[calls.length - 1][1];
}

function lastPatchUrl(): string {
  const calls = mockApiPatch.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.patch was not called");
  return calls[calls.length - 1][0];
}

function mockSuccess() {
  mockUnwrap.mockResolvedValueOnce(ROUND_DATA);
}

function mockApiErrorOnce(code: string, message = "error", status = 400) {
  mockUnwrap.mockRejectedValueOnce(new ApiError(code, status, message));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── hook construction ─────────────────────────────────────────────────────────

describe("useRoundEdit — hook construction", () => {
  it("returns an object with updateRound function", () => {
    const api = useRoundEdit(ROUND_ID);
    expect(typeof api.updateRound).toBe("function");
  });

  it("does not call api.patch before updateRound is invoked", () => {
    useRoundEdit(ROUND_ID); // construct only
    expect(mockApiPatch).not.toHaveBeenCalled();
  });
});

// ── method is PATCH not POST ──────────────────────────────────────────────────

describe("useRoundEdit — uses PATCH method", () => {
  it("calls api.patch (not api.post or api.put) exactly once", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" });
    expect(mockApiPatch).toHaveBeenCalledTimes(1);
  });
});

// ── URL construction ──────────────────────────────────────────────────────────

describe("useRoundEdit — URL construction", () => {
  it("calls correct path for simple roundId (seed)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit("seed");
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" });
    expect(lastPatchUrl()).toBe("admin/presale/rounds/seed");
  });

  it("calls correct path for underscore roundId (public_a)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit("public_a");
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, supplyOdd: "1000000" });
    // encodeURIComponent("public_a") === "public_a" (underscore is not encoded)
    expect(lastPatchUrl()).toBe("admin/presale/rounds/public_a");
  });

  it("URL-encodes roundId with special characters (slash + space)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit("round/with spaces");
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.01" });
    // encodeURIComponent("round/with spaces") === "round%2Fwith%20spaces"
    expect(lastPatchUrl()).toBe("admin/presale/rounds/round%2Fwith%20spaces");
  });
});

// ── single-field patch ────────────────────────────────────────────────────────

describe("useRoundEdit — single-field patch", () => {
  it("sends only priceUsd + note when only priceUsd provided", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({ note: NOTE, priceUsd: "0.05" });
    expect(Object.keys(body)).toHaveLength(2);
  });

  it("sends only supplyOdd + note when only supplyOdd provided", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, supplyOdd: "2000000" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({ note: NOTE, supplyOdd: "2000000" });
  });

  it("sends only endTs + note when only endTs provided", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, endTs: 1700200000000 });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({ note: NOTE, endTs: 1700200000000 });
  });

  it("sends only minPerOrderUsd + note", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, minPerOrderUsd: "50.00" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({ note: NOTE, minPerOrderUsd: "50.00" });
  });

  it("sends only maxPerWalletUsd + note", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, maxPerWalletUsd: "10000.00" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({ note: NOTE, maxPerWalletUsd: "10000.00" });
  });

  it("sends only tgeReleasePct + note", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, tgeReleasePct: "25.00" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({ note: NOTE, tgeReleasePct: "25.00" });
  });

  it("sends only linearReleaseDays + note (as number, not string)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, linearReleaseDays: 365 });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({ note: NOTE, linearReleaseDays: 365 });
    expect(typeof body.linearReleaseDays).toBe("number");
  });
});

// ── multi-field patch ─────────────────────────────────────────────────────────

describe("useRoundEdit — multi-field patch", () => {
  it("sends all provided fields together", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({
      note: NOTE,
      idempotencyKey: IDEM_KEY,
      priceUsd: "0.08",
      supplyOdd: "500000",
      endTs: 1700300000000,
    });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({
      note: NOTE,
      priceUsd: "0.08",
      supplyOdd: "500000",
      endTs: 1700300000000,
    });
  });

  it("sends all 7 payload fields simultaneously", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({
      note: NOTE,
      idempotencyKey: IDEM_KEY,
      priceUsd: "0.10",
      supplyOdd: "3000000",
      endTs: 1700400000000,
      minPerOrderUsd: "100.00",
      maxPerWalletUsd: "20000.00",
      tgeReleasePct: "30.00",
      linearReleaseDays: 180,
    });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body).toEqual({
      note: NOTE,
      priceUsd: "0.10",
      supplyOdd: "3000000",
      endTs: 1700400000000,
      minPerOrderUsd: "100.00",
      maxPerWalletUsd: "20000.00",
      tgeReleasePct: "30.00",
      linearReleaseDays: 180,
    });
  });

  it("does NOT include fields that are not provided (no spurious undefined keys)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05", supplyOdd: "1000000" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect("endTs" in body).toBe(false);
    expect("minPerOrderUsd" in body).toBe(false);
    expect("maxPerWalletUsd" in body).toBe(false);
    expect("tgeReleasePct" in body).toBe(false);
    expect("linearReleaseDays" in body).toBe(false);
  });
});

// ── X-Idempotency-Key header ──────────────────────────────────────────────────

describe("useRoundEdit — X-Idempotency-Key header", () => {
  it("sets X-Idempotency-Key header from args", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("uses the idempotencyKey passed by the caller (not a generated value)", async () => {
    const customKey = "custom-key-abcdef-789";
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: customKey, supplyOdd: "500000" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(customKey);
  });

  it("each call uses the idempotencyKey passed by the caller independently", async () => {
    const key1 = "key-aaa-111";
    const key2 = "key-bbb-222";
    mockSuccess();
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: key1, priceUsd: "0.05" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(key1);
    await updateRound({ note: NOTE, idempotencyKey: key2, priceUsd: "0.06" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(key2);
  });
});

// ── string type preservation (decimal precision) ──────────────────────────────

describe("useRoundEdit — decimal string type preservation", () => {
  it("priceUsd is sent as string, not coerced to number", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(typeof body.priceUsd).toBe("string");
    expect(body.priceUsd).toBe("0.05");
    // Must never be coerced to number 0.05
    expect(body.priceUsd).not.toBe(0.05);
  });

  it("supplyOdd integer string stays as string (not number)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, supplyOdd: "1000000" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(typeof body.supplyOdd).toBe("string");
    expect(body.supplyOdd).toBe("1000000");
    expect(body.supplyOdd).not.toBe(1000000);
  });

  it("tgeReleasePct preserves decimal precision as string", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, tgeReleasePct: "12.50" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(typeof body.tgeReleasePct).toBe("string");
    expect(body.tgeReleasePct).toBe("12.50");
  });

  it("linearReleaseDays is sent as number (integer days)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, linearReleaseDays: 90 });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(typeof body.linearReleaseDays).toBe("number");
    expect(body.linearReleaseDays).toBe(90);
  });

  it("endTs is sent as number (epoch ms)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, endTs: 1700200000000 });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(typeof body.endTs).toBe("number");
    expect(body.endTs).toBe(1700200000000);
  });
});

// ── success path ──────────────────────────────────────────────────────────────

describe("useRoundEdit — success path", () => {
  it("resolves (returns void) on success", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await expect(
      updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" }),
    ).resolves.toBeUndefined();
  });

  it("calls unwrap exactly once per call", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit(ROUND_ID);
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" });
    expect(mockUnwrap).toHaveBeenCalledTimes(1);
  });
});

// ── error propagation ─────────────────────────────────────────────────────────

describe("useRoundEdit — error propagation", () => {
  it("propagates ApiError on INVALID_PARAM without swallowing", async () => {
    mockApiErrorOnce("INVALID_PARAM", "invalid priceUsd", 400);
    const { updateRound } = useRoundEdit(ROUND_ID);
    await expect(
      updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "not-a-decimal" }),
    ).rejects.toMatchObject({ errorCode: "INVALID_PARAM" });
  });

  it("propagates ApiError on ROUND_NOT_FOUND", async () => {
    mockApiErrorOnce("ROUND_NOT_FOUND", "round not found", 404);
    const { updateRound } = useRoundEdit(ROUND_ID);
    await expect(
      updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" }),
    ).rejects.toMatchObject({ errorCode: "ROUND_NOT_FOUND" });
  });

  it("propagates ApiError on INVALID_STATE_TRANSITION", async () => {
    mockApiErrorOnce("INVALID_STATE_TRANSITION", "state transition not allowed", 409);
    const { updateRound } = useRoundEdit(ROUND_ID);
    await expect(
      updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" }),
    ).rejects.toMatchObject({
      errorCode: "INVALID_STATE_TRANSITION",
      statusCode: 409,
    });
  });

  it("propagates ApiError on INSUFFICIENT_ROLE (403)", async () => {
    mockApiErrorOnce("INSUFFICIENT_ROLE", "forbidden", 403);
    const { updateRound } = useRoundEdit(ROUND_ID);
    await expect(
      updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, supplyOdd: "1000000" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("propagates ApiError on IDEMPOTENCY_BODY_MISMATCH (409)", async () => {
    mockApiErrorOnce("IDEMPOTENCY_BODY_MISMATCH", "body mismatch", 409);
    const { updateRound } = useRoundEdit(ROUND_ID);
    await expect(
      updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" }),
    ).rejects.toMatchObject({ errorCode: "IDEMPOTENCY_BODY_MISMATCH" });
  });

  it("does NOT swallow errors — they reach the caller", async () => {
    mockApiErrorOnce("INTERNAL_ERROR", "server error", 500);
    const { updateRound } = useRoundEdit(ROUND_ID);
    let caught: unknown = null;
    try {
      await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.05" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
  });
});

// ── roundId URL encoding ──────────────────────────────────────────────────────

describe("useRoundEdit — roundId URL encoding", () => {
  it("does not double-encode simple ids (seed → seed)", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit("seed");
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.01" });
    expect(lastPatchUrl()).toBe("admin/presale/rounds/seed");
  });

  it("encodes slash in roundId", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit("round/id");
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, priceUsd: "0.01" });
    expect(lastPatchUrl()).toBe("admin/presale/rounds/round%2Fid");
  });

  it("encodes space in roundId", async () => {
    mockSuccess();
    const { updateRound } = useRoundEdit("my round");
    await updateRound({ note: NOTE, idempotencyKey: IDEM_KEY, endTs: 1700200000000 });
    expect(lastPatchUrl()).toBe("admin/presale/rounds/my%20round");
  });
});
