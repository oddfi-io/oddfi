/**
 * DD-107: /api/ai/chat endpoint。
 *
 * 仅导出 HTTP verb（Next.js 14 App Router 约束）；逻辑在 ./handler.ts。
 * 测试通过 import buildPostHandler 直接做 dep-injection。
 */
import { buildPostHandler } from "./handler";

export const runtime = "nodejs";
export const POST = buildPostHandler();
