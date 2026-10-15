import { describe, it, expect } from "vitest";
import {
  adaptDepositList,
  adaptReferralList,
  adaptReferralMe,
  type DepositListWire,
  type ReferralListWire,
  type ReferralMeWire,
} from "./types";

describe("adaptDepositList — 归一 list/items 字段漂移（DD §2.2）", () => {
  const deposit = {
    depositId: "1",
    txHash: "0xabc",
    status: "confirmed" as const,
    anomalyReason: null,
    roundId: "seed",
    amountUsdt: "1.000000000000000000",
    sharesOdd: "1.000000000000000000",
    blockTimestamp: 1779696539000,
  };

  it("读契约稿的 `list` 键", () => {
    const raw: DepositListWire = { list: [deposit], total: 1 };
    expect(adaptDepositList(raw)).toEqual({ items: [deposit], total: 1 });
  });

  it("读实测的 `items` 键", () => {
    const raw: DepositListWire = { items: [deposit], total: 7, page: 1, size: 20 };
    expect(adaptDepositList(raw).items).toHaveLength(1);
    expect(adaptDepositList(raw).total).toBe(7);
  });

  it("items 优先于 list（两者都在时）", () => {
    const raw: DepositListWire = { items: [deposit], list: [], total: 1 };
    expect(adaptDepositList(raw).items).toHaveLength(1);
  });

  it("空响应兜底为空数组 + total 取实际长度", () => {
    expect(adaptDepositList(null)).toEqual({ items: [], total: 0 });
    expect(adaptDepositList({})).toEqual({ items: [], total: 0 });
    expect(adaptDepositList({ items: [deposit] }).total).toBe(1);
  });

  it("金额字符串原样保留不丢精度", () => {
    const { items } = adaptDepositList({ items: [deposit] });
    expect(items[0].amountUsdt).toBe("1.000000000000000000");
    expect(items[0].sharesOdd).toBe("1.000000000000000000");
  });
});

describe("adaptReferralMe — 归一 stats（契约 invitedCount / 实测 totalReferred）", () => {
  const base: Omit<ReferralMeWire, "stats"> = {
    myCode: "0xABCD23",
    shareLink: "https://oddfi.io/invest?ref=0xABCD23",
    referrer: null,
  };

  it("实测 totalReferred → invitedCount", () => {
    const raw: ReferralMeWire = { ...base, stats: { totalReferred: 12, totalRewardOdd: "3200" } };
    expect(adaptReferralMe(raw).stats).toEqual({ invitedCount: 12, totalRewardOdd: "3200" });
  });

  it("契约 invitedCount 兜底", () => {
    const raw: ReferralMeWire = { ...base, stats: { invitedCount: 5, totalRewardOdd: "100" } };
    expect(adaptReferralMe(raw).stats.invitedCount).toBe(5);
  });

  it("totalReferred 优先于 invitedCount", () => {
    const raw: ReferralMeWire = {
      ...base,
      stats: { totalReferred: 9, invitedCount: 3, totalRewardOdd: "0" },
    };
    expect(adaptReferralMe(raw).stats.invitedCount).toBe(9);
  });

  it("referrer 透传 null/对象", () => {
    expect(adaptReferralMe({ ...base, stats: { totalRewardOdd: "0" } }).referrer).toBeNull();
  });
});

describe("adaptReferralList — 归一 items/list + boundAt/joinedAt", () => {
  it("实测 items + boundAt → joinedAt", () => {
    const raw: ReferralListWire = {
      items: [
        {
          userId: "1001",
          eoa: "0x9d9b",
          boundAt: 1779696440000,
          totalRewardOdd: "0.001",
          deposits: [{ txHash: "0xea", roundId: "seed", rewardOdd: "0.001" }],
        },
      ],
      total: 1,
    };
    const out = adaptReferralList(raw);
    expect(out.items[0].joinedAt).toBe(1779696440000);
    expect(out.items[0].deposits).toHaveLength(1);
    expect(out.total).toBe(1);
  });

  it("契约 list + joinedAt", () => {
    const raw: ReferralListWire = {
      list: [{ userId: "2", eoa: "0x2", joinedAt: 123, totalRewardOdd: "5", deposits: [] }],
      total: 1,
    };
    expect(adaptReferralList(raw).items[0].joinedAt).toBe(123);
  });

  it("缺 deposits 兜底空数组；空响应兜底", () => {
    const raw: ReferralListWire = { items: [{ userId: "3", eoa: "0x3", totalRewardOdd: "0" }] };
    expect(adaptReferralList(raw).items[0].deposits).toEqual([]);
    expect(adaptReferralList(null)).toEqual({ items: [], total: 0 });
  });
});
