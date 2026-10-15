import { http, HttpResponse } from "msw";
import type { InviteInfo, InviteReward, InviteRecord, InviteStats } from "@/types/api";

const inviteInfo: InviteInfo = {
  myCode: "PREDICTX-A8F2",
  myLink: "https://predictx.io/invite?code=PREDICTX-A8F2",
  referrer: "0x1234...abcd",
  totalInvited: 18,
};

const inviteStats: InviteStats = {
  inviteCount: 120,
  inviteIncome: "355",
  communityLevel: 10,
  directCount: 112,
  indirectCount: 112,
  totalPerf: "124",
  smallZonePerf: "355",
  contribution: "112",
  availableContrib: "124",
};

const rewards: InviteReward[] = [
  { type: "trade",       label: "贡献收益",  amount: "1250.00", claimable: "420.00"  },
  { type: "invite",      label: "邀请收益",  amount: "380.50",  claimable: "380.50"  },
  { type: "market_make", label: "做市收益",  amount: "2180.00", claimable: "0"       },
  { type: "stake",       label: "质押收益",  amount: "3456.75", claimable: "1200.00" },
];

const records: InviteRecord[] = Array.from({ length: 18 }, (_, i) => ({
  address: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
  joinedAt: new Date(Date.now() - i * 3 * 24 * 3600 * 1000).toISOString(),
  contributed: (Math.random() * 10000).toFixed(2),
  reward: (Math.random() * 200).toFixed(2),
}));

export const inviteHandlers = [
  http.get("*/api/invite/info", () =>
    HttpResponse.json({ code: 0, message: "ok", data: inviteInfo })
  ),

  http.get("*/api/invite/rewards", () =>
    HttpResponse.json({ code: 0, message: "ok", data: rewards })
  ),

  http.get("*/api/invite/stats", () =>
    HttpResponse.json({ code: 0, message: "ok", data: inviteStats })
  ),

  http.get("*/api/invite/records", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      code: 0,
      message: "ok",
      data: { list: records.slice(start, start + pageSize), total: records.length, page, pageSize },
    });
  }),

  http.post("*/api/invite/claim", async () => {
    await new Promise((r) => setTimeout(r, 800));
    return HttpResponse.json({
      code: 0,
      message: "ok",
      data: { txHash: `0x${Math.random().toString(16).slice(2)}` },
    });
  }),
];
