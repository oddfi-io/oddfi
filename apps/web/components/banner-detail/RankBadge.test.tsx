// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RankBadge from "./RankBadge";

describe("RankBadge", () => {
  afterEach(cleanup);

  it.each([
    [1, "rank-medal-1", "Gold trophy (rank 1)"],
    [2, "rank-medal-2", "Silver trophy (rank 2)"],
    [3, "rank-medal-3", "Bronze trophy (rank 3)"],
  ])("rank %d renders trophy SVG with correct alt", (rank, slug, alt) => {
    render(<RankBadge rank={rank} />);
    const img = screen.getByAltText(alt) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img.src)).toContain(slug);
  });

  it.each([1, 2, 3])("rank %d overlays the digit on the trophy", (rank) => {
    render(<RankBadge rank={rank} />);
    expect(screen.getByAltText(new RegExp(`rank ${rank}`, "i"))).toBeInTheDocument();
    expect(screen.getByText(String(rank))).toBeInTheDocument();
  });

  it.each([4, 5, 10, 99])("rank %d renders as numeric (no trophy)", (rank) => {
    render(<RankBadge rank={rank} />);
    expect(screen.queryByAltText(/trophy/i)).not.toBeInTheDocument();
    expect(screen.getByText(String(rank))).toBeInTheDocument();
  });

  it("respects custom size for trophy", () => {
    render(<RankBadge rank={1} size={48} />);
    const img = screen.getByAltText(/Gold trophy/) as HTMLImageElement;
    expect(img.getAttribute("width")).toBe("48");
    expect(img.getAttribute("height")).toBe("48");
  });
});
