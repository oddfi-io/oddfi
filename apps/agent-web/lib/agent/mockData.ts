export const RISK_LABELS = [
  "极度保守",
  "保守",
  "保守偏中性",
  "中等保守",
  "中等",
  "中性",
  "中等进取",
  "偏进取",
  "进取",
  "高度进取",
  "极度进取",
];

export interface PushType {
  id: string;
  title: string;
  description: string;
  defaultOn: boolean;
}

export const PUSH_TYPES: PushType[] = [
  { id: "login_summon", title: "登录召唤", description: "登录瞬间主动打招呼，最低优先级，超频会被丢弃", defaultOn: true },
  { id: "pre_match", title: "赛前分析", description: "关注比赛开赛前 4–6 小时主动推送深度分析", defaultOn: true },
  { id: "live_update", title: "临场更新", description: "开赛前 30 分钟，最高优先级（错过即不可补）", defaultOn: true },
  { id: "recap", title: "复盘", description: "比赛结束后回顾结果与 AI 自评", defaultOn: true },
  { id: "high_priority", title: "高优事件突破上限", description: "比赛取消、阵容剧变、赔率异动等可突破软上限", defaultOn: true },
];

export interface SoundPreset {
  id: string;
  name: string;
}

export const SOUND_PRESETS: SoundPreset[] = [
  { id: "bell", name: "叮" },
  { id: "chime", name: "风铃" },
  { id: "ping", name: "清脆" },
  { id: "koto", name: "古琴" },
  { id: "pulse", name: "通讯" },
];

export const DEFAULT_COUNTRIES = [
  "西班牙",
  "法国",
  "英格兰",
  "阿根廷",
  "巴西",
  "葡萄牙",
  "德国",
  "荷兰",
  "比利时",
  "克罗地亚",
  "意大利",
];

export const DEFAULT_PLAYERS = [
  "梅西",
  "姆巴佩",
  "亚马尔",
  "C 罗",
  "贝林厄姆",
  "哈兰德",
  "孙兴慜",
  "维尼修斯",
  "凯恩",
  "佩里西奇",
  "内马尔",
  "萨拉赫",
  "莫德里奇",
];

export const MOCK_USER = {
  tier: 3,
  creditsBalance: 347,
  monthlyConsumed: 512,
};

export function generateDailyConsumption(days: number): number[] {
  const seed = [12, 8, 15, 10, 0, 25, 32, 18, 14, 11, 9, 0, 22, 28, 16, 13, 10, 8, 0, 19, 35, 24, 17, 12, 11, 9, 0, 21, 30, 23];
  const repeats = Math.ceil(days / seed.length);
  const expanded: number[] = [];
  for (let i = 0; i < repeats; i++) expanded.push(...seed);
  return expanded.slice(-days);
}

export interface MemoryObservation {
  text: string;
  confidence: "high" | "mid" | "low";
  meta: string;
}

