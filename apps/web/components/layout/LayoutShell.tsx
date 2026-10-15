"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import TopNav from "./TopNav";
import AIAgentFloatButton from "./AIAgentFloatButton";
import { useAiAgentStore } from "@/stores/aiAgentStore";
import { CreateAgentIntroModal } from "@/components/ai-agent/CreateAgentIntroModal";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

// TopNav 本体（Logo + 导航链接）已是 SSR 安全的 Client Component，直接渲染。
// 右侧 wagmi/auth 动作区由 TopNav 内部的 DynamicTopNavActions（ssr:false）隔离。
const DynamicWrongNetworkBanner = dynamic(
  () =>
    import("@/components/wallet/WrongNetworkBanner").then((m) => ({
      default: m.WrongNetworkBanner,
    })),
  { ssr: false, loading: () => null }
);

// AiChatModal 依赖 window + localStorage + react-rnd，须 ssr:false（DD-106 §3.8）。
const DynamicAiChatModal = dynamic(() => import("@/components/ai-chat/AiChatModal"), {
  ssr: false,
  loading: () => null,
});

// DD-125：H5 AI 聊天抽屉，依赖 window/localStorage，须 ssr:false。
const DynamicMobileAiChatSheet = dynamic(
  () => import("@/components/ai-chat/mobile/MobileAiChatSheet"),
  { ssr: false, loading: () => null }
);

export function TopNavShell() {
  return <TopNav />;
}

export function WrongNetworkBannerShell() {
  return <DynamicWrongNetworkBanner />;
}

export function AIAgentFloatShell() {
  return <AIAgentFloatButton />;
}

export function AiChatModalShell() {
  // DD-125：按断点互斥挂载 — H5 走移动端抽屉 MobileAiChatSheet，PC 走 dock/float 浮窗 AiChatModal。
  // 互斥保证 useAiChat / useNewsFeed 同一时刻只有一份实例，不重复连接。
  const mode = useResponsiveMode();
  if (mode === "h5") return <DynamicMobileAiChatSheet />;
  return <DynamicAiChatModal />;
}

function AgentGlobalOnboardingModal() {
  const hydrated = useAiAgentStore((s) => s.hydrated);
  const hydrate = useAiAgentStore((s) => s.hydrate);
  const hasCreatedAgent = useAiAgentStore((s) => s.hasCreatedAgent);
  const hasSeenGlobalOnboarding = useAiAgentStore((s) => s.hasSeenGlobalOnboarding);
  const markSeenGlobalOnboarding = useAiAgentStore((s) => s.markSeenGlobalOnboarding);
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  // H5-AI-DISABLED: H5 不弹首次创建 Agent 提醒；不写 markSeen，保留切到 PC 后的首次提醒
  const responsive = useResponsiveMode();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const visible = hydrated && !hasCreatedAgent && !hasSeenGlobalOnboarding && responsive !== "h5";

  return (
    <CreateAgentIntroModal
      isOpen={visible}
      onCreate={() => {
        markSeenGlobalOnboarding();
        router.push(`/${params.locale}/ai-agent`);
      }}
      onSkip={markSeenGlobalOnboarding}
      onClose={markSeenGlobalOnboarding}
    />
  );
}

export function AgentGlobalOnboardingShell() {
  return <AgentGlobalOnboardingModal />;
}
