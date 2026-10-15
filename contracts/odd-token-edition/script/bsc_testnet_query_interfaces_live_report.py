#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from decimal import Decimal, getcontext
from pathlib import Path
from typing import Any, Callable

from eth_account import Account
from eth_utils import to_hex
from web3 import Web3
from web3._utils.events import event_abi_to_log_topic, get_event_data
from web3.exceptions import ContractLogicError, TransactionNotFound
from web3.middleware import ExtraDataToPOAMiddleware

getcontext().prec = 50

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
REPORT_NAME = os.environ.get("QUERY_INTERFACES_REPORT_NAME", "2026-06-08-bsc-testnet-query-interfaces-live-report.md")
REPORT = ROOT / "docs" / "testing" / REPORT_NAME

RPC_URL = os.environ["RPC_URL"]
ADMIN_PRIVATE_KEY = os.environ["ADMIN_PRIVATE_KEY"]
CHAIN_ID = int(os.environ.get("CHAIN_ID", "97"))
ODD_WAD = 10**18
BPS = 10_000

ADDR = {
    "ODDToken": Web3.to_checksum_address("0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0"),
    "StakingPool": Web3.to_checksum_address("0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F"),
    "LiquidityPool": Web3.to_checksum_address("0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50"),
    "BettingPool": Web3.to_checksum_address("0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3"),
    "BettingSettlementModule": Web3.to_checksum_address(
        os.environ.get("BETTING_SETTLEMENT_MODULE", "0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39")
    ),
    "BettingParlayModule": Web3.to_checksum_address(
        os.environ.get("BETTING_PARLAY_MODULE", "0xD7AcFb964C01D4be09757207034FD919dA06fE96")
    ),
    "BettingParlayLens": Web3.to_checksum_address(
        os.environ.get("BETTING_PARLAY_LENS", "0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2")
    ),
}


@dataclass
class Actor:
    name: str
    key: str
    address: str


def redacted_rpc_url() -> str:
    if "/v2/" in RPC_URL:
        return RPC_URL.split("/v2/", 1)[0] + "/v2/<redacted>"
    return "RPC_URL environment value used (token omitted)"


def derived_actor_key(name: str) -> str:
    admin_seed = Web3.keccak(hexstr=ADMIN_PRIVATE_KEY)
    return to_hex(Web3.keccak(admin_seed + name.encode()))


w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 120}))
w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
if not w3.is_connected():
    raise SystemExit("RPC not connected")

actors: dict[str, Actor] = {"admin": Actor("admin", ADMIN_PRIVATE_KEY, Account.from_key(ADMIN_PRIVATE_KEY).address)}
for name in ["bettor", "cashoutUser", "parlayUser", "lpUser", "staker", "wrongUser"]:
    key = derived_actor_key(f"query-live-{name}")
    actors[name] = Actor(name, key, Account.from_key(key).address)


def load_abi(source: str, name: str) -> list[dict[str, Any]]:
    return json.loads((OUT / source / f"{name}.json").read_text())["abi"]


abis = {
    "ODDToken": load_abi("ODDToken.sol", "ODDToken"),
    "StakingPool": load_abi("StakingPool.sol", "StakingPool"),
    "LiquidityPool": load_abi("LiquidityPool.sol", "LiquidityPool"),
    "BettingPool": load_abi("BettingPool.sol", "BettingPool"),
    "BettingSettlementModule": load_abi("BettingSettlementModule.sol", "BettingSettlementModule"),
    "BettingParlayModule": load_abi("BettingParlayModule.sol", "BettingParlayModule"),
    "BettingParlayLens": load_abi("BettingParlayLens.sol", "BettingParlayLens"),
}
contracts = {name: w3.eth.contract(address=ADDR[name], abi=abi) for name, abi in abis.items()}
odd = contracts["ODDToken"]
staking = contracts["StakingPool"]
liquidity = contracts["LiquidityPool"]
betting = contracts["BettingPool"]
settlement = contracts["BettingSettlementModule"]
parlay_module = contracts["BettingParlayModule"]
lens = contracts["BettingParlayLens"]

event_decoders: dict[str, tuple[str, dict[str, Any]]] = {}
for contract_name, abi in abis.items():
    for item in abi:
        if item.get("type") == "event":
            event_decoders[to_hex(event_abi_to_log_topic(item))] = (contract_name, item)

