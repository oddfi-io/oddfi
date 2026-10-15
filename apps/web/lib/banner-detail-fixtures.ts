// Banner 详情页趋势 + 倒计时 mock fixture
// DD-085 §3.2：后端不返回 trend / countdown，本文件供详情页静态消费
// Phase 3 后端 trend 接口就绪后整体删除（删除清单：本文件 + hooks/useBannerDetail 内的 fixture 拼装）

import type { TemplateId } from "@/types/home-banner";

/** 单条趋势线 mock */
export interface TrendSeriesMock {
  /** key：country_code（B1）或 player_id（B3/B4/B5）或 goals_slot（B2） */
  key: string;
  /** Legend 展示文案，如 "Spain"、"Ronaldo"、"1 goal" */
  label: string;
  /** 折线颜色 hex（按 Figma Vector 6/7/8/9 4 色配色） */
  color: string;
  /** 14 个数据点（百分比 0-30） */
  values: number[];
  /** Legend 末尾百分比标注，如 "16.15%" */
  pctLabel: string;
}

/** 倒计时 mock（静态字符串，不接 setInterval） */
export interface BannerCountdownMock {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** 详情页全套 mock（按 template_id 索引） */
export interface BannerDetailFixture {
  /** 4 条折线 + 14 个 X 轴日期 + Y 轴上限 */
  trend: {
    series: TrendSeriesMock[];
    xAxisLabels: string[];
    yMax: number;
  };
  /** 倒计时硬编码：90D / 31H / 31M / 14S（与 Figma 一致） */
  countdown: BannerCountdownMock;
  /** 标题 fallback —— 详情页优先取 list 元数据的 title，list 失败时降级到此 */
  fallbackTitle: string;
}

// 4 种折线配色（沿用 design-tokens.css variable_defs）
const COLOR_ORANGE = "#ed7442"; // function/orange
const COLOR_TEAL = "#28f4d2"; // text/brand-default
const COLOR_BLUE = "#304ffe"; // Bet 蓝（DD-084 沿用）
const COLOR_YELLOW = "#f1c409"; // function/yellow

const X_AXIS_14 = [
  "Jan 3",
  "Jan 10",
  "Jan 17",
  "Jan 24",
  "Jan 31",
  "Feb 7",
  "Feb 14",
  "Feb 21",
  "Feb 28",
  "Mar 7",
  "Mar 14",
  "Mar 21",
  "Mar 28",
  "Apr 4",
];

const COUNTDOWN_DEFAULT: BannerCountdownMock = {
  days: 90,
  hours: 31,
  minutes: 31,
  seconds: 14,
};

export const BANNER_DETAIL_FIXTURES: Record<TemplateId, BannerDetailFixture> = {
  // ============================================================
  // top_wins_the_world_cup — 2026 FIFA World Cup Winner（夺冠盘）
  // 趋势：Spain 16.15% / England 11.15% / France 11.15% / Argentina 8.8%
  // ============================================================
  top_wins_the_world_cup: {
    trend: {
      series: [
        {
          key: "ES",
          label: "Spain",
          color: COLOR_ORANGE,
          values: [12, 13, 14, 13.5, 14.5, 15, 14.8, 15.2, 15.5, 15.8, 16, 16.1, 16.15, 16.15],
          pctLabel: "16.15%",
        },
        {
          key: "GB-ENG",
          label: "England",
          color: COLOR_TEAL,
          values: [9, 9.5, 10, 10.5, 10.2, 10.5, 10.8, 10.6, 10.9, 11, 11.1, 11.15, 11.15, 11.15],
          pctLabel: "11.15%",
        },
        {
          key: "FR",
          label: "France",
          color: COLOR_BLUE,
          values: [
            13, 12.5, 12, 11.8, 11.5, 11.3, 11.4, 11.2, 11.1, 11.15, 11.15, 11.15, 11.15, 11.15,
          ],
          pctLabel: "11.15%",
        },
        {
          key: "AR",
          label: "Argentina",
          color: COLOR_YELLOW,
          values: [10, 9.8, 9.5, 9.3, 9.1, 9, 8.9, 8.85, 8.8, 8.8, 8.8, 8.8, 8.8, 8.8],
          pctLabel: "8.8%",
        },
      ],
      xAxisLabels: X_AXIS_14,
      yMax: 30,
    },
    countdown: COUNTDOWN_DEFAULT,
    fallbackTitle: "2026 FIFA World Cup Winner",
  },

  // ============================================================
  // total_goals — Total goals scored by Cristiano Ronaldo（C 罗进球总数）
  // 趋势：1 goal 24% / 2 goals 22% / 0 goal 15% / 3 goals 14%（Top 4 by implied_probability）
  // ============================================================
  total_goals: {
    trend: {
      series: [
        {
          key: "1",
          label: "1 goal",
          color: COLOR_ORANGE,
          values: [18, 19, 20, 21, 21.5, 22, 22.5, 23, 23.5, 23.8, 24, 24, 24, 24],
          pctLabel: "24%",
        },
        {
          key: "2",
          label: "2 goals",
          color: COLOR_TEAL,
          values: [25, 24.5, 24, 23.5, 23, 22.8, 22.5, 22.3, 22.1, 22, 22, 22, 22, 22],
          pctLabel: "22%",
        },
        {
          key: "0",
          label: "0 goal",
          color: COLOR_BLUE,
          values: [12, 12.5, 13, 13.5, 14, 14.2, 14.5, 14.7, 14.9, 15, 15, 15, 15, 15],
          pctLabel: "15%",
        },
        {
          key: "3",
          label: "3 goals",
          color: COLOR_YELLOW,
          values: [16, 15.5, 15, 14.8, 14.6, 14.4, 14.3, 14.2, 14.1, 14, 14, 14, 14, 14],
          pctLabel: "14%",
        },
      ],
      xAxisLabels: X_AXIS_14,
      yMax: 30,
    },
    countdown: COUNTDOWN_DEFAULT,
    fallbackTitle: "Total goals scored by Cristiano Ronaldo",
  },

  // ============================================================
  // top_golden_ball_name — Golden Ball / MVP（Top 4）
  // 球员排名 mock，4 个候选趋势
  // ============================================================
  top_golden_ball_name: {
    trend: {
      series: [
        {
          key: "p_messi",
          label: "Messi",
          color: COLOR_ORANGE,
          values: [20, 21, 21.5, 22, 22.5, 23, 23.2, 23.5, 23.8, 24, 24.2, 24.5, 24.7, 25],
          pctLabel: "25%",
        },
        {
          key: "p_ronaldo",
          label: "Ronaldo",
          color: COLOR_TEAL,
          values: [18, 17.5, 17, 16.8, 16.5, 16.3, 16, 15.8, 15.6, 15.4, 15.2, 15, 15, 15],
          pctLabel: "15%",
        },
        {
          key: "p_mbappe",
          label: "Mbappé",
          color: COLOR_BLUE,
          values: [10, 10.5, 11, 11.5, 12, 12.3, 12.5, 12.7, 12.9, 13, 13, 13, 13, 13],
          pctLabel: "13%",
        },
        {
          key: "p_bellingham",
          label: "Bellingham",
          color: COLOR_YELLOW,
          values: [8, 8.5, 9, 9.3, 9.5, 9.7, 9.9, 10, 10.2, 10.4, 10.6, 10.8, 10.9, 11],
          pctLabel: "11%",
        },
      ],
      xAxisLabels: X_AXIS_14,
      yMax: 30,
    },
    countdown: COUNTDOWN_DEFAULT,
    fallbackTitle: "Who is the MVP player?",
  },

  // ============================================================
  // top_golden_boot_name — Golden Boot（最佳射手 Top 4）
  // ============================================================
  top_golden_boot_name: {
    trend: {
      series: [
        {
          key: "p_haaland",
          label: "Haaland",
          color: COLOR_ORANGE,
          values: [15, 16, 17, 18, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.3, 22.5, 22.5],
          pctLabel: "22.5%",
        },
        {
          key: "p_mbappe",
          label: "Mbappé",
          color: COLOR_TEAL,
          values: [22, 21, 20.5, 20, 19.5, 19.3, 19, 18.7, 18.5, 18.3, 18.2, 18.1, 18, 18],
          pctLabel: "18%",
        },
        {
          key: "p_kane",
          label: "Kane",
          color: COLOR_BLUE,
          values: [11, 11.5, 12, 12.5, 13, 13.3, 13.5, 13.7, 13.9, 14, 14, 14, 14, 14],
          pctLabel: "14%",
        },
        {
          key: "p_messi",
          label: "Messi",
          color: COLOR_YELLOW,
          values: [9, 9.5, 10, 10.3, 10.5, 10.7, 10.8, 10.9, 11, 11, 11, 11, 11, 11],
          pctLabel: "11%",
        },
      ],
      xAxisLabels: X_AXIS_14,
      yMax: 30,
    },
    countdown: COUNTDOWN_DEFAULT,
    fallbackTitle: "Golden Boot — Top Scorer",
  },

  // ============================================================
  // top_golden_glove_name — Golden Glove（最佳门将 Top 4）
  // ============================================================
  top_golden_glove_name: {
    trend: {
      series: [
        {
          key: "p_courtois",
          label: "Courtois",
          color: COLOR_ORANGE,
          values: [18, 18.5, 19, 19.5, 20, 20.3, 20.5, 20.7, 20.9, 21, 21, 21, 21, 21],
          pctLabel: "21%",
        },
        {
          key: "p_alisson",
          label: "Alisson",
          color: COLOR_TEAL,
          values: [16, 16.2, 16.5, 16.8, 17, 17.2, 17.3, 17.4, 17.5, 17.5, 17.5, 17.5, 17.5, 17.5],
          pctLabel: "17.5%",
        },
        {
          key: "p_donnarumma",
          label: "Donnarumma",
          color: COLOR_BLUE,
          values: [12, 12.5, 13, 13.5, 14, 14.3, 14.5, 14.6, 14.7, 14.8, 14.9, 15, 15, 15],
          pctLabel: "15%",
        },
        {
          key: "p_neuer",
          label: "Neuer",
          color: COLOR_YELLOW,
          values: [11, 10.8, 10.5, 10.3, 10.1, 10, 10, 10, 10, 10, 10, 10, 10, 10],
          pctLabel: "10%",
        },
      ],
      xAxisLabels: X_AXIS_14,
      yMax: 30,
    },
    countdown: COUNTDOWN_DEFAULT,
    fallbackTitle: "Golden Glove — Best Goalkeeper",
  },
};
