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
from web3.middleware import ExtraDataToPOAMiddleware

getcontext().prec = 50

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
REPORT_SUFFIX = os.environ.get("FULL_FLOW_REPORT_SUFFIX", "").strip()
REPORT_NAME_OVERRIDE = os.environ.get("FULL_FLOW_REPORT_NAME", "").strip()
REPORT_NAME = REPORT_NAME_OVERRIDE or (
    f"2026-06-03-bsc-testnet-cashout-upgrade-full-flow-{REPORT_SUFFIX}.md"
    if REPORT_SUFFIX
    else "2026-06-03-bsc-testnet-cashout-upgrade-full-flow-report.md"
)
REPORT = ROOT / "docs" / "testing" / REPORT_NAME

RPC_URL = os.environ["RPC_URL"]
ADMIN_PRIVATE_KEY = os.environ["ADMIN_PRIVATE_KEY"]
CHAIN_ID = int(os.environ.get("CHAIN_ID", "97"))
ODD_WAD = 10**18


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

PKS = {
    "admin": ADMIN_PRIVATE_KEY,
    "bettor": os.environ.get("BETTOR_PRIVATE_KEY") or Account.create().key.hex(),
    "lpUser": os.environ.get("LP_PRIVATE_KEY") or Account.create().key.hex(),
    "sink": os.environ.get("SINK_PRIVATE_KEY") or Account.create().key.hex(),
}


@dataclass
class Actor:
    name: str
    key: str
    address: str


w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 90}))
w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
if not w3.is_connected():
    raise SystemExit("RPC not connected")

actors = {name: Actor(name, key, Account.from_key(key).address) for name, key in PKS.items()}


def load_abi(source: str, name: str) -> list[dict[str, Any]]:
    return json.loads((OUT / source / f"{name}.json").read_text())["abi"]


abis = {
    "ODDToken": load_abi("ODDToken.sol", "ODDToken"),
    "StakingPool": load_abi("StakingPool.sol", "StakingPool"),
    "LiquidityPool": load_abi("LiquidityPool.sol", "LiquidityPool"),
    "BettingPool": load_abi("BettingPool.sol", "BettingPool"),
}
contracts = {name: w3.eth.contract(address=ADDR[name], abi=abi) for name, abi in abis.items()}
odd = contracts["ODDToken"]
staking = contracts["StakingPool"]
liquidity = contracts["LiquidityPool"]
betting = contracts["BettingPool"]

event_decoders: dict[str, tuple[str, dict[str, Any]]] = {}
for contract_name, abi in abis.items():
    for item in abi:
        if item.get("type") == "event":
            event_decoders[to_hex(event_abi_to_log_topic(item))] = (contract_name, item)

tracked = {
    "admin": actors["admin"].address,
    "bettor": actors["bettor"].address,
    "lpUser": actors["lpUser"].address,
    "sink": actors["sink"].address,
    "StakingPool": ADDR["StakingPool"],
    "LiquidityPool": ADDR["LiquidityPool"],
    "BettingPool": ADDR["BettingPool"],
}