tracked = {
    "admin": actors["admin"].address,
    "bettor": actors["bettor"].address,
    "cashoutUser": actors["cashoutUser"].address,
    "parlayUser": actors["parlayUser"].address,
    "lpUser": actors["lpUser"].address,
    "staker": actors["staker"].address,
    "BettingPool": ADDR["BettingPool"],
    "LiquidityPool": ADDR["LiquidityPool"],
    "StakingPool": ADDR["StakingPool"],
}

transactions: list[dict[str, Any]] = []
checks: list[tuple[str, bool, str]] = []
issues: list[str] = []
nonce_cache: dict[str, int] = {}


def fmt(raw: int, decimals: int = 18) -> str:
    return f"{Decimal(raw) / Decimal(10**decimals):,.18f}".rstrip("0").rstrip(".")


def snapshot() -> dict[str, dict[str, int]]:
    return {
        label: {"bnb": w3.eth.get_balance(address), "odd": odd.functions.balanceOf(address).call()}
        for label, address in tracked.items()
    }


def decode_logs(receipt: Any) -> list[dict[str, Any]]:
    decoded: list[dict[str, Any]] = []
    for log in receipt["logs"]:
        if not log["topics"]:
            continue
        entry = event_decoders.get(to_hex(log["topics"][0]))
        if entry is None:
            decoded.append({"address": log["address"], "event": "<unknown>", "args": {}})
            continue
        contract_name, event_abi = entry
        data = get_event_data(w3.codec, event_abi, log)
        decoded.append({"contract": contract_name, "address": log["address"], "event": data["event"], "args": dict(data["args"])})
    return decoded


def tx_base(actor: Actor) -> dict[str, Any]:
    chain_nonce = w3.eth.get_transaction_count(actor.address, "pending")
    cached_nonce = nonce_cache.get(actor.address, chain_nonce)
    nonce = max(chain_nonce, cached_nonce)
    nonce_cache[actor.address] = nonce + 1
    return {
        "from": actor.address,
        "nonce": nonce,
        "chainId": CHAIN_ID,
        "gasPrice": max(w3.eth.gas_price, 1_000_000_000),
    }


def wait_for_receipt(label: str, tx_hash: bytes) -> Any:
    deadline = time.time() + 900
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            return w3.eth.get_transaction_receipt(tx_hash)
        except TransactionNotFound as exc:
            last_error = exc
        except Exception as exc:
            last_error = exc
            print(f"{label}: receipt poll retry after {type(exc).__name__}", flush=True)
        time.sleep(5)
    raise RuntimeError(f"{label}: receipt unavailable for {to_hex(tx_hash)}; last_error={last_error!r}")


def check(name: str, ok: bool, detail: str) -> None:
    checks.append((name, ok, detail))
    if not ok:
        issues.append(f"{name}: {detail}")


def expect_revert(name: str, call: Callable[[], Any]) -> None:
    try:
        call()
    except ContractLogicError as exc:
        check(name, True, type(exc).__name__)
    except Exception as exc:
        check(name, True, type(exc).__name__)
    else:
        check(name, False, "call unexpectedly succeeded")


