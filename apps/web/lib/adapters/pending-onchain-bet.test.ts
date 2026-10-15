import { describe, it, expect } from "vitest";
import { buildPendingPortfolioBet } from "./pending-onchain-bet";
import type { BetSelection } from "@/types/betting";

const baseSelection: BetSelection = {
  id: "11-1-Home",
  oddId: 1001,
  fixtureId: 11,
  fixtureName: "Braga VS Ferencvarosi",
  leagueName: "Champions League",
  marketType: "1x2",
  marketDescription: "Fulltime Result",
  selection: "Home",
  displayLabel: "Braga",
  odds: "1.85",
};

describe("buildPendingPortfolioBet", () => {
  it("解析队名（VS 大小写不敏感）+ 标记 isOnchain + 占位队徽", () => {
    const bet = buildPendingPortfolioBet({
      selection: baseSelection,
      stakeOdd: "100",
      rate: null,
      now: 1_700_000_000_000,
    });
    expect(bet.homeTeam.name).toBe("Braga");
    expect(bet.awayTeam.name).toBe("Ferencvarosi");
    expect(bet.isOnchain).toBe(true);
    expect(bet.homeTeam.iconUrl).toContain("placeholder");
  });

  it("selection 携带队徽时优先用赛事卡资源，缺省回退占位图", () => {
    const withLogos = buildPendingPortfolioBet({
      selection: {
        ...baseSelection,
        homeLogo: "https://cdn.example.com/braga.png",
        awayLogo: "https://cdn.example.com/ferencvarosi.png",
      },
      stakeOdd: "100",
      rate: null,
      now: 1,
    });
    expect(withLogos.homeTeam.iconUrl).toBe("https://cdn.example.com/braga.png");
    expect(withLogos.awayTeam.iconUrl).toBe("https://cdn.example.com/ferencvarosi.png");

    // 仅给主队徽：客队回退占位
    const homeOnly = buildPendingPortfolioBet({
      selection: { ...baseSelection, homeLogo: "https://cdn.example.com/braga.png" },
      stakeOdd: "100",
      rate: null,
      now: 1,
    });
    expect(homeOnly.homeTeam.iconUrl).toBe("https://cdn.example.com/braga.png");
    expect(homeOnly.awayTeam.iconUrl).toContain("placeholder");
  });

  it("potentialWin = stake × 赔率（decimal 精确，非浮点）", () => {
    const bet = buildPendingPortfolioBet({
      selection: baseSelection,
      stakeOdd: "100",
      rate: null,
      now: 1,
    });
    expect(bet.betAmount).toBe("100");
    expect(bet.potentialWin).toBe("185");
    expect(bet.odds).toBe("1.85");
  });

  it("无汇率时 USD 字段回退 ODD 原值", () => {
    const bet = buildPendingPortfolioBet({
      selection: baseSelection,
      stakeOdd: "100",
      rate: null,
      now: 1,
    });
    expect(bet.betAmountUsd).toBe("100");
  });

  it("有汇率时 USD 字段按汇率换算", () => {
    const bet = buildPendingPortfolioBet({
      selection: baseSelection,
      stakeOdd: "100",
      rate: "0.5",
      now: 1,
    });
    // convertOdd(100, "0.5") = 50
    expect(bet.betAmountUsd).toBe("50");
    expect(bet.potentialWinUsd).toBe("92.5");
  });

  it("乐观卡固定 pending / 不可兑现 / id 带 pending- 前缀", () => {
    const bet = buildPendingPortfolioBet({
      selection: baseSelection,
      stakeOdd: "100",
      rate: null,
      now: 1,
    });
    expect(bet.settlementStatus).toBe("pending");
    expect(bet.cashoutAvailable).toBe(false);
    expect(bet.id).toBe("pending-11-1-Home");
  });

  it("createdAt 为 now 的 ISO 字符串", () => {
    const bet = buildPendingPortfolioBet({
      selection: baseSelection,
      stakeOdd: "100",
      rate: null,
      now: 1_700_000_000_000,
    });
    expect(bet.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
  });
});
