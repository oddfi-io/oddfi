// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import CountryOddsCard from "./CountryOddsCard";
import type { BannerItemDetail } from "@/types/home-banner";

const ITEM: BannerItemDetail = {
  name: "Spain",
  country_code: "ES",
  odds: 5,
  implied_probability: 20,
  market_id: 10001,
  selection_id: 20002,
  bet_mode: ["single"],
  extra: { heat: 5, tvl: 850000 },
};

describe("CountryOddsCard", () => {
  afterEach(cleanup);

  it("renders gold trophy for rank 1, name and odds", () => {
    render(<CountryOddsCard rank={1} item={ITEM} onBet={() => {}} />);
    expect(screen.getByAltText(/Gold trophy/i)).toBeInTheDocument();
    expect(screen.getByText("Spain")).toBeInTheDocument();
    expect(screen.getByText("5x")).toBeInTheDocument();
  });

  it("renders numeric rank for rank >= 4", () => {
    render(<CountryOddsCard rank={4} item={ITEM} onBet={() => {}} />);
    expect(screen.queryByAltText(/trophy/i)).not.toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("calls onBet with the full item when Bet is clicked", () => {
    const onBet = vi.fn();
    render(<CountryOddsCard rank={1} item={ITEM} onBet={onBet} />);
    fireEvent.click(screen.getByRole("button", { name: /bet/i }));
    expect(onBet).toHaveBeenCalledTimes(1);
    expect(onBet).toHaveBeenCalledWith(ITEM, expect.anything());
  });

  it("renders without flag when country_code is missing", () => {
    const noFlagItem: BannerItemDetail = { ...ITEM, country_code: undefined };
    render(<CountryOddsCard rank={1} item={noFlagItem} onBet={() => {}} />);
    expect(screen.getByText("Spain")).toBeInTheDocument();
  });

  it("preserves Figma node id for traceability", () => {
    const { container } = render(<CountryOddsCard rank={1} item={ITEM} onBet={() => {}} />);
    expect(container.querySelector('[data-figma-node="3550:73361"]')).toBeInTheDocument();
  });

  describe("mobile=true (H5 compact 343×59)", () => {
    it("renders with H5 Figma node id", () => {
      const { container } = render(
        <CountryOddsCard rank={1} item={ITEM} onBet={() => {}} mobile />
      );
      expect(container.querySelector('[data-figma-node="3646:135980"]')).toBeInTheDocument();
    });

    it("renders country name and odds in mobile layout", () => {
      render(<CountryOddsCard rank={2} item={ITEM} onBet={() => {}} mobile />);
      expect(screen.getByText("Spain")).toBeInTheDocument();
      expect(screen.getByText("5x")).toBeInTheDocument();
    });

    it("renders rank number in mobile layout", () => {
      render(<CountryOddsCard rank={4} item={ITEM} onBet={() => {}} mobile />);
      expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("calls onBet when Bet clicked in mobile layout", () => {
      const onBet = vi.fn();
      render(<CountryOddsCard rank={1} item={ITEM} onBet={onBet} mobile />);
      fireEvent.click(screen.getByRole("button", { name: /bet/i }));
      expect(onBet).toHaveBeenCalledTimes(1);
      expect(onBet).toHaveBeenCalledWith(ITEM, expect.anything());
    });

    it("uses 14px name text (Body Bold) in mobile layout", () => {
      render(<CountryOddsCard rank={1} item={ITEM} onBet={() => {}} mobile />);
      const nameEl = screen.getByText("Spain");
      expect(nameEl.className).toMatch(/text-\[14px\]/);
    });
  });
});
