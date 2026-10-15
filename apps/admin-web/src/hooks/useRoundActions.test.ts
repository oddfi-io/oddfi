/**
 * Tests for useRoundActions hook.
 *
 * Strategy:
 *   - vi.mock('@/lib/api') intercepts all network calls.
 *   - mockUnwrap controls success/failure: success returns Round-shaped data;
 *     failure rejects with ApiError (simulating what the real unwrap throws).
 *   - We inspect the arguments passed to mockApiPost / mockApiPatch to verify
 *     path, method, JSON body shape, and X-Idempotency-Key header.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/types/api";

// ── Hoist mocks before vi.mock factories run ──────────────────────────────────
const { mockUnwrap, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockUnwrap: vi.fn(),
  mockApiPost: vi.fn(() => Promise.resolve(new Response("{}"))),
  mockApiPatch: vi.fn(() => Promise.resolve(new Response("{}"))),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: mockApiPost,
    patch: mockApiPatch,
    put: vi.fn(),
    delete: vi.fn(),
  },
  unwrap: mockUnwrap,
}));

// Import AFTER mocking so the hook receives the mocked module.
import { useRoundActions } from "./useRoundActions";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ROUND_ID = "seed";
const IDEM_KEY = "test-idem-key-1234";
const NOTE = "This is a test note for audit log";

/** Minimal Round-shaped data — unwrap would return this on success. */
const ROUND_DATA = {
  id: ROUND_ID,
  status: "paused",
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

/** Wire unwrap to resolve with data (simulates code===0 success path). */
function mockSuccess() {
  mockUnwrap.mockResolvedValueOnce(ROUND_DATA);
}

/** Wire unwrap to reject with ApiError (simulates code!==0 error path). */
function mockApiErrorOnce(code: string, message = "error", status = 409) {
  mockUnwrap.mockRejectedValueOnce(new ApiError(code, status, message));
}

/**
 * Extract the ky options object from the most recent api.post or api.patch call.
 * Returns { json, headers } as passed by the hook.
 */
type KyCallArgs = [string, { json?: unknown; headers?: Record<string, string> }];

function lastPostOptions(): { json?: unknown; headers?: Record<string, string> } {
  const calls = mockApiPost.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.post was not called");
  return calls[calls.length - 1][1];
}

function lastPatchOptions(): { json?: unknown; headers?: Record<string, string> } {
  const calls = mockApiPatch.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.patch was not called");
  return calls[calls.length - 1][1];
}

/** Get the URL string from the most recent api.post call. */
function lastPostUrl(): string {
  const calls = mockApiPost.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.post was not called");
  return calls[calls.length - 1][0];
}

/** Get the URL string from the most recent api.patch call. */
function lastPatchUrl(): string {
  const calls = mockApiPatch.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.patch was not called");
  return calls[calls.length - 1][0];
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── useRoundActions — hook construction ───────────────────────────────────────

describe("useRoundActions — hook construction", () => {
  it("returns an object with all five action functions", () => {
    const actions = useRoundActions(ROUND_ID);
    expect(typeof actions.pause).toBe("function");
    expect(typeof actions.resume).toBe("function");
    expect(typeof actions.reopen).toBe("function");
    expect(typeof actions.close).toBe("function");
    expect(typeof actions.updateReferralPct).toBe("function");
  });
});

// ── pause ─────────────────────────────────────────────────────────────────────

describe("useRoundActions — pause", () => {
  it("calls api.post with correct path", async () => {
    mockSuccess();
    const { pause } = useRoundActions(ROUND_ID);
    await pause({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostUrl()).toBe(`admin/presale/rounds/${ROUND_ID}/pause`);
  });

  it("sends note in JSON body", async () => {
    mockSuccess();
    const { pause } = useRoundActions(ROUND_ID);
    await pause({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostOptions().json).toEqual({ note: NOTE });
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { pause } = useRoundActions(ROUND_ID);
    await pause({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves (returns void) on success", async () => {
    mockSuccess();
    const { pause } = useRoundActions(ROUND_ID);
    await expect(pause({ note: NOTE, idempotencyKey: IDEM_KEY })).resolves.toBeUndefined();
  });

  it("propagates ApiError on failure without swallowing it", async () => {
    mockApiErrorOnce("INVALID_STATE_TRANSITION");
    const { pause } = useRoundActions(ROUND_ID);
    await expect(pause({ note: NOTE, idempotencyKey: IDEM_KEY })).rejects.toMatchObject({
      errorCode: "INVALID_STATE_TRANSITION",
    });
  });

  it("calls unwrap exactly once", async () => {
    mockSuccess();
    const { pause } = useRoundActions(ROUND_ID);
    await pause({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(mockUnwrap).toHaveBeenCalledTimes(1);
  });
});

// ── resume ────────────────────────────────────────────────────────────────────

describe("useRoundActions — resume", () => {
  it("calls api.post with correct path", async () => {
    mockSuccess();
    const { resume } = useRoundActions(ROUND_ID);
    await resume({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostUrl()).toBe(`admin/presale/rounds/${ROUND_ID}/resume`);
  });

  it("sends note in JSON body", async () => {
    mockSuccess();
    const { resume } = useRoundActions(ROUND_ID);
    await resume({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostOptions().json).toEqual({ note: NOTE });
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { resume } = useRoundActions(ROUND_ID);
    await resume({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves on success", async () => {
    mockSuccess();
    const { resume } = useRoundActions(ROUND_ID);
    await expect(resume({ note: NOTE, idempotencyKey: IDEM_KEY })).resolves.toBeUndefined();
  });

  it("propagates ApiError on failure", async () => {
    mockApiErrorOnce("INVALID_STATE_TRANSITION");
    const { resume } = useRoundActions(ROUND_ID);
    await expect(resume({ note: NOTE, idempotencyKey: IDEM_KEY })).rejects.toBeInstanceOf(ApiError);
  });
});

// ── reopen ────────────────────────────────────────────────────────────────────

describe("useRoundActions — reopen", () => {
  it("calls api.post with correct path", async () => {
    mockSuccess();
    const { reopen } = useRoundActions(ROUND_ID);
    await reopen({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostUrl()).toBe(`admin/presale/rounds/${ROUND_ID}/reopen`);
  });

  it("sends note in JSON body", async () => {
    mockSuccess();
    const { reopen } = useRoundActions(ROUND_ID);
    await reopen({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostOptions().json).toEqual({ note: NOTE });
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { reopen } = useRoundActions(ROUND_ID);
    await reopen({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves on success", async () => {
    mockSuccess();
    const { reopen } = useRoundActions(ROUND_ID);
    await expect(reopen({ note: NOTE, idempotencyKey: IDEM_KEY })).resolves.toBeUndefined();
  });

  it("propagates ApiError on failure", async () => {
    mockApiErrorOnce("INSUFFICIENT_ROLE", "forbidden", 403);
    const { reopen } = useRoundActions(ROUND_ID);
    await expect(reopen({ note: NOTE, idempotencyKey: IDEM_KEY })).rejects.toMatchObject({
      errorCode: "INSUFFICIENT_ROLE",
      statusCode: 403,
    });
  });
});

// ── close ─────────────────────────────────────────────────────────────────────

describe("useRoundActions — close", () => {
  it("calls api.post with correct path", async () => {
    mockSuccess();
    const { close } = useRoundActions(ROUND_ID);
    await close({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostUrl()).toBe(`admin/presale/rounds/${ROUND_ID}/close`);
  });

  it("sends note in JSON body", async () => {
    mockSuccess();
    const { close } = useRoundActions(ROUND_ID);
    await close({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostOptions().json).toEqual({ note: NOTE });
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { close } = useRoundActions(ROUND_ID);
    await close({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves on success", async () => {
    mockSuccess();
    const { close } = useRoundActions(ROUND_ID);
    await expect(close({ note: NOTE, idempotencyKey: IDEM_KEY })).resolves.toBeUndefined();
  });

  it("propagates ApiError on failure", async () => {
    mockApiErrorOnce("INVALID_STATE_TRANSITION");
    const { close } = useRoundActions(ROUND_ID);
    await expect(close({ note: NOTE, idempotencyKey: IDEM_KEY })).rejects.toBeInstanceOf(ApiError);
  });
});

// ── updateReferralPct ─────────────────────────────────────────────────────────

describe("useRoundActions — updateReferralPct", () => {
  it("calls api.patch (not api.post) with correct path", async () => {
    mockSuccess();
    const { updateReferralPct } = useRoundActions(ROUND_ID);
    await updateReferralPct({ note: NOTE, idempotencyKey: IDEM_KEY, referralRewardPct: "10" });
    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(lastPatchUrl()).toBe(`admin/presale/rounds/${ROUND_ID}/referral-pct`);
  });

  it("sends referralRewardPct as string in JSON body", async () => {
    mockSuccess();
    const { updateReferralPct } = useRoundActions(ROUND_ID);
    await updateReferralPct({ note: NOTE, idempotencyKey: IDEM_KEY, referralRewardPct: "12.5" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.referralRewardPct).toBe("12.5");
    // Must be string, never number — decimal precision requirement
    expect(typeof body.referralRewardPct).toBe("string");
  });

  it("sends note in JSON body alongside referralRewardPct", async () => {
    mockSuccess();
    const { updateReferralPct } = useRoundActions(ROUND_ID);
    await updateReferralPct({ note: NOTE, idempotencyKey: IDEM_KEY, referralRewardPct: "5" });
    expect(lastPatchOptions().json).toEqual({ referralRewardPct: "5", note: NOTE });
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { updateReferralPct } = useRoundActions(ROUND_ID);
    await updateReferralPct({ note: NOTE, idempotencyKey: IDEM_KEY, referralRewardPct: "10" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves on success", async () => {
    mockSuccess();
    const { updateReferralPct } = useRoundActions(ROUND_ID);
    await expect(
      updateReferralPct({ note: NOTE, idempotencyKey: IDEM_KEY, referralRewardPct: "10" }),
    ).resolves.toBeUndefined();
  });

  it("propagates ApiError on failure without swallowing", async () => {
    mockApiErrorOnce("INVALID_PARAM", "bad decimal", 400);
    const { updateReferralPct } = useRoundActions(ROUND_ID);
    await expect(
      updateReferralPct({ note: NOTE, idempotencyKey: IDEM_KEY, referralRewardPct: "not-a-number" }),
    ).rejects.toMatchObject({ errorCode: "INVALID_PARAM" });
  });

  it("referralRewardPct is not coerced to number — integer string stays string", async () => {
    mockSuccess();
    const { updateReferralPct } = useRoundActions(ROUND_ID);
    await updateReferralPct({ note: NOTE, idempotencyKey: IDEM_KEY, referralRewardPct: "10" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    // Strict type check: "10" must not become the number 10
    expect(body.referralRewardPct).not.toBe(10);
    expect(body.referralRewardPct).toBe("10");
  });
});

// ── roundId URL encoding ──────────────────────────────────────────────────────

describe("useRoundActions — roundId URL encoding", () => {
  it("uses plain roundId without encoding for simple IDs (seed)", async () => {
    mockSuccess();
    const { pause } = useRoundActions("seed");
    await pause({ note: NOTE, idempotencyKey: IDEM_KEY });
    expect(lastPostUrl()).toBe("admin/presale/rounds/seed/pause");
  });

  it("URL-encodes roundId with underscore (public_a)", async () => {
    mockSuccess();
    const { close } = useRoundActions("public_a");
    await close({ note: NOTE, idempotencyKey: IDEM_KEY });
    // encodeURIComponent("public_a") === "public_a" (underscore is not encoded)
    expect(lastPostUrl()).toBe("admin/presale/rounds/public_a/close");
  });

  it("URL-encodes roundId with special characters", async () => {
    mockSuccess();
    const { resume } = useRoundActions("round/with spaces");
    await resume({ note: NOTE, idempotencyKey: IDEM_KEY });
    // encodeURIComponent("round/with spaces") === "round%2Fwith%20spaces"
    expect(lastPostUrl()).toBe("admin/presale/rounds/round%2Fwith%20spaces/resume");
  });

  it("updateReferralPct uses URL-encoded roundId", async () => {
    mockSuccess();
    const { updateReferralPct } = useRoundActions("public_b");
    await updateReferralPct({ note: NOTE, idempotencyKey: IDEM_KEY, referralRewardPct: "8" });
    expect(lastPatchUrl()).toBe("admin/presale/rounds/public_b/referral-pct");
  });
});

// ── idempotency key isolation ─────────────────────────────────────────────────

describe("useRoundActions — idempotency key isolation", () => {
  it("each action call uses the idempotencyKey passed by the caller", async () => {
    const key1 = "key-aaa-111";
    const key2 = "key-bbb-222";

    mockSuccess();
    mockSuccess();

    const { pause } = useRoundActions(ROUND_ID);

    await pause({ note: NOTE, idempotencyKey: key1 });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(key1);

    await pause({ note: NOTE, idempotencyKey: key2 });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(key2);
  });

  it("does not call api.post before an action is invoked", () => {
    useRoundActions(ROUND_ID); // construct only
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockApiPatch).not.toHaveBeenCalled();
  });
});

// ── different actions do not bleed into each other ───────────────────────────

describe("useRoundActions — action path isolation", () => {
  it("pause and resume use different paths", async () => {
    mockSuccess();
    mockSuccess();

    const allCalls = mockApiPost.mock.calls as unknown as KyCallArgs[];
    const actions = useRoundActions(ROUND_ID);
    await actions.pause({ note: NOTE, idempotencyKey: IDEM_KEY });
    const pausePath = allCalls[0][0];

    await actions.resume({ note: NOTE, idempotencyKey: IDEM_KEY });
    const resumePath = allCalls[1][0];

    expect(pausePath).toContain("/pause");
    expect(resumePath).toContain("/resume");
    expect(pausePath).not.toBe(resumePath);
  });
});
