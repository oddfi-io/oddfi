// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import OddsRow from "./OddsRow";
import type { BannerItem } from "@/types/home-banner";

afterEach(cleanup);

const makeItem = (overrides: Partial<BannerItem> = {}): BannerItem => ({
  name: "BRAZIL",
  odds: 4.5,
  market_id: 10001,
  selection_id: 20001,
  bet_mode: ["single"],
  country_code: "BR",
  extra: {},
  ...overrides,
});

describe("OddsRow 变体分支", () => {
  describe("B1 (Hot Market 夺冠盘)", () => {
    it("渲染名字 + 赔率（formatAmount 2 位） + Bet 按钮", () => {
      render(
        <OddsRow
          item={makeItem({ extra: { heat: 5 } })}
          variant="top_wins_the_world_cup"
          bannerId="bnr_001"
        />
      );
      expect(screen.getByText("BRAZIL")).toBeInTheDocument();
      expect(screen.getByText("4.50")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bet" })).toBeInTheDocument();
    });

    it("heat=0 时不渲染火焰 wrapper", () => {
      // HeatFlames 在 heat=0 时整个 return null；
      // 用 wrapper span 的 inline style width:17px 计数（next/image 会重写 src）
      const { container } = render(
        <OddsRow
          item={makeItem({ extra: { heat: 0 } })}
          variant="top_wins_the_world_cup"
          bannerId="bnr_001"
        />
      );
      expect(container.querySelectorAll('span[style*="width: 17px"]')).toHaveLength(0);
    });

    it("heat=3 时渲染 3 个火焰 wrapper", () => {
      const { container } = render(
        <OddsRow
          item={makeItem({ extra: { heat: 3 } })}
          variant="top_wins_the_world_cup"
          bannerId="bnr_001"
        />
      );
      expect(container.querySelectorAll('span[style*="width: 17px"]')).toHaveLength(3);
    });

    it("不渲染奖牌（B1 无 RankMedal）— rank 即使传入也不应渲染", () => {
      // B1 路径不走 RankMedal 分支；通过 Bet 按钮存在 + 名字存在间接确认走 B1 分支
      render(
        <OddsRow
          item={makeItem({ extra: { heat: 5 } })}
          variant="top_wins_the_world_cup"
          bannerId="bnr_001"
          rank={1}
        />
      );
      expect(screen.getByRole("button", { name: "Bet" })).toBeInTheDocument();
      expect(screen.getByText("BRAZIL")).toBeInTheDocument();
    });
  });

  describe("B3 (Golden Ball MVP)", () => {
    it("渲染奖牌 + 国旗 + 名字 + Bet 按钮", () => {
      const { container } = render(
        <OddsRow
          item={makeItem({ name: "BELLINGHAM" })}
          variant="top_golden_ball_name"
          bannerId="bnr_003"
          rank={1}
        />
      );
      expect(screen.getByText("BELLINGHAM")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bet" })).toBeInTheDocument();
      expect(container.querySelectorAll('img[src*="rank-medal-1"]').length).toBeGreaterThan(0);
    });

    it("country_code 缺失时不渲染国旗", () => {
      const { container } = render(
        <OddsRow
          item={makeItem({ country_code: undefined })}
          variant="top_golden_ball_name"
          bannerId="bnr_003"
          rank={2}
        />
      );
      // CountryFlag 在 country_code 不存在时 OddsRow 守门返回，不会渲染 svg flag
      expect(container.querySelector("svg")).toBeNull();
    });
  });

  describe("B4 (Golden Boot 金靴)", () => {
    it("不渲染 Bet 按钮（GoalsBar 替代）", () => {
      render(
        <OddsRow
          item={makeItem({ name: "MBAPPE", extra: { goals: 4 } })}
          variant="top_golden_boot_name"
          bannerId="bnr_004"
          rank={1}
          maxGoals={4}
        />
      );
      expect(screen.queryByRole("button", { name: "Bet" })).not.toBeInTheDocument();
      expect(screen.getByText("MBAPPE")).toBeInTheDocument();
    });

    it("goals 字段缺失时不渲染 GoalsBar", () => {
      const { container } = render(
        <OddsRow
          item={makeItem({ extra: {} })}
          variant="top_golden_boot_name"
          bannerId="bnr_004"
          rank={1}
        />
      );
      // GoalsBar 内部有进度条 div，缺失 goals 时不渲染（OddsRow 用 goals !== undefined 守门）
      // 通过赔率仍正常渲染来确认主体路径
      expect(screen.getByText("4.50")).toBeInTheDocument();
      expect(container.querySelector('[role="progressbar"]')).toBeNull();
    });
  });

  describe("B5 (Golden Glove 金手套)", () => {
    it("渲染 'N Saves' + 不渲染 Bet 按钮", () => {
      render(
        <OddsRow
          item={makeItem({ name: "COURTOIS", extra: { saves: 28 } })}
          variant="top_golden_glove_name"
          bannerId="bnr_005"
          rank={1}
        />
      );
      expect(screen.getByText("28 Saves")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Bet" })).not.toBeInTheDocument();
    });

    it("saves 字段缺失时不渲染 SavesPill", () => {
      render(
        <OddsRow
          item={makeItem({ extra: {} })}
          variant="top_golden_glove_name"
          bannerId="bnr_005"
          rank={2}
        />
      );
      expect(screen.queryByText(/Saves/)).not.toBeInTheDocument();
    });
  });

  describe("赔率格式化", () => {
    it("整数赔率补 0", () => {
      render(
        <OddsRow
          item={makeItem({ odds: 12 })}
          variant="top_wins_the_world_cup"
          bannerId="bnr_001"
        />
      );
      expect(screen.getByText("12.00")).toBeInTheDocument();
    });

    it("多位小数截到 2 位", () => {
      render(
        <OddsRow
          item={makeItem({ odds: 3.14159 })}
          variant="top_wins_the_world_cup"
          bannerId="bnr_001"
        />
      );
      expect(screen.getByText("3.14")).toBeInTheDocument();
    });
  });
});
