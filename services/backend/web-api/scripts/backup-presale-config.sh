#!/usr/bin/env bash
#
# backup-presale-config.sh — presale_config 单行表日级备份
#
# 用途：presale_config 是 PK=1 单行表，含 vault_address / lark_webhook_url /
# tge_ts / total_target_usd 等关键运营配置。一次误改可能导致：
#   - 主站显示错误的金库地址，用户转错钱
#   - Lark webhook 失效，运营群断告警
#   - TGE 时间错位，运营页前端 UI 错乱
#
# RDS snapshot 太重（GB 级 + 整库），单行表用 mysqldump --where=id=1 即可。
# 备份保留 30 天，超期自动清理。
#
# 部署：oddfi-backend EC2 /usr/local/bin/backup-presale-config.sh
# Cron：每日 03:00 跑（避开早高峰）
#
# 凭据来源：/etc/oddfi/config_prod.yaml database: 块（与 verify-migration.sh 同源）
# 输出：/var/backup/oddfi/presale_config_YYYY-MM-DD.sql.gz，0600 root
#
# 恢复：
#   gunzip -c /var/backup/oddfi/presale_config_2026-05-27.sql.gz | \
#     mysql -h <rds_host> -u admin project_oddfi

set -euo pipefail

# REV-002 m8：紧 umask，确保 /tmp 中间产物 + 备份目录 / 文件都 0600 / 0700
#（dump 含 lark_webhook_url，避免任何窗口期被同机其他用户读到）
umask 077

# REV-002 m12：--dry-run flag，便于本地排错时验证凭据解析 + mysqldump 命令路径
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  echo "$(date -Is) ⚠️  DRY-RUN: 仅验证凭据 + 打印 mysqldump 命令，不真备份"
fi

BACKUP_DIR=/var/backup/oddfi
RETAIN_DAYS=30
TS=$(date +%Y-%m-%d_%H%M%S)
OUT="$BACKUP_DIR/presale_config_${TS}.sql.gz"

# ── 准备目录（首次跑时建）────────────────────────────────────────
sudo mkdir -p "$BACKUP_DIR"
sudo chmod 0700 "$BACKUP_DIR"

# ── 从 config_prod.yaml 抽 RDS 凭据（database: 块）──────────────
if [[ ! -r /etc/oddfi/config_prod.yaml ]]; then
  echo "$(date -Is) ❌ /etc/oddfi/config_prod.yaml 不可读（请用 sudo 跑）" >&2
  exit 2
fi

CFG=/etc/oddfi/config_prod.yaml
MYSQL_BLOCK=$(sed -n '/^database:/,/^[a-zA-Z]/{/^database:/!{/^[a-zA-Z]/!p}}' "$CFG")
# REV-002 M2: 用 sed 抓整行（含空格 / 双引号），避免 awk $2 在值含特殊字符时丢半截
extract_val() {
  echo "$MYSQL_BLOCK" | sed -nE "s/^[[:space:]]*$1:[[:space:]]*\"?([^\"]+)\"?[[:space:]]*$/\1/p" | head -1
}
MYSQL_HOST=$(extract_val host)
MYSQL_USER=$(extract_val username)
MYSQL_PWD=$(extract_val password)
MYSQL_DB=$(extract_val dbname)
export MYSQL_PWD

if [[ -z "$MYSQL_HOST" || -z "$MYSQL_USER" || -z "$MYSQL_DB" ]]; then
  echo "$(date -Is) ❌ 凭据解析失败" >&2
  exit 2
fi

# ── dump 单行（--where id=1）+ gzip ─────────────────────────────
# 关键 mysqldump flags（与 §0-8 备份保持一致，避免 RDS 权限报错）：
#   --no-tablespaces        非 SUPER 权限必须
#   --column-statistics=0   8.0 客户端默认尝试拉 stats，RDS 上不开放
#   --skip-add-locks        加上 LOCK TABLES，RDS 不允许
#   --where "id=1"          只 dump 单行
# RDS admin@% 不持 RELOAD/LOCK_TABLES 权限，必须禁锁
#   --lock-tables=false      跳过 LOCK TABLES（mysql 8.0 正确写法）
#   --skip-add-locks         dump 输出里不写 LOCK TABLES 语句
#   --column-statistics=0    8.0 客户端默认拉 stats，RDS 不开放
#   --set-gtid-purged=OFF    避免在 dump 头部写 SET @@GLOBAL.GTID_PURGED
#   --where=id=1             单行表只 dump 一行
DUMP_CMD=(mysqldump
  -h "$MYSQL_HOST" -u "$MYSQL_USER"
  --no-tablespaces
  --column-statistics=0
  --lock-tables=false
  --skip-add-locks
  --set-gtid-purged=OFF
  --where=id=1
  "$MYSQL_DB" presale_config)

if [[ $DRY_RUN -eq 1 ]]; then
  echo "$(date -Is) ▶ dry-run cmd: ${DUMP_CMD[*]/$MYSQL_PWD/****}"
  echo "$(date -Is) ▶ output would be: $OUT"
  echo "$(date -Is) ✅ dry-run PASSED（凭据 + 命令 OK，未实际备份）"
  exit 0
fi

"${DUMP_CMD[@]}" 2>/tmp/mysqldump.err \
  | gzip > /tmp/presale_config_dump.sql.gz

sudo install -m 0600 -o root -g root /tmp/presale_config_dump.sql.gz "$OUT"
rm -f /tmp/presale_config_dump.sql.gz

# ── 验证 dump 含有 INSERT 行（非空保护）────────────────────────
LINES=$(zcat "$OUT" | grep -c '^INSERT INTO' || true)
if [[ "$LINES" -lt 1 ]]; then
  echo "$(date -Is) ❌ dump 不含 INSERT 行（可能 RDS 拒绝 / SQL 错误）" >&2
  # REV-002 m8 partial: 失败时打印 mysqldump stderr 帮助排查
  if [[ -s /tmp/mysqldump.err ]]; then
    echo "   stderr:" >&2
    sed 's/^/   /' /tmp/mysqldump.err >&2
  fi
  sudo rm -f "$OUT"
  exit 3
fi

# ── 清理超期备份（30 天）────────────────────────────────────────
sudo find "$BACKUP_DIR" -name "presale_config_*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete

# ── 完成 ────────────────────────────────────────────────────────
SIZE=$(stat -c %s "$OUT" 2>/dev/null || stat -f %z "$OUT")
echo "$(date -Is) ✅ presale_config 备份 → $OUT ($SIZE bytes, $LINES INSERT lines)"
