// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import PlayerOddsCard from "./PlayerOddsCard";
import type { BannerItemDetail } from "@/types/home-banner";

const ITEM: BannerItemDetail = {
  name: "Ronaldo",
  country_code: "PT",
  odds: 1.6,
  market_id: 10003,
  selection_id: 20003,
  bet_mode: ["single"],
  player_id: "p_ronaldo",
  avatar_key: "player_ronaldo",
  extra: { tvl: 100000 },
};

describe("PlayerOddsCard", () => {
  afterEach(cleanup);

  it("renders gold trophy for rank 1, name and odds", () => {
    render(<PlayerOddsCard rank={1} item={ITEM} onBet={() => {}} />);
    expect(screen.getByAltText(/Gold trophy/i)).toBeInTheDocument();
    expect(screen.getByText("Ronaldo")).toBeInTheDocument();
    expect(screen.getByText("1.6x")).toBeInTheDocument();
  });

  it("renders numeric rank for rank >= 4", () => {
    render(<PlayerOddsCard rank={4} item={ITEM} onBet={() => {}} />);
    expect(screen.queryByAltText(/trophy/i)).not.toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("calls onBet with the full item when Bet is clicked", () => {
    const onBet = vi.fn();
    render(<PlayerOddsCard rank={1} item={ITEM} onBet={onBet} />);
    fireEvent.click(screen.getByRole("button", { name: /bet/i }));
    expect(onBet).toHaveBeenCalledTimes(1);
    expect(onBet).toHaveBeenCalledWith(ITEM, expect.anything());
  });

  it("renders avatar fallback initial when no image", () => {
    render(<PlayerOddsCard rank={1} item={ITEM} onBet={() => {}} />);
    // "Ronaldo" 单词 → initial "R"
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("renders without country flag when country_code is missing", () => {
    const noFlag: BannerItemDetail = { ...ITEM, country_code: undefined };
    render(<PlayerOddsCard rank={1} item={noFlag} onBet={() => {}} />);
    expect(screen.getByText("Ronaldo")).toBeInTheDocument();
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(<PlayerOddsCard rank={1} item={ITEM} onBet={() => {}} />);
    expect(container.querySelector('[data-figma-node="3606:13492"]')).toBeInTheDocument();
  });

  describe("mobile=true (H5 compact 343×69)", () => {
    it("renders with H5 Figma node id", () => {
      const { container } = render(<PlayerOddsCard rank={1} item={ITEM} onBet={() => {}} mobile />);
      expect(container.querySelector('[data-figma-node="3647:139047"]')).toBeInTheDocument();
    });

    it("renders player name and odds in mobile layout", () => {
      render(<PlayerOddsCard rank={1} item={ITEM} onBet={() => {}} mobile />);
      expect(screen.getByText("Ronaldo")).toBeInTheDocument();
      expect(screen.getByText("1.6x")).toBeInTheDocument();
    });

    it("renders rank as plain number (no trophy) in mobile layout", () => {
      render(<PlayerOddsCard rank={1} item={ITEM} onBet={() => {}} mobile />);
      expect(screen.queryByAltText(/trophy/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText("Rank 1")).toBeInTheDocument();
    });

    it("calls onBet when Bet clicked in mobile layout", () => {
      const onBet = vi.fn();
      render(<PlayerOddsCard rank={1} item={ITEM} onBet={onBet} mobile />);
      fireEvent.click(screen.getByRole("button", { name: /bet/i }));
      expect(onBet).toHaveBeenCalledTimes(1);
      expect(onBet).toHaveBeenCalledWith(ITEM, expect.anything());
    });

    it("renders avatar initial fallback in mobile layout", () => {
      render(<PlayerOddsCard rank={1} item={ITEM} onBet={() => {}} mobile />);
      expect(screen.getByText("R")).toBeInTheDocument();
    });

    it("uses 14px medium name text in mobile layout", () => {
      render(<PlayerOddsCard rank={1} item={ITEM} onBet={() => {}} mobile />);
      const nameEl = screen.getByText("Ronaldo");
      expect(nameEl.className).toMatch(/text-\[14px\]/);
      expect(nameEl.className).toMatch(/font-medium/);
    });
  });
});
