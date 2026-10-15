import { describe, it, expect } from "vitest";
import {
  adaptDepositList,
  adaptReferralList,
  adaptReferralMe,
  type BindRes,
  type Deposit,
  type DepositListWire,
  type Position,
  type PresaleConfig,
  type ReferralListWire,
  type ReferralMeWire,
  type ReportTxRes,
} from "@/lib/presale/types";

/**
 * DD-119 §9.2 集成契约护栏（项目惯例：冻结后端真实 sample + 跑 adapter，TS 编译即契约校验）。
 * 样例取自 oddfi-backend/web-api/docs/dd-invest/frontend-integration.md §4（本地实测 live response）。
 * 后端字段重命名/缺失 → 这里 TS 编译失败 或 adapter 断言失败，先于运行时暴露。
 */

describe("§4.1 GET /presale/config", () => {
  // data 部分（实测样例，单轮简化）
  const config: PresaleConfig = {
    vault: {
      depositAddress: "0xf4b6036d2423b1254f273272929364a120a50c7c",
      chain: "BSC",
      chainId: 56,
      asset: "USDT",
      usdtAddress: "0x55d398326f99059fF775485246999027B3197955",
      minSubscribeUsd: "0.005",
      totalRaisedUsd: "1.05",
      totalTargetUsd: "20000000",
      tgeTs: 1781049600000,
      tgeOpenPriceUsd: "0.1",
      audit: "",
      boundaryToleranceMin: 5,
    },
    rounds: [
      {
        id: "seed",
        name: "种子轮",
        roundType: "private",
        price: "1",
        supply: "1000",
        sold: "1.05",
        raised: "1.05",
        soldPercent: 0.105,
        targetRaiseUsd: "1000",
        tgeReleasePct: "10",
        linearReleaseDays: 90,
        referralRewardPct: "10",
        tgeDiscountPct: "-900",
        startTs: 1779692842379,
        endTs: 1779784233000,
        status: "active",
        badge: null,
        minPerOrderUsd: null,
        maxPerWalletUsd: null,
      },
    ],
  };

  it("金额字段为 string；时间为 ms number；chainId=56 / USDT 18-decimals 地址", () => {
    expect(typeof config.vault.minSubscribeUsd).toBe("string");
    expect(typeof config.vault.tgeTs).toBe("number");
    expect(config.vault.chainId).toBe(56);
    expect(config.vault.usdtAddress.toLowerCase()).toBe(
      "0x55d398326f99059ff775485246999027b3197955"
    );
  });
});

describe("§4.2 POST /deposit/report-tx — 实测响应 {depositId,status,roundId}", () => {
  const res: ReportTxRes = { depositId: "1", status: "pending", roundId: "seed" };
  it("含 depositId + status=pending；roundId 可选并集字段存在", () => {
    expect(res.status).toBe("pending");
    expect(res.roundId).toBe("seed");
  });
});

describe("§4.3 GET /deposit/:txHash — confirmed 样例", () => {
  const d: Deposit = {
    depositId: "1",
    txHash: "0x141238c2fd",
    status: "confirmed",
    anomalyReason: null,
    roundId: "seed",
    amountUsdt: "1.000000000000000000",
    priceUsd: "1.000000000000000000",
    sharesOdd: "1.000000000000000000",
    referrerEoa: null,
    referralRewardOdd: "0.000000000000000000",
    blockNumber: 100313269,
    blockTimestamp: 1779696539000,
    source: "worker",
    confirmedAt: 1779696547281,
    createdAt: 1779696547281,
  };
  it("status/anomalyReason/金额字符串保真", () => {
    expect(d.status).toBe("confirmed");
    expect(d.anomalyReason).toBeNull();
    expect(d.amountUsdt).toBe("1.000000000000000000");
  });
  it("paused_arrival 是 confirmed + 标记（非 anomaly）", () => {
    const paused: Deposit = { ...d, anomalyReason: "paused_arrival" };
    expect(paused.status).toBe("confirmed");
    expect(paused.anomalyReason).toBe("paused_arrival");
  });
});

