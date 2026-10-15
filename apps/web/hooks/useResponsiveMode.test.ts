// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ─── Mock useLayoutState ─────────────────────────────────────────────────

let mockLayoutState = "default";
let mockSidebarCollapsed = true;

vi.mock("@/stores/marketsLayoutStore", () => ({
  useLayoutState: () => mockLayoutState,
  useMarketsLayoutStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ sidebarCollapsed: mockSidebarCollapsed }),
  selectSidebarCollapsed: (s: Record<string, unknown>) => s.sidebarCollapsed,
}));

// ─── matchMedia helper ───────────────────────────────────────────────────

function setupMatchMedia(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      // 解析 min-width 查询
      const minMatch = query.match(/min-width:\s*(\d+)px/);
      const minWidth = minMatch ? parseInt(minMatch[1], 10) : 0;
      const matches = width >= minWidth;
      return {
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("useResponsiveMode", () => {
  beforeEach(() => {
    vi.resetModules();
    mockLayoutState = "default";
  });

  it('returns "h5" when width < 1024', async () => {
    setupMatchMedia(800);
    const { useResponsiveMode } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe("h5");
  });

  it('returns "standard" when width is 1024-1599', async () => {
    setupMatchMedia(1280);
    const { useResponsiveMode } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe("standard");
  });

  it('returns "wide" when width is 1600-1919', async () => {
    setupMatchMedia(1600);
    const { useResponsiveMode } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe("wide");
  });

  it('returns "ultra" when width >= 1920', async () => {
    setupMatchMedia(1920);
    const { useResponsiveMode } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useResponsiveMode());
    expect(result.current).toBe("ultra");
  });
});

describe("useIsTripleOdds", () => {
  beforeEach(() => {
    vi.resetModules();
    mockLayoutState = "default";
    mockSidebarCollapsed = true;
  });

  it("returns false for h5 mode regardless of layoutState", async () => {
    setupMatchMedia(800);
    mockLayoutState = "default";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    expect(result.current).toBe(false);
  });

  it("returns false for standard + default (mode-based)", async () => {
    setupMatchMedia(1280);
    mockLayoutState = "default";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    expect(result.current).toBe(false);
  });

  it('returns true for wide + "default" layoutState', async () => {
    setupMatchMedia(1600);
    mockLayoutState = "default";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    expect(result.current).toBe(true);
  });

  it('returns true for wide + "betslip-only" layoutState', async () => {
    setupMatchMedia(1600);
    mockLayoutState = "betslip-only";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    expect(result.current).toBe(true);
  });

  it('returns true for wide + "detail" layoutState', async () => {
    setupMatchMedia(1600);
    mockLayoutState = "detail";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    expect(result.current).toBe(true);
  });

  it('returns false for wide + "betslip" layoutState', async () => {
    setupMatchMedia(1600);
    mockLayoutState = "betslip";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    expect(result.current).toBe(false);
  });

  it("returns true for ultra + betslip (enough content width)", async () => {
    setupMatchMedia(1920);
    mockLayoutState = "betslip";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    expect(result.current).toBe(true);
  });

  // ── Dynamic width tests ─────────────────────────────────────────────

  it("returns true for standard + detail when viewport wide enough (1400)", async () => {
    setupMatchMedia(1400);
    mockLayoutState = "detail";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    // content = 1400 - 138 - 532 = 730 ≥ 720
    expect(result.current).toBe(true);
  });

  it("returns false for standard + detail when viewport too narrow (1200)", async () => {
    setupMatchMedia(1200);
    mockLayoutState = "detail";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    // content = 1200 - 138 - 532 = 530 < 720
    expect(result.current).toBe(false);
  });

  it("returns true for wide + betslip when viewport wide enough (1850)", async () => {
    setupMatchMedia(1850);
    mockLayoutState = "betslip";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    // content = 1850 - 138 - 984 = 728 ≥ 720
    expect(result.current).toBe(true);
  });

  it("returns true for standard + betslip-only when wide enough (1320)", async () => {
    setupMatchMedia(1320);
    mockLayoutState = "betslip-only";
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    // content = 1320 - 138 - 452 = 730 ≥ 720
    expect(result.current).toBe(true);
  });

  it("accounts for expanded sidebar (less content width)", async () => {
    setupMatchMedia(1600);
    mockLayoutState = "detail";
    mockSidebarCollapsed = false; // expanded = 200px
    const { useIsTripleOdds } = await import("./useResponsiveMode");
    const { result } = renderHook(() => useIsTripleOdds());
    // content = 1600 - 288 - 532 = 780 ≥ 720
    expect(result.current).toBe(true);
  });
});
