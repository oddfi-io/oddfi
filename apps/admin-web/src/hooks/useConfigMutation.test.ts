/**
 * Tests for useConfigMutation hook.
 *
 * Strategy:
 *   - vi.mock('@/lib/api') intercepts all network calls.
 *   - mockUnwrap controls success/failure: success returns UpdateConfigResult-shaped data;
 *     failure rejects with ApiError (simulating what the real unwrap throws).
 *   - We inspect the arguments passed to mockApiPatch to verify
 *     path, method, JSON body shape, and X-Idempotency-Key header.
 *
 * Backend JSON tags verified against internal/handler/presale_config.go updateConfigReq:
 *   larkWebhookUrl, vaultAddress, minSubscribeUsd, tgeOpenPriceUsd,
 *   tgeTs, boundaryToleranceMin, totalTargetUsd, auditLabel, note
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
import { useConfigMutation } from "./useConfigMutation";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const IDEM_KEY = "test-idem-key-config-5678";
const NOTE = "This is a test config note for audit";

/** Minimal UpdateConfigResult-shaped data — unwrap would return this on success. */
const CONFIG_RESULT = {
  config: {
    tgeTs: 1700000000000,
    tgeOpenPriceUsd: "0.10",
    vaultAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
    minSubscribeUsd: "1000",
    boundaryToleranceMin: 5,
    totalTargetUsd: "10000000",
    auditLabel: "CertiK",
    larkWebhookUrl: "https://open.larksuite.com/open-apis/bot/v2/hook/test-uuid",
    updatedAt: 1700010000000,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wire unwrap to resolve with data (simulates code===0 success path). */
function mockSuccess() {
  mockUnwrap.mockResolvedValueOnce(CONFIG_RESULT);
}

/** Wire unwrap to reject with ApiError (simulates code!==0 error path). */
function mockApiErrorOnce(code: string, message = "error", status = 400) {
  mockUnwrap.mockRejectedValueOnce(new ApiError(code, status, message));
}

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

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── hook construction ─────────────────────────────────────────────────────────

describe("useConfigMutation — hook construction", () => {
  it("returns an object with updateConfig function", () => {
    const mutation = useConfigMutation();
    expect(typeof mutation.updateConfig).toBe("function");
  });

  it("does not call api.patch on construction", () => {
    useConfigMutation();
    expect(mockApiPatch).not.toHaveBeenCalled();
  });
});

// ── updateConfig — path and method ───────────────────────────────────────────

describe("useConfigMutation — path and method", () => {
  it("calls api.patch (not any other method) with the correct path", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, larkWebhookUrl: "https://example.com" });
    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    expect(lastPatchUrl()).toBe("admin/presale/config");
  });
});

// ── updateConfig — larkWebhookUrl only ───────────────────────────────────────

describe("useConfigMutation — larkWebhookUrl patch", () => {
  it("sends larkWebhookUrl in JSON body with correct key", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    const url = "https://open.larksuite.com/open-apis/bot/v2/hook/new-uuid";
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, larkWebhookUrl: url });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.larkWebhookUrl).toBe(url);
  });

  it("includes note in body alongside larkWebhookUrl", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, larkWebhookUrl: "https://example.com" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.note).toBe(NOTE);
  });

  it("does not include vaultAddress or minSubscribeUsd when not provided", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, larkWebhookUrl: "https://example.com" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.vaultAddress).toBeUndefined();
    expect(body.minSubscribeUsd).toBeUndefined();
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, larkWebhookUrl: "https://example.com" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves (returns void) on success", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await expect(
      updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, larkWebhookUrl: "https://example.com" }),
    ).resolves.toBeUndefined();
  });
});

// ── updateConfig — vaultAddress only ─────────────────────────────────────────

describe("useConfigMutation — vaultAddress patch", () => {
  it("sends vaultAddress in JSON body with correct key", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    const addr = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, vaultAddress: addr });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.vaultAddress).toBe(addr);
  });

  it("vaultAddress is transmitted as string", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    const addr = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, vaultAddress: addr });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(typeof body.vaultAddress).toBe("string");
  });

  it("does not include larkWebhookUrl or minSubscribeUsd when not provided", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, vaultAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.larkWebhookUrl).toBeUndefined();
    expect(body.minSubscribeUsd).toBeUndefined();
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, vaultAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves on success", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await expect(
      updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, vaultAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" }),
    ).resolves.toBeUndefined();
  });
});

// ── updateConfig — minSubscribeUsd only ──────────────────────────────────────

describe("useConfigMutation — minSubscribeUsd patch", () => {
  it("sends minSubscribeUsd in JSON body with correct key", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, minSubscribeUsd: "1000" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.minSubscribeUsd).toBe("1000");
  });

  it("minSubscribeUsd is transmitted as string — never coerced to number", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, minSubscribeUsd: "500.00" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(typeof body.minSubscribeUsd).toBe("string");
    // Must not be coerced to number
    expect(body.minSubscribeUsd).not.toBe(500);
    expect(body.minSubscribeUsd).toBe("500.00");
  });

  it("does not include vaultAddress or larkWebhookUrl when not provided", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, minSubscribeUsd: "1000" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.vaultAddress).toBeUndefined();
    expect(body.larkWebhookUrl).toBeUndefined();
  });

  it("sets X-Idempotency-Key header", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, minSubscribeUsd: "1000" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(IDEM_KEY);
  });

  it("resolves on success", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await expect(
      updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, minSubscribeUsd: "1000" }),
    ).resolves.toBeUndefined();
  });
});

