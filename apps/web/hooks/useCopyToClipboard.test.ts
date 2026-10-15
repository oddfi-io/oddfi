// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCopyToClipboard } from "./useCopyToClipboard";

describe("useCopyToClipboard", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with copied=false", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);
  });

  it("sets copied=true after successful copy and resets after default 2s", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hello");
    });

    expect(writeTextMock).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(false);
  });

  it("honors custom resetMs", async () => {
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: 500 }));

    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it("returns false and keeps copied=false when clipboard rejects", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("denied"));
    const { result } = renderHook(() => useCopyToClipboard());

    let ok = true;
    await act(async () => {
      ok = await result.current.copy("hello");
    });
    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it("returns false for empty input without calling clipboard", async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    let ok = true;
    await act(async () => {
      ok = await result.current.copy("");
    });
    expect(ok).toBe(false);
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("debounces sequential copies — each call resets the timer", async () => {
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: 1000 }));

    await act(async () => {
      await result.current.copy("a");
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      await result.current.copy("b");
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });
});
