/**
 * Tests for useAnomalyActions hook.
 *
 * Strategy:
 *   - vi.mock('@/lib/api') intercepts all network calls.
 *   - mockUnwrap controls success/failure: success returns AnomalyEvent-shaped data;
 *     failure rejects with ApiError (simulating what the real unwrap throws).
 *   - We inspect the arguments passed to mockApiPost to verify
 *     path, JSON body shape, and X-Idempotency-Key header.
 *
 * Backend JSON tags verified against:
 *   - internal/handler/presale_anomaly.go resolveReq: resolution / targetRoundId / note
 *   - web-api internal/service/presale_admin_anomaly.go Resolution enum:
 *       convert_to_deposit / partial_credit / reject
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/types/api";

// ── Hoist mocks before vi.mock factories run ──────────────────────────────────
const { mockUnwrap, mockApiPost } = vi.hoisted(() => ({
  mockUnwrap: vi.fn(),
  mockApiPost: vi.fn(() => Promise.resolve(new Response("{}"))),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: mockApiPost,
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  unwrap: mockUnwrap,
}));

// Import AFTER mocking so the hook receives the mocked module.
import { useAnomalyActions } from "./useAnomalyActions";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ANOMALY_ID_NUM = 42;
const ANOMALY_ID_STR = "99";
const IDEM_KEY = "test-idem-key-anomaly-abcd";
const NOTE = "This is a test audit note of sufficient length";

/** Minimal AnomalyEvent-shaped data — unwrap would return this on success. */
const ANOMALY_DATA = {
  id: ANOMALY_ID_NUM,
  eventType: "unclaimed_deposit",
  txHash: "0xabc",
  eoaAddress: "0xdef",
  amountUsdt: "100.00",
  status: "resolved",
  resolution: "convert_to_deposit",
  note: NOTE,
  operatorId: "op-1",
  createdAt: 1700000000000,
  updatedAt: 1700100000000,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wire unwrap to resolve with data (simulates code===0 success path). */
function mockSuccess() {
  mockUnwrap.mockResolvedValueOnce(ANOMALY_DATA);
}

/** Wire unwrap to reject with ApiError (simulates code!==0 error path). */
function mockApiErrorOnce(code: string, message = "error", status = 400) {
  mockUnwrap.mockRejectedValueOnce(new ApiError(code, status, message));
}

type KyCallArgs = [string, { json?: unknown; headers?: Record<string, string> }];

function lastPostUrl(): string {
  const calls = mockApiPost.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.post was not called");
  return calls[calls.length - 1][0];
}

function lastPostOptions(): { json?: unknown; headers?: Record<string, string> } {
  const calls = mockApiPost.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.post was not called");
  return calls[calls.length - 1][1];
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── hook construction ─────────────────────────────────────────────────────────

describe("useAnomalyActions — hook construction", () => {
  it("returns an object with a resolve function", () => {
    const actions = useAnomalyActions(ANOMALY_ID_NUM);
    expect(typeof actions.resolve).toBe("function");
  });

  it("does not call api.post on construction", () => {
    useAnomalyActions(ANOMALY_ID_NUM);
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ── resolve — path ────────────────────────────────────────────────────────────

describe("useAnomalyActions — resolve path", () => {
  it("calls api.post (not patch/put/delete)", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it("uses correct path for numeric anomalyId", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    expect(lastPostUrl()).toBe(`admin/presale/anomaly/${ANOMALY_ID_NUM}/resolve`);
  });

  it("uses correct path for string anomalyId", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_STR);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    expect(lastPostUrl()).toBe(`admin/presale/anomaly/${ANOMALY_ID_STR}/resolve`);
  });
});

// ── resolve — body ────────────────────────────────────────────────────────────

describe("useAnomalyActions — resolve body shape", () => {
  it("sends resolution and note in JSON body for 'reject'", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    expect(lastPostOptions().json).toEqual({ resolution: "reject", note: NOTE });
  });

  it("sends resolution and note in JSON body for 'partial_credit'", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "partial_credit" });
    expect(lastPostOptions().json).toEqual({ resolution: "partial_credit", note: NOTE });
  });

  it("sends resolution, note, and targetRoundId for 'convert_to_deposit'", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({
      note: NOTE,
      idempotencyKey: IDEM_KEY,
      resolution: "convert_to_deposit",
      targetRoundId: "seed",
    });
    expect(lastPostOptions().json).toEqual({
      resolution: "convert_to_deposit",
      note: NOTE,
      targetRoundId: "seed",
    });
  });

  it("omits targetRoundId from body when not provided (reject)", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain("targetRoundId");
  });

  it("omits targetRoundId from body when not provided (partial_credit)", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "partial_credit" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain("targetRoundId");
  });

  it("includes targetRoundId when resolution is 'convert_to_deposit' with public_a round", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({
      note: NOTE,
      idempotencyKey: IDEM_KEY,
      resolution: "convert_to_deposit",
      targetRoundId: "public_a",
    });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(body.targetRoundId).toBe("public_a");
  });
});

