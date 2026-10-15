import { describe, it, expect } from "vitest";
import type { HomeBannerData, TemplateId } from "@/types/home-banner";

// 契约来源：Lark wiki Market_Banner v1.0 §三接口契约
// 后端示例：GET /api/v1/market/banners?lang=ja → { code: 0, data: HomeBannerData[] }
//
// 这里冻结后端 sample 的关键结构，作为前后端契约护栏：
// 后端字段命名/嵌套层级一旦变更（renamed/missing），TS 编译即失败。

const BACKEND_SAMPLE: { code: number; data: HomeBannerData[] } = {
  code: 0,
  data: [
    {
      banner_id: "bnr_001",
      template_id: "top_wins_the_world_cup",
      sort_order: 1,
      is_active: true,
      tag_text: "注目マーケット",
      tag_color: "#FF8A00",
      title: "ワールドカップ優勝はどこ？",
      subtitle: null,
      decoration_key: "world_cup_trophy",
      items: [
        {
          name: "スペイン",
          country_code: "ES",
          odds: 5,
          implied_probability: 20,
          market_id: 10001,
          selection_id: 20002,
          bet_mode: ["single"],
          extra: { heat: 5, tvl: 850000 },
        },
        {
          name: "イングランド",
          country_code: "GB-ENG",
          odds: 6,
          implied_probability: 16.7,
          market_id: 10001,
          selection_id: 20011,
          bet_mode: ["single"],
          extra: { heat: 0, tvl: 680000 },
        },
      ],
    },
    {
      banner_id: "bnr_002",
      template_id: "total_goals",
      sort_order: 2,
      is_active: true,
      tag_text: "選手スペシャル",
      tag_color: "#22C55E",
      title: "ロナウド総得点",
      subtitle: "クリスティアーノ・ロナウド · FW · #7",
      decoration_key: "player_ronaldo",
      items: [
        {
          name: "1ゴール",
          odds: 3.8,
          implied_probability: 24,
          market_id: 10002,
          selection_id: 20021,
          bet_mode: ["single"],
          extra: { goals_slot: 1, is_favorite: true, tvl: 420000 },
        },
        {
          name: "0ゴール",
          odds: 6,
          implied_probability: 15,
          market_id: 10002,
          selection_id: 20020,
          bet_mode: ["single"],
          extra: { goals_slot: 0, is_favorite: false, tvl: 180000 },
        },
      ],
    },
    {
      banner_id: "bnr_003",
      template_id: "top_golden_ball_name",
      sort_order: 3,
      is_active: true,
      tag_text: "バロンドール",
      tag_color: "#06B6D4",
      title: "MVPは誰になる？",
      subtitle: null,
      decoration_key: "player_bellingham",
      items: [
        {
          name: "ベリンガム",
          country_code: "GB-ENG",
          player_id: "p_bellingham",
          odds: 5.5,
          implied_probability: 18.2,
          market_id: 10003,
          selection_id: 20030,
          bet_mode: ["single"],
          extra: { tvl: 520000 },
        },
      ],
    },
    {
      banner_id: "bnr_004",
      template_id: "top_golden_boot_name",
      sort_order: 4,
      is_active: true,
      tag_text: "ゴールデンブーツ",
      tag_color: "#EF4444",
      title: "大会得点王",
      subtitle: null,
      decoration_key: "golden_boot",
      items: [
        {
          name: "エムバペ",
          country_code: "FR",
          player_id: "p_mbappe",
          odds: 4.5,
          implied_probability: 22.2,
          market_id: 10004,
          selection_id: 20004,
          bet_mode: ["single"],
          extra: { goals: 4, tvl: 680000 },
        },
      ],
    },
    {
      banner_id: "bnr_005",
      template_id: "top_golden_glove_name",
      sort_order: 5,
      is_active: true,
      tag_text: "ゴールデングローブ",
      tag_color: "#A855F7",
      title: "大会最優秀ゴールキーパー",
      subtitle: null,
      decoration_key: "golden_glove",
      items: [
        {
          name: "E. マルティネス",
          country_code: "AR",
          player_id: "p_emartinez",
          odds: 4.5,
          implied_probability: 22.2,
          market_id: 10005,
          selection_id: 20005,
          bet_mode: ["single"],
          extra: { saves: 31, tvl: 320000 },
        },
      ],
    },
  ],
};

