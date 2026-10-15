export interface DiscountTier {
  tier: number;
  name: string;
  discountRate: number;
  unitPriceUsd: number;
  savePct: number | null;
}

export const DISCOUNT_TIERS: DiscountTier[] = [
  { tier: 0, name: "普通", discountRate: 1.0, unitPriceUsd: 0.01, savePct: null },
  { tier: 1, name: "VIP 1", discountRate: 0.95, unitPriceUsd: 0.0095, savePct: 5 },
  { tier: 2, name: "VIP 2", discountRate: 0.9, unitPriceUsd: 0.009, savePct: 10 },
  { tier: 3, name: "VIP 3", discountRate: 0.85, unitPriceUsd: 0.0085, savePct: 15 },
  { tier: 4, name: "VIP 4", discountRate: 0.8, unitPriceUsd: 0.008, savePct: 20 },
  { tier: 5, name: "VIP 5", discountRate: 0.7, unitPriceUsd: 0.007, savePct: 30 },
  { tier: 6, name: "VIP 6", discountRate: 0.6, unitPriceUsd: 0.006, savePct: 40 },
  { tier: 7, name: "VIP 7", discountRate: 0.5, unitPriceUsd: 0.005, savePct: 50 },
  { tier: 8, name: "VIP 8", discountRate: 0.4, unitPriceUsd: 0.004, savePct: 60 },
  { tier: 9, name: "VIP 9", discountRate: 0.35, unitPriceUsd: 0.0035, savePct: 65 },
  { tier: 10, name: "VIP 10", discountRate: 0.3, unitPriceUsd: 0.003, savePct: 70 },
];

export const BASE_COSTS = {
  chat: 1,
  preMatch: 8,
  liveUpdate: 3,
  recap: 5,
  proactivePush: 2,
  loginSummon: 1,
  tiltBrake: 2,
} as const;
