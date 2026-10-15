type JsonObject = Record<string, unknown>;

const ERROR_STATUS: Readonly<Record<string, number>> = {
  INVALID_AUTHORIZATION: 401,
  INVALID_TOKEN: 401,
  MISSING_AUTHORIZATION: 401
};

/**
 * 输出 JSON 并按解析结果退出。
 * @param result 解析结果，会直接序列化到 stdout。
 * @param ok 是否通过解析，通过时退出 0，失败时退出 1。
 * 实现方式：统一 JSON pretty print，方便 shell 和 CI 读取，不输出原始 token。
 */
const finish = (result: JsonObject, ok: boolean): never => {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(ok ? 0 : 1);
};

/**
 * 构造失败结果。
 * @param code 稳定错误码。
 * @param message 给调用方的简短错误说明。
 * @param extra 需要附加的非敏感调试字段。
 * 实现方式：用错误码映射 HTTP 状态码，保持和 nginx Lua 脚本响应一致。
 */
const failure = (code: string, message: string, extra: JsonObject = {}): JsonObject => ({
  ok: false,
  status: ERROR_STATUS[code] ?? 401,
  code,
  message,
  ...extra
});

/**
 * 从环境变量读取 Bearer token。
 * @returns JWT compact token；未提供时返回 undefined。
 * 实现方式：优先读取完整 AUTHORIZATION，其次读取裸 JWT_TOKEN，避免把 token 写入仓库文件。
 */
const readToken = (): string | undefined => {
  const authorization = process.env.AUTHORIZATION;
  if (authorization !== undefined && authorization.trim() !== "") {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1];
  }
  return process.env.JWT_TOKEN;
};

/**
 * 解码 base64url 文本为 Buffer。
 * @param value 不带 padding 的 base64url 字符串。
 * @returns 解码后的二进制数据。
 * 实现方式：把 URL 安全字符替换回标准 base64，由 Node Buffer 完成 padding 容错。
 */
const base64UrlDecode = (value: string): Buffer =>
  Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64");

/**
 * 解码 JWT payload JSON。
 * @param value JWT payload 分段。
 * @returns JSON object。
 * 实现方式：只解码第二段 payload，不验签、不校验过期时间，并拒绝非对象 JSON。
 */
const decodePayload = (value: string): JsonObject => {
  const parsed: unknown = JSON.parse(base64UrlDecode(value).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("jwt payload must be object");
  }
  return parsed as JsonObject;
};

/**
 * 执行和 nginx Lua 脚本等价的边缘解析流程。
 * @returns payload 解析详情。
 * 实现方式：按 Bearer、compact、payload、user_id 顺序 fail-fast，成功时输出上游 header。
 */
const verify = (): JsonObject => {
  const token = readToken();
  if (token === undefined || token.trim() === "") {
    return failure("MISSING_AUTHORIZATION", "authorization bearer token is required");
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part === "")) {
    return failure("INVALID_TOKEN", "jwt must contain three compact parts");
  }

  const payloadPart = parts[1];
  if (payloadPart === undefined) {
    return failure("INVALID_TOKEN", "jwt payload is required");
  }

  let claims: JsonObject;
  try {
    claims = decodePayload(payloadPart);
  } catch (error) {
    return failure(
      "INVALID_TOKEN",
      error instanceof Error ? error.message : "jwt payload is invalid"
    );
  }

  if (typeof claims.user_id !== "string" || claims.user_id === "") {
    return failure("INVALID_TOKEN", "jwt payload user_id is required", { claims });
  }

  return {
    ok: true,
    status: 200,
    code: "OK",
    claims,
    upstream_headers: {
      "x-user-id": claims.user_id,
      ...(typeof claims.address === "string" ? { "x-user-address": claims.address } : {}),
      ...(typeof claims.jti === "string" ? { "x-token-jti": claims.jti } : {})
    }
  };
};

const result = verify();
finish(result, result.ok === true);
