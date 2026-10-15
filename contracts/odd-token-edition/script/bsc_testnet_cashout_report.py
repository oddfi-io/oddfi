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
REPORT_SUFFIX = os.environ.get("CASHOUT_REPORT_SUFFIX", "").strip()
REPORT_NAME_OVERRIDE = os.environ.get("CASHOUT_REPORT_NAME", "").strip()
REPORT_NAME = REPORT_NAME_OVERRIDE or (
    f"2026-06-03-bsc-testnet-cashout-upgrade-{REPORT_SUFFIX}.md"
    if REPORT_SUFFIX
    else "2026-06-03-bsc-testnet-cashout-upgrade-report.md"
)
REPORT = ROOT / "docs" / "testing" / REPORT_NAME

RPC_URL = os.environ["RPC_URL"]
ADMIN_PRIVATE_KEY = os.environ["ADMIN_PRIVATE_KEY"]
CHAIN_ID = int(os.environ.get("CHAIN_ID", "97"))
ODD_WAD = 10**18

ADDR = {
    "ODDToken": Web3.to_checksum_address("0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0"),
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
    5: "CashedOut",
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
    "cashoutUser": Actor("cashoutUser", derived_actor_key("cashoutUser"), ""),
    "lockedWinner": Actor("lockedWinner", derived_actor_key("lockedWinner"), ""),
    "lockedLoser": Actor("lockedLoser", derived_actor_key("lockedLoser"), ""),
}
for name, actor in list(actors.items()):
    if not actor.address:
        actors[name] = Actor(actor.name, actor.key, Account.from_key(actor.key).address)


def load_abi(source: str, name: str) -> list[dict[str, Any]]:
    return json.loads((OUT / source / f"{name}.json").read_text())["abi"]


abis = {
    "ODDToken": load_abi("ODDToken.sol", "ODDToken"),
    "BettingPool": load_abi("BettingPool.sol", "BettingPool"),
}
contracts = {name: w3.eth.contract(address=ADDR[name], abi=abi) for name, abi in abis.items()}
odd = contracts["ODDToken"]
betting = contracts["BettingPool"]

event_decoders: dict[str, tuple[str, dict[str, Any]]] = {}
for contract_name, abi in abis.items():
    for item in abi:
        if item.get("type") == "event":
            event_decoders[to_hex(event_abi_to_log_topic(item))] = (contract_name, item)

