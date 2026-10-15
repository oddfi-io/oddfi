import { renderHook, act } from "@testing-library/react";
import { useIdempotencyKey } from "./useIdempotencyKey";

// UUID v4 shape: 8-4-4-4-12 hex chars separated by dashes (36 chars total)
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("useIdempotencyKey", () => {
  it("returns a non-empty key with UUID v4 shape on initial render", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    expect(result.current.key).toMatch(UUID_V4_RE);
  });

  it("rotate() returns a value different from the previous key", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const before = result.current.key;

    let returned: string | undefined;
    act(() => {
      returned = result.current.rotate();
    });

    expect(returned).not.toBe(before);
    expect(returned).toMatch(UUID_V4_RE);
  });

  it("result.current.key is updated synchronously after rotate()", () => {
    const { result } = renderHook(() => useIdempotencyKey());

    let returned: string | undefined;
    act(() => {
      returned = result.current.rotate();
    });

    expect(result.current.key).toBe(returned);
  });

  it("multiple rotate() calls all produce distinct keys", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const keys = new Set<string>();
    keys.add(result.current.key);

    for (let i = 0; i < 5; i++) {
      act(() => {
        keys.add(result.current.rotate());
      });
    }

    // 1 initial + 5 rotations = 6 unique keys
    expect(keys.size).toBe(6);
  });

  it("key is stable across re-renders when rotate() is not called", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const initial = result.current.key;

    rerender();
    rerender();
    rerender();

    expect(result.current.key).toBe(initial);
  });

  it("respects initial param: key equals the provided value", () => {
    const pinned = "00000000-0000-4000-8000-000000000001";
    const { result } = renderHook(() => useIdempotencyKey(pinned));
    expect(result.current.key).toBe(pinned);
  });
});
