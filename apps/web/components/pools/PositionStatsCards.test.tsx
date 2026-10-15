// @vitest-environment jsdom
//
// TDD 验证 — 把 2026-05-19 LP 7h 仓位故事的 "4 张统计卡数值变化" 编码成断言。
// 任何断言失败 = PositionStatsCards 的派生逻辑与故事偏离。
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../messages/en.json";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import type { LpPositionData } from "@/hooks/useLpPositions";

// Mocks
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ address: "0xAlice" as const }),
}));

const useLpPositionsMock = vi.fn();
vi.mock("@/hooks/useLpPositions", () => ({
  useLpPositions: (...args: unknown[]) => useLpPositionsMock(...args),
}));

import PositionStatsCards from "./PositionStatsCards";

function renderCards() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PositionStatsCards />
    </NextIntlClientProvider>
  );
}

function makePosition(state: number, principalOdd = 1000n): LpPositionData {
  return {
    positionId: 1n,
    poolId: 0n,
    principal: principalOdd * 10n ** 18n,
    weight: 0n,
    unlockAt: 0n,
    planId: 0,
    state: state as LpPositionData["state"],
    poolType: "global",
  };
}

function valueFor(label: string): string {
  // 统计卡结构是：<p>label</p><p>value</p>，取 label 节点的下一个兄弟节点文本
  const labelNode = screen.getByText(label);
  const valueNode = labelNode.nextElementSibling;
  if (!valueNode) throw new Error(`stats card "${label}" has no value node`);
  return valueNode.textContent ?? "";
}

beforeEach(() => {
  useLpPositionsMock.mockReset();
});

