import { http, HttpResponse, delay } from "msw";
import type { CollateralPosition, ActiveBorrow } from "@/types/lending";

const mockPositions: CollateralPosition[] = [
  {
    id: "POS-001",
    matchTitle: "France vs Spain — World Cup Final",
    matchDate: "Wed, Jul 1 9:00 PM",
    homeTeamLogo: "/images/mocks/teams/placeholder.png",
    awayTeamLogo: "/images/mocks/teams/placeholder.png",
    principal: 520000,
    returnMultiplier: 2.1,
    creditLimit: 100,
    isBorrowed: false,
  },
  {
    id: "POS-002",
    matchTitle: "Brazil vs Mexico — Quarter Final",
    matchDate: "Sat, Jun 27 6:00 PM",
    homeTeamLogo: "/images/mocks/teams/placeholder.png",
    awayTeamLogo: "/images/mocks/teams/placeholder.png",
    principal: 380000,
    returnMultiplier: 1.85,
    creditLimit: 75,
    isBorrowed: false,
  },
  {
    id: "POS-003",
    matchTitle: "England vs Germany — Semi Final",
    matchDate: "Tue, Jun 30 9:00 PM",
    homeTeamLogo: "/images/mocks/teams/placeholder.png",
    awayTeamLogo: "/images/mocks/teams/placeholder.png",
    principal: 640000,
    returnMultiplier: 3.2,
    creditLimit: null,
    isBorrowed: true,
  },
  {
    id: "POS-004",
    matchTitle: "Argentina vs Portugal — Round of 16",
    matchDate: "Thu, Jun 25 3:00 PM",
    homeTeamLogo: "/images/mocks/teams/placeholder.png",
    awayTeamLogo: "/images/mocks/teams/placeholder.png",
    principal: 295000,
    returnMultiplier: 2.45,
    creditLimit: 60,
    isBorrowed: false,
  },
  {
    id: "POS-005",
    matchTitle: "Netherlands vs Italy — Quarter Final",
    matchDate: "Fri, Jun 26 6:00 PM",
    homeTeamLogo: "/images/mocks/teams/placeholder.png",
    awayTeamLogo: "/images/mocks/teams/placeholder.png",
    principal: 450000,
    returnMultiplier: 1.95,
    creditLimit: 90,
    isBorrowed: false,
  },
  {
    id: "POS-006",
    matchTitle: "Japan vs South Korea — Group Stage",
    matchDate: "Mon, Jun 15 12:00 PM",
    homeTeamLogo: "/images/mocks/teams/placeholder.png",
    awayTeamLogo: "/images/mocks/teams/placeholder.png",
    principal: 175000,
    returnMultiplier: 4.5,
    creditLimit: 35,
    isBorrowed: false,
  },
];

const mockBorrows: ActiveBorrow[] = [
  {
    id: "BRW-001",
    matchTitle: "England vs Spain · Draw",
    collateralInfo: "Collateral: England vs Spain Away Win · #A003",
    homeTeamLogo: "/images/mocks/teams/placeholder.png",
    awayTeamLogo: "/images/mocks/teams/placeholder.png",
    borrowedAmount: 120,
    status: "active",
    times: 3.2,
    potentialReturn: 264,
  },
  {
    id: "BRW-002",
    matchTitle: "Japan vs Croatia · Home Win",
    collateralInfo: "Collateral: Brazil vs Mexico Home Win · #A001",
    homeTeamLogo: "/images/mocks/teams/placeholder.png",
    awayTeamLogo: "/images/mocks/teams/placeholder.png",
    borrowedAmount: 80,
    status: "principal_frozen",
    netProfit: 96,
    principalFrozen: 80,
  },
];

export const lendingHandlers = [
  // GET lending positions
  http.get("*/api/lending/positions", async () => {
    await delay(200);
    return HttpResponse.json({
      code: 0,
      message: "ok",
      data: mockPositions,
    });
  }),

  // GET active borrows
  http.get("*/api/lending/borrows", async () => {
    await delay(200);
    return HttpResponse.json({
      code: 0,
      message: "ok",
      data: mockBorrows,
    });
  }),

  // POST borrow from position
  http.post("*/api/lending/borrow", async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as {
      positionId: string;
      amount: number;
    };
    return HttpResponse.json({
      code: 0,
      message: "ok",
      data: { orderId: `ORD-${Date.now()}-${body.positionId}` },
    });
  }),

  // POST repay borrow
  http.post("*/api/lending/repay", async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { borrowId: string };
    return HttpResponse.json({
      code: 0,
      message: "ok",
      data: { txHash: `0x${body.borrowId.replace("BRW-", "")}a1b2c3d4e5f6` },
    });
  }),
];
