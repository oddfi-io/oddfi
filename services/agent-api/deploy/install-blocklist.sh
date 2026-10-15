#!/usr/bin/env bash
# 一次性脚本：在 nginx 服务器上安装 IP 黑名单的 conf.d 配置。
#
# ENH-002 §4.5 — 服务器 nginx 进程混部多 site（news-api / market-api / ...），
# 改动必须先 `nginx -t` 验证，失败立即 abort 不 reload，否则其他 site 一起下线。
#
# 用法（每台服务器只跑一次）：
#   ssh test-market-api 'bash -s' < deploy/install-blocklist.sh   # dev
#   ssh backend-03      'bash -s' < deploy/install-blocklist.sh   # prod
#
# 修改黑名单后只需 reload：
#   sudo vim /etc/nginx/conf.d/blocklist.conf   # 加 IP 行
#   sudo nginx -t && sudo systemctl reload nginx
#
# 删除某 IP 同理：注释 / 删行后 reload。

set -euo pipefail

CONF="/etc/nginx/conf.d/blocklist.conf"

if [ "$(id -u)" = "0" ]; then
  echo "[Blocklist] 不要以 root 运行；用 ubuntu 用户 + sudo（脚本内部按需 sudo）" >&2
  exit 1
fi

# 幂等：已存在则跳过创建（不覆盖运维手工添加的 IP）
if [ -f "$CONF" ]; then
  echo "[Blocklist] $CONF already exists, skipping creation."
else
  echo "[Blocklist] creating empty blocklist at $CONF ..."
  sudo tee "$CONF" >/dev/null <<'EOF'
# /etc/nginx/conf.d/blocklist.conf — IP 黑名单（ENH-002）
#
# nginx 主配自动 include /etc/nginx/conf.d/*.conf 到 http 上下文，
# 所以 geo 块在此自然生效，全部 site 共享 $blocklist 变量。
#
# 添加 IP：在 default 0; 之后追加 `<ip> 1;` 行，sudo nginx -t && sudo systemctl reload nginx
# 删除 IP：删行或改为 0，同样 reload
#
# 命中后被 news-api site 内的 `if ($blocklist) { return 444; }` 拦截，
# 直接 reset 连接，不消耗后端资源。
geo $blocklist {
    default 0;
    # 1.2.3.4 1;   # 示例
}
EOF
fi

echo "[Blocklist] running nginx -t ..."
if ! sudo nginx -t; then
  echo "[Blocklist] ✗ nginx -t FAILED — NOT reloading; fix the config before re-running" >&2
  exit 1
fi

echo "[Blocklist] reloading nginx ..."
sudo systemctl reload nginx

echo "[Blocklist] ✓ done — geo \$blocklist 现已可用，news-api site 已挂 if 拦截"
