export interface ChatMessage {
  from: "agent" | "user";
  text: string;
  timestamp: string;
}

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    from: "agent",
    text: "嗨 Cat，注意到你关注的阿根廷今晚 22:00 有一场关键比赛对巴西。要看看赛前分析吗？",
    timestamp: "14:32",
  },
  { from: "user", text: "好啊，给我一份", timestamp: "14:32" },
  {
    from: "agent",
    text: "整理了 3 条关键论据 + 1 条不知道的事。AI 估主胜 48% vs 市场 41%，有 +7pp 价值。建议仓位 1,000–1,500 ODD。要不要切到「分析」Tab 看详情？",
    timestamp: "14:33",
  },
  { from: "user", text: "你刚才说不知道的事是什么？", timestamp: "14:35" },
  {
    from: "agent",
    text: "巴西门将 Bento 状态未知，是否首发待开赛前 30 分钟才能确认。如果首发的是 Ederson，扑救数据会显著不同。这会影响我对主胜概率的估计。",
    timestamp: "14:35",
  },
];

export type PushTagKind = "odds" | "match" | "market";

export interface PushPosition {
  pick: string;
  entryOdd: number;
  stake: number;
  newOdd: number;
  pnl: number;
}

export interface PushSuggest {
  text: string;
  action: string;
  alt: string;
}

export interface PushAiAnalysis {
  change: string;
  priceImpact: string;
  probImpact: string;
}

// 与后端 internal/pushtypes/types.go 的 PushCard 对齐
export interface DockPush {
  id: string;
  tag?: PushTagKind | "";           // 增强后才有
  tagLabel?: string;                 // 增强后才有
  time: string;
  title?: string;                    // 增强后才有
  originalText: string;              // 永远有 — 推文原文
  source: string;
  sourceUrl: string;
  authorName?: string;
  match?: string;
  aiAnalysis?: PushAiAnalysis;       // 增强后才有
  suggest?: PushSuggest;             // 增强后才有
  position?: PushPosition;
  createdAt: number;
  aiEnriched: boolean;
}

export interface AnalysisUpcoming {
  id: string;
  match: string;
  startTime: string;
  hoursToStart: number;
  aiProb: { home: number; draw: number; away: number };
  marketProb: { home: number; draw: number; away: number };
  evidence: string[];
  unknown: string;
  suggestionRange: string;
  pickLabel: string;
  pickOdds: number;
}

export const MOCK_UPCOMING: AnalysisUpcoming[] = [
  {
    id: "u1",
    match: "阿根廷 vs 巴西",
    startTime: "今晚 22:00",
    hoursToStart: 5.5,
    aiProb: { home: 48, draw: 28, away: 24 },
    marketProb: { home: 41, draw: 29, away: 30 },
    evidence: [
      "梅西伤愈复出，首发概率 90%（Olé · 2h 前 · 高置信）",
      "巴西内马尔停赛，中场创造力下降（UOL · 4h 前 · 高置信）",
      "近 5 次交锋阿根廷 3 胜 1 平 1 负（FBref · 中置信）",
    ],
    unknown: "巴西门将 Bento 状态未知，开赛前 30 分钟才能确认",
    suggestionRange: "1,000 – 1,500 ODD",
    pickLabel: "主胜",
    pickOdds: 2.4,
  },
  {
    id: "u2",
    match: "曼城 vs 利物浦",
    startTime: "明天 03:30",
    hoursToStart: 11,
    aiProb: { home: 52, draw: 24, away: 24 },
    marketProb: { home: 48, draw: 25, away: 27 },
    evidence: [
      "曼城主场近 10 场 8 胜 1 平 1 负（Opta · 高置信）",
      "利物浦客场状态下滑（FBref · 中置信）",
      "Haaland 状态正佳（5 场 6 球）（BBC · 高置信）",
    ],
    unknown: "天气：暴雨预报，可能影响传控",
    suggestionRange: "1,000 – 1,200 ODD",
    pickLabel: "主胜 -0.5",
    pickOdds: 1.95,
  },
];

export interface AnalysisRecap {
  id: string;
  match: string;
  finishedAt: string;
  result: string;
  yourBet: string;
  stake: number;
  payout: number;
  aiCallCorrect: boolean;
  todayPnl: number;
  weekPnl: number;
}

export const MOCK_RECAP: AnalysisRecap[] = [
  {
    id: "r1",
    match: "皇马 vs 曼城",
    finishedAt: "今天 02:30",
    result: "皇马 2-1 曼城",
    yourBet: "皇马主胜",
    stake: 1200,
    payout: 2220,
    aiCallCorrect: true,
    todayPnl: 1020,
    weekPnl: 2840,
  },
];