// ── updateConfig — multiple fields ───────────────────────────────────────────

describe("useConfigMutation — multiple fields patch", () => {
  it("sends all provided fields in body", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({
      note: NOTE,
      idempotencyKey: IDEM_KEY,
      larkWebhookUrl: "https://open.larksuite.com/open-apis/bot/v2/hook/test",
      vaultAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
      minSubscribeUsd: "2000",
    });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(body.larkWebhookUrl).toBe("https://open.larksuite.com/open-apis/bot/v2/hook/test");
    expect(body.vaultAddress).toBe("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12");
    expect(body.minSubscribeUsd).toBe("2000");
    expect(body.note).toBe(NOTE);
  });

  it("string decimal fields remain strings when multiple are sent together", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({
      note: NOTE,
      idempotencyKey: IDEM_KEY,
      minSubscribeUsd: "100",
      tgeOpenPriceUsd: "0.10",
      totalTargetUsd: "5000000",
    });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect(typeof body.minSubscribeUsd).toBe("string");
    expect(typeof body.tgeOpenPriceUsd).toBe("string");
    expect(typeof body.totalTargetUsd).toBe("string");
  });
});

// ── updateConfig — idempotency key isolation ──────────────────────────────────

describe("useConfigMutation — idempotency key isolation", () => {
  it("each call uses the idempotencyKey passed by the caller", async () => {
    const key1 = "key-config-aaa-111";
    const key2 = "key-config-bbb-222";

    mockSuccess();
    mockSuccess();

    const { updateConfig } = useConfigMutation();

    await updateConfig({ note: NOTE, idempotencyKey: key1, larkWebhookUrl: "https://a.example.com" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(key1);

    await updateConfig({ note: NOTE, idempotencyKey: key2, larkWebhookUrl: "https://b.example.com" });
    expect(lastPatchOptions().headers?.["X-Idempotency-Key"]).toBe(key2);
  });
});

// ── updateConfig — error propagation ─────────────────────────────────────────

describe("useConfigMutation — error propagation", () => {
  it("propagates INVALID_PARAM ApiError without swallowing", async () => {
    mockApiErrorOnce("INVALID_PARAM", "bad decimal format", 400);
    const { updateConfig } = useConfigMutation();
    await expect(
      updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, minSubscribeUsd: "not-a-number" }),
    ).rejects.toMatchObject({ errorCode: "INVALID_PARAM" });
  });

  it("propagates INSUFFICIENT_ROLE ApiError", async () => {
    mockApiErrorOnce("INSUFFICIENT_ROLE", "forbidden", 403);
    const { updateConfig } = useConfigMutation();
    await expect(
      updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, vaultAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" }),
    ).rejects.toMatchObject({ errorCode: "INSUFFICIENT_ROLE", statusCode: 403 });
  });

  it("propagates ApiError as-is (does not wrap or modify it)", async () => {
    mockApiErrorOnce("INVALID_PARAM", "vault address format invalid", 400);
    const { updateConfig } = useConfigMutation();
    await expect(
      updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, vaultAddress: "not-an-address" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("calls unwrap exactly once per invocation", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, larkWebhookUrl: "https://example.com" });
    expect(mockUnwrap).toHaveBeenCalledTimes(1);
  });

  it("does not swallow error — rejects on ApiError, does not resolve", async () => {
    mockApiErrorOnce("INVALID_PARAM", "bad param", 400);
    const { updateConfig } = useConfigMutation();
    // Must reject, not resolve
    await expect(
      updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY }),
    ).rejects.toBeDefined();
  });
});

// ── updateConfig — body field naming (JSON tags) ──────────────────────────────

describe("useConfigMutation — JSON tag alignment with backend", () => {
  it("uses camelCase JSON key 'larkWebhookUrl' matching backend tag", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, larkWebhookUrl: "https://example.com" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    // Must use the exact JSON tag from updateConfigReq
    expect("larkWebhookUrl" in body).toBe(true);
    expect("lark_webhook_url" in body).toBe(false);
    expect("LarkWebhookUrl" in body).toBe(false);
  });

  it("uses camelCase JSON key 'vaultAddress' matching backend tag", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, vaultAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect("vaultAddress" in body).toBe(true);
    expect("vault_address" in body).toBe(false);
  });

  it("uses camelCase JSON key 'minSubscribeUsd' matching backend tag", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, minSubscribeUsd: "1000" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect("minSubscribeUsd" in body).toBe(true);
    expect("min_subscribe_usd" in body).toBe(false);
  });

  it("note field is always included in body", async () => {
    mockSuccess();
    const { updateConfig } = useConfigMutation();
    await updateConfig({ note: NOTE, idempotencyKey: IDEM_KEY, auditLabel: "CertiK" });
    const body = lastPatchOptions().json as Record<string, unknown>;
    expect("note" in body).toBe(true);
    expect(body.note).toBe(NOTE);
  });
});
