"use client";

/**
 * MobileAgentDrawer — H5 AI Agent 汉堡侧边栏（DD-135 Batch 1 · Figma 7973:127993）。
 *
 * fixed 全屏层（z-70，盖过 MobileAiChatSheet z-60，遮罩覆盖含顶部导航的整屏）：
 *   - 遮罩（Figma 7973:127996）：fill-mask rgba(4,6,12,0.7)，点击关闭
 *   - 右锚定抽屉（Figma 7968:127678）：260px / bg-primary / px-8，全高
 *   - 顶部关闭行（Figma 7973:127997 + 7968:127709）：h-48 右对齐 IconBtn（24px rounded-6 input2 底 + 16px X）
 *   - 复用 PC AiChatSidebar（Figma 7973:128293 与 PC 6814:126173 同源组件，宽度随父容器）
 *
 * 动画（animation.md 强约束 · WAAPI 唯一方案）：
 *   panel translateX(100%→0) + 遮罩 opacity 0→1，250ms ease-out；
 *   退场反向，onfinish 卸载（fallback timer 兜底动画被打断的场景）。
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@phosphor-icons/react";

import { AiChatSidebar, type RecentEntry } from "@/components/ai-agent/AiChatSidebar";
import type { ConfigTab } from "@/components/ai-agent/AgentConfigTabs";

const ANIM_MS = 250;

interface MobileAgentDrawerProps {
  open: boolean;
  onClose: () => void;
  recents: RecentEntry[];
  onNewChat: () => void;
  onClearRecents: () => void;
  onOpenConfig: (tab: ConfigTab) => void;
  /** 当前激活的设置 tab（设置视图打开时高亮对应导航项）。 */
  activeConfigTab?: ConfigTab | null;
}

export function MobileAgentDrawer({
  open,
  onClose,
  recents,
  onNewChat,
  onClearRecents,
  onOpenConfig,
  activeConfigTab = null,
}: MobileAgentDrawerProps) {
  // rendered 控制实际挂载：open=false 时先播退场动画，结束后再卸载
  const [rendered, setRendered] = useState(false);
  const maskRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 入场：open 翻 true → 挂载，挂载完成后播 WAAPI 入场
  useEffect(() => {
    if (open) setRendered(true);
  }, [open]);

  // body 滚动锁：保存并恢复先前值（sheet 已锁 body 时不被本组件解锁 — REV-v1 A-2）
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !rendered) return;
    panelRef.current?.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], {
      duration: ANIM_MS,
      easing: "ease-out",
      fill: "backwards",
    });
    maskRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: ANIM_MS,
      easing: "ease-out",
      fill: "backwards",
    });
  }, [open, rendered]);

  // 退场：open 翻 false → 反向动画，onfinish 卸载（fallback timer 兜底）
  useEffect(() => {
    if (open || !rendered) return;
    const mask = maskRef.current;
    const panel = panelRef.current;
    if (!mask || !panel) {
      setRendered(false);
      return;
    }
    const anim = panel.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(100%)" }],
      { duration: ANIM_MS, easing: "ease-out", fill: "forwards" }
    );
    mask.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ANIM_MS,
      easing: "ease-out",
      fill: "forwards",
    });
    // cancelled 防重入：cleanup（快速 open→close→open 竞态 / unmount）后，
    // 过时的 onfinish / fallback timer 不得再调 setRendered（REV-v1 A-3）
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      setRendered(false);
    };
    anim.onfinish = finish;
    const timer = window.setTimeout(finish, ANIM_MS + 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, rendered]);

  // Escape 关闭（对齐 MobileBottomSheet 交互）
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!rendered) return null;

  // Portal 到 body：脱离 sheet 的 transform/backdrop-filter 包含块，确保 fixed 覆盖整屏
  return createPortal(
    <div
      className="fixed inset-0 z-[70] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Agent menu"
    >
      {/* 遮罩（Figma 7973:127996 · fill/mask）— 点击关闭；touch-action none 阻断滚动穿透 */}
      <div
        ref={maskRef}
        className="absolute inset-0 bg-fill-mask"
        onClick={onClose}
        style={{ touchAction: "none" }}
      />

      {/* 右锚定抽屉（Figma 7968:127678 · 260px / bg-primary / px-8） */}
      <div
        ref={panelRef}
        className="absolute inset-y-0 right-0 flex w-[260px] flex-col bg-primary px-[8px]"
      >
        {/* 顶部关闭行（Figma 7973:127997 · h-48 右对齐；按钮 44px 热区包 24px 视觉，图标右缘距边 10px 与设计一致） */}
        <div className="flex h-[48px] shrink-0 items-center justify-end">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            style={{ touchAction: "manipulation" }}
            className="flex size-[44px] cursor-pointer items-center justify-center border-0 bg-transparent"
          >
            <span className="flex size-[24px] items-center justify-center rounded-[6px] bg-fill-input-modal transition-colors hover:bg-fill-hover">
              <XIcon size={16} className="text-primary" />
            </span>
          </button>
        </div>

        {/* .side bar（Figma 7973:128293）— 复用 PC AiChatSidebar，宽度随父容器、去右分隔线 */}
        <AiChatSidebar
          className="w-full min-h-0 flex-1 border-r-0"
          recents={recents}
          onNewChat={onNewChat}
          onClearRecents={onClearRecents}
          onOpenConfig={onOpenConfig}
          activeConfigTab={activeConfigTab}
        />
      </div>
    </div>,
    document.body
  );
}
