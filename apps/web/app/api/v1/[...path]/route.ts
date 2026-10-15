import { type NextRequest, NextResponse } from "next/server";
import { proxyRequest, sanitizePath } from "@/lib/proxy";
import { MARKET_API_BASE } from "@/lib/market-api";
import { getCacheControl } from "../cache-control";

export const runtime = "nodejs";

const MARKET_API_URL = MARKET_API_BASE;

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  const qs = req.nextUrl.searchParams.toString();
  const endpoint = qs ? `${safe.join("/")}?${qs}` : safe.join("/");
  // Market data is public — strip Auth to enable CDN caching (RFC 7234 §3.2)
  const response = await proxyRequest(`${MARKET_API_URL}/api/v1/${endpoint}`, "GET", null);
  if (response.status === 200) {
    const clone = response.clone();
    const body = await clone.json();
    const hasData =
      body.data !== null &&
      body.data !== undefined &&
      !(Array.isArray(body.data) && body.data.length === 0);
    if (!hasData) {
      console.warn(
        `[MarketProxy] null/empty data from ${endpoint} — setting no-store to prevent CDN caching`
      );
    }
    response.headers.set(
      "Cache-Control",
      hasData ? getCacheControl(safe, req.nextUrl.searchParams) : "no-store"
    );
  }
  return response;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  return proxyRequest(
    `${MARKET_API_URL}/api/v1/${safe.join("/")}`,
    "POST",
    req.headers.get("Authorization"),
    await req.text()
  );
}
