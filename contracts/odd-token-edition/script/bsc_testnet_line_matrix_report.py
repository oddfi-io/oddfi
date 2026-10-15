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
from web3.exceptions import TransactionNotFound
from web3.middleware import ExtraDataToPOAMiddleware

getcontext().prec = 50

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
REPORT_SUFFIX = os.environ.get("LINE_MATRIX_REPORT_SUFFIX", "").strip()
REPORT_NAME_OVERRIDE = os.environ.get("LINE_MATRIX_REPORT_NAME", "").strip()
REPORT_NAME = REPORT_NAME_OVERRIDE or (
    f"2026-06-03-bsc-testnet-cashout-upgrade-line-matrix-{REPORT_SUFFIX}.md"
    if REPORT_SUFFIX
    else "2026-06-03-bsc-testnet-cashout-upgrade-line-matrix-report.md"
)
REPORT = ROOT / "docs" / "testing" / REPORT_NAME

RPC_URL = os.environ["RPC_URL"]
ADMIN_PRIVATE_KEY = os.environ["ADMIN_PRIVATE_KEY"]
CHAIN_ID = int(os.environ.get("CHAIN_ID", "97"))
ODD_WAD = 10**18
ODDS_SCALE = 10_000
LIGHT_TX_SNAPSHOTS = os.environ.get("LINE_MATRIX_LIGHT_TX_SNAPSHOTS", "1") != "0"


def redacted_rpc_url() -> str:
    if "/v2/" in RPC_URL:
        return RPC_URL.split("/v2/", 1)[0] + "/v2/<redacted>"
    return "RPC_URL environment value used (token omitted)"


ADDR = {
    "ODDToken": Web3.to_checksum_address("0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0"),
    "StakingPool": Web3.to_checksum_address("0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F"),
    "LiquidityPool": Web3.to_checksum_address("0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50"),
    "BettingPool": Web3.to_checksum_address("0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3"),
}

MARKET_STATUS = {
    0: "Open",
    1: "Locked",
    2: "Settled",
    3: "Refunded",
    4: "Cancelled",
}

BET_STATE = {
    0: "Pending",
    1: "Refunded",
    2: "Lost",
    3: "WonUnclaimed",
    4: "WonClaimed",
}

MARKET_TYPE_LABEL = {
    0: "1X2",
    1: "AH",
    2: "OU",
}

AH_LABEL = {
    0: "-0.5",
    1: "-1",
    2: "-1.5",
    3: "-0.25",
    4: "-0.75",
    5: "-1.25",
    6: "+0",
    7: "+0.25",
    8: "+0.5",
    9: "+0.75",
}

OU_LABEL = {
    0: "1.5",
    1: "2.5",
    2: "3.5",
}


@dataclass
class Actor:
    name: str
    key: str
    address: str


@dataclass
class Scenario:
    sid: str
    market_type: int
    line: int
    home_score: int
    away_score: int
    outcomes: list[int]
    result_case: str


@dataclass
class BetRecord:
    scenario: Scenario
    outcome: int
    owner: Actor
    bet_id: bytes
    accepted_amount: int
    locked_odds: int
    expected_result: str
    expected_refunded: int
    expected_claimable: int
    expected_pre_claim_state: str
    final_state: str = ""
    actual_refunded: int = 0
    actual_claimable: int = 0
    claim_tx: str = ""
    net_claim_delta: int = 0


w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 120}))
w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
if not w3.is_connected():
    raise SystemExit("RPC not connected")


def derived_actor_key(name: str) -> str:
    admin_seed = Web3.keccak(hexstr=ADMIN_PRIVATE_KEY)
    return to_hex(Web3.keccak(admin_seed + name.encode()))


actors: dict[str, Actor] = {
    "admin": Actor("admin", ADMIN_PRIVATE_KEY, Account.from_key(ADMIN_PRIVATE_KEY).address),
    "bettor0": Actor("bettor0", derived_actor_key("bettor0"), ""),
    "bettor1": Actor("bettor1", derived_actor_key("bettor1"), ""),
    "bettor2": Actor("bettor2", derived_actor_key("bettor2"), ""),
    "lpUser": Actor("lpUser", derived_actor_key("lpUser"), ""),
}
for name, actor in list(actors.items()):
    if not actor.address:
        actors[name] = Actor(actor.name, actor.key, Account.from_key(actor.key).address)