def send_tx(label: str, actor: Actor, build: Callable[[dict[str, Any]], dict[str, Any]], expected_status: int = 1) -> Any:
    before = snapshot()
    tx: dict[str, Any] = {}
    tx_hash: bytes | None = None
    for attempt in range(5):
        base = tx_base(actor)
        tx = dict(build(base))
        tx.setdefault("from", base["from"])
        tx.setdefault("nonce", base["nonce"])
        tx.setdefault("chainId", base["chainId"])
        tx.setdefault("gasPrice", base["gasPrice"])
        if attempt:
            tx["gasPrice"] = int(tx["gasPrice"] * (12 + attempt) // 10)
        if "gas" not in tx:
            tx["gas"] = int(w3.eth.estimate_gas(tx) * 13 // 10)
        signed = Account.sign_transaction(tx, actor.key)
        try:
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            break
        except Exception as exc:
            message = str(exc)
            if "nonce too low" not in message and "replacement transaction underpriced" not in message:
                raise
            nonce_cache[actor.address] = max(
                nonce_cache.get(actor.address, 0),
                int(tx["nonce"]) + 1,
                w3.eth.get_transaction_count(actor.address, "pending") + 1,
            )
            print(f"{label}: retrying after nonce error ({type(exc).__name__})", flush=True)
            time.sleep(5)
    if tx_hash is None:
        raise RuntimeError(f"{label}: unable to send transaction after nonce retries")
    receipt = wait_for_receipt(label, tx_hash)
    after = snapshot()
    status = int(receipt["status"])
    check(f"{label}_status", status == expected_status, f"status={status}, tx={receipt['transactionHash'].hex()}")
    transactions.append(
        {
            "label": label,
            "actor": actor.name,
            "actor_address": actor.address,
            "tx_hash": receipt["transactionHash"].hex(),
            "status": status,
            "gas_used": int(receipt["gasUsed"]),
            "effective_gas_price": int(receipt.get("effectiveGasPrice", tx["gasPrice"])),
            "before": before,
            "after": after,
            "logs": decode_logs(receipt),
        }
    )
    print(f"{label}: {receipt['transactionHash'].hex()} status={status} gas={receipt['gasUsed']}", flush=True)
    return receipt


def wait_until(target_ts: int, label: str) -> None:
    while True:
        now = int(w3.eth.get_block("latest")["timestamp"])
        if now >= target_ts:
            return
        remaining = target_ts - now
        print(f"waiting {remaining}s for {label} ...", flush=True)
        time.sleep(min(15, remaining))


def seed_actor(name: str, min_bnb: int, min_odd: int, odd_topup: int) -> None:
    actor = actors[name]
    if w3.eth.get_balance(actor.address) < min_bnb:
        send_tx(
            f"SEED_BNB_{name}",
            actors["admin"],
            lambda base, to=actor.address: {**base, "to": to, "value": min_bnb * 2, "gas": 50_000},
        )
    if odd.functions.balanceOf(actor.address).call() < min_odd:
        send_tx(
            f"SEED_ODD_{name}",
            actors["admin"],
            lambda base, to=actor.address, amount=odd_topup: odd.functions.transfer(to, amount).build_transaction(base),
        )


def approve_if_needed(label: str, actor: Actor, spender: str, amount: int) -> None:
    if odd.functions.allowance(actor.address, spender).call() < amount:
        send_tx(label, actor, lambda base: odd.functions.approve(spender, 2**256 - 1).build_transaction(base))


def open_market(label: str, match_label: str, start_ts: int, end_ts: int) -> tuple[bytes, bytes]:
    match_id = Web3.keccak(text=f"{match_label}-{CHAIN_ID}-{int(time.time())}")
    receipt = send_tx(
        label,
        actors["admin"],
        lambda base: betting.functions.openMarket(
            match_id,
            0,
            0,
            start_ts,
            end_ts,
            [20_000, 20_000, 20_000],
            int(w3.eth.get_block("latest")["timestamp"]),
        ).build_transaction(base),
    )
    market_id = None
    for log in decode_logs(receipt):
        if log.get("event") == "MarketOpened":
            market_id = log["args"]["marketId"]
            break
    if market_id is None:
        raise RuntimeError(f"{label}: MarketOpened missing")
    return match_id, market_id


def quote_guard(market_id: bytes, outcome: int, amount: int) -> tuple[int, int, int, int, int]:
    (_, accepted, locked_odds, _, _) = betting.functions.previewSignal(market_id, outcome, amount).call()
    (_, quoted_odds, updated_at, quote_version) = betting.functions.getMarketOdds(market_id).call()
    return (quote_version, updated_at, max(locked_odds, quoted_odds[outcome]), accepted, int(time.time()) + 900)


def parlay_leg(market_id: bytes, outcome: int) -> tuple[bytes, int, int, int, int]:
    (_, quoted_odds, updated_at, quote_version) = betting.functions.getMarketOdds(market_id).call()
    return (market_id, outcome, quote_version, updated_at, quoted_odds[outcome])


def place_bet(label: str, actor_name: str, market_id: bytes, outcome: int, amount: int) -> bytes:
    actor = actors[actor_name]
    guard = quote_guard(market_id, outcome, amount)
    receipt = send_tx(
        label,
        actor,
        lambda base: betting.functions.placeBet(market_id, outcome, amount, guard).build_transaction(base),
    )
    for log in decode_logs(receipt):
        if log.get("event") == "BetPlaced":
            return log["args"]["betId"]
    raise RuntimeError(f"{label}: BetPlaced missing")


def settle_market(label_prefix: str, market_id: bytes, home_score: int, away_score: int) -> None:
    bet_ids = betting.functions.getMarketBetIds(market_id, 0, 50).call()
    send_tx(
        f"{label_prefix}_SETTLE_BETS",
        actors["admin"],
        lambda base: betting.functions.settleMarketBetsByScore(market_id, home_score, away_score, bet_ids).build_transaction(base),
    )
    send_tx(
        f"{label_prefix}_FINALIZE",
        actors["admin"],
        lambda base: betting.functions.finalizeMarketSettlement(market_id, 0).build_transaction(base),
    )


def main() -> None:
    suite_before = snapshot()
    chain_before_block = w3.eth.block_number
    start_delay = int(os.environ.get("QUERY_START_DELAY_SECONDS", "180"))
    end_delay = int(os.environ.get("QUERY_END_DELAY_SECONDS", "300"))

    check("BETTING_SETTLEMENT_MODULE_CONFIGURED", betting.functions.settlementModule().call() == ADDR["BettingSettlementModule"], betting.functions.settlementModule().call())
    check("BETTING_PARLAY_MODULE_CONFIGURED", betting.functions.parlayModule().call() == ADDR["BettingParlayModule"], betting.functions.parlayModule().call())

    for name in ["bettor", "cashoutUser", "parlayUser", "lpUser", "staker"]:
        seed_actor(name, int(0.02 * ODD_WAD), 1_500 * ODD_WAD, 3_000 * ODD_WAD)

    approve_if_needed("APPROVE_BETTOR", actors["bettor"], ADDR["BettingPool"], 1_000 * ODD_WAD)
    approve_if_needed("APPROVE_CASHOUT_USER", actors["cashoutUser"], ADDR["BettingPool"], 500 * ODD_WAD)
    approve_if_needed("APPROVE_PARLAY_USER", actors["parlayUser"], ADDR["BettingPool"], 500 * ODD_WAD)
    approve_if_needed("APPROVE_LP_USER", actors["lpUser"], ADDR["LiquidityPool"], 2_000 * ODD_WAD)
    approve_if_needed("APPROVE_STAKER", actors["staker"], ADDR["StakingPool"], 200 * ODD_WAD)

    stake_receipt = send_tx("STAKE_CREATE", actors["staker"], lambda base: staking.functions.stake(100 * ODD_WAD, 0).build_transaction(base))
    stake_id = next(log["args"]["positionId"] for log in decode_logs(stake_receipt) if log.get("event") == "StakeCreated")
    check("STAKER_ACTIVE_AFTER_STAKE", staking.functions.isActiveStaker(actors["staker"].address).call(), str(stake_id))
    send_tx("STAKE_EARLY_UNSTAKE", actors["staker"], lambda base: staking.functions.earlyUnstake(stake_id).build_transaction(base))
    check("STAKER_INACTIVE_AFTER_EARLY_UNSTAKE", not staking.functions.isActiveStaker(actors["staker"].address).call(), str(stake_id))

    single_now = int(w3.eth.get_block("latest")["timestamp"])
    single_end = single_now + end_delay
    single_match, single_market = open_market("OPEN_SINGLE_MARKET", "query-single", single_now + start_delay, single_end)
    deposit_receipt = send_tx(
        "LP_DEPOSIT_MATCH",
        actors["lpUser"],
        lambda base: liquidity.functions.depositMatch(single_match, 1_000 * ODD_WAD).build_transaction(base),
    )
    lp_position_id = next(log["args"]["positionId"] for log in decode_logs(deposit_receipt) if log.get("event") == "LiquidityDeposited")
    bet_id = place_bet("PLACE_SINGLE_BET", "bettor", single_market, 0, 100 * ODD_WAD)

    estimated_value, floating_pnl = settlement.functions.estimateBetValue(ADDR["BettingPool"], actors["bettor"].address, bet_id).call()
    check("ESTIMATE_BET_VALUE_PENDING", estimated_value > 0, f"estimated={estimated_value}, pnl={floating_pnl}")
    wrong_estimated, wrong_pnl = settlement.functions.estimateBetValue(ADDR["BettingPool"], actors["wrongUser"].address, bet_id).call()
    check("ESTIMATE_BET_VALUE_WRONG_USER_ZERO", wrong_estimated == 0 and wrong_pnl == 0, f"estimated={wrong_estimated}, pnl={wrong_pnl}")
    expect_revert("GET_CLAIM_STATUS_BEFORE_MATCH_END_REVERTS", lambda: settlement.functions.getClaimStatus(ADDR["BettingPool"], actors["bettor"].address, bet_id).call())

    cashout_now = int(w3.eth.get_block("latest")["timestamp"])
    cashout_match, cashout_market = open_market(
        "OPEN_CASHOUT_MARKET", "query-cashout", cashout_now + start_delay, cashout_now + max(end_delay, start_delay + 60)
    )
    cashout_bet_id = place_bet("PLACE_CASHOUT_BET", "cashoutUser", cashout_market, 0, 100 * ODD_WAD)
    (_, _, _, cashout_quote_version) = betting.functions.getMarketOdds(cashout_market).call()
    cashout_quoted_at = int(w3.eth.get_block("latest")["timestamp"])
    send_tx(
        "CASH_OUT",
        actors["cashoutUser"],
        lambda base: betting.functions.cashOut(
            cashout_bet_id,
            cashout_quote_version,
            cashout_quoted_at,
            10 * ODD_WAD,
            int(time.time()) + 900,
        ).build_transaction({**base, "gas": 500_000}),
    )
    check("CASHOUT_BET_STATE", betting.functions.getBet(cashout_bet_id).call()[7] == 5, str(betting.functions.getBet(cashout_bet_id).call()[7]))

    parlay_now = int(w3.eth.get_block("latest")["timestamp"])
    parlay_end = parlay_now + end_delay
    parlay_match_a, parlay_market_a = open_market("OPEN_PARLAY_MARKET_A", "query-parlay-a", parlay_now + start_delay, parlay_end)
    parlay_match_b, parlay_market_b = open_market("OPEN_PARLAY_MARKET_B", "query-parlay-b", parlay_now + start_delay, parlay_end)
    legs = [parlay_leg(parlay_market_a, 0), parlay_leg(parlay_market_b, 0)]
    parlay_receipt = send_tx(
        "PLACE_PARLAY",
        actors["parlayUser"],
        lambda base: betting.functions.placeParlay(legs, 100 * ODD_WAD, 39_000, int(time.time()) + 900, "0x0000000000000000000000000000000000000000").build_transaction(base),
    )
    parlay_id = next(log["args"]["parlayId"] for log in decode_logs(parlay_receipt) if log.get("event") == "ParlayPlaced")
    parlay_estimate = lens.functions.estimateParlayValue(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call()
    check("ESTIMATE_PARLAY_VALUE_PENDING", parlay_estimate[4] > 0, f"estimated={parlay_estimate[4]}, pnl={parlay_estimate[5]}")
    parlay_wrong = lens.functions.estimateParlayValue(ADDR["BettingPool"], actors["wrongUser"].address, parlay_id).call()
    check("ESTIMATE_PARLAY_VALUE_WRONG_USER_ZERO", parlay_wrong[1] == 0 and parlay_wrong[4] == 0 and parlay_wrong[5] == 0, str(parlay_wrong))
    expect_revert("GET_PARLAY_CLAIM_STATUS_BEFORE_MATCH_END_REVERTS", lambda: parlay_module.functions.getParlayClaimStatus(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call())

    wait_until(max(single_end, parlay_end) + 3, "single and parlay match end")
    settle_market("SINGLE", single_market, 2, 1)
    won, reward = settlement.functions.getClaimStatus(ADDR["BettingPool"], actors["bettor"].address, bet_id).call()
    check("GET_CLAIM_STATUS_WON_UNCLAIMED", won and reward > 0, f"won={won}, reward={reward}")
    expect_revert("ESTIMATE_BET_VALUE_AFTER_SETTLE_REVERTS", lambda: settlement.functions.estimateBetValue(ADDR["BettingPool"], actors["bettor"].address, bet_id).call())
    send_tx("CLAIM_SINGLE_PAYOUT", actors["bettor"], lambda base: betting.functions.claimPayout(bet_id).build_transaction(base))
    won_after, reward_after = settlement.functions.getClaimStatus(ADDR["BettingPool"], actors["bettor"].address, bet_id).call()
    check("GET_CLAIM_STATUS_AFTER_CLAIM_ZERO", won_after and reward_after == 0, f"won={won_after}, reward={reward_after}")

    send_tx("LP_REQUEST_UNBOND_MATCH", actors["lpUser"], lambda base: liquidity.functions.requestUnbond(lp_position_id).build_transaction(base))
    check("LP_POSITION_UNBONDING", liquidity.functions.getPositionState(lp_position_id).call() == 1, str(liquidity.functions.getPositionState(lp_position_id).call()))

    settle_market("PARLAY_A", parlay_market_a, 2, 1)
    settle_market("PARLAY_B", parlay_market_b, 1, 0)
    parlay_final_estimate = lens.functions.estimateParlayValue(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call()
    check("ESTIMATE_PARLAY_VALUE_AFTER_LEGS_FINAL_BEFORE_SETTLE", parlay_final_estimate[4] == 400 * ODD_WAD and parlay_final_estimate[5] == 300 * ODD_WAD and parlay_final_estimate[10], str(parlay_final_estimate))
    won_pre_settle, reward_pre_settle = parlay_module.functions.getParlayClaimStatus(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call()
    check("GET_PARLAY_CLAIM_STATUS_PENDING_ZERO", not won_pre_settle and reward_pre_settle == 0, f"won={won_pre_settle}, reward={reward_pre_settle}")
    send_tx("SETTLE_PARLAY", actors["admin"], lambda base: betting.functions.settleParlay(parlay_id).build_transaction(base))
    won_parlay, reward_parlay = parlay_module.functions.getParlayClaimStatus(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call()
    check("GET_PARLAY_CLAIM_STATUS_WON_UNCLAIMED", won_parlay and reward_parlay > 0, f"won={won_parlay}, reward={reward_parlay}")
    expect_revert("ESTIMATE_PARLAY_VALUE_AFTER_SETTLE_REVERTS", lambda: lens.functions.estimateParlayValue(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call())
    send_tx("CLAIM_PARLAY_PAYOUT", actors["parlayUser"], lambda base: betting.functions.claimParlayPayout(parlay_id).build_transaction(base))
    won_parlay_after, reward_parlay_after = parlay_module.functions.getParlayClaimStatus(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call()
    check("GET_PARLAY_CLAIM_STATUS_AFTER_CLAIM_ZERO", won_parlay_after and reward_parlay_after == 0, f"won={won_parlay_after}, reward={reward_parlay_after}")

    suite_after = snapshot()
    lines: list[str] = []
    lines.append("# 2026-06-08 BSC Testnet Query Interfaces Live Report")
    lines.append("")
    lines.append(f"- RPC: `{redacted_rpc_url()}`")
    lines.append(f"- chainId: `{CHAIN_ID}`")
    lines.append(f"- startBlock: `{chain_before_block}`")
    lines.append(f"- endBlock: `{w3.eth.block_number}`")
    lines.append(f"- BettingSettlementModule: `{ADDR['BettingSettlementModule']}`")
    lines.append(f"- BettingParlayModule: `{ADDR['BettingParlayModule']}`")
    lines.append(f"- BettingParlayLens: `{ADDR['BettingParlayLens']}`")
    lines.append(f"- singleBetId: `{bet_id.hex()}`")
    lines.append(f"- cashoutBetId: `{cashout_bet_id.hex()}`")
    lines.append(f"- parlayId: `{parlay_id.hex()}`")
    lines.append(f"- lpPositionId: `{lp_position_id}`")
    lines.append(f"- stakePositionId: `{stake_id}`")
    lines.append("")
    lines.append("## Checks")
    for name, ok, detail in checks:
        lines.append(f"- [{'PASS' if ok else 'FAIL'}] `{name}`: {detail}")
    lines.append("")
    lines.append("## Suite Snapshot")
    lines.append("| label | address | ODD before | ODD after | BNB before | BNB after |")
    lines.append("|---|---|---:|---:|---:|---:|")
    for label, address in tracked.items():
        lines.append(
            f"| `{label}` | `{address}` | `{fmt(suite_before[label]['odd'])}` | `{fmt(suite_after[label]['odd'])}` | `{fmt(suite_before[label]['bnb'])}` | `{fmt(suite_after[label]['bnb'])}` |"
        )
    lines.append("")
    lines.append("## Transactions")
    for idx, item in enumerate(transactions, 1):
        fee = item["gas_used"] * item["effective_gas_price"]
        lines.append(f"### TX-{idx:02d} `{item['label']}`")
        lines.append(f"- sender: `{item['actor']}` / `{item['actor_address']}`")
        lines.append(f"- tx_hash: `{item['tx_hash']}`")
        lines.append(f"- status: `{item['status']}`")
        lines.append(f"- gas_used: `{item['gas_used']}`")
        lines.append(f"- tx_fee: `{fee}` wei")
        event_names = [f"{log.get('contract', 'Unknown')}.{log.get('event')}" for log in item["logs"]]
        if event_names:
            lines.append(f"- events: `{', '.join(event_names)}`")
        lines.append("")
    REPORT.write_text("\n".join(lines))
    print(f"report written to {REPORT}")
    if issues:
        raise SystemExit("\\n".join(issues))


if __name__ == "__main__":
    main()
