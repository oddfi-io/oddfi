#!/usr/bin/env bash
set -euo pipefail

IMPLEMENTATION_SLOT="0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC"

RPC_URL=""
PRIVATE_KEY=""
CHAIN_ID=""
ETHERSCAN_API_KEY=""
VERIFIER_URL=""
OUTPUT_FILE=""
VERIFY_IMPLS=false

ODD_PROXY=""
STAKING_PROXY=""
LIQUIDITY_PROXY=""
BETTING_PROXY=""

ODD_UPGRADE_DATA="0x"
STAKING_UPGRADE_DATA="0x"
LIQUIDITY_UPGRADE_DATA="0x"
BETTING_UPGRADE_DATA="0x"

usage() {
  cat <<'EOF'
Usage:
  script/upgrade_all_contracts.sh \
    --rpc-url <rpc> \
    --private-key <pk> \
    --chain-id <id> \
    --odd-proxy <addr> \
    --staking-proxy <addr> \
    --liquidity-proxy <addr> \
    --betting-proxy <addr> \
    [--odd-upgrade-data <0x...>] \
    [--staking-upgrade-data <0x...>] \
    [--liquidity-upgrade-data <0x...>] \
    [--betting-upgrade-data <0x...>] \
    [--verify-implementations] \
    [--etherscan-api-key <key>] \
    [--verifier-url <url>] \
    [--output-file <path>]

Notes:
  - The script deploys fresh implementations, preflights each proxy upgrade with cast call,
    then sends upgradeToAndCall transactions one by one.
  - BettingPool upgrades also deploy a fresh BettingSettlementModule and set it on
    the BettingPool proxy after the implementation upgrade.
  - If --verify-implementations is set, both --etherscan-api-key and --verifier-url are required.
  - If --output-file is omitted, the summary is written to docs/deployment/chain-<id>-upgrade-<utc>.json.
  - All timestamps printed by this script are UTC.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url) RPC_URL="$2"; shift 2 ;;
    --private-key) PRIVATE_KEY="$2"; shift 2 ;;
    --chain-id) CHAIN_ID="$2"; shift 2 ;;
    --etherscan-api-key) ETHERSCAN_API_KEY="$2"; shift 2 ;;
    --verifier-url) VERIFIER_URL="$2"; shift 2 ;;
    --odd-proxy) ODD_PROXY="$2"; shift 2 ;;
    --staking-proxy) STAKING_PROXY="$2"; shift 2 ;;
    --liquidity-proxy) LIQUIDITY_PROXY="$2"; shift 2 ;;
    --betting-proxy) BETTING_PROXY="$2"; shift 2 ;;
    --odd-upgrade-data) ODD_UPGRADE_DATA="$2"; shift 2 ;;
    --staking-upgrade-data) STAKING_UPGRADE_DATA="$2"; shift 2 ;;
    --liquidity-upgrade-data) LIQUIDITY_UPGRADE_DATA="$2"; shift 2 ;;
    --betting-upgrade-data) BETTING_UPGRADE_DATA="$2"; shift 2 ;;
    --verify-implementations) VERIFY_IMPLS=true; shift 1 ;;
    --output-file) OUTPUT_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

for cmd in jq cast forge; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd" >&2; exit 1; }
done

for required in RPC_URL PRIVATE_KEY CHAIN_ID ODD_PROXY STAKING_PROXY LIQUIDITY_PROXY BETTING_PROXY; do
  if [[ -z "${!required}" ]]; then
    echo "Missing required parameter: ${required}" >&2
    usage
    exit 1
  fi
done

if [[ "$VERIFY_IMPLS" == true ]]; then
  if [[ -z "$ETHERSCAN_API_KEY" || -z "$VERIFIER_URL" ]]; then
    echo "--verify-implementations requires --etherscan-api-key and --verifier-url" >&2
    exit 1
  fi
fi

export NO_PROXY='*'
export HTTP_PROXY=''
export HTTPS_PROXY=''
export ALL_PROXY=''

ADMIN_ADDRESS="$(cast wallet address --private-key "$PRIVATE_KEY")"
RUN_STARTED_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RUN_LABEL="$(date -u +"%Y%m%dT%H%M%SZ")"
TMP_DIR="$(mktemp -d /tmp/odd-upgrade-all-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -z "$OUTPUT_FILE" ]]; then
  OUTPUT_FILE="docs/deployment/chain-${CHAIN_ID}-upgrade-${RUN_LABEL}.json"
fi
mkdir -p "$(dirname "$OUTPUT_FILE")"