export interface MemoryCategory {
  id: string;
  icon: string;
  name: string;
  preview: string;
  observations: MemoryObservation[];
}

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  {
    id: "focus",
    icon: "🎯",
    name: "关注偏好",
    preview: "阿根廷、西班牙、巴西 · 梅西 · 欧洲足球",
    observations: [
      { text: "关注球队：阿根廷 · 西班牙 · 巴西", confidence: "high", meta: "基于 2 个月 47 次相关查询 · 沉淀于 2 个月前" },
      { text: "关注球员：梅西", confidence: "high", meta: "基于 2 个月 23 次相关对话 · 沉淀于 2 个月前" },
      { text: "主看赛事：欧洲杯 / 美洲杯 / 英超", confidence: "mid", meta: "基于 41 笔订单的赛事分布 · 沉淀于 1 个月前" },
    ],
  },
  {
    id: "behavior",
    icon: "📊",
    name: "行为模式",
    preview: "稳健型 · 平均单注 1,180 ODD · 偏好平局",
    observations: [
      { text: "周末早场（10:00-12:00）命中率较低", confidence: "mid", meta: "基于 18 笔早场订单，胜率 38% vs 整体 56% · 沉淀于 3 天前" },
      { text: "单注金额倾向 1,000-1,500 ODD", confidence: "high", meta: "基于近 60 笔订单平均 1,180 ODD · 沉淀于 1 周前" },
      { text: "偏好平局和冷门价值（赔率 ≥ 3.0）", confidence: "high", meta: "基于 60 笔订单中 41% 选项赔率 ≥ 3.0 · 沉淀于 2 周前" },
      { text: "连输 3 场后历史上有报复性加注倾向", confidence: "mid", meta: "基于近半年 6 次连输事件中 4 次出现加注 · 沉淀于 1 个月前" },
      { text: "深夜 23:00 后下注准确率比白天低 12%", confidence: "low", meta: "基于 7 笔深夜订单，样本偏少 · 沉淀于 5 天前" },
    ],
  },
  {
    id: "dialogue",
    icon: "💬",
    name: "对话偏好",
    preview: "喜欢简短 · 不要表情 · 数据驱动",
    observations: [
      { text: "喜欢简短直接的回复，不喜欢冗长解释", confidence: "high", meta: "基于 8 次「太长了」或「简短点」反馈 · 沉淀于 2 周前" },
      { text: "不喜欢 AI 加表情符号", confidence: "high", meta: "基于 3 次明确反馈 + 你的回复中也很少用 · 沉淀于 1 个月前" },
      { text: "听到具体数字和概率比形容词更买账", confidence: "mid", meta: "基于带数据的推荐 vs 不带数据的推荐，你跟单率 +18% · 沉淀于 3 周前" },
    ],
  },
  {
    id: "rhythm",
    icon: "🌙",
    name: "状态与节奏",
    preview: "22:00 后上线 · 输后停 1-2 小时",
    observations: [
      { text: "通常 22:00 后上线，周末早上 9:00 也会出现", confidence: "high", meta: "基于近 90 天登录时间分布 · 沉淀于 1 个月前" },
      { text: "输了一场后会停止 1-2 小时，不是即刻加注型", confidence: "high", meta: "基于近 30 次输场后行为追踪 · 沉淀于 2 周前" },
      { text: "周一活跃度低，周末晚上最活跃", confidence: "mid", meta: "基于 8 周对话与下注频次 · 沉淀于 3 周前" },
    ],
  },
  {
    id: "tilt",
    icon: "🚨",
    name: "冲动信号",
    preview: "3 条个人化 Tilt 模式",
    observations: [
      { text: "周末早场容易冲动 → 那时段我会更保守", confidence: "mid", meta: "关联行为模式中「早场命中率低」那条 · 沉淀于 3 天前" },
      { text: "你说「喝了点」时，我会拒绝推荐高额下注", confidence: "mid", meta: "基于 2 次显式提及 + 之后 4 笔订单结果 · 沉淀于 2 周前" },
      { text: "节制器命中后你会忽略 30% 的劝阻 → 加强语气", confidence: "low", meta: "基于 10 次节制器触发，样本偏少 · 沉淀于 1 周前" },
    ],
  },
  {
    id: "knowledge",
    icon: "🎓",
    name: "知识地图",
    preview: "懂 xG · 不熟 NBA · 半年用户",
    observations: [
      { text: "看得懂 xG 数据，可以直接用术语", confidence: "high", meta: "基于你主动使用 xG 一词 12 次 · 沉淀于 2 周前" },
      { text: "对欧洲足球熟，NBA 几乎不下注", confidence: "high", meta: "基于近 60 笔订单 0 笔 NBA · 沉淀于 1 个月前" },
      { text: "不熟悉美式赔率，需要换算成小数赔率", confidence: "mid", meta: "基于你问过 2 次「+150 是什么意思」 · 沉淀于 3 周前" },
      { text: "大约半年前开始使用 OddFi", confidence: "high", meta: "基于账户注册时间 · 沉淀于 6 个月前" },
    ],
  },
];

export const MEMORY_SUMMARY =
  "这是 D 同学。投注 2 年，主看欧洲足球，关注阿根廷和西班牙，偏好平局和冷门价值。常在周末上午下注，但周末早场命中率较低，我会在那时段更保守。整体属于稳健型玩家，不追热门。听到具体数字和概率比形容词更买账，不喜欢冗长解释。";

export const MEMORY_META = {
  lastUpdated: "2 小时前",
  observationCount: 21,
  dataBasis: "126 笔订单 · 348 次对话",
};

export const ODD_TO_USD_RATE = 0.1;
export const MIN_BET_AMOUNT_ODD = 1000;
