import { describe, it, expect, beforeEach } from "vitest";
import { useCashingOutBetsStore } from "./cashingOutBetsStore";

describe("cashingOutBetsStore (ENH-038)", () => {
  beforeEach(() => {
    useCashingOutBetsStore.getState().clear();
  });

  it("markCashingOut 记入 betId", () => {
    useCashingOutBetsStore.getState().markCashingOut("0xabc");
    expect(useCashingOutBetsStore.getState().byBetId).toEqual({ "0xabc": true });
  });

  it("markCashingOut 幂等 + trim（重复/空白不增量）", () => {
    const store = useCashingOutBetsStore.getState();
    store.markCashingOut("0xabc");
    const ref = useCashingOutBetsStore.getState().byBetId;
    store.markCashingOut("0xabc"); // 重复 → 引用不变
    expect(useCashingOutBetsStore.getState().byBetId).toBe(ref);
    store.markCashingOut("  "); // 空白 → no-op
    expect(useCashingOutBetsStore.getState().byBetId).toBe(ref);
    store.markCashingOut(" 0xdef "); // trim 后记入
    expect(useCashingOutBetsStore.getState().byBetId).toEqual({ "0xabc": true, "0xdef": true });
  });

  it("removeMany 清理离开 active / 后端接管的项；空/无命中为 no-op", () => {
    const store = useCashingOutBetsStore.getState();
    store.markCashingOut("0x1");
    store.markCashingOut("0x2");
    const ref = useCashingOutBetsStore.getState().byBetId;
    store.removeMany([]); // 空 → 引用不变
    expect(useCashingOutBetsStore.getState().byBetId).toBe(ref);
    store.removeMany(["0xZZ"]); // 无命中 → 引用不变
    expect(useCashingOutBetsStore.getState().byBetId).toBe(ref);
    store.removeMany(["0x1"]);
    expect(useCashingOutBetsStore.getState().byBetId).toEqual({ "0x2": true });
  });

  it("clear 清空", () => {
    useCashingOutBetsStore.getState().markCashingOut("0x1");
    useCashingOutBetsStore.getState().clear();
    expect(useCashingOutBetsStore.getState().byBetId).toEqual({});
  });
});
