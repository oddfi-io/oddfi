"use client";

import { usePathname } from "@/i18n/navigation";
import { PetSprite } from "@/components/codex-pets/PetSprite";
import { useAiAgentStore } from "@/stores/aiAgentStore";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useChatOpener } from "@/hooks/useChatOpener";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

/**
 * AIAgentFloatButton — 右下角浮动 AI 入口（Figma 6644:141149 · DD-125 H5 启用）。
 *
 * 裸 dog PNG（无 mint 圆底、无光晕脉冲）。PC 80×80 / H5 64×64（Figma 7077:102250）。
 *
 * 显示规则：
 *   - mode === "closed" → 显示（点击 open() 恢复呈现：PC dock/float，H5 抽屉）
 *   - mode === "dock" / "float" → 隐藏（已在屏，避免双入口）
 *   - 路径 /ai-agent 全屏页 → 隐藏（双入口去重）
 *   - 仅 /markets 路由
 * H5 不再隐藏：项目无底部 TabBar（MobileTabBar 为 dead code，未渲染），无遮挡问题。
 * 未登录 gate 由 useChatOpener 统一接管（toast + 触发钱包连接弹窗）。
 */
export default function AIAgentFloatButton() {
  const pathname = usePathname();
  const mode = useAiChatSessionStore((s) => s.mode);
  const { openChat } = useChatOpener();
  const avatarRef = useAiAgentStore((s) => s.config.avatarRef);
  const responsive = useResponsiveMode();
  const isH5 = responsive === "h5";

  const isOnMarketsPage = pathname === "/markets" || pathname.startsWith("/markets/");
  if (!isOnMarketsPage) return null;
  // DD-108 §3.7：dock / float / 抽屉已在屏 → 浮动入口隐藏
  if (mode !== "closed") return null;

  return (
    <button
      type="button"
      aria-label="Open AI Agent chat"
      onClick={openChat}
      style={{ touchAction: "manipulation" }}
      className={
        isH5
          ? // H5：右下角 16px，预留底部安全区，64×64
            "flex fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-[16px] z-40 size-[64px] items-center justify-center cursor-pointer border-0 bg-transparent p-0 transition active:scale-95"
          : // PC：右下角 24px，80×80
            "flex fixed bottom-[24px] right-[24px] z-40 size-[80px] items-center justify-center cursor-pointer border-0 bg-transparent p-0 transition hover:scale-105"
      }
    >
      <PetSprite
        petId={avatarRef}
        size={isH5 ? 64 : 80}
        mode="idleLoop"
        ariaLabel="AI Agent avatar"
      />
    </button>
  );
}
