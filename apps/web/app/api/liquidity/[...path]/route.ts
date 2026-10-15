import { type NextRequest, NextResponse } from "next/server";
import { proxyRequest, sanitizePath } from "@/lib/proxy";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://api.oddfi.io";

/**
 * DD-130 公开流动性接口代理：/api/liquidity/* → BACKEND_URL/liquidity/*
 *
 * 仅 GET：/liquidity/match/pools、/liquidity/global/plans 均为公开免鉴权接口。
 * 不透传 Authorization（公开数据，且与 account 代理区分开）。
 * 后端 match/pools 自带 5s 缓存；这里 no-store 让前端自行用 TanStack Query 控制刷新节奏。
 */
// 仅放行已知公开只读接口，避免代理穿透到 /liquidity/ 下未来可能的私有路由（REV-v1 m3）
const ALLOWED_PATHS = new Set(["match/pools", "global/plans"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  if (!ALLOWED_PATHS.has(safe.join("/"))) {
    return NextResponse.json({ code: -1, message: "Not found" }, { status: 404 });
  }
  const qs = req.nextUrl.searchParams.toString();
  const endpoint = qs ? `${safe.join("/")}?${qs}` : safe.join("/");
  const response = await proxyRequest(`${BACKEND_URL}/liquidity/${endpoint}`, "GET", null);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