def load_abi(source: str, name: str) -> list[dict[str, Any]]:
    return json.loads((OUT / source / f"{name}.json").read_text())["abi"]


abis = {
    "ODDToken": load_abi("ODDToken.sol", "ODDToken"),
    "LiquidityPool": load_abi("LiquidityPool.sol", "LiquidityPool"),
    "BettingPool": load_abi("BettingPool.sol", "BettingPool"),
}
contracts = {name: w3.eth.contract(address=ADDR[name], abi=abi) for name, abi in abis.items()}
odd = contracts["ODDToken"]
liquidity = contracts["LiquidityPool"]
betting = contracts["BettingPool"]

event_decoders: dict[str, tuple[str, dict[str, Any]]] = {}
for contract_name, abi in abis.items():
    for item in abi:
        if item.get("type") == "event":
            event_decoders[to_hex(event_abi_to_log_topic(item))] = (contract_name, item)

tracked = {
    "admin": actors["admin"].address,
    "bettor0": actors["bettor0"].address,
    "bettor1": actors["bettor1"].address,
    "bettor2": actors["bettor2"].address,
    "lpUser": actors["lpUser"].address,
    "LiquidityPool": ADDR["LiquidityPool"],
    "BettingPool": ADDR["BettingPool"],
}

transactions: list[dict[str, Any]] = []
checks: list[tuple[str, bool, str]] = []
issues: list[str] = []
nonce_cache: dict[str, int] = {}
active_start_ts = 0
post_start_bets: list[str] = []


def rpc_call(label: str, fn: Callable[[], Any], attempts: int = 8) -> Any:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            last_error = exc
            if attempt == attempts:
                break
            print(f"{label}: rpc retry {attempt}/{attempts} after {type(exc).__name__}", flush=True)
            time.sleep(min(10, 2 + attempt))
    raise RuntimeError(f"{label}: rpc failed after {attempts} attempts; last_error={last_error!r}")


def fmt(raw: int, decimals: int = 18) -> str:
    return f"{Decimal(raw) / Decimal(10**decimals):,.18f}".rstrip("0").rstrip(".")


