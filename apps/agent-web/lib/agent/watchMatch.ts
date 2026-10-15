// 纯匹配逻辑（无 react / 无 @ 别名依赖），可被 watchlist.ts 复用 + 被测试直接导入。
import type { DockPush } from "./dockMockData";

export interface Watchlist {
  countries: string[];
  players: string[];
}

// 中文关键词 → 匹配别名（含中文本身 + 英文/西语变体）。
// 推文原文是英文，Grok 增强后 title 是中文，所以两边都要能命中。
export const ALIASES: Record<string, string[]> = {
  // 国家
  西班牙: ["España", "Espana", "Spain", "Spanish"],
  法国: ["France", "French", "Les Bleus"],
  英格兰: ["England", "English", "Three Lions"],
  阿根廷: ["Argentina", "Argentine", "Albiceleste"],
  巴西: ["Brazil", "Brasil", "Brazilian", "Seleção"],
  葡萄牙: ["Portugal", "Portuguese"],
  德国: ["Germany", "German", "Deutschland"],
  荷兰: ["Netherlands", "Holland", "Dutch", "Oranje"],
  比利时: ["Belgium", "Belgian"],
  克罗地亚: ["Croatia", "Croatian", "Hrvatska"],
  意大利: ["Italy", "Italia", "Italian", "Azzurri"],
  // 球星
  梅西: ["Messi", "Leo Messi", "Lionel Messi"],
  姆巴佩: ["Mbappé", "Mbappe", "Kylian"],
  亚马尔: ["Yamal", "Lamine"],
  "C 罗": ["Ronaldo", "Cristiano", "CR7"],
  C罗: ["Ronaldo", "Cristiano", "CR7"],
  贝林厄姆: ["Bellingham", "Jude"],
  哈兰德: ["Haaland", "Erling"],
  孙兴慜: ["Son Heung-min", "Son", "Heung-min"],
  维尼修斯: ["Vinícius", "Vinicius", "Vini Jr", "Vini"],
  凯恩: ["Kane", "Harry Kane"],
  佩里西奇: ["Perišić", "Perisic"],
  内马尔: ["Neymar", "Ney"],
  萨拉赫: ["Salah", "Mo Salah", "Mohamed Salah"],
  莫德里奇: ["Modrić", "Modric", "Luka"],
};

function aliasesFor(term: string): string[] {
  const noSpace = term.replace(/\s/g, "");
  const fromMap = ALIASES[term] ?? ALIASES[noSpace] ?? [];
  // 总是包含关键词本身（命中中文 title）+ 无空格变体
  return [term, noSpace, ...fromMap];
}

// 去重音 + 小写，统一中英比较口径（Mbappé → mbappe，避免重音漏匹配）
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const CJK_RE = /[㐀-鿿豈-﫿＀-￯]/;
function hasCJK(s: string): boolean {
  return CJK_RE.test(s);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Matcher = (haystack: string) => boolean;

// 召回优先（宁可多推，绝不漏）：长词放宽到「起始边界」，容忍复数/词形
// 变体（Argentine→Argentines）；短词仍用完整边界，否则 season/money 之类
// 会命中 Son/Ney 把每条推文都污染成噪音，反而让过滤失效。
const MIN_PREFIX_LEN = 5;

// 把一个关注词编译成一组 matcher：
// - 含 CJK（中文）→ 子串匹配（中文无词边界）
// - 拉丁长词（≥5）→ 起始边界 \bword（容忍后缀，多推不漏）
// - 拉丁短词（<5）→ 完整边界 \bword\b（防 "season" 命中 "Son"）
function compileTerm(term: string): Matcher[] {
  const out: Matcher[] = [];
  for (const alias of aliasesFor(term)) {
    const a = normalize(alias.trim());
    if (!a) continue;
    if (hasCJK(alias)) {
      out.push((h) => h.includes(a));
    } else {
      const re =
        a.replace(/\s/g, "").length >= MIN_PREFIX_LEN
          ? new RegExp(`\\b${escapeRe(a)}`)
          : new RegExp(`\\b${escapeRe(a)}\\b`);
      out.push((h) => re.test(h));
    }
  }
  return out;
}

function buildHaystack(card: DockPush): string {
  return normalize(
    [
      card.title,
      card.originalText,
      card.match,
      card.authorName,
      card.aiAnalysis?.change,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

// 构建一次性 matcher（每次渲染编译一次，而非每张卡都编译，省 regex 开销）。
// 空关注列表视为「不过滤」（全部命中）。
export function buildWatchMatcher(wl: Watchlist): (card: DockPush) => boolean {
  const terms = [...wl.countries, ...wl.players];
  if (terms.length === 0) return () => true;
  const matchers = terms.flatMap(compileTerm);
  return (card) => {
    const hay = buildHaystack(card);
    if (!hay) return false;
    return matchers.some((m) => m(hay));
  };
}

// 单卡便捷封装（主要给测试 / 一次性调用用）
export function matchesWatchlist(card: DockPush, wl: Watchlist): boolean {
  return buildWatchMatcher(wl)(card);
}
