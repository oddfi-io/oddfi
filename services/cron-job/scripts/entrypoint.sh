#!/bin/sh
set -e

# 设置时区（如果配置了TZ环境变量）
if [ -n "$TZ" ]; then
    cp /usr/share/zoneinfo/$TZ /etc/localtime
    echo "$TZ" > /etc/timezone
fi

# 创建日志目录（如果需要）
mkdir -p /app/logs

# 执行应用
exec /home/appuser/main "$@"