describe("PositionStatsCards × 用户故事 4 张统计卡", () => {
  it("T0 添加 1000 ODD → 累计 1000 / 当前 1000 / 可提 0 / 活跃 1", () => {
    useLpPositionsMock.mockReturnValue({
      positions: [makePosition(LP_POSITION_STATE.Active)],
      isLoading: false,
    });
    renderCards();
    expect(valueFor("Total Deposited")).toBe("1000.00 ODD");
    expect(valueFor("Current Value")).toBe("1000.00 ODD");
    expect(valueFor("Ready to Withdraw")).toBe("0.00 ODD");
    expect(valueFor("Active Positions")).toBe("1");
  });

  it("T+7h 到期 Ready → 累计 1000 / 当前 1000 / 可提 0 / 活跃 1", () => {
    useLpPositionsMock.mockReturnValue({
      positions: [makePosition(LP_POSITION_STATE.Ready)],
      isLoading: false,
    });
    renderCards();
    expect(valueFor("Total Deposited")).toBe("1000.00 ODD");
    expect(valueFor("Current Value")).toBe("1000.00 ODD");
    expect(valueFor("Ready to Withdraw")).toBe("0.00 ODD");
    expect(valueFor("Active Positions")).toBe("1");
  });

  it("T+7h+30s Unbonding（redeem 后排队）→ 累计 1000 / 当前 1000 / 可提 0 / 活跃 1", () => {
    useLpPositionsMock.mockReturnValue({
      positions: [makePosition(LP_POSITION_STATE.Unbonding)],
      isLoading: false,
    });
    renderCards();
    expect(valueFor("Total Deposited")).toBe("1000.00 ODD");
    expect(valueFor("Current Value")).toBe("1000.00 ODD");
    expect(valueFor("Ready to Withdraw")).toBe("0.00 ODD");
    expect(valueFor("Active Positions")).toBe("1");
  });

  it("T+7h+E Withdrawable → 累计 1000 / 当前 1000 / 可提 1000 / 活跃 1", () => {
    useLpPositionsMock.mockReturnValue({
      positions: [makePosition(LP_POSITION_STATE.Withdrawable)],
      isLoading: false,
    });
    renderCards();
    expect(valueFor("Total Deposited")).toBe("1000.00 ODD");
    expect(valueFor("Current Value")).toBe("1000.00 ODD");
    // 关键：Withdrawable 计入 readyToWithdraw
    expect(valueFor("Ready to Withdraw")).toBe("1000.00 ODD");
    // 关键：Withdrawable 仍是"活跃"（钱在合约里没提走），用户故事明确
    expect(valueFor("Active Positions")).toBe("1");
  });

  it("Withdrawn 终态 → 累计 1000（历史保留）/ 当前 0 / 可提 0 / 活跃 0", () => {
    useLpPositionsMock.mockReturnValue({
      positions: [makePosition(LP_POSITION_STATE.Withdrawn)],
      isLoading: false,
    });
    renderCards();
    expect(valueFor("Total Deposited")).toBe("1000.00 ODD"); // 历史快照保留
    expect(valueFor("Current Value")).toBe("0.00 ODD"); // 资金已离开合约
    expect(valueFor("Ready to Withdraw")).toBe("0.00 ODD");
    expect(valueFor("Active Positions")).toBe("0"); // 已结束，不算活跃
  });

  it("Liquidated 终态 → 累计 1000 / 当前 0 / 可提 0 / 活跃 0", () => {
    useLpPositionsMock.mockReturnValue({
      positions: [makePosition(LP_POSITION_STATE.Liquidated)],
      isLoading: false,
    });
    renderCards();
    expect(valueFor("Total Deposited")).toBe("1000.00 ODD");
    expect(valueFor("Current Value")).toBe("0.00 ODD"); // 本金归零
    expect(valueFor("Ready to Withdraw")).toBe("0.00 ODD");
    expect(valueFor("Active Positions")).toBe("0");
  });

  it("混合 6 态 (各 1 个) → 累计 6000 / 当前 4000 / 可提 1000 / 活跃 4", () => {
    useLpPositionsMock.mockReturnValue({
      positions: [
        makePosition(LP_POSITION_STATE.Active),
        makePosition(LP_POSITION_STATE.Ready),
        makePosition(LP_POSITION_STATE.Unbonding),
        makePosition(LP_POSITION_STATE.Withdrawable),
        makePosition(LP_POSITION_STATE.Withdrawn),
        makePosition(LP_POSITION_STATE.Liquidated),
      ],
      isLoading: false,
    });
    renderCards();
    expect(valueFor("Total Deposited")).toBe("6000.00 ODD"); // 累计含所有 6 态
    expect(valueFor("Current Value")).toBe("4000.00 ODD"); // 排除 Withdrawn + Liquidated
    expect(valueFor("Ready to Withdraw")).toBe("1000.00 ODD");
    expect(valueFor("Active Positions")).toBe("4"); // 4 个非终态
  });

  it("isLoading=true → 全部显示 — 占位符", () => {
    useLpPositionsMock.mockReturnValue({ positions: [], isLoading: true });
    renderCards();
    expect(valueFor("Total Deposited")).toBe("—");
    expect(valueFor("Current Value")).toBe("—");
    expect(valueFor("Ready to Withdraw")).toBe("—");
    expect(valueFor("Active Positions")).toBe("—");
  });
});

describe("Redeem/Withdraw 成功后 — useLpPositions 必须自动刷新（DD-130 REST）", () => {
  // DD-130：useLpPositions 从 wagmi 扫链改为后端 REST 后，自动刷新机制改为
  // ① 写 hook 成功 bump lpRefetchStore → useLpPositions 订阅 bumpKey 立即 refetch
  // ② TanStack Query refetchInterval 轮询兜底（事件索引异步回填有秒级延迟）
  it("useLpPositions 订阅 lpRefetchStore.bumpKey 触发 refetch", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(path.join(process.cwd(), "hooks/useLpPositions.ts"), "utf8");
    expect(src).toMatch(/useLpRefetchStore\(\(s\) => s\.bumpKey\)/);
    expect(src).toMatch(/refetch\(\)/);
  });

  it("useLpPositions 配置 refetchInterval 轮询兜底", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(path.join(process.cwd(), "hooks/useLpPositions.ts"), "utf8");
    expect(src).toMatch(/refetchInterval:/);
  });
});
