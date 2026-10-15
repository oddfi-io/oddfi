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
REPORT_SUFFIX = os.environ.get("PARLAY_REPORT_SUFFIX", "").strip()
REPORT_NAME = (
    f"2026-06-08-bsc-testnet-modular-entrypoint-parlay-{REPORT_SUFFIX}.md"
    if REPORT_SUFFIX
    else "2026-06-08-bsc-testnet-modular-entrypoint-parlay-report.md"
)
REPORT = ROOT / "docs" / "testing" / REPORT_NAME

RPC_URL = os.environ["RPC_URL"]
ADMIN_PRIVATE_KEY = os.environ["ADMIN_PRIVATE_KEY"]
CHAIN_ID = int(os.environ.get("CHAIN_ID", "97"))
ODD_WAD = 10**18

ADDR = {
    "ODDToken": Web3.to_checksum_address("0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0"),
    "LiquidityPool": Web3.to_checksum_address("0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50"),
    "BettingPool": Web3.to_checksum_address("0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3"),
    "BettingParlayLens": Web3.to_checksum_address(
        os.environ.get("BETTING_PARLAY_LENS", "0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2")
    ),
}

PARLAY_STATE = {
    0: "Pending",
    1: "Lost",
    2: "WonUnclaimed",
    3: "WonClaimed",
    4: "Refundable",
    5: "Refunded",
}

