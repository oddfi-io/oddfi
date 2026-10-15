#!/usr/bin/env bash
# 本地开发启动脚本：从 macOS 钥匙串读 Lark App Secret，注入环境变量后跑 go server
#
# 首次使用（仅一次，secret 不会落任何文件 / shell history）：
#   security add-generic-password -s 'oddfi-admin-lark-secret' -a "$USER" -w
#   # 提示 password: 粘贴 Lark App Secret 回车
#
# 之后每次启动：
#   ./scripts/dev-server.sh
#
# 重置 secret（Lark 后台重置后同步本地）：
#   security delete-generic-password -s 'oddfi-admin-lark-secret' -a "$USER"
#   security add-generic-password   -s 'oddfi-admin-lark-secret' -a "$USER" -w

set -euo pipefail

# 切到仓库根（这个脚本可能从任意目录调用）
cd "$(dirname "$0")/.."

KEYCHAIN_SERVICE='oddfi-admin-lark-secret'

# 检查 secret 是否存在
# 注意：变量展开必须用 ${VAR} 花括号包裹，否则后接 UTF-8 中文符号时
# 会被 bash 当作变量名后缀（macOS bash 3.2 尤其敏感）
if ! security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${USER}" >/dev/null 2>&1; then
  cat >&2 <<EOF
❌ 钥匙串中找不到 secret (service=${KEYCHAIN_SERVICE}, account=${USER})

请在你自己的终端执行一次（不要在 Claude Code 的 Bash 工具里跑，避免 secret 经过 AI 上下文）：

  security add-generic-password -s '${KEYCHAIN_SERVICE}' -a "\$USER" -w

执行后 macOS 会提示 password，粘贴 Lark App Secret 回车即可。
EOF
  exit 1
fi

# 读出 secret（-w 仅输出 password 字段）
# 用环境变量传递，避免 secret 出现在 ps 输出或 history
ADMIN_LARK_APP_SECRET="$(security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${USER}" -w)" \
  exec go run ./cmd/server
