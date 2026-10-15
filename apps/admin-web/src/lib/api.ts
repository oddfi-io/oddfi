// ky 单例 + 信封拆包。所有 HTTP 请求收敛到这里，禁止页面/组件直接 fetch/ky。
// 契约：02-data-layer.md §2，api-conventions.md。
import ky, { HTTPError } from "ky";
import { ApiError, type ApiResponse } from "@/types/api";

const JWT_KEY = "oddfi_admin_jwt";

// crypto.randomUUID() 仅在 secure context（HTTPS/localhost）可用。
// 非安全上下文（http://<IP> 联调）下会抛错，连带打挂 beforeRequest → 所有 mutation 不可用。
// 这里加 getRandomValues 兜底拼 v4，保证 X-Request-ID / idempotency key 始终可生成。
export function generateUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through to getRandomValues
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

export const api = ky.create({
  // ky 2.x 用 `prefix`（旧版叫 prefixUrl）。dev: Vite proxy；prod: Nginx 同源。
  prefix: import.meta.env.VITE_API_BASE ?? "/",
  timeout: 15000,
  retry: { limit: 2, methods: ["get"] }, // 只重试 GET；mutation 的重试由 idempotency 保证安全
  hooks: {
    // ky 2.x 用 state-object hook API：beforeRequest({ request }) / afterResponse({ response })。
    beforeRequest: [
      ({ request }) => {
        const token = localStorage.getItem(JWT_KEY);
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        // 串联前后端日志（api.md §4.4）
        if (!request.headers.has("X-Request-ID")) {
          request.headers.set("X-Request-ID", generateUuidV4());
        }
        // X-Idempotency-Key 不在这里设 —— 由调用方按 form 生命周期传入（02 §6）
      },
    ],
    afterResponse: [
      async ({ response }) => {
        // 兜底「真的会话失效」时清 token 跳登录（Refine 流程外的请求，如 getIdentity 自身）。
        // ⚠️ 只认会话类 401（UNAUTHORIZED/TOKEN_*）。后端基础设施类 401（如 SERVICE_SIG_INVALID、
        // ADMIN_JWT_* 等转发/验签错误）不是用户会话问题，绝不能误登出，否则正常页会被弹回 /login。
        if (response.status === 401) {
          let code = "";
          try {
            code = String(((await response.clone().json()) as { code?: unknown })?.code ?? "");
          } catch {
            // 非 JSON 401（代理/网关）→ 无法判定，按会话失效保守处理
          }
          const sessionDead = code === "" || ["UNAUTHORIZED", "TOKEN_EXPIRED", "TOKEN_INVALID"].includes(code);
          if (sessionDead) {
            localStorage.removeItem(JWT_KEY);
            if (!location.pathname.startsWith("/login")) {
              window.location.href = "/login";
            }
          }
        }
      },
    ],
  },
});

// 统一拆信封：code!==0 抛 ApiError（dataProvider / hooks 都走这个）。
// 同时把 ky 默认对非 2xx 抛的 HTTPError 解析成 ApiError，保证调用方只需 catch ApiError。
export async function unwrap<T>(promise: Promise<Response>): Promise<T> {
  let res: Response;
  try {
    res = await promise;
  } catch (e) {
    // ky 对 4xx/5xx 抛 HTTPError，其 response 仍带后端信封；解析成 ApiError。
    if (e instanceof HTTPError) {
      const errRes = e.response;
      const reqId = errRes.headers.get("X-Request-ID") ?? undefined;
      let body: ApiResponse<unknown> | null;
      try {
        body = (await errRes.json()) as ApiResponse<unknown>;
      } catch {
        body = null;
      }
      const code = body?.code != null ? String(body.code) : "INTERNAL_ERROR";
      const message = body?.message ?? errRes.statusText ?? "Request failed";
      throw new ApiError(code, errRes.status, message, reqId);
    }
    throw e;
  }

  const reqId = res.headers.get("X-Request-ID") ?? undefined; // header 名大小写不敏感
  const replayed = res.headers.get("X-Replayed") === "true"; // 幂等重放标记（02 §4.5）
  const body = (await res.json()) as ApiResponse<T>;
  if (body.code !== 0) {
    throw new ApiError(String(body.code), res.status, body.message, reqId);
  }
  if (replayed) {
    console.log("[api] idempotent replay hit — returning cached result");
  }
  return body.data as T;
}
