"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { IS_EARLY_BIRD_MODE } from "@/lib/early-bird-mode";
import EarlyBirdRegistrationModal from "./EarlyBirdRegistrationModal";

export type EarlyBirdStep = 1 | 2;

interface EarlyBirdContextValue {
  isActive: boolean;
  open: boolean;
  step: EarlyBirdStep;
  rank: number | null;
  openGate: () => void;
  close: () => void;
  setStep: (s: EarlyBirdStep) => void;
  setRank: (r: number | null) => void;
}

const EarlyBirdContext = createContext<EarlyBirdContextValue | null>(null);

const NOOP_CONTEXT: EarlyBirdContextValue = {
  isActive: false,
  open: false,
  step: 1,
  rank: null,
  openGate: () => {},
  close: () => {},
  setStep: () => {},
  setRank: () => {},
};

/**
 * Provider 外调用时返回 inactive NOOP — 让宿主组件（如 ConnectButton）可在测试 / 旧版 wrap 层级
 * 安全降级为"早鸟未启用"。生产代码若需保证 Provider 存在，应改用 useContext(EarlyBirdContext)
 * 直接读 null 自行判断。
 */
export function useEarlyBird() {
  const ctx = useContext(EarlyBirdContext);
  return ctx ?? NOOP_CONTEXT;
}

interface ProviderProps {
  children: ReactNode;
  /** Test-only override; defaults to IS_EARLY_BIRD_MODE env flag. */
  active?: boolean;
  /** DD-103 续：layout SSR 读 httpOnly bypass cookie 后传入；true 则强制 active=false。 */
  bypass?: boolean;
}

/**
 * EarlyBirdProvider (DD-103)
 *
 * 全局点击拦截 + 早鸟 Modal 状态机宿主。仅在 `active` 时挂 document click 捕获 listener，
 * 关闭态下零开销。Modal 实际渲染由 Batch 3 接入；本 Batch 仅暴露 Context + 拦截逻辑。
 *
 * 拦截规则（捕获阶段，先于组件 onClick）：
 * 1. `[data-earlybird-gate]` 元素 → 强拦截 + openGate (用于非 `<a>` 的钱包按钮)
 * 2. `<a>` 元素 → 跨 origin / 同 pathname / `#` hash 一律放行；其余拦截
 */
export function EarlyBirdProvider({
  children,
  active: activeProp = IS_EARLY_BIRD_MODE,
  bypass = false,
}: ProviderProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<EarlyBirdStep>(1);
  const [rank, setRank] = useState<number | null>(null);

  // DD-103 续：bypass 由 layout SSR 校验 httpOnly cookie 后传入，true → active=false。
  const active = activeProp && !bypass;

  const openGate = useCallback(() => {
    setStep(1);
    setRank(null);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!active) return;

    const handler = (event: MouseEvent) => {
      const path = event.composedPath();
      let anchor: HTMLAnchorElement | null = null;
      let gateNode: HTMLElement | null = null;

      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;
        if (!gateNode && node.dataset?.earlybirdGate !== undefined) {
          gateNode = node;
        }
        if (!anchor && node.tagName === "A") {
          anchor = node as HTMLAnchorElement;
        }
        if (anchor || gateNode) break;
      }

      if (gateNode) {
        event.preventDefault();
        event.stopPropagation();
        openGate();
        return;
      }

      if (!anchor) return;

      const rawHref = anchor.getAttribute("href") ?? "";
      if (!rawHref || rawHref.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }

      // 跨 origin 放行（外链 / 社媒 / 第三方）
      if (url.origin !== window.location.origin) return;
      // 同 pathname 放行（锚点跳转 / 仅 hash 变化）
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      openGate();
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [active, openGate]);

  const value = useMemo<EarlyBirdContextValue>(
    () => ({ isActive: active, open, step, rank, openGate, close, setStep, setRank }),
    [active, open, step, rank, openGate, close]
  );

  return (
    <EarlyBirdContext.Provider value={value}>
      {children}
      {active && (
        <>
          {/* Preload modal status icons — Modal returns null when closed so priority prop inside has no effect */}
          <div className="hidden" aria-hidden="true">
            <Image src="/images/status/congrats.png" alt="" width={80} height={80} priority />
            <Image src="/images/status/success.png" alt="" width={80} height={80} priority />
          </div>
          <EarlyBirdRegistrationModal open={open} step={step} onClose={close} setStep={setStep} />
        </>
      )}
    </EarlyBirdContext.Provider>
  );
}
