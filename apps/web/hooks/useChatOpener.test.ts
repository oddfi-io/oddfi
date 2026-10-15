// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatOpener } from "./useChatOpener";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useAuthStore } from "@/stores/authStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";

vi.mock("sonner", () => ({
  toast: { info: vi.fn() },
}));

describe("useChatOpener", () => {
  beforeEach(() => {
    localStorage.clear();
    useAiChatSessionStore.setState({
      mode: "closed",
      lastMode: "dock",
      isOpen: false,
      activeTab: "chat",
      messages: [],
      hydrated: false,
      pendingMatchId: null,
      pendingAutoSend: null,
      dockSlotEl: null,
    });
    useAuthStore.setState({ isAuthenticated: false });
    useWalletSheetStore.setState({ connectTrigger: 0, connectSource: null });
    vi.clearAllMocks();
  });

  describe("openChat (普通入口：FAB / wizard 复位)", () => {
    it("已登录 → store.mode 切到 lastMode，不触发钱包连接 / toast", async () => {
      useAuthStore.setState({ isAuthenticated: true });
      const { toast } = await import("sonner");
      const { result } = renderHook(() => useChatOpener());

      act(() => result.current.openChat());

      const session = useAiChatSessionStore.getState();
      expect(session.mode).toBe("dock");
      expect(session.isOpen).toBe(true);
      expect(useWalletSheetStore.getState().connectTrigger).toBe(0);
      expect(toast.info).not.toHaveBeenCalled();
    });

    it("未登录 → store.mode 不被脏写 + toast 提示 + 触发钱包连接", async () => {
      const { toast } = await import("sonner");
      const { result } = renderHook(() => useChatOpener());

      act(() => result.current.openChat());

      const session = useAiChatSessionStore.getState();
      // 关键不变量：mode 必须保持 closed，否则 MarketsPageClient 右栏占位（大黑列）
      expect(session.mode).toBe("closed");
      expect(session.isOpen).toBe(false);
      expect(toast.info).toHaveBeenCalledOnce();
      const wallet = useWalletSheetStore.getState();
      expect(wallet.connectTrigger).toBe(1);
      expect(wallet.connectSource).toBe("ai-chat");
    });
  });

  describe("openChatWithIntent (AI Badge)", () => {
    const payload = {
      intent: "match-analysis" as const,
      matchId: "fixture-42",
      matchLabel: "PSG vs Arsenal",
    };

    it("已登录 → store.openWithIntent 生效（mode=dock, pendingAutoSend 写入）", async () => {
      useAuthStore.setState({ isAuthenticated: true });
      const { toast } = await import("sonner");
      const { result } = renderHook(() => useChatOpener());

      act(() => result.current.openChatWithIntent(payload));

      const session = useAiChatSessionStore.getState();
      expect(session.mode).toBe("dock");
      expect(session.pendingMatchId).toBe("fixture-42");
      expect(session.pendingAutoSend).toEqual(payload);
      expect(toast.info).not.toHaveBeenCalled();
    });

    it("未登录 → intent 被丢弃，store 状态零侧漏 + 弹钱包连接", async () => {
      const { toast } = await import("sonner");
      const { result } = renderHook(() => useChatOpener());

      act(() => result.current.openChatWithIntent(payload));

      const session = useAiChatSessionStore.getState();
      // 关键回归保护：未登录绝不能让 mode/pendingMatchId/pendingAutoSend 被写入
      // 否则 MarketsPageClient 订阅 mode === "dock" → 大黑列复现（本 PR 修复的 bug）
      expect(session.mode).toBe("closed");
      expect(session.pendingMatchId).toBeNull();
      expect(session.pendingAutoSend).toBeNull();
      expect(toast.info).toHaveBeenCalledOnce();
      expect(useWalletSheetStore.getState().connectTrigger).toBe(1);
      expect(useWalletSheetStore.getState().connectSource).toBe("ai-chat");
    });
  });

  describe("auth 状态变化 → 重新拿到的 opener 立即放行", () => {
    it("先未登录被拦截，状态翻 true 后再调可正常打开", () => {
      const { result, rerender } = renderHook(() => useChatOpener());

      act(() => result.current.openChat());
      expect(useAiChatSessionStore.getState().mode).toBe("closed");

      act(() => {
        useAuthStore.setState({ isAuthenticated: true });
      });
      rerender();

      act(() => result.current.openChat());
      expect(useAiChatSessionStore.getState().mode).toBe("dock");
    });
  });
});
