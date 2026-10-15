// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useIdempotentRefId, useKeyedIdempotentRefId } from "./useIdempotentRefId";

// RFC 4122 UUID v4（crypto.randomUUID 产出格式）
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("useIdempotentRefId", () => {
  it("首次 getOrCreate 生成 RFC 4122 v4 uuid", () => {
    const { result } = renderHook(() => useIdempotentRefId());
    let id = "";
    act(() => {
      id = result.current.getOrCreate();
    });
    expect(id).toMatch(UUID_V4);
  });

  it("挂起期间多次 getOrCreate 返回同一 uuid（复用）", () => {
    const { result } = renderHook(() => useIdempotentRefId());
    let a = "";
    let b = "";
    act(() => {
      a = result.current.getOrCreate();
      b = result.current.getOrCreate();
    });
    expect(a).toBe(b);
  });

  it("clear 后再次 getOrCreate 生成新的 uuid（切换下一笔）", () => {
    const { result } = renderHook(() => useIdempotentRefId());
    let a = "";
    let b = "";
    act(() => {
      a = result.current.getOrCreate();
    });
    act(() => {
      result.current.clear();
    });
    act(() => {
      b = result.current.getOrCreate();
    });
    expect(a).not.toBe(b);
    expect(b).toMatch(UUID_V4);
  });

  it("未挂起时 clear 幂等，不影响后续 getOrCreate", () => {
    const { result } = renderHook(() => useIdempotentRefId());
    act(() => {
      result.current.clear();
      result.current.clear();
    });
    let id = "";
    act(() => {
      id = result.current.getOrCreate();
    });
    expect(id).toMatch(UUID_V4);
  });

  it("rerender 不会重置挂起的 ref_id（useRef 语义）", () => {
    const { result, rerender } = renderHook(() => useIdempotentRefId());
    let a = "";
    let b = "";
    act(() => {
      a = result.current.getOrCreate();
    });
    rerender();
    act(() => {
      b = result.current.getOrCreate();
    });
    expect(a).toBe(b);
  });

  it("连续三笔成功场景：每次 clear 后都是不同的 uuid", () => {
    const { result } = renderHook(() => useIdempotentRefId());
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      act(() => {
        ids.push(result.current.getOrCreate());
      });
      act(() => {
        result.current.clear();
      });
    }
    expect(new Set(ids).size).toBe(3);
  });
});

describe("useKeyedIdempotentRefId", () => {
  it("首次 getOrCreate(key) 生成 RFC 4122 v4 uuid", () => {
    const { result } = renderHook(() => useKeyedIdempotentRefId());
    let id = "";
    act(() => {
      id = result.current.getOrCreate("100-1-1");
    });
    expect(id).toMatch(UUID_V4);
  });

  it("同一 key 多次 getOrCreate 返回同一 uuid（失败腿重试复用）", () => {
    const { result } = renderHook(() => useKeyedIdempotentRefId());
    let a = "";
    let b = "";
    act(() => {
      a = result.current.getOrCreate("100-1-1");
      b = result.current.getOrCreate("100-1-1");
    });
    expect(a).toBe(b);
  });

  it("不同 key 之间互相独立，各自唯一 uuid", () => {
    const { result } = renderHook(() => useKeyedIdempotentRefId());
    let a = "";
    let b = "";
    act(() => {
      a = result.current.getOrCreate("100-1-1");
      b = result.current.getOrCreate("200-2-2");
    });
    expect(a).not.toBe(b);
  });

  it("核心场景：成功腿被清 + 失败腿 idx 漂移，失败腿 nonce 恒定", () => {
    // 模拟 A(成功) / B(失败) 两腿，重试时 A 已移除、B 的 idx 从 1 漂到 0
    const { result } = renderHook(() => useKeyedIdempotentRefId());
    let nonceA = "";
    let nonceBFirst = "";
    let nonceBRetry = "";
    // 首轮：A idx0、B idx1
    act(() => {
      nonceA = result.current.getOrCreate("A-1-1");
      nonceBFirst = result.current.getOrCreate("B-1-1");
    });
    // A 成功 → 调用方清 A 的 ref；B 失败保留
    act(() => {
      result.current.clear("A-1-1");
    });
    // 重试：betslip 仅剩 B（现 idx0），按 selection.id 取 ref
    act(() => {
      nonceBRetry = result.current.getOrCreate("B-1-1");
    });
    expect(nonceBRetry).toBe(nonceBFirst); // ★ 失败腿重试 nonce 完全一致 → 后端去重
    expect(nonceA).not.toBe(nonceBFirst);
  });

  it("成功腿 clear 后同 key 再 getOrCreate 生成新 uuid（重新下注=新注）", () => {
    const { result } = renderHook(() => useKeyedIdempotentRefId());
    let a = "";
    let b = "";
    act(() => {
      a = result.current.getOrCreate("100-1-1");
    });
    act(() => {
      result.current.clear("100-1-1");
    });
    act(() => {
      b = result.current.getOrCreate("100-1-1");
    });
    expect(a).not.toBe(b);
    expect(b).toMatch(UUID_V4);
  });

  it("clearAll 清空所有 key，后续同 key 全部生成新 uuid", () => {
    const { result } = renderHook(() => useKeyedIdempotentRefId());
    let a1 = "";
    let a2 = "";
    act(() => {
      a1 = result.current.getOrCreate("100-1-1");
      result.current.getOrCreate("200-2-2");
    });
    act(() => {
      result.current.clearAll();
    });
    act(() => {
      a2 = result.current.getOrCreate("100-1-1");
    });
    expect(a2).not.toBe(a1);
  });

  it("rerender 不重置已挂起的 keyed ref（useRef 语义）", () => {
    const { result, rerender } = renderHook(() => useKeyedIdempotentRefId());
    let a = "";
    let b = "";
    act(() => {
      a = result.current.getOrCreate("100-1-1");
    });
    rerender();
    act(() => {
      b = result.current.getOrCreate("100-1-1");
    });
    expect(a).toBe(b);
  });
});
