#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  PRIVATE_KEY=0x... EXPLORER_API_KEY=... ./script/deploy_and_verify.sh \
    --rpc-url <rpc_url> \
    --chain <chain_name> \
    [--admin <address>] \
    [--pauser <address>] \
    [--platform-treasury <address>] \
    [--ops-treasury <address>] \
    [--referral-claim-signer <address>] \
    [--referral-swap-pool-fee <uint24>] \
    [--initial-platform-reserve <wei>] \
    [--usdt <address>] \
    [--position-manager <address>] \
    [--referral-swap-router <address>] \
    [--referral-swap-expected-pool <address>] \
    [--verifier-url <url>] \
    [--skip-verify] \
    [--output-file <path>]

Notes:
  - If --admin is omitted, deployer address is used.
  - If --pauser is omitted, admin address is used.
  - If --platform-treasury is omitted, admin address is used.
  - If --ops-treasury is omitted, admin address is used.
  - If --referral-claim-signer is omitted, admin address is used.
  - If --usdt/--position-manager/--referral-swap-router are zero/omitted,
    DeployAll uses its BSC mainnet constants.
  - If admin differs from deployer, the script will:
      1) deploy with deployer as temporary admin,
      2) configure the system,
      3) grant final admin/pauser roles and betting ops roles,
      4) revoke bootstrap deployer roles unless deployer is a final role holder.
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

sanitize_rpc_url() {
  local url="$1"
  if [[ "$url" == *"/v2/"* ]]; then
    echo "${url%%/v2/*}/v2/<redacted>"
  else
    echo "$url" | sed -E 's/([?&](api[_-]?key|key|token)=)[^&]+/\1<redacted>/Ig'
  fi
}

require_cmd forge
require_cmd cast
require_cmd awk

if [[ $# -eq 0 ]]; then
  usage
  exit 1
fi

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "PRIVATE_KEY is required" >&2
  exit 1
fi

RPC_URL=""
CHAIN=""
ADMIN=""
PAUSER=""
PLATFORM_TREASURY=""
OPS_TREASURY=""
SIGNER=""
POOL_FEE="2500"
INITIAL_RESERVE="0"
ZERO_ADDRESS="0x0000000000000000000000000000000000000000"
USDT="$ZERO_ADDRESS"
POSITION_MANAGER="$ZERO_ADDRESS"
REFERRAL_SWAP_ROUTER="$ZERO_ADDRESS"
REFERRAL_SWAP_EXPECTED_POOL="$ZERO_ADDRESS"
VERIFIER_URL=""
SKIP_VERIFY="false"
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url)
      RPC_URL="$2"
      shift 2
      ;;
    --chain)
      CHAIN="$2"
      shift 2
      ;;
    --admin)
      ADMIN="$2"
      shift 2
      ;;
    --pauser)
      PAUSER="$2"
      shift 2
      ;;
    --platform-treasury)
      PLATFORM_TREASURY="$2"
      shift 2
      ;;
    --ops-treasury)
      OPS_TREASURY="$2"
      shift 2
      ;;
    --referral-claim-signer)
      SIGNER="$2"
      shift 2
      ;;
    --referral-swap-pool-fee)
      POOL_FEE="$2"
      shift 2
      ;;
    --initial-platform-reserve)
      INITIAL_RESERVE="$2"
      shift 2
      ;;
    --usdt)
      USDT="$2"
      shift 2
      ;;
    --position-manager)
      POSITION_MANAGER="$2"
      shift 2
      ;;
    --referral-swap-router)
      REFERRAL_SWAP_ROUTER="$2"
      shift 2
      ;;
    --referral-swap-expected-pool)
      REFERRAL_SWAP_EXPECTED_POOL="$2"
      shift 2
      ;;
    --verifier-url)
      VERIFIER_URL="$2"
      shift 2
      ;;
    --skip-verify)
      SKIP_VERIFY="true"
      shift
      ;;
    --output-file)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$RPC_URL" || -z "$CHAIN" ]]; then
  echo "--rpc-url and --chain are required" >&2
  exit 1
fi

if [[ "$SKIP_VERIFY" != "true" && -z "${EXPLORER_API_KEY:-}" ]]; then
  echo "EXPLORER_API_KEY is required unless --skip-verify is used" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

