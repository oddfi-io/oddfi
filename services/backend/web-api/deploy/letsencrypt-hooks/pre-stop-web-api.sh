#!/bin/bash
# Let's Encrypt 续期 PRE hook — 停 web-api 容器空出 :80 给 certbot standalone
#
# 安装位置：/etc/letsencrypt/renewal-hooks/pre/stop-web-api.sh
# 由 certbot 自动调用（systemd timer 触发的 `certbot renew`）
# 续期失败时 post hook 仍会执行（certbot 保证），所以容器一定会被启回

set -e
echo "[$(date -u +%FT%TZ)] pre-renewal: stopping web-api container"
docker stop web-api 2>&1 || true
