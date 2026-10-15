#!/usr/bin/env tsx
/**
 * fetch-wc-fixtures — 抓取 FIFA World Cup 26 全量赛程并保存为 JSON 快照。
 *
 * 用法：
 *   pnpm tsx scripts/fetch-wc-fixtures.ts
 *
 * 数据来源：oddfi market-api `GET /api/v1/detail/sports_all?league=732&page={1..N}`
 * 输出文件：lib/calendar/data/wc-fixtures.json
 *
 * 当后端 schedule 调整（球队伤病、场地变更、淘汰赛对阵确定等），
 * 重新跑此脚本刷新 mock 数据。详见 DD-091 §3.2。
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const API_BASE = "https://www.oddfi.io/api/v1/detail/sports_all";
const LEAGUE_ID = 732;
const MAX_PAGES = 20;
const OUTPUT_PATH = resolve(__dirname, "../lib/calendar/data/wc-fixtures.json");

interface SportsAllResponse {
  code: number;
  msg: string;
  data: Array<Record<string, unknown>>;
}

async function fetchPage(page: number): Promise<Array<Record<string, unknown>>> {
  const url = `${API_BASE}?league=${LEAGUE_ID}&app_lang=en&locale=en&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[fetch-wc-fixtures] HTTP ${res.status} on page ${page}`);
  const json = (await res.json()) as SportsAllResponse;
  if (json.code !== 200) throw new Error(`[fetch-wc-fixtures] code=${json.code} msg=${json.msg}`);
  return json.data;
}

async function main() {
  console.log(`[fetch-wc-fixtures] Starting — league=${LEAGUE_ID}`);
  const all: Array<Record<string, unknown>> = [];

  for (let p = 1; p <= MAX_PAGES; p++) {
    const list = await fetchPage(p);
    if (list.length === 0) {
      console.log(`[fetch-wc-fixtures] Page ${p} empty — stopping`);
      break;
    }
    all.push(...list);
    console.log(`[fetch-wc-fixtures] Page ${p}: +${list.length} (total=${all.length})`);
    if (list.length < 25) break;
  }

  const stages = new Set(all.map((f) => f.stage_id));
  const dates = new Set(all.map((f) => (f.starting_at as string).slice(0, 10)));
  console.log(
    `[fetch-wc-fixtures] Done — fixtures=${all.length} stages=${stages.size} dates=${dates.size}`
  );

  await writeFile(OUTPUT_PATH, JSON.stringify(all, null, 2) + "\n", "utf-8");
  console.log(`[fetch-wc-fixtures] Saved → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[fetch-wc-fixtures] Failed:", err);
  process.exit(1);
});
