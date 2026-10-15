import { NextResponse } from "next/server";

/**
 * Shared proxy utility for Next.js API Route Handlers.
 * Forwards requests to upstream backend services with auth header passthrough.
 *
 * Used by:
 * - app/api/account/[...path]/route.ts → BACKEND_URL
 * - app/api/v1/[...path]/route.ts      → MARKET_API_URL
 */

/** Reject path segments that could cause traversal or reach unintended endpoints. */
export function sanitizePath(segments: string[]): string[] | null {
  for (const seg of segments) {
    if (seg === ".." || seg === "." || seg === "" || seg.includes("\\")) {
      return null;
    }
  }
  return segments;
}

export async function proxyRequest(
  upstreamUrl: string,
  method: "GET" | "POST",
  authHeader: string | null,
  body?: string
): Promise<NextResponse> {
  const pathname = new URL(upstreamUrl).pathname;
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      // BUG-010: 25s > 客户端 ky 15s timeout，避免双层同值 race（proxy 永远不先 timeout）
      signal: AbortSignal.timeout(25_000),
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      ...(body !== undefined ? { body } : {}),
    });
  } catch (err) {
    console.error(`[proxy] ${method} ${pathname} network error`, err);
    return NextResponse.json({ code: -1, message: "Upstream request failed" }, { status: 502 });
  }

  try {
    const data = await upstream.json();
    if (upstream.status >= 400) {
      return NextResponse.json(
        {
          code: data.code ?? upstream.status,
          message: data.msg ?? data.message ?? "Request failed",
        },
        { status: upstream.status }
      );
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    console.error(`[proxy] ${method} ${pathname} non-JSON response (status ${upstream.status})`);
    return NextResponse.json(
      { code: upstream.status, message: "Unexpected response from upstream" },
      { status: upstream.status }
    );
  }
}
