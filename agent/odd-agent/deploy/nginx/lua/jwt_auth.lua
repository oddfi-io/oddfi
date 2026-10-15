local cjson = require("cjson.safe")

--[[
输出统一 JSON 错误响应并终止请求。
入参：status 是 HTTP 状态码，code 是稳定错误码，message 是给调用方的简短说明。
实现方式：设置 JSON content-type，写入 `{code,msg}`，再调用 `ngx.exit(status)`。
]]
local function reject(status, code, message)
  ngx.status = status
  ngx.header["content-type"] = "application/json; charset=utf-8"
  ngx.say(cjson.encode({ code = code, msg = message }))
  return ngx.exit(status)
end

--[[
从 `Authorization` header 提取 Bearer token。
入参：无，直接读取当前 nginx request headers。
实现方式：兼容 header 大小写，只接受大小写不敏感的 `Bearer <token>` 形式，并拒绝空 token。
]]
local function read_bearer_token()
  local headers = ngx.req.get_headers()
  local authorization = headers["authorization"] or headers["Authorization"]
  if type(authorization) == "table" then
    authorization = authorization[1]
  end
  if type(authorization) ~= "string" then
    return nil, "MISSING_AUTHORIZATION", "authorization bearer token is required"
  end

  local token = authorization:match("^[Bb][Ee][Aa][Rr][Ee][Rr]%s+(.+)$")
  if token == nil or token == "" then
    return nil, "INVALID_AUTHORIZATION", "authorization must use bearer token"
  end
  return token, nil, nil
end

--[[
按 JWT compact serialization 拆分 token。
入参：token 是 `header.payload.signature` 字符串。
实现方式：只提取前两段用于 payload 解析；第三段保留结构校验但不做签名校验。
]]
local function split_jwt(token)
  local header_b64, payload_b64, signature_b64 = token:match("^([^.]+)%.([^.]+)%.([^.]+)$")
  if header_b64 == nil or payload_b64 == nil or signature_b64 == nil then
    return nil, "jwt must contain three compact parts"
  end
  return payload_b64, nil
end

--[[
解码 base64url 字符串。
入参：value 是不带 padding 的 base64url 文本。
实现方式：把 URL 安全字符还原为标准 base64，并按长度补齐 padding 后调用 `ngx.decode_base64`。
]]
local function base64url_decode(value)
  local normalized = value:gsub("-", "+"):gsub("_", "/")
  local remainder = #normalized % 4
  if remainder == 2 then
    normalized = normalized .. "=="
  elseif remainder == 3 then
    normalized = normalized .. "="
  elseif remainder == 1 then
    return nil, "invalid base64url length"
  end

  local decoded = ngx.decode_base64(normalized)
  if decoded == nil then
    return nil, "invalid base64url data"
  end
  return decoded, nil
end

--[[
解码 JWT payload JSON。
入参：payload_b64 是 JWT 第二段。
实现方式：先 base64url 解码，再用 `cjson.safe` 解析；边缘服务只读 payload，不验签也不校验有效期。
]]
local function decode_payload(payload_b64)
  local decoded, decode_error = base64url_decode(payload_b64)
  if decoded == nil then
    return nil, decode_error
  end

  local claims, json_error = cjson.decode(decoded)
  if type(claims) ~= "table" then
    return nil, json_error or "jwt payload must be json object"
  end
  return claims, nil
end

--[[
从 claims 中读取用户身份字段。
入参：claims 是 JWT payload 对象。
实现方式：只要求 `user_id` 是非空字符串；`address` 和 `jti` 若存在则透传给上游，便于日志或灰度排查。
]]
local function read_identity(claims)
  if type(claims.user_id) ~= "string" or claims.user_id == "" then
    return nil, "jwt payload user_id is required"
  end
  return {
    user_id = claims.user_id,
    address = type(claims.address) == "string" and claims.address or nil,
    jti = type(claims.jti) == "string" and claims.jti or nil
  }, nil
end

--[[
执行边缘 JWT payload 解析流程。
入参：无，读取当前 nginx request。
实现方式：先放行 CORS 预检请求；业务请求解析 Bearer token 的 payload，抽取 `user_id` 并覆盖写入可信上游 header `x-user-id`。
]]
local function run()
  if ngx.req.get_method() == "OPTIONS" then
    return ngx.OK
  end

  local token, bearer_code, bearer_message = read_bearer_token()
  if token == nil then
    return reject(401, bearer_code, bearer_message)
  end

  local payload_b64, split_error = split_jwt(token)
  if payload_b64 == nil then
    return reject(401, "INVALID_TOKEN", split_error)
  end

  local claims, claims_error = decode_payload(payload_b64)
  if claims == nil then
    return reject(401, "INVALID_TOKEN", claims_error)
  end

  local identity, identity_error = read_identity(claims)
  if identity == nil then
    return reject(401, "INVALID_TOKEN", identity_error)
  end

  ngx.req.clear_header("Authorization")
  ngx.req.set_header("x-user-id", identity.user_id)
  if identity.address ~= nil then
    ngx.req.set_header("x-user-address", identity.address)
  end
  if identity.jti ~= nil then
    ngx.req.set_header("x-token-jti", identity.jti)
  end
  return ngx.OK
end

return run()
