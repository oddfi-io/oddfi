import { http, HttpResponse } from "msw";
import { PLATFORM_TOKEN_SYMBOL } from "@/lib/platform-token";

export const tokenPriceHandlers = [
  // GET /api/prices — demo-stage mock prices
  http.get("*/api/prices", () => {
    return HttpResponse.json({
      code: 0,
      message: "ok",
      data: {
        BNB: "600.00",
        USDT: "1.00",
        USDC: "1.00",
        [PLATFORM_TOKEN_SYMBOL]: "0.10",
        MDAO: "0.035",
        DAI: "1.00",
        DSU: "1.00",
        DOGE: "0.32",
        PEPE: "0.000012",
        ADA: "0.68",
      },
    });
  }),
];