DEPLOYER="$(cast wallet address --private-key "$PRIVATE_KEY")"
if [[ -z "$ADMIN" ]]; then
  ADMIN="$DEPLOYER"
fi
if [[ -z "$PAUSER" ]]; then
  PAUSER="$ADMIN"
fi
if [[ -z "$PLATFORM_TREASURY" ]]; then
  PLATFORM_TREASURY="$ADMIN"
fi
if [[ -z "$OPS_TREASURY" ]]; then
  OPS_TREASURY="$ADMIN"
fi
if [[ -z "$SIGNER" ]]; then
  SIGNER="$ADMIN"
fi
RPC_URL_REDACTED="$(sanitize_rpc_url "$RPC_URL")"

echo "Deploy configuration:"
echo "  chain: $CHAIN"
echo "  rpc: $RPC_URL_REDACTED"
echo "  deployer: $DEPLOYER"
echo "  admin: $ADMIN"
echo "  pauser: $PAUSER"
echo "  platformTreasury: $PLATFORM_TREASURY"
echo "  opsTreasury: $OPS_TREASURY"
echo "  referralClaimSigner: $SIGNER"
echo "  referralSwapPoolFee: $POOL_FEE"
echo "  initialPlatformReserve: $INITIAL_RESERVE"
echo "  usdt: $USDT"
echo "  positionManager: $POSITION_MANAGER"
echo "  referralSwapRouter: $REFERRAL_SWAP_ROUTER"
echo "  referralSwapExpectedPool: $REFERRAL_SWAP_EXPECTED_POOL"
echo "  verify: $([[ "$SKIP_VERIFY" == "true" ]] && echo no || echo yes)"

COMMON_ARGS=(
  --rpc-url "$RPC_URL"
  --broadcast
  --legacy
  --chain "$CHAIN"
)

VERIFY_ARGS=()
if [[ "$SKIP_VERIFY" != "true" ]]; then
  VERIFY_ARGS+=(--verify --etherscan-api-key "$EXPLORER_API_KEY")
  if [[ -n "$VERIFIER_URL" ]]; then
    VERIFY_ARGS+=(--verifier-url "$VERIFIER_URL")
  fi
fi

echo "Deploying contracts..."
TMP_OUT="$(mktemp)"
set +e
forge script script/DeployAll.s.sol:DeployAll \
  "${COMMON_ARGS[@]}" \
  "${VERIFY_ARGS[@]}" \
  --sig "run(address,address,address,address,address,uint24,uint256,address,address,address,address)" \
  "$ADMIN" \
  "$PAUSER" \
  "$PLATFORM_TREASURY" \
  "$OPS_TREASURY" \
  "$SIGNER" \
  "$POOL_FEE" \
  "$INITIAL_RESERVE" \
  "$USDT" \
  "$POSITION_MANAGER" \
  "$REFERRAL_SWAP_ROUTER" \
  "$REFERRAL_SWAP_EXPECTED_POOL" | tee "$TMP_OUT"
FORGE_STATUS="${PIPESTATUS[0]}"
set -e

if [[ "$FORGE_STATUS" -ne 0 ]]; then
  if grep -q 'ONCHAIN EXECUTION COMPLETE & SUCCESSFUL' "$TMP_OUT" \
    && grep -q 'Not all .* contracts were verified' "$TMP_OUT"; then
    echo "warning: deployment succeeded, but automatic explorer verification was partial; continuing to write deployment record" >&2
  else
    exit "$FORGE_STATUS"
  fi
fi

echo
echo "Deployment summary:"
grep -E '^(deployer|admin|pauser|platformTreasury|opsTreasury|oddProxy|tierSaleProxy|houseVaultProxy|dexLaunchProxy|dexLpLockerProxy|ecosystemRewardsProxy|stakingProxy|liquidityProxy|bettingProxy|parlayLens) ' "$TMP_OUT" || true

CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
RUN_JSON="broadcast/DeployAll.s.sol/${CHAIN_ID}/run-latest.json"
if command -v jq >/dev/null 2>&1 && [[ -f "$RUN_JSON" ]]; then
  echo
  echo "Deployment addresses (from $RUN_JSON):"
  jq -r '
    def created($txs; $name): (($txs | map(select((.transactionType == "CREATE" or .transactionType == "CREATE2") and .contractName == $name)))[0] // {});
    .transactions as $txs
    | ($txs | map(select(.transactionType == "CREATE" and .contractName == "ERC1967Proxy"))) as $proxies
    | [
        ["ODDToken implementation", (($txs | map(select(.transactionType == "CREATE" and .contractName == "ODDToken"))[0].contractAddress))],
        ["ODDToken proxy", $proxies[0].contractAddress],
        ["TierSale implementation", (created($txs; "TierSale").contractAddress // null)],
        ["TierSale proxy", $proxies[1].contractAddress],
        ["HouseVault implementation", (created($txs; "HouseVault").contractAddress // null)],
        ["HouseVault proxy", $proxies[2].contractAddress],
        ["DexLpLocker implementation", (created($txs; "DexLpLocker").contractAddress // null)],
        ["DexLpLocker proxy", $proxies[3].contractAddress],
        ["DexLaunchController implementation", (created($txs; "DexLaunchController").contractAddress // null)],
        ["DexLaunchController proxy", $proxies[4].contractAddress],
        ["EcosystemRewards implementation", (created($txs; "EcosystemRewards").contractAddress // null)],
        ["EcosystemRewards proxy", $proxies[5].contractAddress],
        ["StakingPool implementation", (($txs | map(select(.transactionType == "CREATE" and .contractName == "StakingPool"))[0].contractAddress))],
        ["StakingPool proxy", $proxies[6].contractAddress],
        ["LiquidityPool implementation", (($txs | map(select(.transactionType == "CREATE" and .contractName == "LiquidityPool"))[0].contractAddress))],
        ["LiquidityPool proxy", $proxies[7].contractAddress],
        ["BettingPool implementation", (($txs | map(select(.transactionType == "CREATE" and .contractName == "BettingPool"))[0].contractAddress))],
        ["BettingPool proxy", $proxies[8].contractAddress],
        ["BettingSettlementModule", (created($txs; "BettingSettlementModule").contractAddress // null)],
        ["BettingBetModule", (created($txs; "BettingBetModule").contractAddress // null)],
        ["BettingMarketModule", (created($txs; "BettingMarketModule").contractAddress // null)],
        ["BettingReferralModule", (created($txs; "BettingReferralModule").contractAddress // null)],
        ["BettingParlayModule", (created($txs; "BettingParlayModule").contractAddress // null)],
        ["BettingParlayLens", (created($txs; "BettingParlayLens").contractAddress // null)],
        ["BettingOddsLib", (created($txs; "BettingOddsLib").contractAddress // null)],
        ["BettingValidationLib", (created($txs; "BettingValidationLib").contractAddress // null)],
        ["BettingReferralLib", (created($txs; "BettingReferralLib").contractAddress // null)]
      ]
    | .[]
    | "  \(.[0]): \(.[1])"' "$RUN_JSON"

  if [[ -z "$OUTPUT_FILE" ]]; then
    OUTPUT_FILE="docs/deployment/${CHAIN}-current.json"
  fi
  mkdir -p "$(dirname "$OUTPUT_FILE")"
  RUN_STARTED_UTC="$(date -u -r "$RUN_JSON" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")"
  RUN_FINISHED_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  jq \
    --arg run_started_utc "$RUN_STARTED_UTC" \
    --arg run_finished_utc "$RUN_FINISHED_UTC" \
    --arg chain "$CHAIN" \
    --arg chain_id "$CHAIN_ID" \
    --arg rpc_url "$RPC_URL_REDACTED" \
    --arg deployer "$DEPLOYER" \
    --arg admin "$ADMIN" \
    --arg pauser "$PAUSER" \
    --arg platform_treasury "$PLATFORM_TREASURY" \
    --arg ops_treasury "$OPS_TREASURY" \
    --arg referral_claim_signer "$SIGNER" \
    --arg referral_swap_pool_fee "$POOL_FEE" \
    --arg initial_platform_reserve "$INITIAL_RESERVE" \
    --arg usdt "$USDT" \
    --arg position_manager "$POSITION_MANAGER" \
    --arg referral_swap_router "$REFERRAL_SWAP_ROUTER" \
    --arg referral_swap_expected_pool "$REFERRAL_SWAP_EXPECTED_POOL" \
    --arg broadcast_file "$RUN_JSON" '
    def tx_hash: (.hash // .transactionHash // .txHash // "");
    def block_num: (.blockNumber // .receipt.blockNumber // null);
    def gas_used: (.gasUsed // .receipt.gasUsed // null);
    def created($txs; $name): (($txs | map(select((.transactionType == "CREATE" or .transactionType == "CREATE2") and .contractName == $name)))[0] // {});
    def contract_record($txs; $name; $proxy):
      (created($txs; $name)) as $impl
      | {
          proxy: ($proxy.contractAddress // null),
          implementation: ($impl.contractAddress // null),
          proxy_deploy_tx_hash: ($proxy | tx_hash),
          implementation_deploy_tx_hash: ($impl | tx_hash),
          proxy_deploy_block: ($proxy | block_num),
          implementation_deploy_block: ($impl | block_num),
          proxy_deploy_gas_used: ($proxy | gas_used),
          implementation_deploy_gas_used: ($impl | gas_used)
        };
    def standalone_record($txs; $name):
      (created($txs; $name)) as $contract
      | {
          address: ($contract.contractAddress // null),
          deploy_tx_hash: ($contract | tx_hash),
          deploy_block: ($contract | block_num),
          deploy_gas_used: ($contract | gas_used)
        };
    .transactions as $txs
    | ($txs | map(select(.transactionType == "CREATE" and .contractName == "ERC1967Proxy"))) as $proxies
    | {
        run_started_utc: $run_started_utc,
        run_finished_utc: $run_finished_utc,
        chain: $chain,
        chain_id: ($chain_id | tonumber),
        rpc_url: $rpc_url,
        deployer: $deployer,
        admin: $admin,
        pauser: $pauser,
        platform_treasury: $platform_treasury,
        ops_treasury: $ops_treasury,
        referral_claim_signer: $referral_claim_signer,
        referral_swap_pool_fee: ($referral_swap_pool_fee | tonumber),
        initial_platform_reserve: $initial_platform_reserve,
        external_contracts: {
          USDT: $usdt,
          PancakeV3NonfungiblePositionManager: $position_manager,
          PancakeV3SwapRouter: $referral_swap_router,
          referral_swap_expected_pool: $referral_swap_expected_pool
        },
        source: {
          script: "script/DeployAll.s.sol:DeployAll",
          broadcast_file: $broadcast_file
        },
        contracts: {
          ODDToken: contract_record($txs; "ODDToken"; $proxies[0]),
          TierSale: contract_record($txs; "TierSale"; $proxies[1]),
          HouseVault: contract_record($txs; "HouseVault"; $proxies[2]),
          DexLpLocker: contract_record($txs; "DexLpLocker"; $proxies[3]),
          DexLaunchController: contract_record($txs; "DexLaunchController"; $proxies[4]),
          EcosystemRewards: contract_record($txs; "EcosystemRewards"; $proxies[5]),
          StakingPool: contract_record($txs; "StakingPool"; $proxies[6]),
          LiquidityPool: contract_record($txs; "LiquidityPool"; $proxies[7]),
          BettingPool: contract_record($txs; "BettingPool"; $proxies[8]),
          BettingSettlementModule: standalone_record($txs; "BettingSettlementModule"),
          BettingBetModule: standalone_record($txs; "BettingBetModule"),
          BettingMarketModule: standalone_record($txs; "BettingMarketModule"),
          BettingReferralModule: standalone_record($txs; "BettingReferralModule"),
          BettingParlayModule: standalone_record($txs; "BettingParlayModule"),
          BettingParlayLens: standalone_record($txs; "BettingParlayLens"),
          BettingOddsLib: standalone_record($txs; "BettingOddsLib"),
          BettingValidationLib: standalone_record($txs; "BettingValidationLib"),
          BettingReferralLib: standalone_record($txs; "BettingReferralLib")
        },
        configuration_transactions: (
          $txs
          | map(select(.transactionType != "CREATE" and .transactionType != "CREATE2"))
          | map({
              contractName,
              contractAddress,
              function: (.function // ""),
              tx_hash: tx_hash,
              block: block_num,
              gas_used: gas_used
            })
        )
      }' "$RUN_JSON" > "$OUTPUT_FILE"
  echo "Deployment record saved at: $OUTPUT_FILE"
fi

echo
echo "Raw deployment log saved at: $TMP_OUT"
