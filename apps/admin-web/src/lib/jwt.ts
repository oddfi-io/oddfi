// 本地 JWT 处理：仅解 exp 做软过期检查。
// ⚠️ 不做安全判定，不解 role（role 以 /auth/me 为准，见 01-auth-rbac.md §1）。
// 不自行续签/改签 JWT（lark-oauth.md 硬约束）。

interface JwtExpPayload {
  exp?: number; // 秒级时间戳（JWT 标准）
}

// 解析 JWT payload 的 exp。解析失败返回 null（调用方当作过期处理）。
function decodeExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    // base64url → base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const payload = JSON.parse(json) as JwtExpPayload;
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

// 软过期检查：无 exp 或已过期返回 true（视作过期 → 当未登录）。
export function isJwtExpired(token: string): boolean {
  const exp = decodeExp(token);
  if (exp == null) return true;
  return exp * 1000 <= Date.now();
}
