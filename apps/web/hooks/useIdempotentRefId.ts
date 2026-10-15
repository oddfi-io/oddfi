import { useCallback, useMemo, useRef } from "react";

export interface IdempotentRefId {
  /** 取当前挂起的 ref_id；若无则生成新 uuid 并挂起 */
  getOrCreate: () => string;
  /** 收到明确响应后清空，使下一次 getOrCreate 生成新 uuid */
  clear: () => void;
}

/**
 * 业务幂等 key 生命周期 hook：
 * - 挂起期间多次 getOrCreate 返回同一 uuid（网络错/超时/自动 retry 复用）
 * - clear 后首次 getOrCreate 生成新 uuid（拿到明确响应后切换到下一笔）
 */
export function useIdempotentRefId(): IdempotentRefId {
  const pendingRef = useRef<string | null>(null);

  const getOrCreate = useCallback(() => {
    if (pendingRef.current) return pendingRef.current;
    const id = crypto.randomUUID();
    pendingRef.current = id;
    return id;
  }, []);

  const clear = useCallback(() => {
    pendingRef.current = null;
  }, []);

  return { getOrCreate, clear };
}

export interface KeyedIdempotentRefId {
  /** 取该 key 当前挂起的 ref；若无则生成新 uuid 并挂起到该 key */
  getOrCreate: (key: string) => string;
  /** 清单个 key 的 ref（该腿拿到明确成功响应后调用 → 下次同 key 生成新 uuid） */
  clear: (key: string) => void;
  /** 清空所有 key（整轮全成功 / 重置时调用） */
  clearAll: () => void;
}

/**
 * 多腿链上下注的 keyed 幂等 ref 生命周期 hook。
 *
 * 与 useIdempotentRefId 的单 uuid 不同：每个 selection 持有自己 keyed by `selection.id`
 * 的稳定 ref。`selection.id` 由 makeSelectionId 内容派生（`${fid}-${marketId}-${label}-${lineValue}`），
 * 同一选注无论重试几次、在 betslip 中位置（idx）如何漂移，getOrCreate(id) 恒返回同一 uuid。
 *
 * 配合后端 place_bet 幂等键 `sha256(userID | amount | nonce)`：
 * - 某腿失败重试：id 不变 → nonce 不变 → 后端/SDK 去重，不会双重下注（MAX allowance 下硬门控）。
 * - 某腿成功：调用方 clear(id) 释放该腿 ref → 同一选注若后续被重新加入并下注，生成新 uuid → 新注，
 *   避免"成功后不清 → 复用旧 nonce + 相同 amount → 被后端误判去重 → 静默不下单"。
 */
export function useKeyedIdempotentRefId(): KeyedIdempotentRefId {
  const mapRef = useRef<Map<string, string>>(new Map());

  const getOrCreate = useCallback((key: string) => {
    const existing = mapRef.current.get(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    mapRef.current.set(key, id);
    return id;
  }, []);

  const clear = useCallback((key: string) => {
    mapRef.current.delete(key);
  }, []);

  const clearAll = useCallback(() => {
    mapRef.current.clear();
  }, []);

  // useMemo 稳定返回对象的引用：本 hook 的消费方（BetSummary）会把它放进 useEffect deps，
  // 若每次 render 返回新对象字面量会致 effect 反复重跑（项目历史踩过的 deps 抖动坑）。
  return useMemo(() => ({ getOrCreate, clear, clearAll }), [getOrCreate, clear, clearAll]);
}
