import { beforeEach, describe, expect, it, vi } from "vitest";

import { onchainOddsStore, type OnchainOddsServerData } from "./onchainOddsStore";

const MID = "0x020368b0e5316baa9a48b3e7c77872b0e7ca0ffcfd2f18319ebea5b25e762164";

function payload(over: Partial<OnchainOddsServerData> = {}): OnchainOddsServerData {
  return {
    baseOdds: ["22900", "32800", "32400"],
    quotedOdds: ["22900", "32800", "32400"],
    signal: 0,
    quoteVersion: 21,
    updatedAt: 1779371522,
    ...over,
  };
}

describe("onchainOddsStore", () => {
  beforeEach(() => {
    onchainOddsStore.getState().reset();
  });

  describe("applyUpdate", () => {
    it("stores normalized marketId snapshot on first push", () => {
      onchainOddsStore.getState().applyUpdate(MID, payload());
      const snap = onchainOddsStore.getState().byMarketId[MID];
      expect(snap).toBeDefined();
      expect(snap.marketId).toBe(MID);
      expect(snap.quoteVersion).toBe(21);
      expect(snap.signal).toBe(0);
      expect(snap.previousQuotedOdds).toBeUndefined(); // first push: no flash
      expect(snap.stale).toBe(false);
    });

    it("normalizes uppercase marketId before storing", () => {
      const upper = "0x" + MID.slice(2).toUpperCase();
      onchainOddsStore.getState().applyUpdate(upper, payload());
      expect(onchainOddsStore.getState().byMarketId[MID]).toBeDefined();
      expect(onchainOddsStore.getState().byMarketId[upper]).toBeUndefined();
    });

    it("moves previous quotedOdds into previousQuotedOdds on monotonic update", () => {
      const store = onchainOddsStore.getState();
      store.applyUpdate(
        MID,
        payload({ quoteVersion: 21, quotedOdds: ["22900", "32800", "32400"] })
      );
      store.applyUpdate(
        MID,
        payload({ quoteVersion: 22, quotedOdds: ["23000", "32500", "32400"] })
      );
      const snap = onchainOddsStore.getState().byMarketId[MID];
      expect(snap.quoteVersion).toBe(22);
      expect(snap.quotedOdds).toEqual(["23000", "32500", "32400"]);
      expect(snap.previousQuotedOdds).toEqual(["22900", "32800", "32400"]);
    });

    it("drops out-of-order quoteVersion (smaller)", () => {
      const store = onchainOddsStore.getState();
      store.applyUpdate(MID, payload({ quoteVersion: 22 }));
      store.applyUpdate(MID, payload({ quoteVersion: 21 }));
      expect(onchainOddsStore.getState().byMarketId[MID].quoteVersion).toBe(22);
    });

    it("drops duplicate quoteVersion (equal)", () => {
      const store = onchainOddsStore.getState();
      store.applyUpdate(MID, payload({ quoteVersion: 21, quotedOdds: ["1", "2", "3"] }));
      store.applyUpdate(MID, payload({ quoteVersion: 21, quotedOdds: ["9", "9", "9"] }));
      expect(onchainOddsStore.getState().byMarketId[MID].quotedOdds).toEqual(["1", "2", "3"]);
    });

    it("clears stale flag when fresh update arrives", () => {
      const store = onchainOddsStore.getState();
      store.applyUpdate(MID, payload({ quoteVersion: 21 }));
      store.markAllStale();
      expect(onchainOddsStore.getState().byMarketId[MID].stale).toBe(true);
      store.applyUpdate(MID, payload({ quoteVersion: 22 }));
      expect(onchainOddsStore.getState().byMarketId[MID].stale).toBe(false);
    });

    it("ignores update with invalid marketId silently", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      onchainOddsStore.getState().applyUpdate("not-hex", payload());
      expect(Object.keys(onchainOddsStore.getState().byMarketId)).toHaveLength(0);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("ignores update with non-array odds", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      onchainOddsStore
        .getState()
        .applyUpdate(MID, { ...payload(), baseOdds: "oops" as unknown as string[] });
      expect(onchainOddsStore.getState().byMarketId[MID]).toBeUndefined();
      warn.mockRestore();
    });

    it("ignores update with out-of-range signal", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      onchainOddsStore.getState().applyUpdate(MID, payload({ signal: 9 }));
      expect(onchainOddsStore.getState().byMarketId[MID]).toBeUndefined();
      warn.mockRestore();
    });
  });

  describe("markAllStale", () => {
    it("flips stale on all entries", () => {
      const store = onchainOddsStore.getState();
      store.applyUpdate(MID, payload({ quoteVersion: 21 }));
      const otherMid = "0x" + "1".repeat(64);
      store.applyUpdate(otherMid, payload({ quoteVersion: 5 }));
      store.markAllStale();
      const all = onchainOddsStore.getState().byMarketId;
      expect(all[MID].stale).toBe(true);
      expect(all[otherMid].stale).toBe(true);
    });

    it("is a no-op when no entries exist", () => {
      const before = onchainOddsStore.getState().byMarketId;
      onchainOddsStore.getState().markAllStale();
      expect(onchainOddsStore.getState().byMarketId).toBe(before);
    });
  });

  describe("reset", () => {
    it("clears all entries", () => {
      const store = onchainOddsStore.getState();
      store.applyUpdate(MID, payload());
      store.reset();
      expect(onchainOddsStore.getState().byMarketId).toEqual({});
    });
  });
});
