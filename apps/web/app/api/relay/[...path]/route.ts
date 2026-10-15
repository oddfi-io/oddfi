import { type NextRequest, NextResponse } from "next/server";
import { sanitizePath } from "@/lib/proxy";

export const runtime = "nodejs";

const RELAY_API_BASE = "https://api.relay.link";
// RELAY_API_KEY is a server-only env var (no NEXT_PUBLIC_ prefix)
const RELAY_API_KEY = process.env.RELAY_API_KEY;

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const qs = req.nextUrl.searchParams.toString();
  const endpoint = safe.join("/");
  const upstreamUrl = qs ? `${RELAY_API_BASE}/${endpoint}?${qs}` : `${RELAY_API_BASE}/${endpoint}`;

  return proxyToRelay(upstreamUrl, "GET", null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const safe = sanitizePath(path);
  if (!safe) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const qs = req.nextUrl.searchParams.toString();
  const endpoint = safe.join("/");
  const upstreamUrl = qs ? `${RELAY_API_BASE}/${endpoint}?${qs}` : `${RELAY_API_BASE}/${endpoint}`;
  return proxyToRelay(upstreamUrl, "POST", await req.text());
}

async function proxyToRelay(
  url: string,
  method: "GET" | "POST",
  body: string | null
): Promise<NextResponse> {
  const pathname = new URL(url).pathname;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        ...(RELAY_API_KEY ? { "x-relay-api-key": RELAY_API_KEY } : {}),
      },
      ...(body !== null ? { body } : {}),
    });
  } catch (err) {
    console.error(`[RelayProxy] ${method} ${pathname} network error`, err);
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
  }

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    console.error(
      `[RelayProxy] ${method} ${pathname} non-JSON response (status ${upstream.status})`
    );
    return NextResponse.json(
      { error: "Unexpected response from upstream" },
      { status: upstream.status }
    );
  }
}
