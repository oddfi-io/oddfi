/**
 * Calendar 数据抽象层。
 *
 * 当前实现：从 `lib/calendar/data/wc-fixtures.json` 静态快照返回。
 * 未来切换真实接口：替换 fetcher 为 `client.get('v1/detail/sports_all', { searchParams: {league: 732, page} })`
 * 拼接所有页，hooks/组件零改动。
 *
 * 详见 DD-091 §3.2 + §3.7。
 */
import type { SportmonksFixture } from "@/types/api";
import type { CalendarTournament } from "@/types/calendar";
import wcFixtures from "./data/wc-fixtures.json";
import { MOCK_API_DELAY_MS } from "./constants";
import { deriveTournamentMeta } from "./tournament-meta";

/** 静态 fixtures 强制 cast（已校验 shape，详见 PRECHECK §7） */
const STATIC_FIXTURES = wcFixtures as unknown as SportmonksFixture[];

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 拉取赛事元（stages + dates + groups + tournament_window）。
 * 注：locale 参数预留 — 当前 mock 不切语言，将来真实接口可按 locale 拉本地化文案。
 */
export async function getCalendarTournament(): Promise<CalendarTournament> {
  await delay(MOCK_API_DELAY_MS);
  return deriveTournamentMeta(STATIC_FIXTURES);
}

/**
 * 拉取整届 104 场比赛列表。
 * 与 PRD §3.3 总规则一致 — 一次性返回，不分页。
 */
export async function getCalendarMatches(): Promise<SportmonksFixture[]> {
  await delay(MOCK_API_DELAY_MS);
  // 演示阶段统一 pre_open — 后端真实赔率上线后改为 withRealOdds() 或直接返回 API 数据
  return [...STATIC_FIXTURES];
}

/**
 * 按 fixture_id 取单场详情（用于 Calendar 详情列）。
 *
 * 与 `lib/api.ts:getMarketFixtureDetail` 不同 — 后者走真实后端 useQuery，本函数
 * 只查静态快照。Calendar 详情列复用 `MatchDetailContent` 纯展示组件，直接吃此
 * 函数返回值，**不走** TanStack Query 的 refetchInterval（详见 DD-091 §3.4）。
 */
export async function getCalendarMatchById(fixtureId: number): Promise<SportmonksFixture | null> {
  await delay(MOCK_API_DELAY_MS);
  const fixture = STATIC_FIXTURES.find((f) => f.id === fixtureId);
  return fixture ?? null;
}
