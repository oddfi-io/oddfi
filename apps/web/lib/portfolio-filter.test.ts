import { describe, it, expect } from "vitest";
import { statusToApiParams, type FilterStatus } from "./portfolio-filter";

describe("statusToApiParams", () => {
  it("all → 空对象（无筛选）", () => {
    expect(statusToApiParams("all")).toEqual({});
  });

  it("bet_all → type=bet_cancel,bet_won,bet_lost,bet_banner,claim（逗号分隔聚合，含 banner 和 claim）", () => {
    expect(statusToApiParams("bet_all")).toEqual({
      type: "bet_cancel,bet_won,bet_lost,bet_banner,claim",
    });
  });

  it("bet_cancel → type=bet_cancel", () => {
    expect(statusToApiParams("bet_cancel")).toEqual({ type: "bet_cancel" });
  });

  it("bet_won → type=bet_won", () => {
    expect(statusToApiParams("bet_won")).toEqual({ type: "bet_won" });
  });

  it("bet_lost → type=bet_lost", () => {
    expect(statusToApiParams("bet_lost")).toEqual({ type: "bet_lost" });
  });

  it("stake_all → type=stake,unstake（逗号分隔聚合）", () => {
    expect(statusToApiParams("stake_all")).toEqual({ type: "stake,unstake" });
  });

  it("stake → type=stake", () => {
    expect(statusToApiParams("stake")).toEqual({ type: "stake" });
  });

  it("unstake → type=unstake", () => {
    expect(statusToApiParams("unstake")).toEqual({ type: "unstake" });
  });

  it("lp_all → type=add_lp,remove_lp（逗号分隔聚合）", () => {
    expect(statusToApiParams("lp_all")).toEqual({ type: "add_lp,remove_lp" });
  });

  it("add_lp → type=add_lp", () => {
    expect(statusToApiParams("add_lp")).toEqual({ type: "add_lp" });
  });

  it("remove_lp → type=remove_lp", () => {
    expect(statusToApiParams("remove_lp")).toEqual({ type: "remove_lp" });
  });

  it("claim → type=claim", () => {
    expect(statusToApiParams("claim")).toEqual({ type: "claim" });
  });

  it("deposit → type=deposit", () => {
    expect(statusToApiParams("deposit")).toEqual({ type: "deposit" });
  });

  it("withdraw → type=withdraw", () => {
    expect(statusToApiParams("withdraw")).toEqual({ type: "withdraw" });
  });

  it("所有 14 种状态都有确定性映射（不遗漏）", () => {
    const all: FilterStatus[] = [
      "all",
      "bet_all",
      "bet_cancel",
      "bet_won",
      "bet_lost",
      "stake_all",
      "stake",
      "unstake",
      "lp_all",
      "add_lp",
      "remove_lp",
      "claim",
      "deposit",
      "withdraw",
    ];
    for (const s of all) {
      const result = statusToApiParams(s);
      expect(result).toBeDefined();
    }
  });
});