MARKET_STATUS = {
    0: "Open",
    1: "Locked",
    2: "Settled",
    3: "Refunded",
    4: "Cancelled",
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

actors: dict[str, Actor] = {
    "admin": Actor("admin", ADMIN_PRIVATE_KEY, Account.from_key(ADMIN_PRIVATE_KEY).address),
    "parlayUser": Actor("parlayUser", derived_actor_key("parlayUser"), ""),
}
actors["parlayUser"] = Actor(
    actors["parlayUser"].name,
    actors["parlayUser"].key,
    Account.from_key(actors["parlayUser"].key).address,
)


def load_abi(source: str, name: str) -> list[dict[str, Any]]:
    return json.loads((OUT / source / f"{name}.json").read_text())["abi"]


abis = {
    "ODDToken": load_abi("ODDToken.sol", "ODDToken"),
    "LiquidityPool": load_abi("LiquidityPool.sol", "LiquidityPool"),
    "BettingPool": load_abi("BettingPool.sol", "BettingPool"),
    "BettingParlayLens": load_abi("BettingParlayLens.sol", "BettingParlayLens"),
}
contracts = {name: w3.eth.contract(address=ADDR[name], abi=abi) for name, abi in abis.items()}
odd = contracts["ODDToken"]
liquidity = contracts["LiquidityPool"]
betting = contracts["BettingPool"]
lens = contracts["BettingParlayLens"]

event_decoders: dict[str, tuple[str, dict[str, Any]]] = {}
for contract_name, abi in abis.items():
    for item in abi:
        if item.get("type") == "event":
            event_decoders[to_hex(event_abi_to_log_topic(item))] = (contract_name, item)

tracked = {
    "admin": actors["admin"].address,
    "parlayUser": actors["parlayUser"].address,
    "LiquidityPool": ADDR["LiquidityPool"],
    "BettingPool": ADDR["BettingPool"],
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
        decoded.append(
            {"contract": contract_name, "address": log["address"], "event": data["event"], "args": dict(data["args"])}
        )
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
    raise RuntimeError(f"{label}: receipt not available for {to_hex(tx_hash)}; last_error={last_error!r}")


def check(name: str, ok: bool, detail: str) -> None:
    checks.append((name, ok, detail))
    if not ok:
        issues.append(f"{name}: {detail}")


def send_tx(label: str, actor: Actor, build: Callable[[dict[str, Any]], dict[str, Any]], expected_status: int = 1) -> Any:
    before = snapshot()
    base = tx_base(actor)
    tx = dict(build(base))
    tx.setdefault("from", base["from"])
    tx.setdefault("nonce", base["nonce"])
    tx.setdefault("chainId", base["chainId"])
    tx.setdefault("gasPrice", base["gasPrice"])
    if "gas" not in tx:
        tx["gas"] = int(w3.eth.estimate_gas(tx) * 13 // 10)
    signed = Account.sign_transaction(tx, actor.key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
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


def approve_if_needed(label: str, actor: Actor, spender: str, amount: int) -> None:
    if odd.functions.allowance(actor.address, spender).call() < amount:
        send_tx(label, actor, lambda base: odd.functions.approve(spender, 2**256 - 1).build_transaction(base))


def seed_actor(actor_name: str, min_bnb: int, min_odd: int, odd_topup: int) -> None:
    actor = actors[actor_name]
    if w3.eth.get_balance(actor.address) < min_bnb:
        send_tx(
            f"SEED_BNB_{actor_name}",
            actors["admin"],
            lambda base, to=actor.address: {**base, "to": to, "value": min_bnb * 2, "gas": 50_000},
        )
    if odd.functions.balanceOf(actor.address).call() < min_odd:
        send_tx(
            f"SEED_ODD_{actor_name}",
            actors["admin"],
            lambda base, to=actor.address, amount=odd_topup: odd.functions.transfer(to, amount).build_transaction(base),
        )


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
        raise RuntimeError(f"MarketOpened event missing for {label}")
    return match_id, market_id


def parlay_leg(market_id: bytes, outcome: int) -> tuple[bytes, int, int, int, int]:
    (_, quoted_odds, updated_at, quote_version) = betting.functions.getMarketOdds(market_id).call()
    locked_odds = int(quoted_odds[outcome])
    return market_id, outcome, int(quote_version), int(updated_at), locked_odds


def settle_market_empty(label: str, market_id: bytes, home_score: int, away_score: int) -> None:
    send_tx(
        f"{label}_SETTLE_BY_SCORE",
        actors["admin"],
        lambda base: betting.functions.settleMarketBetsByScore(market_id, home_score, away_score, []).build_transaction(base),
    )
    send_tx(
        f"{label}_FINALIZE",
        actors["admin"],
        lambda base: betting.functions.finalizeMarketSettlement(market_id, 0).build_transaction(base),
    )


def market_status(market_id: bytes) -> str:
    raw = betting.functions.getMarket(market_id).call()
    return MARKET_STATUS[int(raw[6])]


def parlay_record(parlay_id: bytes) -> dict[str, Any]:
    raw = betting.functions.parlays(parlay_id).call()
    return {
        "owner": raw[0],
        "stake": int(raw[1]),
        "lockedComboOdds": int(raw[2]),
        "maxPayout": int(raw[3]),
        "claimablePayout": int(raw[4]),
        "parlayRiskId": raw[5],
        "acceptedDayBucket": int(raw[6]),
        "legCount": int(raw[7]),
        "state": int(raw[8]),
        "stateName": PARLAY_STATE[int(raw[8])],
        "payoutTaxRateBps": int(raw[9]),
    }


def assert_no_parlay_cashout_selector() -> None:
    names = {item["name"] for item in abis["BettingPool"] if item.get("type") == "function"}
    forbidden = {"cashOutParlay", "quoteParlayCashOut"}
    check("PARLAY_no_cashout_selectors", names.isdisjoint(forbidden), f"forbidden={sorted(names & forbidden)}")


def main() -> None:
    start_block = int(w3.eth.block_number)
    suite_before = snapshot()
    assert_no_parlay_cashout_selector()

    seed_actor("parlayUser", int(0.04 * 10**18), 2_000 * ODD_WAD, 3_000 * ODD_WAD)
    approve_if_needed("APPROVE_PARLAY_USER_BETTING", actors["parlayUser"], ADDR["BettingPool"], 2_000 * ODD_WAD)

    now = int(w3.eth.get_block("latest")["timestamp"])
    start_ts = now + 60
    end_ts = now + 150
    _, market_a = open_market("PARLAY_OPEN_MARKET_A", "parlay-a", start_ts, end_ts)
    _, market_b = open_market("PARLAY_OPEN_MARKET_B", "parlay-b", start_ts, end_ts)

    stake = 100 * ODD_WAD
    legs = [parlay_leg(market_a, 0), parlay_leg(market_b, 0)]
    preview = lens.functions.previewParlay(ADDR["BettingPool"], legs, stake, actors["parlayUser"].address).call()
    locked_combo_odds = int(preview[1])
    max_payout = int(preview[2])
    available_capacity = int(preview[4])
    check("PARLAY_preview_combo_odds", locked_combo_odds == 40_000, f"lockedComboOdds={locked_combo_odds}")
    check("PARLAY_preview_max_payout", max_payout == 400 * ODD_WAD, f"maxPayout={max_payout}")
    check("PARLAY_preview_capacity", available_capacity >= max_payout, f"available={available_capacity}, required={max_payout}")

    open_max_before = int(betting.functions.openParlayMaxPayout().call())
    user_balance_before_place = int(odd.functions.balanceOf(actors["parlayUser"].address).call())
    place_receipt = send_tx(
        "PARLAY_PLACE",
        actors["parlayUser"],
        lambda base: betting.functions.placeParlay(
            legs,
            stake,
            locked_combo_odds,
            int(w3.eth.get_block("latest")["timestamp"]) + 1200,
            Web3.to_checksum_address("0x0000000000000000000000000000000000000000"),
        ).build_transaction(base),
    )

    parlay_id = None
    parlay_risk_id = None
    for log in decode_logs(place_receipt):
        if log.get("event") == "ParlayPlaced":
            parlay_id = log["args"]["parlayId"]
            parlay_risk_id = log["args"]["parlayRiskId"]
            break
    if parlay_id is None or parlay_risk_id is None:
        raise RuntimeError("ParlayPlaced event missing")

    placed = parlay_record(parlay_id)
    bet_tax_bps = int(betting.functions.betTaxBps().call())
    expected_total_deduct = stake + stake * bet_tax_bps // 10_000
    user_balance_after_place = int(odd.functions.balanceOf(actors["parlayUser"].address).call())
    check("PARLAY_state_after_place", placed["stateName"] == "Pending", f"state={placed['stateName']}")
    check("PARLAY_leg_count", placed["legCount"] == 2, f"legCount={placed['legCount']}")
    check("PARLAY_open_max_after_place", int(betting.functions.openParlayMaxPayout().call()) == open_max_before + max_payout, "open parlay exposure increased")
    check(
        "PARLAY_place_balance_delta",
        user_balance_before_place - user_balance_after_place == expected_total_deduct,
        f"expected={expected_total_deduct}, actual={user_balance_before_place - user_balance_after_place}",
    )

    estimate_pending = lens.functions.estimateParlayValue(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call()
    check("PARLAY_estimate_pending_state", int(estimate_pending[0]) == 0, f"state={estimate_pending[0]}")
    check("PARLAY_estimate_pending_unresolved", int(estimate_pending[8]) == 2, f"unresolved={estimate_pending[8]}")
    check("PARLAY_estimate_pending_positive", int(estimate_pending[4]) > 0, f"estimatedValue={estimate_pending[4]}")

    wait_until(end_ts + 3, "parlay markets to reach match end")
    settle_market_empty("PARLAY_MARKET_A", market_a, 1, 0)
    settle_market_empty("PARLAY_MARKET_B", market_b, 1, 0)
    check("PARLAY_market_a_settled", market_status(market_a) == "Settled", f"status={market_status(market_a)}")
    check("PARLAY_market_b_settled", market_status(market_b) == "Settled", f"status={market_status(market_b)}")

    estimate_final_before_settle = lens.functions.estimateParlayValue(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call()
    check("PARLAY_estimate_final_before_settle", bool(estimate_final_before_settle[10]), f"isFinal={estimate_final_before_settle[10]}")
    check(
        "PARLAY_estimated_value_matches_gross",
        int(estimate_final_before_settle[4]) == max_payout,
        f"estimatedValue={estimate_final_before_settle[4]}, maxPayout={max_payout}",
    )

    settle_receipt = send_tx(
        "PARLAY_SETTLE",
        actors["admin"],
        lambda base: betting.functions.settleParlay(parlay_id).build_transaction(base),
    )
    settled_event = next((log for log in decode_logs(settle_receipt) if log.get("event") == "ParlaySettled"), None)
    settled = parlay_record(parlay_id)
    check("PARLAY_settled_event", settled_event is not None, "ParlaySettled emitted")
    check("PARLAY_state_after_settle", settled["stateName"] == "WonUnclaimed", f"state={settled['stateName']}")
    check("PARLAY_claimable_after_settle", settled["claimablePayout"] == max_payout, f"claimable={settled['claimablePayout']}")
    check("PARLAY_open_max_after_settle", int(betting.functions.openParlayMaxPayout().call()) == open_max_before, "open parlay exposure released")

    reserved_before_claim, paid_before_claim, _ = liquidity.functions.getPayoutLiquidityWindow(parlay_risk_id).call()
    user_before_claim = int(odd.functions.balanceOf(actors["parlayUser"].address).call())
    claim_receipt = send_tx(
        "PARLAY_CLAIM",
        actors["parlayUser"],
        lambda base: betting.functions.claimParlayPayout(parlay_id).build_transaction(base),
    )
    user_after_claim = int(odd.functions.balanceOf(actors["parlayUser"].address).call())
    claimed = parlay_record(parlay_id)
    claim_event = next((log for log in decode_logs(claim_receipt) if log.get("event") == "ParlayPayoutClaimed"), None)
    if claim_event is not None:
        net_payout = int(claim_event["args"]["netPayout"])
        gross_payout = int(claim_event["args"]["grossPayout"])
        tax_amount = int(claim_event["args"]["taxAmount"])
    else:
        net_payout = 0
        gross_payout = 0
        tax_amount = 0
    check("PARLAY_claim_event", claim_event is not None, "ParlayPayoutClaimed emitted")
    check("PARLAY_state_after_claim", claimed["stateName"] == "WonClaimed", f"state={claimed['stateName']}")
    check("PARLAY_claim_gross", gross_payout == max_payout, f"gross={gross_payout}, expected={max_payout}")
    check("PARLAY_claim_balance_delta", user_after_claim - user_before_claim == net_payout, f"delta={user_after_claim - user_before_claim}, net={net_payout}")

    reserved_after_claim, paid_after_claim, _ = liquidity.functions.getPayoutLiquidityWindow(parlay_risk_id).call()
    released_amount = 0
    if int(reserved_after_claim) > int(paid_after_claim):
        release_receipt = send_tx(
            "PARLAY_RELEASE_RESIDUAL_RESERVE",
            actors["admin"],
            lambda base: betting.functions.releasePayoutReserve(parlay_risk_id).build_transaction(base),
        )
        release_event = next((log for log in decode_logs(release_receipt) if log.get("event") == "PayoutReserveReleased"), None)
        if release_event is not None:
            released_amount = int(release_event["args"]["releasedAmount"])
    reserved_after_release, paid_after_release, _ = liquidity.functions.getPayoutLiquidityWindow(parlay_risk_id).call()
    check(
        "PARLAY_reserve_paid_after_claim_not_overdrawn",
        0 <= int(paid_after_claim) <= gross_payout,
        f"paid={paid_after_claim}, gross={gross_payout}",
    )
    check("PARLAY_residual_release", int(reserved_after_release) == int(paid_after_release), f"reserved={reserved_after_release}, paid={paid_after_release}")

    try:
        lens.functions.estimateParlayValue(ADDR["BettingPool"], actors["parlayUser"].address, parlay_id).call()
        estimate_after_claim_reverted = False
    except Exception:
        estimate_after_claim_reverted = True
    check("PARLAY_estimate_after_claim_reverts", estimate_after_claim_reverted, "settled parlay estimate should revert")

    suite_after = snapshot()
    pass_count = sum(1 for _, ok, _ in checks if ok)
    fail_count = len(checks) - pass_count

    lines: list[str] = []
    title_suffix = f" ({REPORT_SUFFIX})" if REPORT_SUFFIX else ""
    lines.append(f"# 2026-06-08 BSC Testnet Modular Entrypoint Parlay Report{title_suffix}")
    lines.append("")
    lines.append(f"- RPC: `{redacted_rpc_url()}`")
    lines.append(f"- chainId: `{CHAIN_ID}`")
    lines.append(f"- suiteStartedAtBlock: `{start_block}`")
    lines.append(f"- suiteFinishedAtBlock: `{int(w3.eth.block_number)}`")
    lines.append(f"- checks: `{pass_count} passed / {fail_count} failed`")
    lines.append("")
    lines.append("## Contracts")
    lines.append(f"- ODDToken: `{ADDR['ODDToken']}`")
    lines.append(f"- LiquidityPool: `{ADDR['LiquidityPool']}`")
    lines.append(f"- BettingPool: `{ADDR['BettingPool']}`")
    lines.append(f"- BettingParlayLens: `{ADDR['BettingParlayLens']}`")
    lines.append("")
    lines.append("## Scenario")
    lines.append("- 开两个不同 match 的 1X2 市场，串关用户下注两个主胜 leg。")
    lines.append("- 比赛结束后两个市场均按 `1:0` 结算，串关结算为 `WonUnclaimed`，用户领取净派奖。")
    lines.append("- 验证 ABI 不存在串关提前 cashout selector；`estimatedValue` 仅作为只读展示估值。")
    lines.append("")
    lines.append("## Parlay")
    lines.append(f"- marketA: `{market_a.hex()}`")
    lines.append(f"- marketB: `{market_b.hex()}`")
    lines.append(f"- parlayId: `{parlay_id.hex()}`")
    lines.append(f"- parlayRiskId: `{parlay_risk_id.hex()}`")
    lines.append(f"- stake: `{fmt(stake)}` ODD")
    lines.append(f"- lockedComboOdds: `{locked_combo_odds}`")
    lines.append(f"- maxPayout / grossPayout: `{fmt(max_payout)}` ODD")
    lines.append(f"- taxAmount: `{fmt(tax_amount)}` ODD")
    lines.append(f"- netPayout: `{fmt(net_payout)}` ODD")
    lines.append(f"- payoutWindow before claim: reserved `{fmt(int(reserved_before_claim))}`, paid `{fmt(int(paid_before_claim))}`")
    lines.append(f"- payoutWindow after claim: reserved `{fmt(int(reserved_after_claim))}`, paid `{fmt(int(paid_after_claim))}`")
    lines.append(f"- residual released: `{fmt(released_amount)}` ODD")
    lines.append("")
    lines.append("## Checks")
    for name, ok, detail in checks:
        lines.append(f"- [{'PASS' if ok else 'FAIL'}] `{name}`: {detail}")
    lines.append("")
    lines.append("## Issues")
    if issues:
        for issue in issues:
            lines.append(f"- {issue}")
    else:
        lines.append("- No parlay functional issues found in this run.")
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
