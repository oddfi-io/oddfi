#!/bin/bash
# Let's Encrypt 续期 POST hook — 启回 web-api 容器恢复 :80 公网服务
#
# 安装位置：/etc/letsencrypt/renewal-hooks/post/start-web-api.sh
# 由 certbot 自动调用（不论续期成功失败）

set -e
echo "[$(date -u +%FT%TZ)] post-renewal: starting web-api container"
docker start web-api 2>&1
