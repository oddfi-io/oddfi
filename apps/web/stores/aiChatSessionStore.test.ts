// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAiChatSessionStore, type ChatMsg } from "./aiChatSessionStore";

vi.mock("sonner", () => ({
  toast: { info: vi.fn() },
}));

const STORAGE_KEY = "oddfi_ai_chat_session_v1";

function mkMsg(id: string, role: "user" | "assistant" = "user", content = "hi"): ChatMsg {
  return { id, role, content, createdAt: 0 };
}

describe("aiChatSessionStore", () => {
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
    });
    vi.clearAllMocks();
  });

  it("toggle flips between closed and lastMode (legacy alias)", () => {
    const s = useAiChatSessionStore.getState();
    s.toggle();
    expect(useAiChatSessionStore.getState().mode).toBe("dock");
    expect(useAiChatSessionStore.getState().isOpen).toBe(true);
    s.toggle();
    expect(useAiChatSessionStore.getState().mode).toBe("closed");
    expect(useAiChatSessionStore.getState().isOpen).toBe(false);
  });

  it("appendMessage persists to localStorage", () => {
    useAiChatSessionStore.getState().appendMessage(mkMsg("1"));
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).messages).toHaveLength(1);
  });

  it("appendMessage caps at 50 entries (FIFO)", () => {
    const { appendMessage } = useAiChatSessionStore.getState();
    for (let i = 0; i < 60; i++) appendMessage(mkMsg(`m${i}`));
    const { messages } = useAiChatSessionStore.getState();
    expect(messages).toHaveLength(50);
    expect(messages[0]!.id).toBe("m10");
    expect(messages.at(-1)!.id).toBe("m59");
  });

  it("updateMessage applies patch to matching id", () => {
    const s = useAiChatSessionStore.getState();
    s.appendMessage(mkMsg("u1"));
    s.updateMessage("u1", { content: "edited", status: "ok" });
    const msg = useAiChatSessionStore.getState().messages[0]!;
    expect(msg.content).toBe("edited");
    expect(msg.status).toBe("ok");
  });

  it("hydrate loads from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages: [mkMsg("seed", "user", "from disk")] })
    );
    useAiChatSessionStore.getState().hydrate();
    const s = useAiChatSessionStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.messages[0]?.content).toBe("from disk");
  });

  it("mode / isOpen / activeTab do not persist (only messages + lastMode)", () => {
    useAiChatSessionStore.getState().setOpen(true);
    // 触发任意持久化路径，确认 raw 中没有 isOpen / mode / activeTab
    useAiChatSessionStore.getState().appendMessage(mkMsg("p1"));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.isOpen).toBeUndefined();
    expect(raw.mode).toBeUndefined();
    expect(raw.activeTab).toBeUndefined();
    // lastMode 是允许持久化的字段
    expect(raw.lastMode).toBe("dock");
  });

  // ────────────────────────────────────────────────────────────────────
  // DD-108：dock / float / closed 状态机
  // ────────────────────────────────────────────────────────────────────

  describe("setMode (DD-108 §3.1)", () => {
    it("setMode('dock') 设置 mode + 同步 isOpen 镜像 + 更新 lastMode", () => {
      useAiChatSessionStore.getState().setMode("dock");
      const s = useAiChatSessionStore.getState();
      expect(s.mode).toBe("dock");
      expect(s.lastMode).toBe("dock");
      expect(s.isOpen).toBe(true);
    });

    it("setMode('float') 把 lastMode 切到 float（用户偏好）", () => {
      useAiChatSessionStore.getState().setMode("float");
      const s = useAiChatSessionStore.getState();
      expect(s.mode).toBe("float");
      expect(s.lastMode).toBe("float");
      expect(s.isOpen).toBe(true);
    });

    it("setMode('closed') 不动 lastMode（保留用户偏好），isOpen=false", () => {
      const s = useAiChatSessionStore.getState();
      s.setMode("float");
      s.setMode("closed");
      const after = useAiChatSessionStore.getState();
      expect(after.mode).toBe("closed");
      expect(after.lastMode).toBe("float"); // 关闭前的偏好保留
      expect(after.isOpen).toBe(false);
    });

    it("setMode('float') 持久化 lastMode 到 localStorage", () => {
      useAiChatSessionStore.getState().setMode("float");
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(raw.lastMode).toBe("float");
    });

    it("setMode('closed') 不重写 lastMode 持久化值", () => {
      const s = useAiChatSessionStore.getState();
      s.setMode("float"); // 写入 float
      s.setMode("closed"); // 不应该把 lastMode 重置回 dock
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(raw.lastMode).toBe("float");
    });
  });

  describe("open / close (DD-108 §3.1 语义糖)", () => {
    it("open() 默认恢复到 dock（首次访问）", () => {
      useAiChatSessionStore.getState().open();
      expect(useAiChatSessionStore.getState().mode).toBe("dock");
    });

    it("open() 恢复 lastMode（用户曾把 chat 拖到 float）", () => {
      const s = useAiChatSessionStore.getState();
      s.setMode("float");
      s.close();
      s.open();
      expect(useAiChatSessionStore.getState().mode).toBe("float");
    });

    it("close() 设置 mode=closed，不改 lastMode", () => {
      const s = useAiChatSessionStore.getState();
      s.setMode("dock");
      s.close();
      const after = useAiChatSessionStore.getState();
      expect(after.mode).toBe("closed");
      expect(after.lastMode).toBe("dock");
      expect(after.isOpen).toBe(false);
    });
  });

  describe("legacy aliases (DD-108 兼容老调用方)", () => {
    it("setOpen(true) 等价 open() — 恢复 lastMode", () => {
      const s = useAiChatSessionStore.getState();
      s.setMode("float");
      s.close();
      s.setOpen(true);
      expect(useAiChatSessionStore.getState().mode).toBe("float");
      expect(useAiChatSessionStore.getState().isOpen).toBe(true);
    });

    it("setOpen(false) 等价 close()", () => {
      const s = useAiChatSessionStore.getState();
      s.setMode("dock");
      s.setOpen(false);
      const after = useAiChatSessionStore.getState();
      expect(after.mode).toBe("closed");
      expect(after.isOpen).toBe(false);
    });
  });

  describe("hydrate · lastMode migration (DD-108 §3.2)", () => {
    it("旧 localStorage 无 lastMode 字段 → hydrate 回落 dock", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: [mkMsg("u1", "user", "hi")] }));
      useAiChatSessionStore.getState().hydrate();
      expect(useAiChatSessionStore.getState().lastMode).toBe("dock");
    });

    it("旧 localStorage 含 lastMode=float → hydrate 恢复偏好", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: [], lastMode: "float" }));
      useAiChatSessionStore.getState().hydrate();
      expect(useAiChatSessionStore.getState().lastMode).toBe("float");
    });

    it("非法 lastMode 值 → 安全回落 dock", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: [], lastMode: "garbage" }));
      useAiChatSessionStore.getState().hydrate();
      expect(useAiChatSessionStore.getState().lastMode).toBe("dock");
    });

    it("hydrate 后 mode 强制回到 closed（不持久化）", () => {
      useAiChatSessionStore.setState({ mode: "float", isOpen: true });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: [], lastMode: "float" }));
      useAiChatSessionStore.getState().hydrate();
      const after = useAiChatSessionStore.getState();
      expect(after.mode).toBe("closed");
      expect(after.isOpen).toBe(false);
      expect(after.lastMode).toBe("float"); // 偏好仍然从 storage 恢复
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // DD-107 v2: openWithIntent + isPlaceholder + pendingMatchId
  // ────────────────────────────────────────────────────────────────────

  describe("openWithIntent (DD-107 §3.4.2 + ENH-2)", () => {
    it("opens modal + chat tab + pendingMatchId + pendingAutoSend (no placeholder)", () => {
      useAiChatSessionStore.getState().openWithIntent({
        intent: "match-analysis",
        matchId: "12345",
        matchLabel: "Arsenal vs PSG",
      });
      const after = useAiChatSessionStore.getState();
      expect(after.isOpen).toBe(true);
      // DD-108：默认首次访问 lastMode='dock'，唤起应进入 dock 形态
      expect(after.mode).toBe("dock");
      expect(after.activeTab).toBe("chat");
      expect(after.pendingMatchId).toBe("12345");
      // ENH-2：不再 push placeholder，由 component useEffect 消费 pendingAutoSend
      expect(after.messages).toHaveLength(0);
      expect(after.pendingAutoSend).toEqual({
        intent: "match-analysis",
        matchId: "12345",
        matchLabel: "Arsenal vs PSG",
      });
    });

    it("resets non-empty messages + toasts info", async () => {
      const { toast } = await import("sonner");
      const s = useAiChatSessionStore.getState();
      s.appendMessage(mkMsg("u1", "user", "previous"));
      s.openWithIntent({
        intent: "match-analysis",
        matchId: "99",
        matchLabel: "X vs Y",
      });
      const after = useAiChatSessionStore.getState();
      // 旧消息被清，无 placeholder（由 component send 拼真实 user message）
      expect(after.messages).toHaveLength(0);
      expect(after.pendingAutoSend?.matchId).toBe("99");
      expect((toast.info as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });

    it("DD-108：lastMode='float' 时 openWithIntent 进入 float（恢复用户偏好）", () => {
      const s = useAiChatSessionStore.getState();
      s.setMode("float"); // 用户曾把 chat 拖出
      s.close();
      s.openWithIntent({
        intent: "match-analysis",
        matchId: "77",
        matchLabel: "X vs Y",
      });
      expect(useAiChatSessionStore.getState().mode).toBe("float");
      expect(useAiChatSessionStore.getState().isOpen).toBe(true);
    });

    it("REV-DD108-v1 C-2：openWithIntent 空消息路径走 setMode → lastMode 持久化", () => {
      const s = useAiChatSessionStore.getState();
      s.setMode("float"); // 偏好写盘
      s.close();
      localStorage.clear(); // 清盘验证 openWithIntent 本身是否触发写入
      s.openWithIntent({
        intent: "match-analysis",
        matchId: "5",
        matchLabel: "A vs B",
      });
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(raw.lastMode).toBe("float");
    });

    it("does not toast when messages were empty", async () => {
      const { toast } = await import("sonner");
      useAiChatSessionStore.getState().openWithIntent({
        intent: "match-analysis",
        matchId: "12",
        matchLabel: "X",
      });
      expect((toast.info as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    });
  });

  describe("consumePendingAutoSend (DD-107 ENH-2)", () => {
    it("clears pendingAutoSend", () => {
      const s = useAiChatSessionStore.getState();
      s.openWithIntent({
        intent: "match-analysis",
        matchId: "12345",
        matchLabel: "X vs Y",
      });
      expect(useAiChatSessionStore.getState().pendingAutoSend).not.toBeNull();
      useAiChatSessionStore.getState().consumePendingAutoSend();
      expect(useAiChatSessionStore.getState().pendingAutoSend).toBeNull();
    });
  });

  describe("hydrate · placeholder cleanup", () => {
    it("strips isPlaceholder messages from localStorage on hydrate", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages: [
            {
              id: "p1",
              role: "user",
              content: "请分析 X",
              createdAt: 1,
              status: "ok",
              isPlaceholder: true,
            },
            { id: "u1", role: "user", content: "hi", createdAt: 2, status: "ok" },
            { id: "a1", role: "assistant", content: "hello", createdAt: 3, status: "ok" },
          ],
        })
      );
      useAiChatSessionStore.getState().hydrate();
      const msgs = useAiChatSessionStore.getState().messages;
      expect(msgs).toHaveLength(2);
      expect(msgs.find((m) => m.isPlaceholder)).toBeUndefined();
      expect(msgs.map((m) => m.id)).toEqual(["u1", "a1"]);
    });

    it("clears pendingMatchId on hydrate", () => {
      useAiChatSessionStore.setState({ pendingMatchId: "stuck-id" });
      useAiChatSessionStore.getState().hydrate();
      expect(useAiChatSessionStore.getState().pendingMatchId).toBeNull();
    });

    it("clears pendingAutoSend on hydrate (避免刷新后重复触发 send)", () => {
      useAiChatSessionStore.setState({
        pendingAutoSend: { intent: "match-analysis", matchId: "1", matchLabel: "X vs Y" },
      });
      useAiChatSessionStore.getState().hydrate();
      expect(useAiChatSessionStore.getState().pendingAutoSend).toBeNull();
    });
  });

  describe("setPendingMatchId", () => {
    it("sets / clears pendingMatchId", () => {
      const s = useAiChatSessionStore.getState();
      s.setPendingMatchId("12345");
      expect(useAiChatSessionStore.getState().pendingMatchId).toBe("12345");
      s.setPendingMatchId(null);
      expect(useAiChatSessionStore.getState().pendingMatchId).toBeNull();
    });
  });

  describe("setDockSlotEl (回归：dock 模式跨路由恢复)", () => {
    it("注册 / 清理 dockSlotEl", () => {
      const el = document.createElement("div");
      useAiChatSessionStore.getState().setDockSlotEl(el);
      expect(useAiChatSessionStore.getState().dockSlotEl).toBe(el);
      useAiChatSessionStore.getState().setDockSlotEl(null);
      expect(useAiChatSessionStore.getState().dockSlotEl).toBeNull();
    });

    it("相等短路：同节点重复注册不写新引用（防订阅者无意义重渲染）", () => {
      const el = document.createElement("div");
      useAiChatSessionStore.getState().setDockSlotEl(el);
      const snapshot1 = useAiChatSessionStore.getState();
      useAiChatSessionStore.getState().setDockSlotEl(el);
      const snapshot2 = useAiChatSessionStore.getState();
      // 同一节点不应触发 set → state 引用稳定
      expect(snapshot1.dockSlotEl).toBe(snapshot2.dockSlotEl);
    });

    it("hydrate 后 dockSlotEl 清零（非持久化字段）", () => {
      useAiChatSessionStore.setState({ dockSlotEl: document.createElement("div") });
      useAiChatSessionStore.getState().hydrate();
      expect(useAiChatSessionStore.getState().dockSlotEl).toBeNull();
    });
  });
});