describe("Market_Banner v1.0 后端契约样本", () => {
  it("响应包络是 { code: 0, data: HomeBannerData[] }", () => {
    expect(BACKEND_SAMPLE.code).toBe(0);
    expect(Array.isArray(BACKEND_SAMPLE.data)).toBe(true);
  });

  it("覆盖 5 个语义模板（snake_case template_id）", () => {
    const templates = BACKEND_SAMPLE.data.map((b) => b.template_id);
    const expected: TemplateId[] = [
      "top_wins_the_world_cup",
      "total_goals",
      "top_golden_ball_name",
      "top_golden_boot_name",
      "top_golden_glove_name",
    ];
    expect(templates).toEqual(expected);
  });

  it("每个 banner 顶层字段与契约一致", () => {
    for (const b of BACKEND_SAMPLE.data) {
      expect(b.banner_id).toMatch(/^bnr_\d+$/);
      expect(typeof b.sort_order).toBe("number");
      expect(typeof b.is_active).toBe("boolean");
      expect(typeof b.tag_text).toBe("string");
      expect(typeof b.tag_color).toBe("string");
      expect(typeof b.title).toBe("string");
      expect(typeof b.decoration_key).toBe("string");
      expect(b.items.length).toBeGreaterThan(0);
    }
  });

  it("items 公共字段：name/odds/market_id/selection_id/bet_mode=['single']", () => {
    for (const b of BACKEND_SAMPLE.data) {
      for (const item of b.items) {
        expect(typeof item.name).toBe("string");
        expect(typeof item.odds).toBe("number");
        expect(typeof item.market_id).toBe("number");
        expect(typeof item.selection_id).toBe("number");
        expect(item.bet_mode).toEqual(["single"]);
      }
    }
  });

  it("implied_probability 是百分数（0~100），非 0~1 比率", () => {
    for (const b of BACKEND_SAMPLE.data) {
      for (const item of b.items) {
        if (item.implied_probability !== undefined) {
          expect(item.implied_probability).toBeGreaterThan(1);
          expect(item.implied_probability).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("top_wins_the_world_cup items 必含 country_code + extra.heat（0~5）", () => {
    const b1 = BACKEND_SAMPLE.data.find((b) => b.template_id === "top_wins_the_world_cup")!;
    for (const item of b1.items) {
      expect(typeof item.country_code).toBe("string");
      const heat = item.extra.heat;
      expect(typeof heat).toBe("number");
      expect(heat).toBeGreaterThanOrEqual(0);
      expect(heat).toBeLessThanOrEqual(5);
    }
  });

  it("total_goals items 必含 extra.goals_slot + is_favorite，无 country_code", () => {
    const b2 = BACKEND_SAMPLE.data.find((b) => b.template_id === "total_goals")!;
    for (const item of b2.items) {
      expect(typeof item.extra.goals_slot).toBe("number");
      expect(typeof item.extra.is_favorite).toBe("boolean");
      expect(item.country_code).toBeUndefined();
    }
  });

  it("top_golden_ball_name items 必含 country_code + player_id（无 avatar_key）", () => {
    const b3 = BACKEND_SAMPLE.data.find((b) => b.template_id === "top_golden_ball_name")!;
    for (const item of b3.items) {
      expect(typeof item.country_code).toBe("string");
      expect(typeof item.player_id).toBe("string");
    }
  });

  it("top_golden_boot_name items 必含 extra.goals", () => {
    const b4 = BACKEND_SAMPLE.data.find((b) => b.template_id === "top_golden_boot_name")!;
    for (const item of b4.items) {
      expect(typeof item.extra.goals).toBe("number");
      expect(typeof item.country_code).toBe("string");
    }
  });

  it("top_golden_glove_name items 必含 extra.saves", () => {
    const b5 = BACKEND_SAMPLE.data.find((b) => b.template_id === "top_golden_glove_name")!;
    for (const item of b5.items) {
      expect(typeof item.extra.saves).toBe("number");
      expect(typeof item.country_code).toBe("string");
    }
  });
});
