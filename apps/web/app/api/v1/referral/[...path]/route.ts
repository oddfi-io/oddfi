import { type NextRequest, NextResponse } from "next/server";
import { proxyRequest, sanitizePath } from "@/lib/proxy";

export const runtime = "nodejs";

/**
 * Referral 代理（DD-119 §2.6）。**站点级**邀请接口，挂在 web-api（BACKEND_URL = api.oddfi.io）。
 * 静态段优先于 catch-all。
 * REV-v2 M-04：referral 是站点级（不随认购在 testnet 门控），故代理**不**做 IS_PRESALE_ENABLED
 * 短路——否则 testnet 下可见的 /referral 页所有 API 全 404。仅 presale 代理做 testnet 短路。
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://api.oddfi.io";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  const qs = req.nextUrl.searchParams.toString();
  const endpoint = qs ? `${safe.join("/")}?${qs}` : safe.join("/");
  const response = await proxyRequest(
    `${BACKEND_URL}/api/v1/referral/${endpoint}`,
    "GET",
    req.headers.get("Authorization")
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
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
    `${BACKEND_URL}/api/v1/referral/${safe.join("/")}`,
    "POST",
    req.headers.get("Authorization"),
    body
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
