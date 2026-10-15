#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 0 ]]; then
  exit 1
fi

RPC_URL="${RPC_URL:-https://bsc-testnet-dataseed.bnbchain.org}"
CHAIN="${CHAIN:-bsc-testnet}"

exec "$(dirname "$0")/deploy_and_verify.sh" \
  --rpc-url "$RPC_URL" \
  --chain "$CHAIN" \
  "$@"
