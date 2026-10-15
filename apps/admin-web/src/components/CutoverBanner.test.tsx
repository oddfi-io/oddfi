import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Hoist mock ────────────────────────────────────────────────────────────────
const { mockUseCustom } = vi.hoisted(() => ({
  mockUseCustom: vi.fn(),
}));

vi.mock("@refinedev/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@refinedev/core")>();
  return { ...actual, useCustom: mockUseCustom };
});

// Import AFTER mocking
import { CutoverBanner } from "./CutoverBanner";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── helpers ───────────────────────────────────────────────────────────────────

function setConfig(minSubscribeUsd: string | undefined) {
  mockUseCustom.mockReturnValue({
    result: minSubscribeUsd !== undefined ? { data: { minSubscribeUsd } } : undefined,
  });
}

// ── banner visible ────────────────────────────────────────────────────────────

describe("CutoverBanner — banner visible", () => {
  it('shows banner when minSubscribeUsd is "0.01"', () => {
    setConfig("0.01");
    render(<CutoverBanner />);
    expect(screen.getByText(/准生产配置/)).toBeInTheDocument();
  });

  it('shows banner when minSubscribeUsd is "0.010000" (decimal trailing zeros)', () => {
    setConfig("0.010000");
    render(<CutoverBanner />);
    expect(screen.getByText(/准生产配置/)).toBeInTheDocument();
  });

  it('shows banner when minSubscribeUsd is "0.0100" (2 trailing zeros)', () => {
    setConfig("0.0100");
    render(<CutoverBanner />);
    expect(screen.getByText(/准生产配置/)).toBeInTheDocument();
  });
});

// ── banner hidden ─────────────────────────────────────────────────────────────

describe("CutoverBanner — banner hidden", () => {
  it('returns null when minSubscribeUsd is "10"', () => {
    setConfig("10");
    const { container } = render(<CutoverBanner />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/准生产配置/)).not.toBeInTheDocument();
  });

  it('returns null when minSubscribeUsd is "1000"', () => {
    setConfig("1000");
    const { container } = render(<CutoverBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when minSubscribeUsd is "0.001" (smaller but not 0.01)', () => {
    setConfig("0.001");
    const { container } = render(<CutoverBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when minSubscribeUsd is "0.1" (larger than 0.01)', () => {
    setConfig("0.1");
    const { container } = render(<CutoverBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when minSubscribeUsd is "0.010001"', () => {
    setConfig("0.010001");
    const { container } = render(<CutoverBanner />);
    expect(container.firstChild).toBeNull();
  });
});

// ── loading / missing data ────────────────────────────────────────────────────

describe("CutoverBanner — loading / missing data", () => {
  it("returns null when result is undefined (loading state)", () => {
    mockUseCustom.mockReturnValue({ result: undefined });
    const { container } = render(<CutoverBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when result.data is undefined", () => {
    mockUseCustom.mockReturnValue({ result: { data: undefined } });
    const { container } = render(<CutoverBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when minSubscribeUsd is empty string (parse guard)", () => {
    setConfig("");
    const { container } = render(<CutoverBanner />);
    // Decimal("") throws → isCutover=false → null
    expect(container.firstChild).toBeNull();
  });

  it("returns null when minSubscribeUsd is non-numeric string", () => {
    setConfig("N/A");
    const { container } = render(<CutoverBanner />);
    expect(container.firstChild).toBeNull();
  });
});
