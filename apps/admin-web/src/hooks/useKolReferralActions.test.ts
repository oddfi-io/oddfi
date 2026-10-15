/**
 * Tests for useKolReferralActions (REQ-004).
 *
 * 策略：vi.mock('@/lib/api') 拦截网络；mockUnwrap 控制成功/失败；
 * 检查 api.post/patch/delete 的 path / body 形状。
 * 关键断言：无 X-Idempotency-Key（后端无幂等中间件）；referralPct 始终为 string；
 * note 为空时不进 body；PATCH/DELETE 的 eoa 做 encodeURIComponent。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/types/api";

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

import { useKolReferralActions } from "./useKolReferralActions";

const EOA = "0x5519aBcD123456789012345678901234567806a4";
const KOL = {
  referrerEoa: EOA,
  referralPct: "8.0000",
  note: "KOL A",
  createdBy: "ou_xxx",
  createdAt: 1748390400000,
  updatedAt: 1748390400000,
};

type KyCall = [string, { json?: unknown; headers?: Record<string, string> }];

function lastCall(mock: typeof mockApiPost): KyCall {
  const calls = mock.mock.calls as unknown as KyCall[];
  if (calls.length === 0) throw new Error("api method was not called");
  return calls[calls.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useKolReferralActions — createKol", () => {
  it("POST 到 admin/presale/kol-referral，body 带 referrerEoa/referralPct/note（note 必发）", async () => {
    mockUnwrap.mockResolvedValueOnce({ kol: KOL });
    const { createKol } = useKolReferralActions();
    const result = await createKol({ referrerEoa: EOA, referralPct: "8.00", note: "新增测试KOL备注" });
    const [url, opts] = lastCall(mockApiPost);
    expect(url).toBe("admin/presale/kol-referral");
    expect(opts.json).toEqual({ referrerEoa: EOA, referralPct: "8.00", note: "新增测试KOL备注" });
    expect(result).toEqual(KOL); // 返回解包后的 kol 字段
  });

  it("note 始终进 body（noteValidatorMW 强制 ≥10，前端总是发送）", async () => {
    mockUnwrap.mockResolvedValueOnce({ kol: KOL });
    const { createKol } = useKolReferralActions();
    await createKol({ referrerEoa: EOA, referralPct: "8.00", note: "十个字符的操作备注" });
    const body = lastCall(mockApiPost)[1].json as Record<string, unknown>;
    expect(body).toHaveProperty("note");
  });

  it("不带 X-Idempotency-Key 头（后端 KOL 路由无幂等中间件）", async () => {
    mockUnwrap.mockResolvedValueOnce({ kol: KOL });
    const { createKol } = useKolReferralActions();
    await createKol({ referrerEoa: EOA, referralPct: "8.00", note: "十个字符的操作备注" });
    expect(lastCall(mockApiPost)[1].headers).toBeUndefined();
  });

  it("referralPct 始终为 string，不被数字化", async () => {
    mockUnwrap.mockResolvedValueOnce({ kol: KOL });
    const { createKol } = useKolReferralActions();
    await createKol({ referrerEoa: EOA, referralPct: "8.00", note: "十个字符的操作备注" });
    const body = lastCall(mockApiPost)[1].json as Record<string, unknown>;
    expect(typeof body.referralPct).toBe("string");
  });
});

describe("useKolReferralActions — updateKol", () => {
  it("PATCH 到 :eoa（encodeURIComponent），body 仅 referralPct/note", async () => {
    mockUnwrap.mockResolvedValueOnce({ kol: KOL });
    const { updateKol } = useKolReferralActions();
    await updateKol(EOA, { referralPct: "9.50", note: "调整返佣比例到9.5%" });
    const [url, opts] = lastCall(mockApiPatch);
    expect(url).toBe(`admin/presale/kol-referral/${encodeURIComponent(EOA)}`);
    expect(opts.json).toEqual({ referralPct: "9.50", note: "调整返佣比例到9.5%" });
  });
});

describe("useKolReferralActions — deleteKol", () => {
  it("DELETE 到 :eoa（encodeURIComponent）+ 带 note body（满足 noteValidatorMW）", async () => {
    mockUnwrap.mockResolvedValueOnce({ referrerEoa: EOA });
    const { deleteKol } = useKolReferralActions();
    await deleteKol(EOA, "删除该KOL特殊返佣配置");
    const [url, opts] = lastCall(mockApiDelete);
    expect(url).toBe(`admin/presale/kol-referral/${encodeURIComponent(EOA)}`);
    expect(opts.json).toEqual({ note: "删除该KOL特殊返佣配置" }); // ⚠️ DELETE 必须带 body
  });
});

describe("useKolReferralActions — error propagation", () => {
  it("createKol 透传 ApiError 不吞", async () => {
    mockUnwrap.mockRejectedValueOnce(new ApiError("KOL_REFERRAL_PCT_INVALID", 400, "bad pct"));
    const { createKol } = useKolReferralActions();
    await expect(
      createKol({ referrerEoa: EOA, referralPct: "200", note: "十个字符的操作备注" }),
    ).rejects.toMatchObject({ errorCode: "KOL_REFERRAL_PCT_INVALID" });
  });

  it("updateKol 透传 KOL_NOT_FOUND", async () => {
    mockUnwrap.mockRejectedValueOnce(new ApiError("KOL_NOT_FOUND", 404, "not found"));
    const { updateKol } = useKolReferralActions();
    await expect(updateKol(EOA, { referralPct: "9.50", note: "十个字符的操作备注" })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("createKol 透传 NOTE_REQUIRED（兜底：前端校验绕过时后端仍拦）", async () => {
    mockUnwrap.mockRejectedValueOnce(new ApiError("NOTE_REQUIRED", 400, "note too short"));
    const { createKol } = useKolReferralActions();
    await expect(
      createKol({ referrerEoa: EOA, referralPct: "8.00", note: "短" }),
    ).rejects.toMatchObject({ errorCode: "NOTE_REQUIRED" });
  });
});