// ── resolve — header ──────────────────────────────────────────────────────────

describe("useAnomalyActions — X-Idempotency-Key header", () => {
  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("passes caller-supplied idempotency key through unchanged", async () => {
    const customKey = "custom-uuid-key-xyz-789";
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: customKey, resolution: "partial_credit" });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(customKey);
  });
});

// ── resolve — success ─────────────────────────────────────────────────────────

describe("useAnomalyActions — resolve success", () => {
  it("resolves void on success (does not return the AnomalyEvent)", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await expect(
      resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" }),
    ).resolves.toBeUndefined();
  });

  it("calls unwrap exactly once per resolve call", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    expect(mockUnwrap).toHaveBeenCalledTimes(1);
  });
});

// ── resolve — error propagation ───────────────────────────────────────────────

describe("useAnomalyActions — error propagation", () => {
  it("propagates INVALID_RESOLUTION (400) ApiError", async () => {
    mockApiErrorOnce("INVALID_RESOLUTION", "invalid resolution type", 400);
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await expect(
      resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" }),
    ).rejects.toMatchObject({ errorCode: "INVALID_RESOLUTION", statusCode: 400 });
  });

  it("propagates ANOMALY_NOT_FOUND (404) ApiError", async () => {
    mockApiErrorOnce("ANOMALY_NOT_FOUND", "anomaly event not found", 404);
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await expect(
      resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" }),
    ).rejects.toMatchObject({ errorCode: "ANOMALY_NOT_FOUND", statusCode: 404 });
  });

  it("propagates TARGET_ROUND_NOT_FOUND (404) ApiError", async () => {
    mockApiErrorOnce("TARGET_ROUND_NOT_FOUND", "target round not found", 404);
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await expect(
      resolve({
        note: NOTE,
        idempotencyKey: IDEM_KEY,
        resolution: "convert_to_deposit",
        targetRoundId: "nonexistent-round",
      }),
    ).rejects.toMatchObject({ errorCode: "TARGET_ROUND_NOT_FOUND", statusCode: 404 });
  });

  it("propagates INVALID_STATE_TRANSITION (409) ApiError", async () => {
    mockApiErrorOnce("INVALID_STATE_TRANSITION", "already resolved", 409);
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await expect(
      resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" }),
    ).rejects.toMatchObject({ errorCode: "INVALID_STATE_TRANSITION" });
  });

  it("does not swallow errors — rejects the promise", async () => {
    mockApiErrorOnce("INTERNAL_ERROR", "server error", 500);
    const { resolve } = useAnomalyActions(ANOMALY_ID_NUM);
    await expect(
      resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

// ── anomalyId type compatibility ──────────────────────────────────────────────

describe("useAnomalyActions — anomalyId number/string compatibility", () => {
  it("accepts number anomalyId and builds correct URL", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions(123);
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    expect(lastPostUrl()).toBe("admin/presale/anomaly/123/resolve");
  });

  it("accepts string anomalyId and builds correct URL", async () => {
    mockSuccess();
    const { resolve } = useAnomalyActions("456");
    await resolve({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    expect(lastPostUrl()).toBe("admin/presale/anomaly/456/resolve");
  });

  it("number and string anomalyId produce the same URL", async () => {
    mockSuccess();
    const { resolve: resolveNum } = useAnomalyActions(789);
    await resolveNum({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    const urlNum = lastPostUrl();

    mockSuccess();
    const { resolve: resolveStr } = useAnomalyActions("789");
    await resolveStr({ note: NOTE, idempotencyKey: IDEM_KEY, resolution: "reject" });
    const urlStr = lastPostUrl();

    expect(urlNum).toBe(urlStr);
  });
});