tracked = {
    "admin": actors["admin"].address,
    "cashoutUser": actors["cashoutUser"].address,
    "lockedWinner": actors["lockedWinner"].address,
    "lockedLoser": actors["lockedLoser"].address,
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
    raise RuntimeError(f"{label}: receipt not available for {to_hex(tx_hash)}; last_error={last_error!r}")


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


def check(name: str, ok: bool, detail: str) -> None:
    checks.append((name, ok, detail))
    if not ok:
        issues.append(f"{name}: {detail}")


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


def place_bet(label: str, actor: Actor, market_id: bytes, outcome: int, amount: int) -> tuple[bytes, int, int]:
    (_, accepted, locked, _, _) = betting.functions.previewSignal(market_id, outcome, amount).call()
    (_, _, updated_at, quote_version) = betting.functions.getMarketOdds(market_id).call()
    guard = (quote_version, updated_at, locked, accepted, int(time.time()) + 1200)
    receipt = send_tx(
        label,
        actor,
        lambda base: betting.functions.placeBet(market_id, outcome, amount, guard).build_transaction(base),
    )
    bet_id = None
    for log in decode_logs(receipt):
        if log.get("event") == "BetPlaced":
            bet_id = log["args"]["betId"]
            accepted = int(log["args"]["acceptedAmount"])
            locked = int(log["args"]["lockedOdds"])
            break
    if bet_id is None:
        raise RuntimeError(f"BetPlaced event missing for {label}")
    return bet_id, accepted, locked


def cashout_args(market_id: bytes, min_amount_out: int = 0) -> tuple[int, int, int, int]:
    (_, _, _, quote_version) = betting.functions.getMarketOdds(market_id).call()
    quoted_at = int(w3.eth.get_block("latest")["timestamp"])
    return quote_version, quoted_at, min_amount_out, quoted_at + 1200


def settle_by_score(label: str, market_id: bytes, home_score: int, away_score: int, bet_ids: list[bytes]) -> None:
    send_tx(
        f"{label}_SETTLE_BY_SCORE",
        actors["admin"],
        lambda base: betting.functions.settleMarketBetsByScore(market_id, home_score, away_score, bet_ids).build_transaction(base),
    )
    send_tx(
        f"{label}_FINALIZE",
        actors["admin"],
        lambda base: betting.functions.finalizeMarketSettlement(market_id, 0).build_transaction(base),
    )


def bet_state(bet_id: bytes) -> str:
    raw = betting.functions.getBet(bet_id).call()
    return BET_STATE[int(raw[7])]


def market_status(market_id: bytes) -> str:
    raw = betting.functions.getMarket(market_id).call()
    return MARKET_STATUS[int(raw[6])]


def assert_cashout_call_reverts(bet_id: bytes, market_id: bytes, actor: Actor) -> str:
    quote_version, quoted_at, min_amount_out, deadline = cashout_args(market_id)
    fn = betting.functions.cashOut(bet_id, quote_version, quoted_at, min_amount_out, deadline)
    tx = fn.build_transaction({"from": actor.address, "gas": 500_000})
    try:
        w3.eth.call({"from": actor.address, "to": ADDR["BettingPool"], "data": tx["data"]})
    except Exception as exc:
        return str(exc)[:240]
    raise RuntimeError("cashOut eth_call unexpectedly succeeded after lockMarket")


def main() -> None:
    start_block = int(w3.eth.block_number)
    suite_before = snapshot()

    for actor_name in ["cashoutUser", "lockedWinner", "lockedLoser"]:
        seed_actor(actor_name, int(0.04 * 10**18), 1_000 * ODD_WAD, 2_000 * ODD_WAD)
        approve_if_needed(f"APPROVE_{actor_name}_BETTING", actors[actor_name], ADDR["BettingPool"], 1_000 * ODD_WAD)

    now = int(w3.eth.get_block("latest")["timestamp"])
    start_ts = now + 120
    end_ts = now + 240

    _, cashout_market = open_market("CASHOUT_OPEN_MARKET", "cashout-success", start_ts, end_ts)
    cashout_bet, _, _ = place_bet("CASHOUT_PLACE_BET", actors["cashoutUser"], cashout_market, 0, 100 * ODD_WAD)

    cashout_user_before = odd.functions.balanceOf(actors["cashoutUser"].address).call()
    quote_version, quoted_at, min_amount_out, deadline = cashout_args(cashout_market)
    cashout_receipt = send_tx(
        "CASHOUT_BEFORE_LOCK",
        actors["cashoutUser"],
        lambda base: betting.functions.cashOut(
            cashout_bet, quote_version, quoted_at, min_amount_out, deadline
        ).build_transaction({**base, "gas": 500_000}),
    )
    cashout_succeeded = int(cashout_receipt["status"]) == 1
    cashout_user_after = odd.functions.balanceOf(actors["cashoutUser"].address).call()
    cashout_event = next((log for log in decode_logs(cashout_receipt) if log.get("event") == "BetCashedOut"), None)
    check("CASHOUT_event_present", cashout_event is not None, "BetCashedOut emitted")
    if cashout_event is not None:
        cashout_amount = int(cashout_event["args"]["cashOutAmount"])
        check("CASHOUT_amount_positive", cashout_amount > 0, f"cashOutAmount={cashout_amount}")
        check(
            "CASHOUT_balance_delta",
            cashout_user_after - cashout_user_before == cashout_amount,
            f"expected delta={cashout_amount}, got={cashout_user_after - cashout_user_before}",
        )
    check("CASHOUT_bet_state", bet_state(cashout_bet) == "CashedOut", f"state={bet_state(cashout_bet)}")

    _, locked_market = open_market("LOCKED_OPEN_MARKET", "cashout-locked", start_ts, end_ts)
    winner_bet, _, _ = place_bet("LOCKED_PLACE_WINNER_BET", actors["lockedWinner"], locked_market, 0, 100 * ODD_WAD)
    loser_bet, _, _ = place_bet("LOCKED_PLACE_LOSER_BET", actors["lockedLoser"], locked_market, 2, 100 * ODD_WAD)
    send_tx("LOCKED_LOCK_MARKET", actors["admin"], lambda base: betting.functions.lockMarket(locked_market).build_transaction(base))
    check("LOCKED_market_status_after_lock", market_status(locked_market) == "Locked", f"status={market_status(locked_market)}")

    revert_detail = assert_cashout_call_reverts(winner_bet, locked_market, actors["lockedWinner"])
    check("LOCKED_cashout_eth_call_reverts", True, revert_detail)
    quote_version, quoted_at, min_amount_out, deadline = cashout_args(locked_market)
    send_tx(
        "LOCKED_CASHOUT_REVERT_TX",
        actors["lockedWinner"],
        lambda base: betting.functions.cashOut(
            winner_bet, quote_version, quoted_at, min_amount_out, deadline
        ).build_transaction({**base, "gas": 500_000}),
        expected_status=0,
    )
    check("LOCKED_winner_state_still_pending", bet_state(winner_bet) == "Pending", f"state={bet_state(winner_bet)}")

    wait_until(end_ts + 3, "cash out scenario markets to reach match end")
    if cashout_succeeded:
        settle_by_score("CASHOUT_MARKET", cashout_market, 1, 0, [])
        check("CASHOUT_market_settled", market_status(cashout_market) == "Settled", f"status={market_status(cashout_market)}")
        check("CASHOUT_bet_state_after_settlement", bet_state(cashout_bet) == "CashedOut", f"state={bet_state(cashout_bet)}")
    else:
        cashout_bet_ids = betting.functions.getMarketBetIds(cashout_market, 0, 50).call()
        settle_by_score("CASHOUT_MARKET_FALLBACK", cashout_market, 1, 0, cashout_bet_ids)
        check(
            "CASHOUT_success_path_skipped_after_failed_tx",
            False,
            "cashOut tx failed before settlement; fallback settled the pending betIds for cleanup/report continuity",
        )
        if bet_state(cashout_bet) == "WonUnclaimed":
            send_tx("CASHOUT_FALLBACK_CLAIM_PAYOUT", actors["cashoutUser"], lambda base: betting.functions.claimPayout(cashout_bet).build_transaction(base))

    locked_bet_ids = betting.functions.getMarketBetIds(locked_market, 0, 50).call()
    settle_by_score("LOCKED_MARKET", locked_market, 1, 0, locked_bet_ids)
    check("LOCKED_market_settled", market_status(locked_market) == "Settled", f"status={market_status(locked_market)}")
    winner_before_claim = odd.functions.balanceOf(actors["lockedWinner"].address).call()
    claim_receipt = send_tx("LOCKED_WINNER_CLAIM_PAYOUT", actors["lockedWinner"], lambda base: betting.functions.claimPayout(winner_bet).build_transaction(base))
    winner_after_claim = odd.functions.balanceOf(actors["lockedWinner"].address).call()
    check("LOCKED_claim_status", int(claim_receipt["status"]) == 1, claim_receipt["transactionHash"].hex())
    check("LOCKED_claim_delta_positive", winner_after_claim > winner_before_claim, f"delta={winner_after_claim - winner_before_claim}")
    check("LOCKED_winner_state_claimed", bet_state(winner_bet) == "WonClaimed", f"state={bet_state(winner_bet)}")
    check("LOCKED_loser_state_lost", bet_state(loser_bet) == "Lost", f"state={bet_state(loser_bet)}")

    suite_after = snapshot()
    pass_count = sum(1 for _, ok, _ in checks if ok)
    fail_count = len(checks) - pass_count

    lines: list[str] = []
    title_suffix = f" ({REPORT_SUFFIX})" if REPORT_SUFFIX else ""
    lines.append(f"# 2026-06-07 BSC Testnet Parlay Upgrade Cash Out Report{title_suffix}")
    lines.append("")
    lines.append(f"- RPC: `{redacted_rpc_url()}`")
    lines.append(f"- chainId: `{CHAIN_ID}`")
    lines.append(f"- suiteStartedAtBlock: `{start_block}`")
    lines.append(f"- suiteFinishedAtBlock: `{int(w3.eth.block_number)}`")
    lines.append(f"- checks: `{pass_count} passed / {fail_count} failed`")
    lines.append("")
    lines.append("## Contracts")
    lines.append(f"- ODDToken: `{ADDR['ODDToken']}`")
    lines.append(f"- BettingPool: `{ADDR['BettingPool']}`")
    lines.append("")
    lines.append("## Scenarios")
    lines.append("- 下注 -> 提前撤 -> 比赛结束 -> 空 betIds 记分结算 -> finalize；提前撤注单保持 `CashedOut`。")
    lines.append("- 下注 -> `lockMarket` -> 提前撤 `eth_call` 与真实交易均失败 -> 比赛结束 -> 记分结算 -> 胜方 `claimPayout`。")
    lines.append("")
    lines.append("## Actors")
    for name in ["admin", "cashoutUser", "lockedWinner", "lockedLoser"]:
        lines.append(f"- `{name}`: `{actors[name].address}`")
    lines.append("")
    lines.append("## Checks")
    for name, ok, detail in checks:
        lines.append(f"- [{'PASS' if ok else 'FAIL'}] `{name}`: {detail}")
    lines.append("")
    lines.append("## Live Finding")
    if cashout_succeeded:
        lines.append("- Pre-lock Cash Out succeeded on BSC Testnet in this run.")
    else:
        lines.append(
            "- Pre-lock Cash Out failed on BSC Testnet before settlement. The script uses latest chain block "
            "timestamp and manual gas to avoid local clock/estimate delays, so the remaining likely blocker is "
            "the current 5 second `CASH_OUT_QUOTE_TTL` being too tight for real RPC submission and block inclusion."
        )
    lines.append("")
    if issues:
        lines.append("## Issues")
        for issue in issues:
            lines.append(f"- {issue}")
        lines.append("")
    else:
        lines.append("## Issues")
        lines.append("- No Cash Out functional issues found in this run.")
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
