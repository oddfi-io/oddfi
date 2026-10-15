import { type NextRequest, NextResponse } from "next/server";
import { proxyRequest, sanitizePath } from "@/lib/proxy";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://api.oddfi.io";

/**
 * Proxy /api/market/* → BACKEND_URL/market/*
 * - GET  /market/price                       — ODD token price (legacy)
 * - POST /market/{marketId}/preview-signal   — chain odds signal preview (DD-117)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  const qs = req.nextUrl.searchParams.toString();
  const endpoint = qs ? `${safe.join("/")}?${qs}` : safe.join("/");
  const response = await proxyRequest(
    `${BACKEND_URL}/market/${endpoint}`,
    "GET",
    req.headers.get("Authorization")
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  const body = await req.text();
  const response = await proxyRequest(
    `${BACKEND_URL}/market/${safe.join("/")}`,
    "POST",
    req.headers.get("Authorization"),
    body
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
