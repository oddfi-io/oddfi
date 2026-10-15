#!/usr/bin/env bash
#
# verify-migration.sh — 验证 prod / dev 库的 migration 状态
#
# 用途：cutover §2.1 必须运行此脚本，exit 0 才能标"verify migration"完成。
# 防止 INC-002 重复（漏跑 8 张 presale 业务表 12h 没人察觉）。
#
# 用法（在 oddfi-backend EC2 上运行，自动从 container 配置读 RDS 凭据）：
#   ./scripts/verify-migration.sh
#
# 或显式传环境变量（任意环境）：
#   MYSQL_HOST=<host> MYSQL_USER=<user> MYSQL_PWD=<pwd> MYSQL_DB=<db> \
#     ./scripts/verify-migration.sh
#
# Exit code：
#   0 — 所有表存在 + presale_config 单行 seed OK
#   1 — 缺表 或 seed 异常
#   2 — 无法连接 DB 或缺凭据

set -euo pipefail

# ── 期望的表清单（与 migrations/README.md manifest 保持一致）──────────────────
EXPECTED_TABLES=(
  "presale_round"
  "presale_deposit"
  "presale_config"
  "presale_holding"
  "presale_event_cursor"
  "presale_ops_event"
  "user_referral_code"
  "user_referral_bind"
  "presale_admin_audit"
  "admin_idempotency"
  "inv6_backfill_applied"
  "presale_kol_referral_pct"
)

# ── 从 env 或 container 配置读 DB 凭据 ───────────────────────────────────────
if [[ -z "${MYSQL_HOST:-}" ]]; then
  if [[ -r /etc/oddfi/config_prod.yaml ]]; then
    echo "▶ 从 /etc/oddfi/config_prod.yaml 读 RDS 凭据"
    CFG=/etc/oddfi/config_prod.yaml
    # 用 sed range 提取 database: 块（直到下一个顶层 key），避免与 server.host / redis.host 撞名
    MYSQL_BLOCK=$(sed -n '/^database:/,/^[a-zA-Z]/{/^database:/!{/^[a-zA-Z]/!p}}' "$CFG")
    # REV-002 M2：用 sed 抓 value 整行（去 leading space + 可选双引号），避免 awk $2 在
    # 值含空格 / 引号时只拿到第一个 token（INC-001 刚轮换过密码，下次密码加特殊字符就会静默 fail）
    extract_val() {
      echo "$MYSQL_BLOCK" | sed -nE "s/^[[:space:]]*$1:[[:space:]]*\"?([^\"]+)\"?[[:space:]]*$/\1/p" | head -1
    }
    MYSQL_HOST=$(extract_val host)
    MYSQL_USER=$(extract_val username)
    MYSQL_PWD=$(extract_val password)
    MYSQL_DB=$(extract_val dbname)
  else
    echo "❌ 缺 MYSQL_HOST 等环境变量，且 /etc/oddfi/config_prod.yaml 不可读（请用 sudo 运行）" >&2
    exit 2
  fi
fi

if [[ -z "${MYSQL_HOST:-}" || -z "${MYSQL_USER:-}" || -z "${MYSQL_DB:-}" ]]; then
  echo "❌ 凭据解析失败（MYSQL_HOST/USER/DB 至少一个为空）" >&2
  exit 2
fi
export MYSQL_PWD

echo "▶ target  : ${MYSQL_USER}@${MYSQL_HOST}/${MYSQL_DB}"
echo "▶ expected: ${#EXPECTED_TABLES[@]} tables"

# ── 拉实际表清单 ────────────────────────────────────────────────────────────
ACTUAL=$(mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" "$MYSQL_DB" -N -e \
  "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA='${MYSQL_DB}'" 2>/tmp/mysql-verify.err) || {
  echo "❌ DB 查询失败（凭据 / 网络 / 权限 / SQL）" >&2
  echo "   stderr:" >&2
  sed 's/^/   /' /tmp/mysql-verify.err >&2 2>/dev/null || true
  exit 2
}

# ── 比对缺失 ────────────────────────────────────────────────────────────────
MISSING=()
for t in "${EXPECTED_TABLES[@]}"; do
  if ! echo "$ACTUAL" | grep -qx "$t"; then
    MISSING+=("$t")
  fi
done

if (( ${#MISSING[@]} > 0 )); then
  echo "❌ 缺以下表（共 ${#MISSING[@]} 张）："
  printf '   - %s\n' "${MISSING[@]}"
  echo ""
  echo "→ 修复：scp web-api/migrations/0001..0010_*.sql to server + mysql apply"
  echo "→ 详见 web-api/migrations/README.md"
  exit 1
fi

echo "✅ 全部 ${#EXPECTED_TABLES[@]} 张表存在"

# ── 验 presale_config 单行 seed ─────────────────────────────────────────────
CFG_COUNT=$(mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" "$MYSQL_DB" -N -e \
  "SELECT COUNT(*) FROM presale_config WHERE id=1" 2>/tmp/mysql-verify.err)

if [[ "$CFG_COUNT" != "1" ]]; then
  echo "❌ presale_config 缺 id=1 单行 seed（应有恰好 1 行，实际 ${CFG_COUNT} 行）" >&2
  echo "→ 修复：跑 0003_create_presale_config.sql 中的 INSERT IGNORE 段" >&2
  exit 1
fi

CFG_VAULT=$(mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" "$MYSQL_DB" -N -e \
  "SELECT LENGTH(vault_address) FROM presale_config WHERE id=1" 2>/tmp/mysql-verify.err)

if [[ "$CFG_VAULT" != "42" ]]; then
  echo "❌ presale_config.vault_address 长度 ${CFG_VAULT}（期望 42 — 0x + 40 hex）" >&2
  echo "→ 修复：UPDATE presale_config SET vault_address='0x...' WHERE id=1" >&2
  exit 1
fi

echo "✅ presale_config 单行 seed OK（vault_address 长度=42）"
echo ""
echo "🎉 migration verify PASSED"
exit 0