describe("§4.4 GET /deposit/list — 实测 items 键（契约 list）→ adaptDepositList 归一", () => {
  const wire: DepositListWire = {
    items: [
      {
        depositId: "1",
        txHash: "0xea",
        status: "confirmed",
        anomalyReason: null,
        roundId: "seed",
        amountUsdt: "0.01",
        sharesOdd: "0.01",
        blockTimestamp: 1779696440000,
      },
    ],
    total: 7,
    page: 1,
    size: 20,
  };
  it("items + total 正确归一", () => {
    const out = adaptDepositList(wire);
    expect(out.items).toHaveLength(1);
    expect(out.total).toBe(7);
  });
});

describe("§4.5 GET /position", () => {
  const p: Position = {
    holdings: "1.050000000000000000",
    holdingsBySource: { invest: "1.050000000000000000", referral: "0.000000000000000000" },
    investedUsd: "1.050000000000000000",
    lockedPriceAvg: "1.000000000000000000",
    perRound: [
      {
        roundId: "seed",
        totalOdd: "1.050000000000000000",
        investedUsd: "1.050000000000000000",
        lockedPriceAvg: "1.000000000000000000",
        referralOdd: "0.000000000000000000",
      },
    ],
  };
  it("holdingsBySource 拆分 + 无 V3 已砍的价格/价值字段", () => {
    expect(p.holdingsBySource.invest).toBe("1.050000000000000000");
    expect(p.holdingsBySource.referral).toBe("0.000000000000000000");
    expect("todayValueUsd" in p).toBe(false);
  });
});

describe("§4.6 GET /referral/me — 实测 stats.totalReferred → adaptReferralMe 归一 invitedCount", () => {
  const wire: ReferralMeWire = {
    myCode: "0xABCD23",
    shareLink: "https://oddfi.io/invest?ref=0xABCD23",
    referrer: {
      userId: "1002",
      eoa: "0x0000000000000000000000000000000000001002",
      code: "0xABCD23",
      boundAt: 1779696440000,
    },
    stats: { totalReferred: 0, totalRewardOdd: "0" },
  };
  it("totalReferred → invitedCount；referrer 透传", () => {
    const me = adaptReferralMe(wire);
    expect(me.stats.invitedCount).toBe(0);
    expect(me.referrer?.eoa).toBe("0x0000000000000000000000000000000000001002");
  });
});

describe("§4.7 POST /referral/bind", () => {
  const res: BindRes = {
    referrerEoa: "0xREF",
    referrerCode: "0xABCD23",
    boundAt: 1779696440000,
  };
  it("返回 referrerEoa + boundAt", () => {
    expect(res.referrerCode).toBe("0xABCD23");
    expect(typeof res.boundAt).toBe("number");
  });
});

describe("§4.8 GET /referral/list — 实测 items + boundAt → adaptReferralList 归一 joinedAt", () => {
  const wire: ReferralListWire = {
    items: [
      {
        userId: "1001",
        eoa: "0x9d9bcdfee0ca1701cbb161a583241ee8c4656490",
        boundAt: 1779696440000,
        totalRewardOdd: "0.001000000000000000",
        deposits: [
          {
            txHash: "0xea0a41b49a",
            roundId: "seed",
            amountUsdt: "0.01",
            sharesOdd: "0.01",
            rewardOdd: "0.001",
            blockTimestamp: 1779696440000,
          },
        ],
      },
    ],
    total: 1,
    page: 1,
    size: 20,
  };
  it("boundAt → joinedAt；逐笔 deposits 保留", () => {
    const out = adaptReferralList(wire);
    expect(out.items[0].joinedAt).toBe(1779696440000);
    expect(out.items[0].deposits[0].rewardOdd).toBe("0.001");
    expect(out.total).toBe(1);
  });
});
