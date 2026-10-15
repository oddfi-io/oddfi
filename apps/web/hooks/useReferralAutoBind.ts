"use client";

import { useEffect, useRef } from "react";
import {
  decideReferralEntry,
  isValidReferralCode,
  normalizeReferralCode,
} from "@/lib/presale/referral-entry";
import type { ReferralMe } from "@/lib/presale/types";

/** 自动绑场景的绑定入口（仅取 mutate；options 与 useBindReferral().mutate 一致） */
interface AutoBindMutate {
  mutate: (
    body: { code: string; source: "link" | "manual"; business: string },
    options?: { onSuccess?: () => void; onError?: (err: unknown) => void }
  ) => void;
}

export interface UseReferralAutoBindParams {
  /** 已登录（walletConnected）才决策 */
  enabled: boolean;
  /** /referral/me 结果（决定已绑 / myCode）；未就绪传 null/undefined */
  referralMe: Pick<ReferralMe, "myCode" | "referrer"> | null | undefined;
  /** 当前登录账户地址（per-account key，地址变即为新账户重新决策；未登录传 null） */
  sessionAddress: string | null;
  /** 当前 URL ?ref（无则 null） */
  urlRef: string | null;
  /** 绑定入口（传 useBindReferral() 即可，只用 mutate） */
  bind: AutoBindMutate;
  /** 自动绑成功回调（如 toast.success） */
  onAutoBound: () => void;
  /** 自动绑失败回调（自动场景静默，如 console.warn；不打扰用户） */
  onAutoBindError: (err: unknown) => void;
  /** 决策为「自己链接 / 无码」时打开手动填码弹窗 */
  onOpenModal: () => void;
}

/**
 * DD-131：登录后邀请码入口决策（按登录账户 key，账户切换重登后为新账户重新决策）。
 *
 * - 后端已绑（referrer 非空）→ 收口不动。
 * - 他人有效码 → 自动 bind(source:link)，成功 onAutoBound、失败 onAutoBindError（静默）。
 * - 自己链接 / 无码 → 350ms 后 onOpenModal 引导手动填码。
 *
 * per-account：`referralEntryAddrRef` 记录已决策的 sessionAddress；地址变化（切账户重登）时
 * 自然失配 → 为新账户重新决策。保留 `!referralMe` guard，配合 useReferralMe 的 address 维度
 * queryKey，不会用旧账户的 referralMe 给新账户决策（DD-131 review architect M2）。
 *
 * 回调走 latest-ref，不进 effect deps —— 避免调用方传内联函数导致 effect 每帧重跑、
 * 把 modal 的 350ms timer 在 cleanup 里反复清掉（弹窗永不出现）。
 */
export function useReferralAutoBind({
  enabled,
  referralMe,
  sessionAddress,
  urlRef,
  bind,
  onAutoBound,
  onAutoBindError,
  onOpenModal,
}: UseReferralAutoBindParams): void {
  const referralEntryAddrRef = useRef<string | null>(null);
  const cbsRef = useRef({ onAutoBound, onAutoBindError, onOpenModal });
  cbsRef.current = { onAutoBound, onAutoBindError, onOpenModal };

  useEffect(() => {
    if (!enabled || !referralMe || !sessionAddress) return;
    // 同一账户已决策过 → 收口（地址变化时本 ref 自然失配，触发重新决策）
    if (referralEntryAddrRef.current === sessionAddress) return;
    // 后端已绑 → 收口（唯一可信判据）
    if (referralMe.referrer) {
      referralEntryAddrRef.current = sessionAddress;
      return;
    }
    // 自己链接检测依赖 myCode；新用户 myCode 异步生成中 → 若 URL 有有效码但 myCode 未就绪，
    // 先等下一次 referralMe 再决策（避免把自己的链接误判为他人码）。
    if (isValidReferralCode(normalizeReferralCode(urlRef ?? "")) && !referralMe.myCode) return;

    referralEntryAddrRef.current = sessionAddress;
    const entry = decideReferralEntry({
      urlRef,
      myCode: referralMe.myCode ?? null,
      hasReferrer: !!referralMe.referrer,
    });
    if (entry.kind === "prefill") {
      bind.mutate(
        { code: entry.code, source: "link", business: "presale" },
        {
          onSuccess: () => cbsRef.current.onAutoBound(),
          onError: (err) => cbsRef.current.onAutoBindError(err),
        }
      );
      return;
    }
    if (entry.kind === "modal") {
      const timer = window.setTimeout(() => cbsRef.current.onOpenModal(), 350);
      return () => window.clearTimeout(timer);
    }
  }, [enabled, referralMe, sessionAddress, urlRef, bind]);
}
