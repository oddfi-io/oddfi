import { type NextRequest, NextResponse } from "next/server";
import { proxyRequest, sanitizePath } from "@/lib/proxy";
import { IS_PRESALE_ENABLED } from "@/lib/presale/presale-visibility";

export const runtime = "nodejs";

/**
 * Presale 代理（DD-119 §2.6）。
 *
 * ⚠️ presale/referral 接口在 web-api 服务（BACKEND_URL = api.oddfi.io），
 * 不在 market-api（MARKET_API_URL）。Next.js 静态段 `presale` 优先于 catch-all
 * `app/api/v1/[...path]`（后者转发 market-api），所以 /api/v1/presale/* 命中本路由。
 *
 * testnet 下 IS_PRESALE_ENABLED=false → 直接 404，不向后端转发（§3.5 代理层短路）。
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://api.oddfi.io";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!IS_PRESALE_ENABLED)
    return NextResponse.json({ code: -1, message: "Not found" }, { status: 404 });
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  const qs = req.nextUrl.searchParams.toString();
  const endpoint = qs ? `${safe.join("/")}?${qs}` : safe.join("/");
  const response = await proxyRequest(
    `${BACKEND_URL}/api/v1/presale/${endpoint}`,
    "GET",
    req.headers.get("Authorization")
  );
  // config 公开但仍按用户数据保守处理：no-store，客户端 staleTime 自行短缓存（§6.1）
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!IS_PRESALE_ENABLED)
    return NextResponse.json({ code: -1, message: "Not found" }, { status: 404 });
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  const body = await req.text();
  if (body.length === 0) {
    return NextResponse.json(
      { code: -1, message: "Empty body — request aborted by client" },
      { status: 499 }
    );
  }
  const response = await proxyRequest(
    `${BACKEND_URL}/api/v1/presale/${safe.join("/")}`,
    "POST",
    req.headers.get("Authorization"),
    body
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
