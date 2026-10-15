import { NextRequest, NextResponse } from "next/server";
import { EB_BYPASS_COOKIE } from "@/lib/early-bird-mode";

/**
 * POST /api/auth/early-bird-bypass —— DD-103 续：DevToolsModal 邀请码校验入口。
 *
 * 复用 `INVITE_CODE` env，匹配则下发 cookie（值=INVITE_CODE 原文 + httpOnly + 30 天）。
 * 仅服务端可校验（middleware / Server Component），客户端无法读取或伪造。
 * 校验失败返回 401。
 */
export async function POST(request: NextRequest) {
  const INVITE_CODE = process.env.INVITE_CODE;
  if (!INVITE_CODE) {
    return NextResponse.json({ error: "INVITE_CODE env not configured" }, { status: 500 });
  }

  let code: unknown;
  try {
    ({ code } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof code !== "string" || code !== INVITE_CODE) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(EB_BYPASS_COOKIE, INVITE_CODE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
