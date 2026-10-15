// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── vi.hoisted：确保 mock 变量在 vi.mock 工厂函数执行前已初始化 ──────────────

const { mockUseWalletClient, mockGetRelayClient } = vi.hoisted(() => ({
  mockUseWalletClient: vi.fn(() => ({ data: null })),
  mockGetRelayClient: vi.fn(),
}));

vi.mock("wagmi", () => ({ useWalletClient: mockUseWalletClient }));
vi.mock("@/lib/relay/client", () => ({ getRelayClient: mockGetRelayClient }));

import { useRelayExecute } from "./useRelayExecute";
import type { Execute } from "@relayprotocol/relay-sdk";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_WALLET = { type: "walletClient" };

const MOCK_QUOTE = {
  steps: [{ id: "approve" }, { id: "bridge" }],
} as unknown as Execute;

const MOCK_STEPS = [{ id: "approve" }, { id: "bridge" }];

// ── Helper：构造 mock relay client ────────────────────────────────────────────

type ProgressData = {
  currentStep?: { id: string };
  txHashes?: { txHash: string }[];
  steps?: { id: string }[];
  error?: unknown;
};

function makeClient(progressEvents: ProgressData[] = []) {
  return {
    actions: {
      execute: vi.fn(async ({ onProgress }: { onProgress: (d: ProgressData) => void }) => {
        for (const event of progressEvents) onProgress(event);
      }),
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useRelayExecute", () => {
  beforeEach(() => {
    mockUseWalletClient.mockReturnValue({ data: null });
    mockGetRelayClient.mockReset();
  });

  it("初始状态为 idle", () => {
    const { result } = renderHook(() => useRelayExecute());
    expect(result.current.state).toEqual({
      status: "idle",
      currentStep: 0,
      totalSteps: 0,
      txHashes: [],
    });
  });

  it("execute() — 钱包未连接 → failed + errorMessage", async () => {
    const { result } = renderHook(() => useRelayExecute());
    await act(async () => {
      await result.current.execute(MOCK_QUOTE);
    });
    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.errorMessage).toBe("Wallet not connected");
  });

  it("execute() — 无 onProgress 事件，正常完成 → completed", async () => {
    mockUseWalletClient.mockReturnValue({ data: MOCK_WALLET as any });
    mockGetRelayClient.mockResolvedValue(makeClient());

    const { result } = renderHook(() => useRelayExecute());
    await act(async () => {
      await result.current.execute(MOCK_QUOTE);
    });
    expect(result.current.state.status).toBe("completed");
    expect(result.current.state.totalSteps).toBe(2); // from MOCK_QUOTE.steps
  });

  it("onProgress — 无 txHash → status 为 signing 后完成 → completed", async () => {
    mockUseWalletClient.mockReturnValue({ data: MOCK_WALLET as any });
    mockGetRelayClient.mockResolvedValue(
      makeClient([{ currentStep: { id: "approve" }, txHashes: [], steps: MOCK_STEPS }])
    );

    const { result } = renderHook(() => useRelayExecute());
    await act(async () => {
      await result.current.execute(MOCK_QUOTE);
    });
    // execute 已 resolve → completed；onProgress 阶段走过 signing
    expect(result.current.state.status).toBe("completed");
    expect(result.current.state.txHashes).toEqual([]);
  });

  it("onProgress — 有 txHash → 收集哈希 + 最终 completed", async () => {
    mockUseWalletClient.mockReturnValue({ data: MOCK_WALLET as any });
    mockGetRelayClient.mockResolvedValue(
      makeClient([
        { currentStep: { id: "approve" }, txHashes: [], steps: MOCK_STEPS },
        {
          currentStep: { id: "bridge" },
          txHashes: [{ txHash: "0xabc" }, { txHash: "0xdef" }],
          steps: MOCK_STEPS,
        },
      ])
    );

    const { result } = renderHook(() => useRelayExecute());
    await act(async () => {
      await result.current.execute(MOCK_QUOTE);
    });
    expect(result.current.state.status).toBe("completed");
    expect(result.current.state.txHashes).toContain("0xabc");
    expect(result.current.state.txHashes).toContain("0xdef");
  });

  it("onProgress — data.error → failed（不被后续 completed 覆盖）", async () => {
    mockUseWalletClient.mockReturnValue({ data: MOCK_WALLET as any });
    mockGetRelayClient.mockResolvedValue(
      makeClient([{ error: new Error("Solver timeout"), txHashes: [], steps: [] }])
    );

    const { result } = renderHook(() => useRelayExecute());
    await act(async () => {
      await result.current.execute(MOCK_QUOTE);
    });
    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.errorMessage).toMatch(/Refund initiated/i);
  });

  it("execute() throw → failed + errorMessage 截取首行", async () => {
    mockUseWalletClient.mockReturnValue({ data: MOCK_WALLET as any });
    mockGetRelayClient.mockResolvedValue({
      actions: { execute: vi.fn().mockRejectedValue(new Error("Network error\ndetail")) },
    });

    const { result } = renderHook(() => useRelayExecute());
    await act(async () => {
      await result.current.execute(MOCK_QUOTE);
    });
    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.errorMessage).toBe("Network error");
  });

  it("reset() → 恢复 idle", async () => {
    mockUseWalletClient.mockReturnValue({ data: MOCK_WALLET as any });
    mockGetRelayClient.mockResolvedValue({
      actions: { execute: vi.fn().mockRejectedValue(new Error("err")) },
    });

    const { result } = renderHook(() => useRelayExecute());
    await act(async () => {
      await result.current.execute(MOCK_QUOTE);
    });
    expect(result.current.state.status).toBe("failed");

    act(() => {
      result.current.reset();
    });
    expect(result.current.state).toEqual({
      status: "idle",
      currentStep: 0,
      totalSteps: 0,
      txHashes: [],
    });
  });

  it("currentStep 跟随 steps 数组下标更新", async () => {
    mockUseWalletClient.mockReturnValue({ data: MOCK_WALLET as any });

    const client = {
      actions: {
        execute: vi.fn(async ({ onProgress }: { onProgress: (d: ProgressData) => void }) => {
          onProgress({ currentStep: { id: "approve" }, txHashes: [], steps: MOCK_STEPS });
          onProgress({
            currentStep: { id: "bridge" },
            txHashes: [{ txHash: "0x1" }],
            steps: MOCK_STEPS,
          });
        }),
      },
    };
    mockGetRelayClient.mockResolvedValue(client);

    const { result } = renderHook(() => useRelayExecute());
    await act(async () => {
      await result.current.execute(MOCK_QUOTE);
    });

    // 最终完成后 currentStep = 1（bridge 是 steps[1]）
    expect(result.current.state.currentStep).toBe(1);
    expect(result.current.state.totalSteps).toBe(2);
  });
});
