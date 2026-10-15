// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ScrollSelectorPanel from "./ScrollSelectorPanel";
import type { BannerItemDetail } from "@/types/home-banner";

const makeItem = (slot: number, name?: string): BannerItemDetail => ({
  name: name ?? `${slot} goals`,
  odds: 3 + slot * 0.5,
  market_id: 10002,
  selection_id: 20000 + slot,
  bet_mode: ["single"],
  extra: { goals_slot: slot, tvl: 1000 },
});

const ITEMS: BannerItemDetail[] = [
  makeItem(0),
  makeItem(1),
  makeItem(2),
  makeItem(3),
  makeItem(4),
  makeItem(5),
  makeItem(6),
  makeItem(7),
  makeItem(8),
  makeItem(9, "8+ goals"),
];

describe("ScrollSelectorPanel", () => {
  afterEach(cleanup);

  it("uses double-column figma node by default (1168w)", () => {
    const { container } = render(<ScrollSelectorPanel items={ITEMS} onBet={() => {}} />);
    expect(container.querySelector('[data-figma-node="3602:11890"]')).toBeInTheDocument();
  });

  it("switches to compact figma node when compact=true (704w)", () => {
    const { container } = render(<ScrollSelectorPanel items={ITEMS} onBet={() => {}} compact />);
    expect(container.querySelector('[data-figma-node="3646:137236"]')).toBeInTheDocument();
  });

  it("defaults selected to goals_slot=7 (Figma default)", () => {
    render(<ScrollSelectorPanel items={ITEMS} onBet={() => {}} />);
    // ScrollSelectorBetForm 显示 goalsLabel = "7" 和 odds 计算结果（slot 7 → 6.5x）
    const goalsLabels = screen.getAllByText("7");
    expect(goalsLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders 10 selector dots (0-8 + 8+)", () => {
    const { container } = render(<ScrollSelectorPanel items={ITEMS} onBet={() => {}} />);
    // ScrollSelector 内部每档 1 个点 + 1 个标签按钮 = 20 个 button；至少
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(20);
  });

  it("relays Bet click to parent with current item", () => {
    const onBet = vi.fn();
    render(<ScrollSelectorPanel items={ITEMS} onBet={onBet} />);
    // BetPillButton 用 aria-label="Bet on {name}" 暴露可访问名
    fireEvent.click(screen.getByRole("button", { name: /^bet on/i }));
    expect(onBet).toHaveBeenCalledTimes(1);
    // 默认 slot=7，selection_id=20007
    expect(onBet.mock.calls[0][0].selection_id).toBe(20007);
  });

  it("returns null when items is empty", () => {
    const { container } = render(<ScrollSelectorPanel items={[]} onBet={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  // ── mobile=true 分支断言 ───────────────────────────────────────────────────
  it("mobile=true renders the H5 compact card (Figma 3702:70861)", () => {
    const { container } = render(<ScrollSelectorPanel items={ITEMS} onBet={() => {}} mobile />);
    expect(container.querySelector('[data-figma-node="3702:70861"]')).toBeInTheDocument();
  });

  it("mobile=true does NOT render PC figma nodes", () => {
    const { container } = render(<ScrollSelectorPanel items={ITEMS} onBet={() => {}} mobile />);
    expect(container.querySelector('[data-figma-node="3602:11890"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-figma-node="3646:137236"]')).not.toBeInTheDocument();
  });

  it("mobile=true shows Goals label and default slot value", () => {
    render(<ScrollSelectorPanel items={ITEMS} onBet={() => {}} mobile />);
    expect(screen.getByText("Goals")).toBeInTheDocument();
    // default slot=7 shown in input display
    const sevens = screen.getAllByText("7");
    expect(sevens.length).toBeGreaterThanOrEqual(1);
  });

  it("mobile=true Bet button calls onBet with current item", () => {
    const onBet = vi.fn();
    render(<ScrollSelectorPanel items={ITEMS} onBet={onBet} mobile />);
    fireEvent.click(screen.getByRole("button", { name: /^bet on/i }));
    expect(onBet).toHaveBeenCalledTimes(1);
    expect(onBet.mock.calls[0][0].selection_id).toBe(20007);
  });

  it("mobile=true renders 10 dot buttons + 10 number strip buttons", () => {
    const { container } = render(<ScrollSelectorPanel items={ITEMS} onBet={() => {}} mobile />);
    // 10 progress dots (aria-label="Select N") + 10 number strip buttons + 1 big Bet button = 21 total
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(21);
  });
});
