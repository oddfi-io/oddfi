// 对抗性测试：直接导入出货的匹配逻辑，不复制。
// 运行：npx --yes tsx scripts/watchMatch.adversarial.ts
import { matchesWatchlist, type Watchlist } from "../lib/agent/watchMatch";
import { DEFAULT_COUNTRIES, DEFAULT_PLAYERS } from "../lib/agent/mockData";

const WL: Watchlist = {
  countries: DEFAULT_COUNTRIES,
  players: DEFAULT_PLAYERS,
};

type Case = {
  name: string;
  card: Record<string, unknown>;
  wl?: Watchlist;
  want: boolean;
};

const card = (fields: Record<string, unknown>) => ({
  id: "t",
  time: "刚刚",
  source: "🐦 @test",
  sourceUrl: "",
  createdAt: 0,
  aiEnriched: false,
  ...fields,
});

const cases: Case[] = [
  // ── 正命中：必须匹配 ──
  { name: "中文title-梅西", card: card({ title: "梅西世界杯出场数历史第一", originalText: "Messi sets record" }), want: true },
  { name: "英文原文-Lionel Messi", card: card({ originalText: "Lionel Messi is the all-time leader" }), want: true },
  { name: "英文-Argentina beat Brazil", card: card({ originalText: "Argentina beat Brazil 2-0" }), want: true },
  { name: "重音-Kylian Mbappé", card: card({ originalText: "Kylian Mbappé scores again" }), want: true },
  { name: "C罗-Cristiano Ronaldo CR7", card: card({ originalText: "Cristiano Ronaldo CR7 brace" }), want: true },
  { name: "哈兰德-Haaland", card: card({ originalText: "Haaland brace seals the win" }), want: true },
  { name: "孙兴慜-Son独立词", card: card({ originalText: "Son scored a hat-trick tonight" }), want: true },
  { name: "内马尔-Neymar(默认列表已含)", card: card({ originalText: "Neymar returns from injury" }), want: true },
  { name: "萨拉赫-Salah(默认列表已含)", card: card({ originalText: "Mohamed Salah scores again" }), want: true },
  { name: "莫德里奇-Modric(默认列表已含)", card: card({ originalText: "Luka Modric extends contract" }), want: true },
  { name: "意大利-Italy(默认列表已含)", card: card({ originalText: "Italy qualify for the final" }), want: true },
  // 召回优先：复数/词形也要命中（宁可多推绝不漏）
  { name: "复数-Argentines(多推不漏)", card: card({ originalText: "Argentines celebrate the win" }), want: true },
  { name: "复数-Brazilians(多推不漏)", card: card({ originalText: "Brazilians dominate possession" }), want: true },
  { name: "hashtag-#Argentina", card: card({ originalText: "#Argentina win the cup" }), want: true },
  { name: "重音-Vinícius", card: card({ originalText: "Vinícius Júnior on fire" }), want: true },
  { name: "中文无空格-C罗加盟", card: card({ title: "C罗加盟新球队", originalText: "transfer news" }), want: true },
  { name: "match字段命中", card: card({ originalText: "big game tonight", match: "France vs Germany" }), want: true },

  // ── 误伤：必须 NOT 匹配（对抗核心）──
  { name: "season≠Son(孙兴慜)", card: card({ originalText: "Premier League season opens this weekend" }), want: false },
  { name: "money≠Ney(内马尔)", card: card({ originalText: "He spent a lot of money on transfers" }), want: false },
  { name: "Rooney≠Ney(内马尔)", card: card({ originalText: "Wayne Rooney returns to management" }), want: false },
  { name: "Kanté≠Kane(凯恩)", card: card({ originalText: "N'Golo Kante injured in training" }), want: false },
  // 召回优先策略下，France(长词起始边界)会命中 Frances —— 可接受的「多推」
  { name: "Frances→France(可接受多推)", card: card({ originalText: "Frances Tiafoe wins in tennis" }), want: true },
  { name: "完全无关-NBA", card: card({ originalText: "NBA Lakers beat Celtics in overtime" }), want: false },
  { name: "Partey签证(真实漏网案例)", card: card({ title: "加纳为帕尔特伊签证上诉", originalText: "court hearing in Ottawa" }), want: false },

  // ── 边界 ──
  { name: "空关注列表→全过", card: card({ originalText: "anything goes here" }), wl: { countries: [], players: [] }, want: true },
  { name: "空文本→不匹配", card: card({ originalText: "" }), want: false },
  { name: "自定义拉丁词-PSG命中", card: card({ originalText: "PSG win the league" }), wl: { countries: [], players: ["PSG"] }, want: true },
  { name: "自定义拉丁词-PSGs不误伤", card: card({ originalText: "the PSGs fan club" }), wl: { countries: [], players: ["PSG"] }, want: false },
  { name: "自定义中文词-皇马", card: card({ originalText: "皇马 2-1 巴萨", title: "" }), wl: { countries: [], players: ["皇马"] }, want: true },
];

let pass = 0;
const fails: string[] = [];
for (const c of cases) {
  const got = matchesWatchlist(c.card as never, c.wl ?? WL);
  const ok = got === c.want;
  if (ok) pass++;
  else fails.push(`✗ ${c.name}: got=${got} want=${c.want}`);
  console.log(`${ok ? "✓" : "✗"} ${c.name}`);
}
console.log(`\n${pass}/${cases.length} passed`);
if (fails.length) {
  console.log("\nFAILURES:\n" + fails.join("\n"));
  process.exit(1);
}
