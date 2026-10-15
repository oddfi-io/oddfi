// Mock data for Portfolio page — will be replaced by real API when backend is ready.
// No MSW handler needed at this stage (DD-054 §7).

export interface PortfolioSummaryData {
  totalAssets: string;
  totalAssetsUsd: string;
  dailyPnl: string;
  dailyPnlPercent: string;
  cash: { amount: string; usd: string };
  bet: { amount: string; usd: string };
  stake: { amount: string; usd: string };
  liquidity: { amount: string; usd: string };
  won: { amount: string; usd: string };
}

export const MOCK_SUMMARY: PortfolioSummaryData = {
  totalAssets: "1023296.00",
  totalAssetsUsd: "1023296.00",
  dailyPnl: "105.92",
  dailyPnlPercent: "1.31",
  cash: { amount: "512648.00", usd: "512648.00" },
  bet: { amount: "256324.00", usd: "256324.00" },
  stake: { amount: "153794.00", usd: "153794.00" },
  liquidity: { amount: "100530.00", usd: "100530.00" },
  won: { amount: "1023296.00", usd: "1023296.00" },
};