run_with_retry_capture() {
  local attempt
  local output

  for attempt in 1 2 3; do
    if output="$("$@" 2>&1)"; then
      printf '%s\n' "$output"
      return 0
    fi
    if [[ "$attempt" -lt 3 ]]; then
      echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] retry ${attempt}/3 failed for: $*" >&2
      echo "$output" >&2
      sleep 5
    fi
  done

  echo "$output" >&2
  return 1
}

extract_field() {
  local text="$1"
  local key="$2"
  printf '%s\n' "$text" | awk -v k="$key" '$1 == k {print $2}' | tail -n 1
}

read_proxy_impl() {
  local proxy="$1"
  local storage_value
  storage_value="$(run_with_retry_capture cast storage "$proxy" "$IMPLEMENTATION_SLOT" --rpc-url "$RPC_URL")"
  echo "0x${storage_value:26:40}"
}

read_settlement_module() {
  local value

  if value="$(run_with_retry_capture cast call "$BETTING_PROXY" 'settlementModule()(address)' --rpc-url "$RPC_URL")"; then
    echo "$value"
  else
    echo "unreadable"
  fi
}

verify_impl() {
  local label="$1"
  local address="$2"
  local source_id="$3"
  local attempt
  local verify_status="skipped"

  if [[ "$VERIFY_IMPLS" != true ]]; then
    eval "${label}_VERIFY_STATUS='$verify_status'"
    return 0
  fi

  for attempt in 1 2 3; do
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] verifying ${label} implementation ${address} (attempt ${attempt}/3)"
    if run_with_retry_capture forge verify-contract \
      --chain "$CHAIN_ID" \
      --watch \
      --verifier-url "$VERIFIER_URL" \
      --etherscan-api-key "$ETHERSCAN_API_KEY" \
      "$address" \
      "$source_id" >/dev/null; then
      verify_status="verified"
      eval "${label}_VERIFY_STATUS='$verify_status'"
      return 0
    fi
    sleep 5
  done

  verify_status="failed"
  eval "${label}_VERIFY_STATUS='$verify_status'"
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] verification failed for ${label} after 3 attempts; upgrade already completed" >&2
}

deploy_impl() {
  local label="$1"
  local artifact_path="$2"
  local source_id="$3"
  local bytecode
  local receipt

  bytecode="$(jq -r '.bytecode.object' "$artifact_path")"
  receipt="$(run_with_retry_capture cast send --legacy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --create "$bytecode")"

  local deployed_to
  local deploy_tx
  local block_number
  local gas_used

  deployed_to="$(extract_field "$receipt" "contractAddress")"
  deploy_tx="$(extract_field "$receipt" "transactionHash")"
  block_number="$(extract_field "$receipt" "blockNumber")"
  gas_used="$(extract_field "$receipt" "gasUsed")"

  if [[ -z "$deployed_to" || -z "$deploy_tx" ]]; then
    echo "Failed to parse deployment receipt for ${label}" >&2
    printf '%s\n' "$receipt" >&2
    exit 1
  fi

  eval "${label}_IMPL='$deployed_to'"
  eval "${label}_DEPLOY_TX='$deploy_tx'"
  eval "${label}_DEPLOY_BLOCK='$block_number'"
  eval "${label}_DEPLOY_GAS='$gas_used'"

  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] deployed ${label} implementation"
  echo "  implementation: ${deployed_to}"
  echo "  tx_hash:        ${deploy_tx}"
  echo "  block:          ${block_number}"
  echo "  gas_used:       ${gas_used}"

}

preflight_upgrade() {
  local label="$1"
  local proxy="$2"
  local implementation="$3"
  local upgrade_data="$4"

  run_with_retry_capture cast call \
    "$proxy" \
    'upgradeToAndCall(address,bytes)' \
    "$implementation" \
    "$upgrade_data" \
    --from "$ADMIN_ADDRESS" \
    --rpc-url "$RPC_URL" >/dev/null

  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] preflight ok for ${label} proxy ${proxy}"
}