def snapshot() -> dict[str, dict[str, int]]:
    return {
        label: {
            "bnb": rpc_call(f"balance_bnb_{label}", lambda address=address: w3.eth.get_balance(address)),
            "odd": rpc_call(f"balance_odd_{label}", lambda address=address: odd.functions.balanceOf(address).call()),
        }
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
    chain_nonce = rpc_call(f"nonce_{actor.name}", lambda: w3.eth.get_transaction_count(actor.address, "pending"))
    cached_nonce = nonce_cache.get(actor.address, chain_nonce)
    nonce = max(chain_nonce, cached_nonce)
    nonce_cache[actor.address] = nonce + 1
    return {
        "from": actor.address,
        "nonce": nonce,
        "chainId": CHAIN_ID,
        "gasPrice": max(rpc_call("gas_price", lambda: w3.eth.gas_price), 1_000_000_000),
    }


def send_tx(label: str, actor: Actor, build: Callable[[dict[str, Any]], dict[str, Any]], expected_status: int = 1) -> Any:
    before = {} if LIGHT_TX_SNAPSHOTS else snapshot()
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
            tx["gas"] = int(rpc_call(f"{label}_estimate_gas", lambda: w3.eth.estimate_gas(tx)) * 13 // 10)
        signed = Account.sign_transaction(tx, actor.key)
        try:
            tx_hash = rpc_call(f"{label}_send_raw_transaction", lambda: w3.eth.send_raw_transaction(signed.raw_transaction))
            break
        except Exception as exc:
            message = str(exc)
            if "nonce too low" not in message and "replacement transaction underpriced" not in message:
                raise
            nonce_cache[actor.address] = max(
                nonce_cache.get(actor.address, 0),
                int(tx["nonce"]) + 1,
                rpc_call(f"nonce_retry_{actor.name}", lambda: w3.eth.get_transaction_count(actor.address, "pending")) + 1,
            )
            print(f"{label}: retrying after nonce error ({type(exc).__name__})", flush=True)
            time.sleep(5)
    if tx_hash is None:
        raise RuntimeError(f"{label}: unable to send transaction after nonce retries")
    receipt = wait_for_receipt(label, tx_hash)
    after = {} if LIGHT_TX_SNAPSHOTS else snapshot()
    status = int(receipt["status"])
    ok = status == expected_status
    checks.append((f"{label}_status", ok, f"status={status}, tx={receipt['transactionHash'].hex()}"))
    if not ok:
        issues.append(f"{label}: status={status}, expected={expected_status}, tx={receipt['transactionHash'].hex()}")
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


def wait_for_receipt(label: str, tx_hash: bytes) -> Any:
    deadline = time.time() + 900
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            return w3.eth.get_transaction_receipt(tx_hash)
        except TransactionNotFound as exc:
            last_error = exc
        except Exception as exc:  # RPC providers may transiently close the connection while the tx is already mined.
            last_error = exc
            print(f"{label}: receipt poll retry after {type(exc).__name__}", flush=True)
        time.sleep(5)
    raise RuntimeError(f"{label}: receipt not available for {to_hex(tx_hash)}; last_error={last_error!r}")


def check(name: str, ok: bool, detail: str) -> None:
    checks.append((name, ok, detail))
    if not ok:
        issues.append(f"{name}: {detail}")


def wait_until(target_ts: int, label: str) -> None:
    while True:
        now = int(rpc_call(f"{label}_latest_block", lambda: w3.eth.get_block("latest"))["timestamp"])
        if now >= target_ts:
            return
        remaining = target_ts - now
        print(f"waiting {remaining}s for {label} ...", flush=True)
        time.sleep(min(15, remaining))


def approve_if_needed(label: str, actor: Actor, spender: str, amount: int) -> None:
    if rpc_call(f"{label}_allowance", lambda: odd.functions.allowance(actor.address, spender).call()) < amount:
        send_tx(label, actor, lambda base: odd.functions.approve(spender, 2**256 - 1).build_transaction(base))


def seed_actor(actor_name: str, min_bnb: int, min_odd: int, odd_topup: int) -> None:
    actor = actors[actor_name]
    if rpc_call(f"seed_bnb_balance_{actor_name}", lambda: w3.eth.get_balance(actor.address)) < min_bnb:
        send_tx(
            f"SEED_BNB_{actor_name}",
            actors["admin"],
            lambda base, to=actor.address: {**base, "to": to, "value": min_bnb * 2, "gas": 50_000},
        )
    if rpc_call(f"seed_odd_balance_{actor_name}", lambda: odd.functions.balanceOf(actor.address).call()) < min_odd:
        send_tx(
            f"SEED_ODD_{actor_name}",
            actors["admin"],
            lambda base, to=actor.address, amount=odd_topup: odd.functions.transfer(to, amount).build_transaction(base),
        )


def ensure_reserve(min_reserve: int) -> None:
    current = rpc_call("platform_reserve", lambda: betting.functions.platformReserve().call())
    if current >= min_reserve:
        return
    amount = min_reserve - current
    approve_if_needed("APPROVE_ADMIN_BETTING_RESERVE", actors["admin"], ADDR["BettingPool"], amount)
    send_tx(
        "ADD_PLATFORM_RESERVE_FOR_LINE_MATRIX",
        actors["admin"],
        lambda base: betting.functions.addPlatformReserve(amount).build_transaction(base),
    )


def scenarios(scope: str) -> list[Scenario]:
    result: list[Scenario] = [
        Scenario("1x2-home-win", 0, 0, 1, 0, [0, 1, 2], "home win"),
        Scenario("1x2-draw", 0, 0, 1, 1, [0, 1, 2], "draw"),
        Scenario("1x2-away-win", 0, 0, 0, 1, [0, 1, 2], "away win"),
    ]
    for line, over_score, under_score in [(0, (2, 0), (1, 0)), (1, (2, 1), (1, 1)), (2, (3, 1), (1, 1))]:
        result.append(Scenario(f"ou-{OU_LABEL[line]}-over", 2, line, over_score[0], over_score[1], [0, 1], "over"))
        result.append(Scenario(f"ou-{OU_LABEL[line]}-under", 2, line, under_score[0], under_score[1], [0, 1], "under"))

    ah_scores_full = {
        0: [("full-win", (1, 0)), ("full-loss", (0, 0))],
        1: [("full-win", (2, 0)), ("full-push", (1, 0)), ("full-loss", (0, 0))],
        2: [("full-win", (2, 0)), ("full-loss", (1, 0))],
        3: [("full-win", (1, 0)), ("half-loss", (0, 0)), ("full-loss", (0, 1))],
        4: [("full-win", (2, 0)), ("half-win", (1, 0)), ("full-loss", (0, 0))],
        5: [("full-win", (2, 0)), ("half-loss", (1, 0)), ("full-loss", (0, 0))],
        6: [("full-win", (1, 0)), ("full-push", (0, 0)), ("full-loss", (0, 1))],
        7: [("full-win", (1, 0)), ("half-win", (0, 0)), ("full-loss", (0, 1))],
        8: [("full-win", (0, 0)), ("full-loss", (0, 1))],
        9: [("full-win", (0, 0)), ("half-loss", (0, 1)), ("full-loss", (0, 2))],
    }
    ah_scores_line = {
        0: [("full-win", (1, 0))],
        1: [("full-push", (1, 0))],
        2: [("full-loss", (1, 0))],
        3: [("half-loss", (0, 0))],
        4: [("half-win", (1, 0))],
        5: [("half-loss", (1, 0))],
        6: [("full-push", (0, 0))],
        7: [("half-win", (0, 0))],
        8: [("full-win", (0, 0))],
        9: [("half-loss", (0, 1))],
    }
    ah_scores = ah_scores_full if scope == "full" else ah_scores_line
    for line, cases in ah_scores.items():
        for case, (home, away) in cases:
            result.append(Scenario(f"ah-{AH_LABEL[line]}-{case}", 1, line, home, away, [0, 1], case))
    return result


def result_for(scenario: Scenario, outcome: int) -> str:
    home = scenario.home_score
    away = scenario.away_score
    if scenario.market_type == 0:
        winning = 0 if home > away else 1 if home == away else 2
        return "FullWin" if outcome == winning else "FullLoss"
    if scenario.market_type == 2:
        threshold = {0: 3, 1: 5, 2: 7}[scenario.line]
        winning = 0 if (home + away) * 2 > threshold else 1
        return "FullWin" if outcome == winning else "FullLoss"

    diff = home - away
    if scenario.line == 0:
        home_result = "FullWin" if diff >= 1 else "FullLoss"
    elif scenario.line == 1:
        home_result = "FullWin" if diff >= 2 else "FullPush" if diff == 1 else "FullLoss"
    elif scenario.line == 2:
        home_result = "FullWin" if diff >= 2 else "FullLoss"
    elif scenario.line == 3:
        home_result = "FullWin" if diff >= 1 else "HalfLoss" if diff == 0 else "FullLoss"
    elif scenario.line == 4:
        home_result = "FullWin" if diff >= 2 else "HalfWin" if diff == 1 else "FullLoss"
    elif scenario.line == 5:
        home_result = "FullWin" if diff >= 2 else "HalfLoss" if diff == 1 else "FullLoss"
    elif scenario.line == 6:
        home_result = "FullWin" if diff >= 1 else "FullPush" if diff == 0 else "FullLoss"
    elif scenario.line == 7:
        home_result = "FullWin" if diff >= 1 else "HalfWin" if diff == 0 else "FullLoss"
    elif scenario.line == 8:
        home_result = "FullWin" if diff >= 0 else "FullLoss"
    else:
        home_result = "FullWin" if diff >= 0 else "HalfLoss" if diff == -1 else "FullLoss"

    if outcome == 0:
        return home_result
    opposite = {
        "FullWin": "FullLoss",
        "FullLoss": "FullWin",
        "FullPush": "FullPush",
        "HalfWin": "HalfLoss",
        "HalfLoss": "HalfWin",
    }
    return opposite[home_result]


def expected_amounts(result: str, accepted: int, locked_odds: int) -> tuple[str, int, int]:
    if result == "FullWin":
        return "WonUnclaimed", 0, accepted * locked_odds // ODDS_SCALE
    if result == "FullLoss":
        return "Lost", 0, 0
    if result == "FullPush":
        return "Refunded", accepted, 0
    half = accepted // 2
    refund = accepted - half
    if result == "HalfWin":
        return "WonUnclaimed", refund, half * locked_odds // ODDS_SCALE
    return "Lost", refund, 0


def market_label(s: Scenario) -> str:
    if s.market_type == 1:
        return f"AH {AH_LABEL[s.line]}"
    if s.market_type == 2:
        return f"OU {OU_LABEL[s.line]}"
    return "1X2"


def place_bet(s: Scenario, market_id: bytes, outcome: int) -> BetRecord:
    owner = actors[f"bettor{outcome}"]
    amount = 100 * ODD_WAD
    (_, accepted, locked, _, _) = rpc_call(
        f"preview_{s.sid}_outcome{outcome}",
        lambda: betting.functions.previewSignal(market_id, outcome, amount).call(),
    )
    (_, _, updated_at, quote_version) = rpc_call(
        f"odds_{s.sid}_outcome{outcome}",
        lambda: betting.functions.getMarketOdds(market_id).call(),
    )
    guard = (quote_version, updated_at, locked, accepted, int(time.time()) + 1800)
    receipt = send_tx(
        f"PLACE_{s.sid}_outcome{outcome}",
        owner,
        lambda base: betting.functions.placeBet(market_id, outcome, amount, guard).build_transaction(base),
    )
    receipt_ts = int(rpc_call(f"{s.sid}_outcome{outcome}_receipt_block", lambda: w3.eth.get_block(receipt["blockNumber"]))["timestamp"])
    if active_start_ts and receipt_ts >= active_start_ts:
        post_start_bets.append(f"{s.sid}/outcome{outcome}@{receipt_ts}")
    bet_id = None
    for log in decode_logs(receipt):
        if log.get("event") == "BetPlaced":
            bet_id = log["args"]["betId"]
            accepted = int(log["args"]["acceptedAmount"])
            locked = int(log["args"]["lockedOdds"])
            break
    if bet_id is None:
        raise RuntimeError(f"BetPlaced event missing for {s.sid} outcome {outcome}")
    expected_result = result_for(s, outcome)
    expected_state, expected_refunded, expected_claimable = expected_amounts(expected_result, accepted, locked)
    return BetRecord(
        scenario=s,
        outcome=outcome,
        owner=owner,
        bet_id=bet_id,
        accepted_amount=accepted,
        locked_odds=locked,
        expected_result=expected_result,
        expected_refunded=expected_refunded,
        expected_claimable=expected_claimable,
        expected_pre_claim_state=expected_state,
    )


def read_bet_record(record: BetRecord) -> tuple[str, int, int]:
    raw = rpc_call(
        f"read_bet_{record.scenario.sid}_outcome{record.outcome}",
        lambda: betting.functions.getBet(record.bet_id).call(),
    )
    return BET_STATE[int(raw[7])], int(raw[4]), int(raw[8])


def main() -> None:
    global active_start_ts
    start_block = int(rpc_call("start_block", lambda: w3.eth.block_number))
    suite_before = snapshot()
    scope = os.environ.get("LINE_MATRIX_SCOPE", "line")
    if scope not in {"line", "full"}:
        raise SystemExit("LINE_MATRIX_SCOPE must be 'line' or 'full'")
    all_scenarios = scenarios(scope)
    total_bet_count = sum(len(item.outcomes) for item in all_scenarios)
    print(f"line matrix scope={scope} scenarios={len(all_scenarios)} bets={total_bet_count}", flush=True)

    for actor_name in ["bettor0", "bettor1", "bettor2", "lpUser"]:
        seed_actor(actor_name, int(0.04 * 10**18), 5_000 * ODD_WAD, 8_000 * ODD_WAD)
    for actor_name in ["bettor0", "bettor1", "bettor2"]:
        approve_if_needed(f"APPROVE_{actor_name}_BETTING", actors[actor_name], ADDR["BettingPool"], 5_000 * ODD_WAD)
    approve_if_needed("APPROVE_lpUser_LIQUIDITY", actors["lpUser"], ADDR["LiquidityPool"], 5_000 * ODD_WAD)
    ensure_reserve(20_000 * ODD_WAD)

    now = int(rpc_call("latest_block_for_timing", lambda: w3.eth.get_block("latest"))["timestamp"])
    start_delay = int(os.environ.get("LINE_MATRIX_START_DELAY_SECONDS", "2400"))
    start_ts = now + start_delay
    active_start_ts = start_ts
    end_delay = os.environ.get("LINE_MATRIX_END_DELAY_SECONDS")
    end_ts = now + int(end_delay) if end_delay is not None else start_ts + 60
    if end_ts <= start_ts:
        raise RuntimeError("LINE_MATRIX_END_DELAY_SECONDS must put match end after match start")
    match_id = Web3.keccak(text=f"line-matrix-{CHAIN_ID}-{int(time.time())}")
    print(
        f"line matrix timing start_delay={start_delay}s end_delay={end_ts - now}s",
        flush=True,
    )

    market_ids: dict[str, bytes] = {}
    bet_records: list[BetRecord] = []
    for index, s in enumerate(all_scenarios, 1):
        base_odds = [20_000, 20_000, 20_000] if s.market_type == 0 else [20_000, 20_000]
        scenario_match_id = Web3.keccak(match_id + s.sid.encode())
        open_receipt = send_tx(
            f"OPEN_{s.sid}",
            actors["admin"],
            lambda base, scenario_match_id=scenario_match_id, s=s, base_odds=base_odds: betting.functions.openMarket(
                scenario_match_id,
                s.market_type,
                s.line,
                start_ts,
                end_ts,
                base_odds,
                int(rpc_call(f"open_{s.sid}_latest_block", lambda: w3.eth.get_block("latest"))["timestamp"]),
            ).build_transaction(base),
        )
        market_id = None
        for log in decode_logs(open_receipt):
            if log.get("event") == "MarketOpened":
                market_id = log["args"]["marketId"]
                break
        if market_id is None:
            raise RuntimeError(f"MarketOpened event missing for {s.sid}")
        market_ids[s.sid] = market_id

        if index == 1:
            send_tx(
                "DEPOSIT_MATCH_LP_FOR_FIRST_MATRIX_MATCH",
                actors["lpUser"],
                lambda base, scenario_match_id=scenario_match_id: liquidity.functions.depositMatch(
                    scenario_match_id, 5_000 * ODD_WAD
                ).build_transaction(base),
            )

        for outcome in s.outcomes:
            if int(rpc_call(f"{s.sid}_before_bet_latest_block", lambda: w3.eth.get_block("latest"))["timestamp"]) >= end_ts:
                raise RuntimeError("match end reached before all line matrix bets were placed")
            bet_records.append(place_bet(s, market_id, outcome))

    check(
        "post_start_betting_covered",
        len(post_start_bets) > 0,
        f"{len(post_start_bets)} bets mined at/after matchStartTime; examples={post_start_bets[:5]}",
    )

    wait_until(end_ts + 3, "all matrix markets to reach match end")

    for s in all_scenarios:
        market_id = market_ids[s.sid]
        bet_ids = rpc_call(f"{s.sid}_bet_ids", lambda: betting.functions.getMarketBetIds(market_id, 0, 50).call())
        send_tx(
            f"SETTLE_{s.sid}",
            actors["admin"],
            lambda base, s=s, market_id=market_id, bet_ids=bet_ids: betting.functions.settleMarketBetsByScore(
                market_id, s.home_score, s.away_score, bet_ids
            ).build_transaction(base),
        )
        send_tx(
            f"FINALIZE_{s.sid}",
            actors["admin"],
            lambda base, market_id=market_id: betting.functions.finalizeMarketSettlement(market_id, 0).build_transaction(base),
        )
        market = rpc_call(f"{s.sid}_market_after_finalize", lambda: betting.functions.getMarket(market_id).call())
        check(f"{s.sid}_market_settled", MARKET_STATUS[int(market[6])] == "Settled", f"status={MARKET_STATUS[int(market[6])]}")

    payout_tax_bps = int(rpc_call("payout_tax_bps", lambda: betting.functions.payoutTaxBps().call()))
    for record in bet_records:
        state, refunded, claimable = read_bet_record(record)
        check(
            f"{record.scenario.sid}_outcome{record.outcome}_pre_claim",
            state == record.expected_pre_claim_state
            and refunded == record.expected_refunded
            and claimable == record.expected_claimable,
            (
                f"expected state/refund/claimable={record.expected_pre_claim_state}/"
                f"{record.expected_refunded}/{record.expected_claimable}, got={state}/{refunded}/{claimable}"
            ),
        )
        if state == "WonUnclaimed":
            before_balance = rpc_call(
                f"{record.scenario.sid}_outcome{record.outcome}_before_claim_balance",
                lambda: odd.functions.balanceOf(record.owner.address).call(),
            )
            receipt = send_tx(
                f"CLAIM_{record.scenario.sid}_outcome{record.outcome}",
                record.owner,
                lambda base, bet_id=record.bet_id: betting.functions.claimPayout(bet_id).build_transaction(base),
            )
            record.claim_tx = receipt["transactionHash"].hex()
            after_balance = rpc_call(
                f"{record.scenario.sid}_outcome{record.outcome}_after_claim_balance",
                lambda: odd.functions.balanceOf(record.owner.address).call(),
            )
            expected_net = record.expected_claimable - record.expected_claimable * payout_tax_bps // 10_000
            record.net_claim_delta = after_balance - before_balance
            check(
                f"{record.scenario.sid}_outcome{record.outcome}_claim_net",
                record.net_claim_delta == expected_net,
                f"expected={expected_net}, got={record.net_claim_delta}",
            )

        final_state, final_refunded, final_claimable = read_bet_record(record)
        record.final_state = final_state
        record.actual_refunded = final_refunded
        record.actual_claimable = final_claimable

    suite_after = snapshot()
    pass_count = sum(1 for _, ok, _ in checks if ok)
    fail_count = len(checks) - pass_count

    lines: list[str] = []
    lines.append("# 2026-06-07 BSC Testnet Parlay Upgrade Line Matrix Report")
    lines.append("")
    lines.append(f"- RPC: `{redacted_rpc_url()}`")
    lines.append(f"- chainId: `{CHAIN_ID}`")
    lines.append(f"- scope: `{scope}`")
    lines.append(f"- scenarios: `{len(all_scenarios)}`")
    lines.append(f"- bets: `{len(bet_records)}`")
    lines.append(f"- postStartBets: `{len(post_start_bets)}`")
    lines.append(f"- checks: `{pass_count} passed / {fail_count} failed`")
    lines.append(f"- suiteStartedAtBlock: `{start_block}`")
    lines.append(f"- suiteFinishedAtBlock: `{int(rpc_call('finish_block', lambda: w3.eth.block_number))}`")
    lines.append("")
    lines.append("## Contracts")
    lines.append(f"- ODDToken: `{ADDR['ODDToken']}`")
    lines.append(f"- LiquidityPool: `{ADDR['LiquidityPool']}`")
    lines.append(f"- BettingPool: `{ADDR['BettingPool']}`")
    lines.append("")
    lines.append("## Actors")
    for name in ["admin", "bettor0", "bettor1", "bettor2", "lpUser"]:
        lines.append(f"- `{name}`: `{actors[name].address}`")
    lines.append("")
    lines.append("## Checks")
    for name, ok, detail in checks:
        lines.append(f"- [{'PASS' if ok else 'FAIL'}] `{name}`: {detail}")
    lines.append("")
    if issues:
        lines.append("## Issues")
        for issue in issues:
            lines.append(f"- {issue}")
        lines.append("")
    else:
        lines.append("## Issues")
        lines.append("- No line-matrix functional issues found in this run.")
        lines.append("")
    lines.append("## Scenario Matrix")
    lines.append(
        "| scenario | market | score | outcome | expected result | final state | refunded ODD | claimable ODD | net claim ODD | betId | claim tx |"
    )
    lines.append("|---|---|---:|---:|---|---|---:|---:|---:|---|---|")
    for record in bet_records:
        s = record.scenario
        lines.append(
            f"| `{s.sid}` | `{market_label(s)}` | `{s.home_score}-{s.away_score}` | `{record.outcome}` | "
            f"`{record.expected_result}` | `{record.final_state}` | `{fmt(record.actual_refunded)}` | "
            f"`{fmt(record.actual_claimable)}` | `{fmt(record.net_claim_delta)}` | `{record.bet_id.hex()}` | "
            f"`{record.claim_tx or '-'}` |"
        )
    lines.append("")
    lines.append("## Transactions")
    lines.append("| # | label | actor | tx | status | gas |")
    lines.append("|---:|---|---|---|---:|---:|")
    for idx, item in enumerate(transactions, 1):
        lines.append(
            f"| {idx} | `{item['label']}` | `{item['actor']}` | `{item['tx_hash']}` | `{item['status']}` | `{item['gas_used']}` |"
        )
    lines.append("")
    lines.append("## Suite Snapshot")
    lines.append("| label | address | ODD before | ODD after | BNB before | BNB after |")
    lines.append("|---|---|---:|---:|---:|---:|")
    for label, address in tracked.items():
        lines.append(
            f"| `{label}` | `{address}` | `{fmt(suite_before[label]['odd'])}` | `{fmt(suite_after[label]['odd'])}` | "
            f"`{fmt(suite_before[label]['bnb'])}` | `{fmt(suite_after[label]['bnb'])}` |"
        )
    REPORT.write_text("\n".join(lines))
    print(f"report written to {REPORT}")
    if issues:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
