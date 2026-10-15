import { http, HttpResponse } from "msw";
import type { SwapQuote, SwapToken, KlineBar } from "@/types/api";

const RATES: Record<string, Record<string, string>> = {
  USDT: { PTK: "10.2", BNB: "0.00167" },
  PTK:  { USDT: "0.098", BNB: "0.000164" },
  BNB:  { USDT: "598.5", PTK: "6103.5" },
};

function generateKlineData(basePrice: number, count: number): KlineBar[] {
  const bars: KlineBar[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  for (let i = count - 1; i >= 0; i--) {
    const change = (Math.random() - 0.48) * price * 0.04;
    const open = price;
    price = Math.max(price + change, price * 0.5);
    const high = Math.max(open, price) * (1 + Math.random() * 0.015);
    const low = Math.min(open, price) * (1 - Math.random() * 0.015);
    bars.push({
      time: now - i * 3600,
      open: Number(open.toFixed(6)),
      high: Number(high.toFixed(6)),
      low: Number(low.toFixed(6)),
      close: Number(price.toFixed(6)),
      volume: Math.floor(Math.random() * 50000 + 10000),
    });
  }
  return bars;
}

export const swapHandlers = [
  http.get("*/api/swap/quote", ({ request }) => {
    const url = new URL(request.url);
    const fromToken = url.searchParams.get("fromToken") as SwapToken;
    const toToken = url.searchParams.get("toToken") as SwapToken;
    const amount = url.searchParams.get("amount") ?? "0";

    const rate = RATES[fromToken]?.[toToken] ?? "1";
    const toAmount = (Number(amount) * Number(rate)).toFixed(6);
    const priceImpact = ((Number(amount) / 100000) * 0.05).toFixed(4);

    const quote: SwapQuote = {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount,
      rate,
      priceImpact,
      minReceived: (Number(toAmount) * 0.995).toFixed(6),
      fee: (Number(amount) * 0.003).toFixed(6),
    };
    return HttpResponse.json({ code: 0, message: "ok", data: quote });
  }),

  http.get("*/api/swap/kline", ({ request }) => {
    const url = new URL(request.url);
    const pair = url.searchParams.get("pair") ?? "PTK/USDT";
    const interval = url.searchParams.get("interval") ?? "1H";

    const count = interval === "1W" || interval === "1D" ? 30 : 24;
    const basePrice = pair.startsWith("PTK")
      ? 0.098
      : pair.startsWith("BNB")
      ? 598.5
      : 1;
    const data = generateKlineData(basePrice, count);

    return HttpResponse.json({ code: 0, message: "ok", data });
  }),

  http.post("*/api/swap", async ({ request }) => {
    const body = await request.json() as { fromToken?: string; toToken?: string; amount?: string };
    await new Promise((r) => setTimeout(r, 1000));
    const rate = RATES[body?.fromToken ?? "USDT"]?.[body?.toToken ?? "PTK"] ?? "1";
    const toAmount = (Number(body?.amount ?? 0) * Number(rate)).toFixed(6);
    return HttpResponse.json({
      code: 0,
      message: "ok",
      data: { txHash: `0x${Math.random().toString(16).slice(2, 18)}`, toAmount },
    });
  }),
];
