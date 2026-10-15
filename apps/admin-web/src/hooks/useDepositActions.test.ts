/**
 * Tests for useDepositActions hook.
 *
 * Strategy:
 *   - vi.mock('@/lib/api') intercepts all network calls.
 *   - mockUnwrap controls success/failure: success returns MigrateResult-shaped data;
 *     failure rejects with ApiError (simulating what the real unwrap throws).
 *   - We inspect the arguments passed to mockApiPost to verify path, method,
 *     JSON body shape, and X-Idempotency-Key header.
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
import { useDepositActions } from "./useDepositActions";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TX_HASH = "0xabc123def456abc123def456abc123def456abc123def456abc123def456abcd";
const IDEM_KEY = "test-idem-key-deposit-1234";
const NOTE = "This is a test audit note for migrate round";
const TARGET_ROUND_ID = "public_a";

/** Minimal MigrateResult-shaped data — unwrap would return this on success. */
const MIGRATE_RESULT = {
  txHash: TX_HASH,
  oldRoundId: "seed",
  newRoundId: TARGET_ROUND_ID,
  oldSharesOdd: "1000",
  newSharesOdd: "950",
  deposit: {
    txHash: TX_HASH,
    roundId: TARGET_ROUND_ID,
    eoaAddress: "0xdeadbeef",
    vaultAddress: "0xcafebabe",
    amountUsdt: "100",
    sharesOdd: "950",
    status: "confirmed" as const,
    blockTs: 1700000000000,
    createdAt: 1699000000000,
    updatedAt: 1700000000000,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wire unwrap to resolve with data (simulates code===0 success path). */
function mockSuccess() {
  mockUnwrap.mockResolvedValueOnce(MIGRATE_RESULT);
}

/** Wire unwrap to reject with ApiError (simulates code!==0 error path). */
function mockApiErrorOnce(code: string, message = "error", status = 422) {
  mockUnwrap.mockRejectedValueOnce(new ApiError(code, status, message));
}

type KyCallArgs = [string, { json?: unknown; headers?: Record<string, string> }];

function lastPostOptions(): { json?: unknown; headers?: Record<string, string> } {
  const calls = mockApiPost.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.post was not called");
  return calls[calls.length - 1][1];
}

function lastPostUrl(): string {
  const calls = mockApiPost.mock.calls as unknown as KyCallArgs[];
  if (calls.length === 0) throw new Error("api.post was not called");
  return calls[calls.length - 1][0];
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── useDepositActions — hook construction ─────────────────────────────────────

describe("useDepositActions — hook construction", () => {
  it("returns an object with migrateRound function", () => {
    const actions = useDepositActions(TX_HASH);
    expect(typeof actions.migrateRound).toBe("function");
  });

  it("does not call api.post before an action is invoked", () => {
    useDepositActions(TX_HASH); // construct only
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ── migrateRound — happy path ─────────────────────────────────────────────────

describe("useDepositActions — migrateRound happy path", () => {
  it("calls api.post with correct path including txHash", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    expect(lastPostUrl()).toBe(
      `admin/presale/deposits/${encodeURIComponent(TX_HASH)}/migrate-round`,
    );
  });

  it("uses POST method (not PATCH or PUT)", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it("sends targetRoundId in JSON body (matching backend JSON tag 'targetRoundId')", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(body.targetRoundId).toBe(TARGET_ROUND_ID);
  });

  it("sends note in JSON body alongside targetRoundId", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    expect(lastPostOptions().json).toEqual({ targetRoundId: TARGET_ROUND_ID, note: NOTE });
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves (returns void) on success", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    await expect(
      migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID }),
    ).resolves.toBeUndefined();
  });

  it("calls unwrap exactly once per invocation", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    expect(mockUnwrap).toHaveBeenCalledTimes(1);
  });

  it("each call uses the idempotencyKey passed by the caller", async () => {
    const key1 = "key-deposit-aaa-111";
    const key2 = "key-deposit-bbb-222";
    mockSuccess();
    mockSuccess();

    const { migrateRound } = useDepositActions(TX_HASH);
    await migrateRound({ note: NOTE, idempotencyKey: key1, targetRoundId: TARGET_ROUND_ID });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(key1);

    await migrateRound({ note: NOTE, idempotencyKey: key2, targetRoundId: TARGET_ROUND_ID });
    expect(lastPostOptions().headers?.["X-Idempotency-Key"]).toBe(key2);
  });
});

// ── targetRoundId type safety ─────────────────────────────────────────────────

describe("useDepositActions — targetRoundId type safety", () => {
  it("targetRoundId is sent as string, not coerced to number", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: "public_a" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(typeof body.targetRoundId).toBe("string");
    expect(body.targetRoundId).toBe("public_a");
  });

  it("targetRoundId numeric-looking string stays as string (not coerced)", async () => {
    mockSuccess();
    const { migrateRound } = useDepositActions(TX_HASH);
    // Some round IDs might be numeric strings; they must never become numbers
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: "123" });
    const body = lastPostOptions().json as Record<string, unknown>;
    expect(typeof body.targetRoundId).toBe("string");
    expect(body.targetRoundId).not.toBe(123);
    expect(body.targetRoundId).toBe("123");
  });
});

