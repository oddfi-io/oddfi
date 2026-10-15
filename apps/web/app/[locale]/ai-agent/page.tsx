"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { ComingSoon } from "@/components/common/ComingSoon";
import { AiChatMainView } from "@/components/ai-agent/AiChatMainView";
import { CreateAgentWizardLinear } from "@/components/ai-agent/CreateAgentWizardLinear";
import { PersonaCreatingModal } from "@/components/ai-agent/onboarding/PersonaCreatingModal";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAiAgentStore } from "@/stores/aiAgentStore";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useAuthStore } from "@/stores/authStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";

/**
 * AI Agent 配置中心（DD-109 · 取代 DD-106 的 "Intro + 4-tab wizard + 聊天页" 流程）。
 *
 * 流程：
 *   - 未挂载 / SSR 阶段 → null（避免 H5 首屏闪 PC 视图）
 *   - H5（<1024）→ 通用 ComingSoon  [H5-AI-DISABLED: 等 H5 设计稿]
 *   - PC + hasCreatedAgent=false → CreateAgentWizardLinear（线性 3 步）
 *     · 用户点「生成画像」→ wizard 内调 finish() 写 store + 父组件弹 PersonaCreatingModal
 *     · 用户点右上 X 关闭 → finish() 已写 store，hasCreatedAgent=true 自动 re-render 到 tabs
 *   - PC + hasCreatedAgent=true → AiChatMainView（DD-121 · 聊天主界面 + 配置覆盖层）
 *
 * DD-121：已创建 Agent 后默认进聊天主界面（左侧栏 + 中央聊天区），
 * 配置页（AgentConfigTabs）降级为左侧栏 5 tab / 中央齿轮唤起的全屏覆盖层。
 * CreateAgentIntroModal / CreateAgentWizard 旧版仍保留文件，后续 ENH 清理。
 */
export default function AiAgentRoute() {
  const t = useTranslations("aiAgent");
  const [mounted, setMounted] = useState(false);
  const isPC = useMediaQuery("(min-width:1024px)");

  const hasCreatedAgent = useAiAgentStore((s) => s.hasCreatedAgent);
  const hydrated = useAiAgentStore((s) => s.hydrated);
  const hydrate = useAiAgentStore((s) => s.hydrate);

  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const openChat = useAiChatSessionStore((s) => s.open);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);
  const setConnectSource = useWalletSheetStore((s) => s.setConnectSource);

  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const pendingOpenChat = useRef(false);

  useEffect(() => {
    setMounted(true);
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  // wizard 完成后若未登录，标记 pendingOpenChat；登录成功后再唤出聊天栏
  useEffect(() => {
    if (isAuthenticated && pendingOpenChat.current) {
      pendingOpenChat.current = false;
      openChat();
    }
  }, [isAuthenticated, openChat]);

  if (!mounted) return null;
  if (!isPC) {
    // H5-AI-DISABLED: H5 设计稿未到位前展示通用 ComingSoon，到位后替换为真实 H5 视图
    return <ComingSoon sectionId="ai-agent-h5" title={t("mobileComingSoon.title")} />;
  }

  return (
    <>
      {!hasCreatedAgent && (
        <CreateAgentWizardLinear
          onCreatePersona={() => setShowPersonaModal(true)}
          // finish() 已在 wizard 内调用；store.hasCreatedAgent 翻转后自动 re-render 到 tabs
          onClose={() => {
            /* noop — store 状态切换驱动 UI */
          }}
        />
      )}
      {hasCreatedAgent && <AiChatMainView />}
      <PersonaCreatingModal
        isOpen={showPersonaModal}
        onClose={() => {
          setShowPersonaModal(false);
          router.push(`/${params.locale}/markets`);
          if (isAuthenticated) {
            openChat();
          } else {
            pendingOpenChat.current = true;
            setConnectSource("ai-agent");
            triggerConnect();
          }
        }}
      />
    </>
  );
}
