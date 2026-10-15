// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTxLockStore, useIsTxLockedByOther } from "./txLockStore";

describe("txLockStore", () => {
  beforeEach(() => {
    useTxLockStore.getState().unlock();
  });

  it("initial state is unlocked", () => {
    const { isLocked, lockedBy } = useTxLockStore.getState();
    expect(isLocked).toBe(false);
    expect(lockedBy).toBeNull();
  });

  it("lock(kind) sets isLocked=true with lockedBy", () => {
    useTxLockStore.getState().lock("stake");
    expect(useTxLockStore.getState().isLocked).toBe(true);
    expect(useTxLockStore.getState().lockedBy).toBe("stake");
  });

  it("unlock() resets state", () => {
    useTxLockStore.getState().lock("unstake");
    useTxLockStore.getState().unlock();
    expect(useTxLockStore.getState().isLocked).toBe(false);
    expect(useTxLockStore.getState().lockedBy).toBeNull();
  });

  it("re-lock with different kind overwrites lockedBy", () => {
    useTxLockStore.getState().lock("stake");
    useTxLockStore.getState().lock("earlyUnstake");
    expect(useTxLockStore.getState().lockedBy).toBe("earlyUnstake");
  });

  describe("useIsTxLockedByOther", () => {
    it("returns false when unlocked", () => {
      const { result } = renderHook(() => useIsTxLockedByOther("stake"));
      expect(result.current).toBe(false);
    });

    it("returns false when locked by self", () => {
      useTxLockStore.getState().lock("stake");
      const { result } = renderHook(() => useIsTxLockedByOther("stake"));
      expect(result.current).toBe(false);
    });

    it("returns true when locked by another kind", () => {
      useTxLockStore.getState().lock("stake");
      const { result } = renderHook(() => useIsTxLockedByOther("unstake"));
      expect(result.current).toBe(true);
    });
  });
});
