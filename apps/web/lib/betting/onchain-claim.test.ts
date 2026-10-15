import { describe, it, expect, vi } from "vitest";
import {
  getOnchainBetId,
  submitOnchainClaim,
  isOnchainBetNotReadyError,
  classifyClaimError,
  OnchainClaimRevertedError,
} from "./onchain-claim";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";
import { HTTPError } from "ky";

describe("getOnchainBetId", () => {
  it("returns bet_id when business_type=onchain_single + bet_id present", () => {
    expect(getOnchainBetId({ business_type: "onchain_single", bet_id: "0xdead" } as never)).toBe(
      "0xdead"
    );
  });

  it("returns null when business_type=onchain_single but bet_id missing (事件索引未回填)", () => {
    expect(getOnchainBetId({ business_type: "onchain_single" } as never)).toBeNull();
  });

  it("returns null when business_type=single (centralized 链下行,即使有 bet_id 字段)", () => {
    expect(getOnchainBetId({ business_type: "single", bet_id: "0xdead" } as never)).toBeNull();
  });

  it("returns null when record is null", () => {
    expect(getOnchainBetId(null)).toBeNull();
  });

  it("returns null when undefined", () => {
    expect(getOnchainBetId(undefined)).toBeNull();
  });
});

describe("submitOnchainClaim", () => {
  it("calls onchainClaimPayout with bet_id only (DD-141: server derives idempotency key) + waits receipt success", async () => {
    const onchainClaimPayout = vi.fn(async () => ({
      order_id: 1,
      tx_hash: "0xCCC",
      action_id: 1,
      idempotency_key: "claim-0xdead-abc",
    }));
    const waitForReceipt = vi.fn(async () => ({
      status: "success" as const,
      blockNumber: 1n,
      txHash: "0xCCC" as const,
    }));

    const res = await submitOnchainClaim(
      { betId: "0xdead" },
      { onchainClaimPayout, waitForReceipt }
    );

    expect(onchainClaimPayout).toHaveBeenCalledWith({
      bet_id: "0xdead",
    });
    expect(waitForReceipt).toHaveBeenCalledWith("0xCCC");
    expect(res).toEqual({ txHash: "0xCCC" });
  });

  it("throws OnchainClaimRevertedError when receipt status=reverted", async () => {
    const onchainClaimPayout = vi.fn(async () => ({
      order_id: 1,
      tx_hash: "0xCCC",
      action_id: 1,
      idempotency_key: "k",
    }));
    const waitForReceipt = vi.fn(async () => ({
      status: "reverted" as const,
      blockNumber: 1n,
      txHash: "0xCCC" as const,
    }));

    await expect(
      submitOnchainClaim({ betId: "0xdead" }, { onchainClaimPayout, waitForReceipt })
    ).rejects.toBeInstanceOf(OnchainClaimRevertedError);
  });

  it("propagates ReceiptTimeoutError", async () => {
    const onchainClaimPayout = vi.fn(async () => ({
      order_id: 1,
      tx_hash: "0xCCC",
      action_id: 1,
      idempotency_key: "k",
    }));
    const waitForReceipt = vi.fn(async () => {
      throw new ReceiptTimeoutError("0xCCC", 1000);
    });

    await expect(
      submitOnchainClaim({ betId: "0xdead" }, { onchainClaimPayout, waitForReceipt })
    ).rejects.toBeInstanceOf(ReceiptTimeoutError);
  });
});

describe("isOnchainBetNotReadyError", () => {
  it("detects ErrOnchainBetNotReady from ky HTTPError responseJSON.code", () => {
    const err = Object.assign(new Error("HTTP 400"), {
      name: "HTTPError",
      responseJSON: { code: "ErrOnchainBetNotReady" },
      response: { status: 400 },
    });
    Object.setPrototypeOf(err, HTTPError.prototype);
    expect(isOnchainBetNotReadyError(err)).toBe(true);
  });

  it("detects via message substring fallback (后端早期未返回 code 时)", () => {
    const err = new Error("onchain bet id not found or not ready for current user");
    expect(isOnchainBetNotReadyError(err)).toBe(true);
  });

  it("returns false for non-NotReady errors", () => {
    expect(isOnchainBetNotReadyError(new Error("Something else"))).toBe(false);
    expect(isOnchainBetNotReadyError(null)).toBe(false);
    expect(isOnchainBetNotReadyError(undefined)).toBe(false);
  });
});

// ─── classifyClaimError（后端 ENH-007 guard：relay 前同步拒绝，无 tx 上链） ──

/** 构造带 responseJSON 的 ky HTTPError 形状（lib/api.ts beforeError 挂载行为的镜像） */
function fakeHttpError(message: string, code: unknown = 400): HTTPError {
  const err = Object.create(HTTPError.prototype) as HTTPError & { responseJSON?: unknown };
  Object.defineProperty(err, "message", { value: "Request failed", writable: true });
  err.responseJSON = { code, message };
  return err;
}

describe("classifyClaimError", () => {
  it("state=cashed_out → not-claimable-cashed-out（已提前兑现，无奖金可领）", () => {
    expect(classifyClaimError(fakeHttpError("onchain bet not claimable: state=cashed_out"))).toBe(
      "not-claimable-cashed-out"
    );
  });

  it("state=won_claimed → not-claimable-claimed（重复领奖）", () => {
    expect(classifyClaimError(fakeHttpError("onchain bet not claimable: state=won_claimed"))).toBe(
      "not-claimable-claimed"
    );
  });

  it.each(["pending", "refunded", "lost", "state_9"])(
    "state=%s → not-claimable（其余状态 + 未来枚举兜底）",
    (state) => {
      expect(classifyClaimError(fakeHttpError(`onchain bet not claimable: state=${state}`))).toBe(
        "not-claimable"
      );
    }
  );

  it("503 state unverified → state-unverified（可原地重试）", () => {
    expect(classifyClaimError(fakeHttpError("onchain bet state unverified, try later", 503))).toBe(
      "state-unverified"
    );
  });

  it("matches plain Error message too (non-HTTPError path)", () => {
    expect(classifyClaimError(new Error("onchain bet not claimable: state=cashed_out"))).toBe(
      "not-claimable-cashed-out"
    );
  });

  it("falls back to unknown for network errors / null / 既有 not-ready 错误", () => {
    expect(classifyClaimError(new Error("fetch failed"))).toBe("unknown");
    expect(classifyClaimError(null)).toBe("unknown");
    // not-ready 由 isOnchainBetNotReadyError 先行拦截，本函数不重复归类
    expect(classifyClaimError(new Error("onchain bet id not found or not ready"))).toBe("unknown");
  });
});
