#!/usr/bin/env bash
#
# lark-openid.sh — 通过邮箱(或手机号)查 Lark open_id,用于给新管理员开权限。
#
# 用法:
#   ./scripts/lark-openid.sh colleague@oddfi.com                       # 单个 email
#   ./scripts/lark-openid.sh a@x.com b@y.com c@z.com                   # 批量(最多 50)
#   ./scripts/lark-openid.sh -m +8613800138000                         # 手机号(需含国家码)
#   ./scripts/lark-openid.sh -m +8613800138000 -m +8613900139000       # 多个手机号
#
# 凭据来源(自动按优先级):
#   1. 环境变量 ADMIN_LARK_APP_ID + ADMIN_LARK_APP_SECRET(直接 export)
#   2. ~/work/oddfi-admin-backend/.env.local (source ADMIN_LARK_APP_SECRET,**不打印**)
#   3. ~/work/oddfi-admin-backend/config.yaml  (取 lark.app_id,明文配置)
#
# 输出:
#   每行一条结果: <input> -> <open_id>  [name=... email=... mobile=...]
#   找不到的: <input> -> NOT_FOUND
#
# 详见:docs/ops/admin-users-manual.md §2.2 方式 1。
set -euo pipefail

API_HOST="https://open.larksuite.com"   # 国际版,不是 feishu.cn
ENV_FILE="${ADMIN_BACKEND_ENV:-${HOME}/work/oddfi-admin-backend/.env.local}"
CONFIG_YAML="${ADMIN_BACKEND_CONFIG:-${HOME}/work/oddfi-admin-backend/config.yaml}"

die() { printf '\033[1;31m[lark-openid] 错误:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[1;36m[lark-openid]\033[0m %s\n' "$*" >&2; }

# ── 解析参数 ────────────────────────────────────────────
EMAILS=()
MOBILES=()
while [ $# -gt 0 ]; do
  case "$1" in
    -m|--mobile)
      shift
      [ -n "${1:-}" ] || die "-m 需要跟手机号(含国家码)"
      MOBILES+=("$1")
      ;;
    -h|--help)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    -*) die "未知选项:$1" ;;
    *) EMAILS+=("$1") ;;
  esac
  shift
done

[ "${#EMAILS[@]}" -gt 0 ] || [ "${#MOBILES[@]}" -gt 0 ] || die "至少要一个 email 或 -m 手机号"
[ $((${#EMAILS[@]} + ${#MOBILES[@]})) -le 50 ] || die "单次最多查 50 个"

# ── 加载凭据 ────────────────────────────────────────────
# secret:env → .env.local
if [ -z "${ADMIN_LARK_APP_SECRET:-}" ] && [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi
# app_id:env → .env.local(若有)→ config.yaml(lark.app_id 明文)
if [ -z "${ADMIN_LARK_APP_ID:-}" ] && [ -f "${CONFIG_YAML}" ]; then
  # 简易 yaml 提取:不引入 yq 依赖,grep + sed 就够(行格式 `  app_id: "cli_xxxx"`)
  ADMIN_LARK_APP_ID=$(awk '/^lark:/{f=1;next} f && /^  app_id:/{gsub(/.*app_id:[[:space:]]*"?|"?[[:space:]]*(#.*)?$/, ""); print; exit}' "${CONFIG_YAML}")
fi
[ -n "${ADMIN_LARK_APP_ID:-}" ] || die "ADMIN_LARK_APP_ID 未设置(env / .env.local / config.yaml 都没找到)"
[ -n "${ADMIN_LARK_APP_SECRET:-}" ] || die "ADMIN_LARK_APP_SECRET 未设置(必须 env 或 .env.local)"

# ── Step 1: 换 tenant_access_token ──────────────────────
info "1/2 换 tenant_access_token(${API_HOST})"
TOKEN_RESP=$(curl -s -m 10 -X POST \
  "${API_HOST}/open-apis/auth/v3/tenant_access_token/internal" \
  -H 'Content-Type: application/json' \
  --data "$(jq -n --arg id "${ADMIN_LARK_APP_ID}" --arg sec "${ADMIN_LARK_APP_SECRET}" \
    '{app_id:$id, app_secret:$sec}')")
TOKEN=$(jq -r '.tenant_access_token // empty' <<<"${TOKEN_RESP}")
[ -n "${TOKEN}" ] || { echo "${TOKEN_RESP}" >&2; die "拿不到 tenant_access_token(看上面响应)"; }

# ── Step 2: batch_get_id ────────────────────────────────
info "2/2 批量查 open_id(emails=${#EMAILS[@]} mobiles=${#MOBILES[@]})"
PAYLOAD=$(jq -n \
  --argjson emails "$(printf '%s\n' "${EMAILS[@]:-}" | jq -R . | jq -s 'map(select(length>0))')" \
  --argjson mobiles "$(printf '%s\n' "${MOBILES[@]:-}" | jq -R . | jq -s 'map(select(length>0))')" \
  '{emails:$emails, mobiles:$mobiles}')

RESP=$(curl -s -m 10 -X POST \
  "${API_HOST}/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  --data "${PAYLOAD}")

CODE=$(jq -r '.code' <<<"${RESP}")
if [ "${CODE}" != "0" ]; then
  echo "${RESP}" | jq . >&2
  MSG=$(jq -r '.msg // "unknown"' <<<"${RESP}")
  die "Lark API 返回 code=${CODE}: ${MSG}"
fi

# ── 输出 ────────────────────────────────────────────────
info "结果:"
jq -r '.data.user_list[] |
  (.email // .mobile // "?") as $input |
  if .user_id then
    "  \($input) -> \(.user_id)"
  else
    "  \($input) -> NOT_FOUND  (该邮箱/手机号在 Lark 工作区找不到对应用户)"
  end' <<<"${RESP}"

# 退出码:全找到 0;有 NOT_FOUND 非零
NOT_FOUND=$(jq -r '[.data.user_list[] | select(.user_id == null)] | length' <<<"${RESP}")
exit "$([ "${NOT_FOUND}" = "0" ] && echo 0 || echo 1)"
