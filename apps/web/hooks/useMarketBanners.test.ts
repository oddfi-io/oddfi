import { describe, it, expect } from "vitest";
import { normalizeBanners, MAX_ITEMS_PER_BANNER } from "./useMarketBanners";
import type { HomeBannerData } from "@/types/home-banner";

const makeBanner = (
  overrides: Partial<HomeBannerData> & { itemsCount?: number }
): HomeBannerData => {
  const itemsCount = overrides.itemsCount ?? 4;
  return {
    banner_id: overrides.banner_id ?? "bnr_x",
    template_id: overrides.template_id ?? "top_wins_the_world_cup",
    sort_order: overrides.sort_order ?? 1,
    is_active: overrides.is_active ?? true,
    tag_text: "X",
    tag_color: "#000",
    title: "T",
    subtitle: null,
    decoration_key: "k",
    items: Array.from({ length: itemsCount }, (_, i) => ({
      name: `n${i}`,
      odds: 2,
      market_id: 10001,
      selection_id: 20000 + i,
      bet_mode: ["single"],
      extra: {},
    })),
  };
};

describe("normalizeBanners", () => {
  it("过滤 is_active=false", () => {
    const data: HomeBannerData[] = [
      makeBanner({ banner_id: "active", is_active: true }),
      makeBanner({ banner_id: "inactive", is_active: false }),
    ];
    const result = normalizeBanners(data);
    expect(result).toHaveLength(1);
    expect(result[0].banner_id).toBe("active");
  });

  it("按 sort_order 升序", () => {
    const data: HomeBannerData[] = [
      makeBanner({ banner_id: "a", sort_order: 3 }),
      makeBanner({ banner_id: "b", sort_order: 1 }),
      makeBanner({ banner_id: "c", sort_order: 2 }),
    ];
    const result = normalizeBanners(data);
    expect(result.map((b) => b.banner_id)).toEqual(["b", "c", "a"]);
  });

  it("items 截到 MAX_ITEMS_PER_BANNER（守护 UI 4 行/4 卡布局）", () => {
    const data: HomeBannerData[] = [
      makeBanner({ banner_id: "wc-winner", itemsCount: 11 }),
      makeBanner({ banner_id: "ronaldo-goals", itemsCount: 9 }),
    ];
    const result = normalizeBanners(data);
    expect(MAX_ITEMS_PER_BANNER).toBe(4);
    for (const b of result) {
      expect(b.items.length).toBeLessThanOrEqual(MAX_ITEMS_PER_BANNER);
    }
    expect(result[0].items.length).toBe(4);
    expect(result[1].items.length).toBe(4);
  });

  it("items 数量 ≤ 上限时不截断", () => {
    const data: HomeBannerData[] = [makeBanner({ itemsCount: 2 })];
    const result = normalizeBanners(data);
    expect(result[0].items.length).toBe(2);
  });

  it("不修改原 banner 对象（返回新对象）", () => {
    const original = makeBanner({ itemsCount: 6 });
    const data = [original];
    const result = normalizeBanners(data);
    expect(result[0]).not.toBe(original);
    expect(original.items.length).toBe(6); // 原对象未变更
  });
});