// ── error propagation ─────────────────────────────────────────────────────────

describe("useDepositActions — error propagation", () => {
  it("propagates MIGRATE_LIMIT_EXCEEDED (422) without swallowing", async () => {
    mockApiErrorOnce("MIGRATE_LIMIT_EXCEEDED", "migration limit exceeded", 422);
    const { migrateRound } = useDepositActions(TX_HASH);
    await expect(
      migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID }),
    ).rejects.toMatchObject({
      errorCode: "MIGRATE_LIMIT_EXCEEDED",
      statusCode: 422,
    });
  });

  it("propagates BLOCK_TIMESTAMP_OUT_OF_RANGE (422) without swallowing", async () => {
    mockApiErrorOnce("BLOCK_TIMESTAMP_OUT_OF_RANGE", "block timestamp out of range", 422);
    const { migrateRound } = useDepositActions(TX_HASH);
    await expect(
      migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID }),
    ).rejects.toMatchObject({
      errorCode: "BLOCK_TIMESTAMP_OUT_OF_RANGE",
      statusCode: 422,
    });
  });

  it("propagates TARGET_ROUND_NOT_FOUND (404) without swallowing", async () => {
    mockApiErrorOnce("TARGET_ROUND_NOT_FOUND", "target round not found", 404);
    const { migrateRound } = useDepositActions(TX_HASH);
    await expect(
      migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: "nonexistent" }),
    ).rejects.toMatchObject({
      errorCode: "TARGET_ROUND_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("propagates generic ApiError as-is (no wrapping)", async () => {
    mockApiErrorOnce("INSUFFICIENT_ROLE", "forbidden", 403);
    const { migrateRound } = useDepositActions(TX_HASH);
    await expect(
      migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("does not swallow errors — rejects instead of resolving undefined on failure", async () => {
    mockApiErrorOnce("MIGRATE_LIMIT_EXCEEDED");
    const { migrateRound } = useDepositActions(TX_HASH);
    // Must reject, NOT resolve
    await expect(
      migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID }),
    ).rejects.toThrow();
  });
});

// ── txHash URL encoding ───────────────────────────────────────────────────────

describe("useDepositActions — txHash URL encoding", () => {
  it("uses plain hex txHash without mangling (0x prefix is ASCII-safe)", async () => {
    mockSuccess();
    const hexHash = "0xabc123def456";
    const { migrateRound } = useDepositActions(hexHash);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    // encodeURIComponent("0xabc123def456") === "0xabc123def456" (all ASCII, no change)
    expect(lastPostUrl()).toBe(
      `admin/presale/deposits/${encodeURIComponent(hexHash)}/migrate-round`,
    );
  });

  it("URL-encodes txHash with special characters (defensive case)", async () => {
    mockSuccess();
    const weirdHash = "tx/with spaces";
    const { migrateRound } = useDepositActions(weirdHash);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    // encodeURIComponent("tx/with spaces") === "tx%2Fwith%20spaces"
    expect(lastPostUrl()).toBe(
      `admin/presale/deposits/tx%2Fwith%20spaces/migrate-round`,
    );
  });

  it("URL-encodes txHash with hash character", async () => {
    mockSuccess();
    const hashWithSymbol = "0xhash#fragment";
    const { migrateRound } = useDepositActions(hashWithSymbol);
    await migrateRound({ note: NOTE, idempotencyKey: IDEM_KEY, targetRoundId: TARGET_ROUND_ID });
    expect(lastPostUrl()).toBe(
      `admin/presale/deposits/${encodeURIComponent(hashWithSymbol)}/migrate-round`,
    );
  });
});
