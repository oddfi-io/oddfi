// P0 testing.md：stores/*.ts 核心 action 必测
import { describe, it, expect, beforeEach } from "vitest";
import { useLpRefetchStore } from "./lpRefetchStore";

describe("lpRefetchStore", () => {
  beforeEach(() => {
    useLpRefetchStore.setState({ bumpKey: 0, syncing: false });
  });

  it("初始 bumpKey 为 0", () => {
    expect(useLpRefetchStore.getState().bumpKey).toBe(0);
  });

  it("bump() 单调递增 bumpKey", () => {
    useLpRefetchStore.getState().bump();
    expect(useLpRefetchStore.getState().bumpKey).toBe(1);
    useLpRefetchStore.getState().bump();
    expect(useLpRefetchStore.getState().bumpKey).toBe(2);
  });

  it("多次 bump 不丢失任何一次（订阅者通过 bumpKey 变化触发 refetch）", () => {
    for (let i = 0; i < 10; i++) useLpRefetchStore.getState().bump();
    expect(useLpRefetchStore.getState().bumpKey).toBe(10);
  });

  it("初始 syncing 为 false", () => {
    expect(useLpRefetchStore.getState().syncing).toBe(false);
  });

  it("startSync() 置 syncing=true，stopSync() 置回 false", () => {
    useLpRefetchStore.getState().startSync();
    expect(useLpRefetchStore.getState().syncing).toBe(true);
    useLpRefetchStore.getState().stopSync();
    expect(useLpRefetchStore.getState().syncing).toBe(false);
  });

  it("startSync 不影响 bumpKey（两个信号独立）", () => {
    useLpRefetchStore.getState().bump();
    useLpRefetchStore.getState().startSync();
    expect(useLpRefetchStore.getState().bumpKey).toBe(1);
    expect(useLpRefetchStore.getState().syncing).toBe(true);
  });
});