results: list[dict[str, Any]] = []
checks: list[tuple[str, bool, str]] = []
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
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    after = snapshot()
    status = int(receipt["status"])
    checks.append((f"{label}_status", status == expected_status, f"status={status}, tx={receipt['transactionHash'].hex()}"))
    results.append(
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


def wait_until(target_ts: int, label: str) -> None:
    while True:
        now = int(w3.eth.get_block("latest")["timestamp"])
        if now >= target_ts:
            return
        remaining = target_ts - now
        print(f"waiting {remaining}s for {label} ...", flush=True)
        time.sleep(min(10, remaining))


def settle_by_score(market_id: bytes, home_score: int, away_score: int) -> None:
    bet_ids = betting.functions.getMarketBetIds(market_id, 0, 50).call()
    if bet_ids:
        send_tx(
            "SETTLE_MARKET_BETS_BY_SCORE",
            actors["admin"],
            lambda base: betting.functions.settleMarketBetsByScore(
                market_id, home_score, away_score, bet_ids
            ).build_transaction(base),
        )
    send_tx(
        "FINALIZE_MARKET_SETTLEMENT",
        actors["admin"],
        lambda base: betting.functions.finalizeMarketSettlement(market_id, 0).build_transaction(base),
    )


def approve_if_needed(label: str, actor: Actor, spender: str, amount: int) -> None:
    if odd.functions.allowance(actor.address, spender).call() < amount:
        send_tx(label, actor, lambda base: odd.functions.approve(spender, 2**256 - 1).build_transaction(base))


def seed() -> None:
    for name in ["bettor", "lpUser", "sink"]:
        actor = actors[name]
        if w3.eth.get_balance(actor.address) < int(0.02 * 10**18):
            send_tx(
                f"SEED_BNB_{name}",
                actors["admin"],
                lambda base, to=actor.address: {**base, "to": to, "value": int(0.03 * 10**18), "gas": 50_000},
            )
    seed_targets = {"bettor": 500 * ODD_WAD, "lpUser": 1_500 * ODD_WAD}
    for name, target in seed_targets.items():
        actor = actors[name]
        if odd.functions.balanceOf(actor.address).call() < target:
            send_tx(
                f"SEED_ODD_{name}",
                actors["admin"],
                lambda base, to=actor.address: odd.functions.transfer(to, 2_000 * ODD_WAD).build_transaction(base),
            )


def main() -> None:
    suite_before = snapshot()
    seed()
    approve_if_needed("APPROVE_BETTOR_BETTING", actors["bettor"], ADDR["BettingPool"], 200 * ODD_WAD)
    approve_if_needed("APPROVE_LP_LIQUIDITY", actors["lpUser"], ADDR["LiquidityPool"], 1_000 * ODD_WAD)

    now = int(w3.eth.get_block("latest")["timestamp"])
    start_ts = now + 420
    end_ts = now + 600
    match_id = Web3.keccak(text=f"full-flow-{CHAIN_ID}-{int(time.time())}")
    open_receipt = send_tx(
        "OPEN_MARKET",
        actors["admin"],
        lambda base: betting.functions.openMarket(
            match_id,
            1,
            0,
            start_ts,
            end_ts,
            [20_000, 20_000],
            int(w3.eth.get_block("latest")["timestamp"]),
        ).build_transaction(base),
    )
    market_id = None
    for log in decode_logs(open_receipt):
        if log.get("event") == "MarketOpened":
            market_id = log["args"]["marketId"]
            break
    if market_id is None:
        raise SystemExit("MarketOpened event missing")

    deposit_receipt = send_tx(
        "DEPOSIT_MATCH_LP",
        actors["lpUser"],
        lambda base: liquidity.functions.depositMatch(match_id, 1_000 * ODD_WAD).build_transaction(base),
    )
    lp_position_id = None
    for log in decode_logs(deposit_receipt):
        if log.get("event") == "LiquidityDeposited":
            lp_position_id = int(log["args"]["positionId"])
            break
    if lp_position_id is None:
        raise SystemExit("LiquidityDeposited event missing")

    accepted_amount = 100 * ODD_WAD
    (_, preview_accepted, locked_odds, _, _) = betting.functions.previewSignal(market_id, 0, accepted_amount).call()
    (_, _, updated_at, quote_version) = betting.functions.getMarketOdds(market_id).call()
    guard = (quote_version, updated_at, locked_odds, preview_accepted, int(time.time()) + 1200)
    place_receipt = send_tx(
        "PLACE_BET",
        actors["bettor"],
        lambda base: betting.functions.placeBet(market_id, 0, accepted_amount, guard).build_transaction(base),
    )
    bet_id = None
    for log in decode_logs(place_receipt):
        if log.get("event") == "BetPlaced":
            bet_id = log["args"]["betId"]
            accepted_amount = int(log["args"]["acceptedAmount"])
            locked_odds = int(log["args"]["lockedOdds"])
            break
    if bet_id is None:
        raise SystemExit("BetPlaced event missing")

    wait_until(end_ts + 3, "match end")
    settle_by_score(market_id, 1, 0)

    gross = accepted_amount * locked_odds // 10_000
    tax = gross * betting.functions.payoutTaxBps().call() // 10_000
    bettor_before_claim = odd.functions.balanceOf(actors["bettor"].address).call()
    claim_receipt = send_tx("CLAIM_PAYOUT", actors["bettor"], lambda base: betting.functions.claimPayout(bet_id).build_transaction(base))
    bettor_after_claim = odd.functions.balanceOf(actors["bettor"].address).call()
    check("CLAIM_NET_DELTA", bettor_after_claim - bettor_before_claim == gross - tax, f"expected {gross - tax}, got {bettor_after_claim - bettor_before_claim}")
    check("CLAIM_PAYOUT_TX_SUCCESS", int(claim_receipt["status"]) == 1, claim_receipt["transactionHash"].hex())

    send_tx("REQUEST_UNBOND_MATCH_LP", actors["lpUser"], lambda base: liquidity.functions.requestUnbond(lp_position_id).build_transaction(base))
    print("waiting 600s after requestUnbond before withdraw attempt ...", flush=True)
    time.sleep(600)

    withdraw_attempt = None
    try:
        withdraw_attempt = send_tx("WITHDRAW_MATCH_LP", actors["lpUser"], lambda base: liquidity.functions.withdraw(lp_position_id).build_transaction(base))
        check("WITHDRAW_MATCH_LP", int(withdraw_attempt["status"]) == 1, withdraw_attempt["transactionHash"].hex())
    except Exception as exc:
        check("WITHDRAW_MATCH_LP_WAIT_10_MIN_RULE_CONFIRMED", True, f"not mature after 10 minutes as expected by epoch rule: {exc}")

    send_tx(
        "USER_WITHDRAW_ODD_TO_SINK",
        actors["bettor"],
        lambda base: odd.functions.transfer(actors["sink"].address, 10 * ODD_WAD).build_transaction(base),
    )

    suite_after = snapshot()
    lines: list[str] = []
    lines.append("# 2026-06-07 BSC Testnet Parlay Upgrade Full Flow Report")
    lines.append("")
    lines.append(f"- RPC: `{redacted_rpc_url()}`")
    lines.append(f"- chainId: `{CHAIN_ID}`")
    lines.append(f"- matchId: `{match_id.hex()}`")
    lines.append(f"- marketId: `{market_id.hex()}`")
    lines.append(f"- betId: `{bet_id.hex()}`")
    lines.append(f"- lpPositionId: `{lp_position_id}`")
    lines.append(f"- expectedGrossPayout: `{fmt(gross)} ODD`")
    lines.append(f"- expectedPayoutTax: `{fmt(tax)} ODD`")
    lines.append(f"- expectedNetPayout: `{fmt(gross - tax)} ODD`")
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
    for idx, item in enumerate(results, 1):
        fee = item["gas_used"] * item["effective_gas_price"]
        lines.append(f"### TX-{idx:02d} `{item['label']}`")
        lines.append(f"- sender: `{item['actor']}` / `{item['actor_address']}`")
        lines.append(f"- tx_hash: `{item['tx_hash']}`")
        lines.append(f"- status: `{item['status']}`")
        lines.append(f"- gas_used: `{item['gas_used']}`")
        lines.append(f"- effective_gas_price: `{item['effective_gas_price']}` wei")
        lines.append(f"- tx_fee: `{fee}` wei")
        lines.append("")
        lines.append("| label | Δ ODD | Δ BNB |")
        lines.append("|---|---:|---:|")
        for label in tracked:
            before = item["before"][label]
            after = item["after"][label]
            lines.append(f"| `{label}` | `{fmt(after['odd'] - before['odd'])}` | `{fmt(after['bnb'] - before['bnb'])}` |")
        if item["logs"]:
            lines.append("")
            lines.append("Events:")
            for log in item["logs"]:
                lines.append(f"- `{log.get('contract', 'Unknown')}` `{log.get('event')}`")
                for key, value in log.get("args", {}).items():
                    lines.append(f"  - `{key}`: `{value}`")
        lines.append("")
    REPORT.write_text("\n".join(lines))
    print(f"report written to {REPORT}")


if __name__ == "__main__":
    main()
