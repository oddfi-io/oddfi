import { type NextRequest, NextResponse } from "next/server";
import { proxyRequest, sanitizePath } from "@/lib/proxy";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://api.oddfi.io";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  const qs = req.nextUrl.searchParams.toString();
  const endpoint = qs ? `${safe.join("/")}?${qs}` : safe.join("/");
  const response = await proxyRequest(
    `${BACKEND_URL}/account/${endpoint}`,
    "GET",
    req.headers.get("Authorization")
  );
  // Unconditional no-store for user data, regardless of status (defensive per §2.2)
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ code: -1, message: "Invalid path" }, { status: 400 });
  const body = await req.text();
  // BUG-010: 空 body 多半是 client abort 后 stream 已关闭（ky duplex:'half' + 15s timeout 触发），
  // 直接返 499（Client Closed Request）+ warn 日志，不再转发后端制造 EOF 400 噪音
  if (body.length === 0) {
    const sentAt = req.headers.get("X-Client-Sent-At");
    console.warn(
      `[proxy] /account/${safe.join("/")} empty body — likely client abort (X-Client-Sent-At=${sentAt ?? "none"})`
    );
    return NextResponse.json(
      { code: -1, message: "Empty body — request aborted by client" },
      { status: 499 }
    );
  }
  const response = await proxyRequest(
    `${BACKEND_URL}/account/${safe.join("/")}`,
    "POST",
    req.headers.get("Authorization"),
    body
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