upgrade_proxy() {
  local label="$1"
  local proxy="$2"
  local implementation="$3"
  local upgrade_data="$4"
  local before_impl
  local receipt
  local after_impl
  local upgrade_tx
  local block_number
  local gas_used

  before_impl="$(read_proxy_impl "$proxy")"
  preflight_upgrade "$label" "$proxy" "$implementation" "$upgrade_data"
  receipt="$(run_with_retry_capture cast send \
    "$proxy" \
    'upgradeToAndCall(address,bytes)' \
    "$implementation" \
    "$upgrade_data" \
    --legacy \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY")"

  after_impl="$(read_proxy_impl "$proxy")"
  upgrade_tx="$(extract_field "$receipt" "transactionHash")"
  block_number="$(extract_field "$receipt" "blockNumber")"
  gas_used="$(extract_field "$receipt" "gasUsed")"

  if [[ "$after_impl" != "${implementation,,}" && "$after_impl" != "$implementation" ]]; then
    echo "Proxy ${label} implementation mismatch after upgrade: expected ${implementation}, got ${after_impl}" >&2
    exit 1
  fi

  eval "${label}_PROXY_BEFORE='$before_impl'"
  eval "${label}_PROXY_AFTER='$after_impl'"
  eval "${label}_UPGRADE_TX='$upgrade_tx'"
  eval "${label}_UPGRADE_BLOCK='$block_number'"
  eval "${label}_UPGRADE_GAS='$gas_used'"

  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] upgraded ${label} proxy"
  echo "  proxy:          ${proxy}"
  echo "  impl_before:    ${before_impl}"
  echo "  impl_after:     ${after_impl}"
  echo "  tx_hash:        ${upgrade_tx}"
  echo "  block:          ${block_number}"
  echo "  gas_used:       ${gas_used}"
  echo "  upgrade_data:   ${upgrade_data}"
}

echo "[$RUN_STARTED_UTC] building contracts"
forge build --skip test >/dev/null

deploy_impl ODD out/ODDToken.sol/ODDToken.json src/modules/token/ODDToken.sol:ODDToken
deploy_impl STAKING out/StakingPool.sol/StakingPool.json src/modules/staking/StakingPool.sol:StakingPool
deploy_impl LIQUIDITY out/LiquidityPool.sol/LiquidityPool.json src/modules/liquidity/LiquidityPool.sol:LiquidityPool
deploy_impl BETTING out/BettingPool.sol/BettingPool.json src/modules/betting/BettingPool.sol:BettingPool
deploy_impl SETTLEMENT out/BettingSettlementModule.sol/BettingSettlementModule.json src/modules/betting/BettingSettlementModule.sol:BettingSettlementModule

upgrade_proxy ODD "$ODD_PROXY" "$ODD_IMPL" "$ODD_UPGRADE_DATA"
upgrade_proxy STAKING "$STAKING_PROXY" "$STAKING_IMPL" "$STAKING_UPGRADE_DATA"
upgrade_proxy LIQUIDITY "$LIQUIDITY_PROXY" "$LIQUIDITY_IMPL" "$LIQUIDITY_UPGRADE_DATA"
upgrade_proxy BETTING "$BETTING_PROXY" "$BETTING_IMPL" "$BETTING_UPGRADE_DATA"

SETTLEMENT_BEFORE="$(read_settlement_module)"
SETTLEMENT_RECEIPT="$(run_with_retry_capture cast send \
  "$BETTING_PROXY" \
  'setSettlementModule(address)' \
  "$SETTLEMENT_IMPL" \
  --legacy \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY")"
SETTLEMENT_AFTER="$(read_settlement_module)"
SETTLEMENT_SET_TX="$(extract_field "$SETTLEMENT_RECEIPT" "transactionHash")"
SETTLEMENT_SET_BLOCK="$(extract_field "$SETTLEMENT_RECEIPT" "blockNumber")"
SETTLEMENT_SET_GAS="$(extract_field "$SETTLEMENT_RECEIPT" "gasUsed")"

if [[ "${SETTLEMENT_AFTER,,}" != "${SETTLEMENT_IMPL,,}" ]]; then
  echo "BettingPool settlementModule mismatch after set: expected ${SETTLEMENT_IMPL}, got ${SETTLEMENT_AFTER}" >&2
  exit 1
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] set BettingPool settlement module"
echo "  betting_proxy:   ${BETTING_PROXY}"
echo "  before:          ${SETTLEMENT_BEFORE}"
echo "  after:           ${SETTLEMENT_AFTER}"
echo "  tx_hash:         ${SETTLEMENT_SET_TX}"
echo "  block:           ${SETTLEMENT_SET_BLOCK}"
echo "  gas_used:        ${SETTLEMENT_SET_GAS}"

verify_impl ODD "$ODD_IMPL" src/modules/token/ODDToken.sol:ODDToken
verify_impl STAKING "$STAKING_IMPL" src/modules/staking/StakingPool.sol:StakingPool
verify_impl LIQUIDITY "$LIQUIDITY_IMPL" src/modules/liquidity/LiquidityPool.sol:LiquidityPool
verify_impl BETTING "$BETTING_IMPL" src/modules/betting/BettingPool.sol:BettingPool
verify_impl SETTLEMENT "$SETTLEMENT_IMPL" src/modules/betting/BettingSettlementModule.sol:BettingSettlementModule

