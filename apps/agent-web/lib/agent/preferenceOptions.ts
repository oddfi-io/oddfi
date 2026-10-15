export const TEAM_OPTIONS = [
  "阿根廷",
  "法国",
  "巴西",
  "西班牙",
  "英格兰",
  "德国",
  "葡萄牙",
  "荷兰",
  "克罗地亚",
  "摩洛哥",
  "纽卡斯尔",
  "曼城",
  "利物浦",
  "阿森纳",
  "皇马",
  "巴萨",
  "拜仁",
  "国米",
];

export const PLAYER_OPTIONS = [
  "梅西",
  "姆巴佩",
  "哈兰德",
  "C罗",
  "贝林厄姆",
  "维尼修斯",
  "凯恩",
  "德布劳内",
  "萨拉赫",
  "劳塔罗",
  "穆夏拉",
  "登贝莱",
];

export const COMPETITION_OPTIONS = [
  "世界杯",
  "EPL 英超",
  "La Liga 西甲",
  "Serie A 意甲",
  "Bundesliga 德甲",
  "Ligue 1 法甲",
  "UCL 欧冠",
  "淘汰赛",
  "决赛",
];

export interface SourceOption {
  id: string;
  icon: string;
  name: string;
}

export const SOURCE_OPTIONS: SourceOption[] = [
  { id: "fifa", icon: "⚽", name: "FIFA / 联赛官方" },
  { id: "twitter", icon: "🐦", name: "X / Twitter" },
  { id: "media", icon: "📰", name: "体育媒体（ESPN/BBC）" },
  { id: "smart_money", icon: "💎", name: "链上 Smart Money" },
  { id: "opta", icon: "📊", name: "Opta / FBref" },
  { id: "market", icon: "🌐", name: "Pinnacle / Polymarket" },
];

export interface FrequencyOption {
  id: string;
  icon: string;
  name: string;
  description: string;
}

export const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { id: "realtime", icon: "⚡", name: "实时", description: "事件发生即推" },
  { id: "5min", icon: "🕐", name: "5min 摘要", description: "5 分钟聚合一次" },
  { id: "1h", icon: "🕒", name: "1h 摘要", description: "整点聚合" },
  { id: "key", icon: "🔔", name: "仅关键", description: "只推 5 类高优事件" },
];

export const DEFAULT_FREQUENCY = "5min";

export interface UserPreferences {
  teams: string[];
  players: string[];
  competitions: string[];
  sources: string[];
  frequency: string;
}
