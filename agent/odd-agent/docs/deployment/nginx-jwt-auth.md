# Nginx JWT 用户 ID 提取 Lua 接入说明

**更新日期：** 2026-05-26  
**状态：** 部署辅助脚本  
**范围：** Nginx/OpenResty 边缘层从 `Authorization: Bearer <jwt>` 中提取 `user_id`。

## 1. 处理口径

本脚本按边缘服务当前诉求实现轻量解析：

- 只接受 `Authorization: Bearer <token>`。
- 只解析 JWT 第二段 payload，不验签、不校验 `exp/nbf/iat`、不查 Redis 黑名单。
- payload 必须是 JSON object，且必须包含非空字符串 `user_id`。
- 解析成功后向上游覆盖写入 `x-user-id`。
- 若 payload 中有字符串 `address` / `jti`，同步透传为 `x-user-address` / `x-token-jti`，便于日志或灰度排查。
- 解析成功后清理原始 `Authorization` 请求头，避免后端业务误用 bearer token。
- `OPTIONS` 预检请求直接放行，由后端 CORS 响应处理；业务请求仍必须携带 Bearer token。

## 2. 部署资产

- `deploy/nginx/lua/jwt_auth.lua`：OpenResty `access_by_lua_file` 脚本。
- `deploy/nginx/odd-agent-auth.example.conf`：Nginx 接入示例。
- `scripts/verify-nginx-jwt-auth.ts`：本地离线 payload 解析脚本，便于在没有 OpenResty 的机器上验证同一套规则。

## 3. 依赖与配置

OpenResty 只需要 `lua-cjson`。当前脚本不需要 JWT secret，也不依赖 Redis。

接入示例：

```nginx
lua_package_path "/opt/odd_agent/current/deploy/nginx/lua/?.lua;;";

location /api/ {
  access_by_lua_file /opt/odd_agent/current/deploy/nginx/lua/jwt_auth.lua;
  proxy_pass http://odd_agent_backend;
}
```

## 4. 验收

离线验证：

```bash
AUTHORIZATION='Bearer <token>' npx tsx scripts/verify-nginx-jwt-auth.ts
```

OpenResty 验收：

```bash
curl -i -H "Authorization: Bearer <token>" http://127.0.0.1:<nginx-port>/api/chat
```

期望：

- payload 含 `user_id` 时进入上游，并携带 `x-user-id`。
- 缺少 bearer token 返回 `401` / `MISSING_AUTHORIZATION`。
- JWT 结构错误或 payload 缺少 `user_id` 返回 `401` / `INVALID_TOKEN`。
