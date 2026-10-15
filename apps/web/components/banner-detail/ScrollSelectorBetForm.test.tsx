// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ScrollSelectorBetForm from "./ScrollSelectorBetForm";
import type { BannerItemDetail } from "@/types/home-banner";

const ITEM: BannerItemDetail = {
  name: "7 goals",
  odds: 32.6,
  market_id: 10002,
  selection_id: 20007,
  bet_mode: ["single"],
  extra: { goals_slot: 7, tvl: 20000 },
};

describe("ScrollSelectorBetForm", () => {
  afterEach(cleanup);

  it("renders Goals label and value", () => {
    render(<ScrollSelectorBetForm item={ITEM} goalsLabel="7" onBet={() => {}} />);
    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders Odds label and value", () => {
    render(<ScrollSelectorBetForm item={ITEM} goalsLabel="7" onBet={() => {}} />);
    expect(screen.getByText("Odds")).toBeInTheDocument();
    expect(screen.getByText("32.6x")).toBeInTheDocument();
  });

  it("calls onBet with the item when Bet is clicked", () => {
    const onBet = vi.fn();
    render(<ScrollSelectorBetForm item={ITEM} goalsLabel="7" onBet={onBet} />);
    fireEvent.click(screen.getByRole("button", { name: /bet/i }));
    expect(onBet).toHaveBeenCalledWith(ITEM, expect.anything());
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(
      <ScrollSelectorBetForm item={ITEM} goalsLabel="7" onBet={() => {}} />
    );
    expect(container.querySelector('[data-figma-node="3638:12287"]')).toBeInTheDocument();
  });

  it("accepts mobile prop without changing PC render output", () => {
    const { container } = render(
      <ScrollSelectorBetForm item={ITEM} goalsLabel="7" onBet={() => {}} mobile />
    );
    // PC layout node still present when mobile prop passed
    expect(container.querySelector('[data-figma-node="3638:12287"]')).toBeInTheDocument();
    expect(screen.getByText("Goals")).toBeInTheDocument();
  });
});