RUN_FINISHED_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat >"$OUTPUT_FILE" <<EOF
{
  "run_started_utc": "$RUN_STARTED_UTC",
  "run_finished_utc": "$RUN_FINISHED_UTC",
  "chain_id": "$CHAIN_ID",
  "rpc_url": "$RPC_URL",
  "admin_address": "$ADMIN_ADDRESS",
  "verification": {
    "enabled": $([[ "$VERIFY_IMPLS" == true ]] && echo true || echo false),
    "verifier_url": "$VERIFIER_URL"
  },
  "contracts": {
    "ODD": {
      "proxy": "$ODD_PROXY",
      "implementation_before": "$ODD_PROXY_BEFORE",
      "implementation_after": "$ODD_PROXY_AFTER",
      "implementation_deployed": "$ODD_IMPL",
      "verification_status": "${ODD_VERIFY_STATUS:-skipped}",
      "deploy_tx_hash": "$ODD_DEPLOY_TX",
      "deploy_block": "$ODD_DEPLOY_BLOCK",
      "upgrade_tx_hash": "$ODD_UPGRADE_TX",
      "upgrade_block": "$ODD_UPGRADE_BLOCK",
      "upgrade_data": "$ODD_UPGRADE_DATA"
    },
    "STAKING": {
      "proxy": "$STAKING_PROXY",
      "implementation_before": "$STAKING_PROXY_BEFORE",
      "implementation_after": "$STAKING_PROXY_AFTER",
      "implementation_deployed": "$STAKING_IMPL",
      "verification_status": "${STAKING_VERIFY_STATUS:-skipped}",
      "deploy_tx_hash": "$STAKING_DEPLOY_TX",
      "deploy_block": "$STAKING_DEPLOY_BLOCK",
      "upgrade_tx_hash": "$STAKING_UPGRADE_TX",
      "upgrade_block": "$STAKING_UPGRADE_BLOCK",
      "upgrade_data": "$STAKING_UPGRADE_DATA"
    },
    "LIQUIDITY": {
      "proxy": "$LIQUIDITY_PROXY",
      "implementation_before": "$LIQUIDITY_PROXY_BEFORE",
      "implementation_after": "$LIQUIDITY_PROXY_AFTER",
      "implementation_deployed": "$LIQUIDITY_IMPL",
      "verification_status": "${LIQUIDITY_VERIFY_STATUS:-skipped}",
      "deploy_tx_hash": "$LIQUIDITY_DEPLOY_TX",
      "deploy_block": "$LIQUIDITY_DEPLOY_BLOCK",
      "upgrade_tx_hash": "$LIQUIDITY_UPGRADE_TX",
      "upgrade_block": "$LIQUIDITY_UPGRADE_BLOCK",
      "upgrade_data": "$LIQUIDITY_UPGRADE_DATA"
    },
    "BETTING": {
      "proxy": "$BETTING_PROXY",
      "implementation_before": "$BETTING_PROXY_BEFORE",
      "implementation_after": "$BETTING_PROXY_AFTER",
      "implementation_deployed": "$BETTING_IMPL",
      "verification_status": "${BETTING_VERIFY_STATUS:-skipped}",
      "deploy_tx_hash": "$BETTING_DEPLOY_TX",
      "deploy_block": "$BETTING_DEPLOY_BLOCK",
      "upgrade_tx_hash": "$BETTING_UPGRADE_TX",
      "upgrade_block": "$BETTING_UPGRADE_BLOCK",
      "upgrade_data": "$BETTING_UPGRADE_DATA"
    },
    "BETTING_SETTLEMENT_MODULE": {
      "address_before": "$SETTLEMENT_BEFORE",
      "address_after": "$SETTLEMENT_AFTER",
      "implementation_deployed": "$SETTLEMENT_IMPL",
      "verification_status": "${SETTLEMENT_VERIFY_STATUS:-skipped}",
      "deploy_tx_hash": "$SETTLEMENT_DEPLOY_TX",
      "deploy_block": "$SETTLEMENT_DEPLOY_BLOCK",
      "set_tx_hash": "$SETTLEMENT_SET_TX",
      "set_block": "$SETTLEMENT_SET_BLOCK"
    }
  }
}
EOF

echo "[$RUN_FINISHED_UTC] upgrade-all run completed"
echo "summary_file: $OUTPUT_FILE"
