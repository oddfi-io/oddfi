// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReferralAutoBind, type UseReferralAutoBindParams } from "./useReferralAutoBind";
import type { Referrer } from "@/lib/presale/types";

type MutateFn = (
  body: { code: string; source: "link" | "manual"; business: string },
  options?: { onSuccess?: () => void; onError?: (err: unknown) => void }
) => void;

// 有效他人邀请码（0x + 6 位 Base32，去 0/1/I/O），与 referral-entry 正则一致
const OTHER_CODE = "0x3YCBK8";
const MY_CODE = "0xMVEKMP";
const ADDR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ADDR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function makeReferrer(): Referrer {
  return { eoa: "0xref", code: OTHER_CODE, boundAt: 1_700_000_000_000 };
}

describe("useReferralAutoBind (DD-131 账户切换重绑)", () => {
  let bindMutate: Mock<MutateFn>;
  let onAutoBound: Mock<() => void>;
  let onAutoBindError: Mock<(err: unknown) => void>;
  let onOpenModal: Mock<() => void>;

  function baseParams(over: Partial<UseReferralAutoBindParams> = {}): UseReferralAutoBindParams {
    return {
      enabled: true,
      referralMe: { myCode: MY_CODE, referrer: null },
      sessionAddress: ADDR_A,
      urlRef: null,
      bind: { mutate: bindMutate },
      onAutoBound,
      onAutoBindError,
      onOpenModal,
      ...over,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    bindMutate = vi.fn<MutateFn>((_body, opts) => opts?.onSuccess?.());
    onAutoBound = vi.fn<() => void>();
    onAutoBindError = vi.fn<(err: unknown) => void>();
    onOpenModal = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── gating ──────────────────────────────────────────────────────────────
  it("未登录(enabled=false) → 不绑不弹", () => {
    renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ enabled: false, urlRef: OTHER_CODE }),
    });
    vi.advanceTimersByTime(400);
    expect(bindMutate).not.toHaveBeenCalled();
    expect(onOpenModal).not.toHaveBeenCalled();
  });

  it("referralMe 未就绪(null) → 不决策", () => {
    renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ referralMe: null, urlRef: OTHER_CODE }),
    });
    vi.advanceTimersByTime(400);
    expect(bindMutate).not.toHaveBeenCalled();
    expect(onOpenModal).not.toHaveBeenCalled();
  });

  it("sessionAddress 为空 → 不决策", () => {
    renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ sessionAddress: null, urlRef: OTHER_CODE }),
    });
    vi.advanceTimersByTime(400);
    expect(bindMutate).not.toHaveBeenCalled();
  });

  // ── 决策分支 ────────────────────────────────────────────────────────────
  it("他人有效码 → 自动 bind(source:link) + onAutoBound", () => {
    renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ urlRef: OTHER_CODE }),
    });
    expect(bindMutate).toHaveBeenCalledTimes(1);
    expect(bindMutate).toHaveBeenCalledWith(
      { code: OTHER_CODE, source: "link", business: "presale" },
      expect.any(Object)
    );
    expect(onAutoBound).toHaveBeenCalledTimes(1);
    expect(onOpenModal).not.toHaveBeenCalled();
  });

  it("自动绑失败 → onAutoBindError（静默，不抛）", () => {
    const err = new Error("ALREADY_BOUND");
    bindMutate = vi.fn<MutateFn>((_b, opts) => opts?.onError?.(err));
    renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ urlRef: OTHER_CODE }),
    });
    expect(onAutoBindError).toHaveBeenCalledWith(err);
    expect(onAutoBound).not.toHaveBeenCalled();
  });

  it("后端已绑(referrer 非空) → 不绑不弹", () => {
    renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({
        urlRef: OTHER_CODE,
        referralMe: { myCode: MY_CODE, referrer: makeReferrer() },
      }),
    });
    vi.advanceTimersByTime(400);
    expect(bindMutate).not.toHaveBeenCalled();
    expect(onOpenModal).not.toHaveBeenCalled();
  });

  it("无 ?ref（直接进站）→ 350ms 后弹手动填码弹窗", () => {
    renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ urlRef: null }),
    });
    expect(onOpenModal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    expect(onOpenModal).toHaveBeenCalledTimes(1);
    expect(bindMutate).not.toHaveBeenCalled();
  });

  it("自己的链接(urlRef === myCode) → 弹窗而非绑定", () => {
    renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ urlRef: MY_CODE }),
    });
    vi.advanceTimersByTime(350);
    expect(bindMutate).not.toHaveBeenCalled();
    expect(onOpenModal).toHaveBeenCalledTimes(1);
  });

  it("有效码但 myCode 未就绪 → 先等下一轮 referralMe（不误判自己链接）", () => {
    const { rerender } = renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ urlRef: OTHER_CODE, referralMe: { myCode: "", referrer: null } }),
    });
    vi.advanceTimersByTime(400);
    expect(bindMutate).not.toHaveBeenCalled();
    expect(onOpenModal).not.toHaveBeenCalled();
    // myCode 就绪后重新决策 → 绑定
    rerender(baseParams({ urlRef: OTHER_CODE, referralMe: { myCode: MY_CODE, referrer: null } }));
    expect(bindMutate).toHaveBeenCalledTimes(1);
  });

  // ── per-account 重绑（核心场景）────────────────────────────────────────
  it("同一账户重渲染 → 只决策一次（ref 防重绑）", () => {
    const { rerender } = renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ urlRef: OTHER_CODE }),
    });
    expect(bindMutate).toHaveBeenCalledTimes(1);
    rerender(baseParams({ urlRef: OTHER_CODE })); // 新对象引用，但同账户
    rerender(baseParams({ urlRef: OTHER_CODE }));
    expect(bindMutate).toHaveBeenCalledTimes(1);
  });

  it("账户切换(A→B)重登 → 为新账户 B 重新绑定（DD-131 根因②修复）", () => {
    const { rerender } = renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ sessionAddress: ADDR_A, urlRef: OTHER_CODE }),
    });
    expect(bindMutate).toHaveBeenCalledTimes(1); // 账户 A 绑

    // 模拟切账户重登：sessionAddress 变 B，referralMe 刷新为 B 的（未绑）
    rerender(
      baseParams({
        sessionAddress: ADDR_B,
        urlRef: OTHER_CODE,
        referralMe: { myCode: "0xZZ9P7Q", referrer: null },
      })
    );
    expect(bindMutate).toHaveBeenCalledTimes(2); // 账户 B 再绑一次
  });

  it("账户切换后新账户已绑 → 不重复绑", () => {
    const { rerender } = renderHook((p: UseReferralAutoBindParams) => useReferralAutoBind(p), {
      initialProps: baseParams({ sessionAddress: ADDR_A, urlRef: OTHER_CODE }),
    });
    expect(bindMutate).toHaveBeenCalledTimes(1);
    // 切到 B，B 后端已绑 → 收口
    rerender(
      baseParams({
        sessionAddress: ADDR_B,
        urlRef: OTHER_CODE,
        referralMe: { myCode: "0xZZ9P7Q", referrer: makeReferrer() },
      })
    );
    expect(bindMutate).toHaveBeenCalledTimes(1);
  });
});
