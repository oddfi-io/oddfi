#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from decimal import Decimal, getcontext
from pathlib import Path
from typing import Any, Dict, List, Tuple

from eth_account import Account
from eth_utils import to_hex
from web3 import Web3
from web3._utils.events import event_abi_to_log_topic, get_event_data
from web3.middleware import ExtraDataToPOAMiddleware

getcontext().prec = 50

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
DOC_OUT = ROOT / "docs" / "testing" / "2026-06-03-bsc-testnet-cashout-upgrade-scenario-report.md"

RPC_URL = os.environ["RPC_URL"]
ADMIN_PRIVATE_KEY = os.environ["ADMIN_PRIVATE_KEY"]
CHAIN_ID = int(os.environ.get("CHAIN_ID", "97"))


def redacted_rpc_url() -> str:
    if "/v2/" in RPC_URL:
        return RPC_URL.split("/v2/", 1)[0] + "/v2/<redacted>"
    return "RPC_URL environment value used (token omitted)"

ADDR = {
    "ODDToken": Web3.to_checksum_address("0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0"),
    "StakingPool": Web3.to_checksum_address("0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F"),
    "LiquidityPool": Web3.to_checksum_address("0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50"),
    "BettingPool": Web3.to_checksum_address("0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3"),
    "BettingSettlementModule": Web3.to_checksum_address("0x120D754E3BD8aE9ba2fe27Fbd423f6B4C392f07d"),
}

PKS = {
    "admin": ADMIN_PRIVATE_KEY,
    "referrer": "0xf5341822875704f7acf0cf5049d4d96e78fc7029d2b569a7c36ba33b11fbbdc6",
    "alice": "0xe4c4542e1267950b9f6668db9571248800acae19a41b8e85f73a3471131b8e33",
    "bob": "0x88e85a871fb39f862692c600d8d65065157deb9675ece103fa51952e2c0816d7",
    "carol": "0xf68ec75e18488dd4f0893926578079bcdb3ff0edbfbd388cd8d1693804f59923",
    "lpUser": "0x58eae93baca46c542ab9dc1f1ce4d7c8558255d40020f89a3a459c56402f36de",
}

ODD_WAD = 10**18


@dataclass
class Actor:
    name: str
    key: str
    address: str


w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 60}))
w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
assert w3.is_connected(), "RPC not connected"

actors: Dict[str, Actor] = {
    name: Actor(name=name, key=pk, address=Account.from_key(pk).address) for name, pk in PKS.items()
}


def load_abi(contract_path: str, contract_name: str) -> List[Dict[str, Any]]:
    artifact = json.loads((OUT / contract_path / f"{contract_name}.json").read_text())
    return artifact["abi"]


abis = {
    "ODDToken": load_abi("ODDToken.sol", "ODDToken"),
    "StakingPool": load_abi("StakingPool.sol", "StakingPool"),
    "LiquidityPool": load_abi("LiquidityPool.sol", "LiquidityPool"),
    "BettingPool": load_abi("BettingPool.sol", "BettingPool"),
}

contracts = {
    name: w3.eth.contract(address=ADDR[name], abi=abi) for name, abi in abis.items()
}
odd = contracts["ODDToken"]
staking = contracts["StakingPool"]
liquidity = contracts["LiquidityPool"]
betting = contracts["BettingPool"]

EVENT_DECODERS: Dict[str, Tuple[str, Dict[str, Any]]] = {}
for contract_name, abi in abis.items():
    for item in abi:
        if item.get("type") != "event":
            continue
        topic = to_hex(event_abi_to_log_topic(item))
        EVENT_DECODERS[topic] = (contract_name, item)


TRACKED = {
    "admin": actors["admin"].address,
    "referrer": actors["referrer"].address,
    "alice": actors["alice"].address,
    "bob": actors["bob"].address,
    "carol": actors["carol"].address,
    "lpUser": actors["lpUser"].address,
    "ODDToken": ADDR["ODDToken"],
    "StakingPool": ADDR["StakingPool"],
    "LiquidityPool": ADDR["LiquidityPool"],
    "BettingPool": ADDR["BettingPool"],
}


issues: List[str] = []
results: List[Dict[str, Any]] = []
checks: List[Tuple[str, bool, str]] = []


def fmt_odd(raw: int) -> str:
    return f"{Decimal(raw) / Decimal(ODD_WAD):,.18f}".rstrip("0").rstrip(".")


def fmt_bnb(raw: int) -> str:
    return f"{Decimal(raw) / Decimal(10**18):,.18f}".rstrip("0").rstrip(".")


def snapshot() -> Dict[str, Dict[str, int]]:
    snap: Dict[str, Dict[str, int]] = {}
    for label, address in TRACKED.items():
        snap[label] = {
            "bnb": w3.eth.get_balance(address),
            "odd": odd.functions.balanceOf(address).call(),
        }
    return snap


def decode_logs(receipt: Any) -> List[Dict[str, Any]]:
    decoded: List[Dict[str, Any]] = []
    for log in receipt["logs"]:
        if not log["topics"]:
            decoded.append({"address": log["address"], "event": "<anonymous>", "args": {"data": log["data"]}})
            continue
        topic0 = to_hex(log["topics"][0])
        entry = EVENT_DECODERS.get(topic0)
        if not entry:
            decoded.append({"address": log["address"], "event": f"<unknown:{topic0}>", "args": {"data": log["data"]}})
            continue
        contract_name, event_abi = entry
        event_data = get_event_data(w3.codec, event_abi, log)
        decoded.append(
            {
                "address": log["address"],
                "contract": contract_name,
                "event": event_data["event"],
                "args": dict(event_data["args"]),
            }
        )
    return decoded


def build_tx(base: Dict[str, Any], built: Dict[str, Any]) -> Dict[str, Any]:
    tx = dict(built)
    tx.setdefault("chainId", CHAIN_ID)
    tx.setdefault("nonce", base["nonce"])
    tx.setdefault("from", base["from"])
    tx.setdefault("gasPrice", base["gasPrice"])
    if "gas" not in tx:
        estimate = w3.eth.estimate_gas(tx)
        tx["gas"] = int(estimate * 12 // 10)
    return tx


def send_tx(label: str, actor: Actor, tx_builder, expected_status: int = 1) -> Any:
    before = snapshot()
    gas_price = w3.eth.gas_price
    nonce = w3.eth.get_transaction_count(actor.address)
    base = {"from": actor.address, "nonce": nonce, "gasPrice": gas_price, "chainId": CHAIN_ID}
    tx = build_tx(base, tx_builder(base))
    signed = Account.sign_transaction(tx, actor.key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    after = snapshot()
    status = receipt["status"]
    if status != expected_status:
        issues.append(f"{label}: status={status}, expected={expected_status}, tx={receipt['transactionHash'].hex()}")
    decoded_logs = decode_logs(receipt)
    results.append(
        {
            "label": label,
            "actor": actor.name,
            "actor_address": actor.address,
            "tx_hash": receipt["transactionHash"].hex(),
            "status": status,
            "gas_used": receipt["gasUsed"],
            "effective_gas_price": receipt.get("effectiveGasPrice", gas_price),
            "tx_fee": receipt["gasUsed"] * receipt.get("effectiveGasPrice", gas_price),
            "before": before,
            "after": after,
            "logs": decoded_logs,
        }
    )
    print(f"sent {label}: {receipt['transactionHash'].hex()} status={status}", flush=True)
    return receipt


def send_native(label: str, actor: Actor, to: str, value: int):
    return send_tx(label, actor, lambda base: {**base, "to": to, "value": value, "gas": 21000})


def wait_until(target_ts: int):
    while True:
        now = w3.eth.get_block("latest")["timestamp"]
        if now >= target_ts:
            return
        remaining = target_ts - now
        print(f"waiting {remaining}s for market end ...", flush=True)
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


def check(name: str, ok: bool, detail: str):
    checks.append((name, ok, detail))
    if not ok:
        issues.append(f"{name}: {detail}")


def encode_bytes32(text: str) -> bytes:
    return Web3.keccak(text=text)


def main():
    suite_before = snapshot()

    # Seed BNB
    native_target = int(0.02 * 10**18)
    for who in ["referrer", "alice", "bob", "carol", "lpUser"]:
        if w3.eth.get_balance(actors[who].address) < native_target:
            send_native(f"SEED_NATIVE_{who}", actors["admin"], actors[who].address, int(0.03 * 10**18))

    # Seed ODD
    seed_targets = {
        "referrer": 1_000 * ODD_WAD,
        "alice": 3_000 * ODD_WAD,
        "bob": 3_000 * ODD_WAD,
        "carol": 500 * ODD_WAD,
        "lpUser": 6_000 * ODD_WAD,
    }
    seed_topups = {
        "referrer": 2_000 * ODD_WAD,
        "alice": 5_000 * ODD_WAD,
        "bob": 5_000 * ODD_WAD,
        "carol": 2_000 * ODD_WAD,
        "lpUser": 10_000 * ODD_WAD,
    }
    for who, target in seed_targets.items():
        if odd.functions.balanceOf(actors[who].address).call() < target:
            amount = seed_topups[who]
            send_tx(
                f"SEED_ODD_{who}",
                actors["admin"],
                lambda base, to=actors[who].address, amount=amount: odd.functions.transfer(to, amount).build_transaction(base),
            )

    # DEP-003 no tax transfers
    send_tx(
        "DEP_003_ALICE_TO_BOB",
        actors["alice"],
        lambda base: odd.functions.transfer(actors["bob"].address, 1_000 * ODD_WAD).build_transaction(base),
    )
    send_tx(
        "DEP_003_BOB_TO_CAROL",
        actors["bob"],
        lambda base: odd.functions.transfer(actors["carol"].address, 123_456 * 10**15).build_transaction(base),
    )

    # approvals
    def approve_if_needed(label: str, actor_name: str, spender: str, min_allowance: int):
        actor = actors[actor_name]
        allowance = odd.functions.allowance(actor.address, spender).call()
        if allowance < min_allowance:
            send_tx(label, actor, lambda base: odd.functions.approve(spender, 2**256 - 1).build_transaction(base))

    approve_if_needed("APPROVE_REFERRER_STAKING", "referrer", ADDR["StakingPool"], 500 * ODD_WAD)
    approve_if_needed("APPROVE_ALICE_BETTING", "alice", ADDR["BettingPool"], 2_000 * ODD_WAD)
    approve_if_needed("APPROVE_BOB_BETTING", "bob", ADDR["BettingPool"], 2_000 * ODD_WAD)
    approve_if_needed("APPROVE_LPUSER_LIQUIDITY", "lpUser", ADDR["LiquidityPool"], 5_000 * ODD_WAD)

    # stake and LP
    send_tx("STAKE_REFERRER", actors["referrer"], lambda base: staking.functions.stake(500 * ODD_WAD, 1).build_transaction(base))
    send_tx("DEPOSIT_GLOBAL_LPUSER", actors["lpUser"], lambda base: liquidity.functions.depositGlobal(5_000 * ODD_WAD, 1).build_transaction(base))

    # open markets
    now = w3.eth.get_block("latest")["timestamp"]
    start_ts = now + 600
    end_ts = now + 660
    match_a = encode_bytes32(f"testnet-match-a-{int(time.time())}")
    match_b = encode_bytes32(f"testnet-match-b-{int(time.time())}")

    open_a_receipt = send_tx(
        "OPEN_MARKET_A",
        actors["admin"],
        lambda base: betting.functions.openMarket(
            match_a,
            0,
            0,
            start_ts,
            end_ts,
            [20_000, 30_000, 40_000],
            w3.eth.get_block("latest")["timestamp"],
        ).build_transaction(base),
    )
    market_a = Web3.solidity_keccak(["bytes32", "uint8", "uint8"], [match_a, 0, 0])
    for log in decode_logs(open_a_receipt):
        if log.get("event") == "MarketOpened":
            market_a = log["args"]["marketId"]
            break

    open_b_receipt = send_tx(
        "OPEN_MARKET_B_PUSH",
        actors["admin"],
        lambda base: betting.functions.openMarket(
            match_b,
            1,
            1,
            start_ts,
            end_ts,
            [20_000, 20_000],
            w3.eth.get_block("latest")["timestamp"],
        ).build_transaction(base),
    )
    market_b = Web3.solidity_keccak(["bytes32", "uint8", "uint8"], [match_b, 1, 1])
    for log in decode_logs(open_b_receipt):
        if log.get("event") == "MarketOpened":
            market_b = log["args"]["marketId"]
            break

    # prepare guards
    def make_guard(market_id: bytes, outcome: int, amount: int):
        signal, accepted, locked, partial, max_amt = betting.functions.previewSignal(market_id, outcome, amount).call()
        base_odds, quoted_odds, updated_at, quote_version = betting.functions.getMarketOdds(market_id).call()
        return (quote_version, updated_at, locked, accepted, int(time.time()) + 3600), accepted, locked

    guard_alice, accepted_alice, locked_alice = make_guard(market_a, 0, 1000 * ODD_WAD)
    guard_push, accepted_push, locked_push = make_guard(market_b, 0, 500 * ODD_WAD)

    # place bets
    receipt_alice = send_tx(
        "PLACE_BET_A_ALICE_WITH_REFERRER",
        actors["alice"],
        lambda base: betting.functions.placeBet(market_a, 0, 1000 * ODD_WAD, guard_alice, actors["referrer"].address).build_transaction(base),
    )
    alice_bet = None
    for log in decode_logs(receipt_alice):
        if log.get("event") == "BetPlaced":
            alice_bet = log["args"]["betId"]
            break
    assert alice_bet is not None

    guard_bob, accepted_bob, locked_bob = make_guard(market_a, 1, 1000 * ODD_WAD)

    receipt_bob = send_tx(
        "PLACE_BET_A_BOB_NO_REFERRER",
        actors["bob"],
        lambda base: betting.functions.placeBet(market_a, 1, 1000 * ODD_WAD, guard_bob).build_transaction(base),
    )
    bob_bet_a = None
    for log in decode_logs(receipt_bob):
        if log.get("event") == "BetPlaced":
            bob_bet_a = log["args"]["betId"]
            break

    receipt_push_bet = send_tx(
        "PLACE_BET_B_BOB_PUSH_MARKET",
        actors["bob"],
        lambda base: betting.functions.placeBet(market_b, 0, 500 * ODD_WAD, guard_push).build_transaction(base),
    )
    bob_bet_b = None
    for log in decode_logs(receipt_push_bet):
        if log.get("event") == "BetPlaced":
            bob_bet_b = log["args"]["betId"]
            break

    # checks after bet placement
    bound_referrer = betting.functions.referrers(actors["alice"].address).call()
    check("REF_002_auto_bind", bound_referrer.lower() == actors["referrer"].address.lower(), f"expected {actors['referrer'].address}, got {bound_referrer}")
    ref_reward_after_bets = betting.functions.referrerRewardsOdd(actors["referrer"].address).call()
    check("TAX_001_referrer_reward_after_bets", ref_reward_after_bets == 10 * ODD_WAD, f"expected 10 ODD, got {ref_reward_after_bets}")

    wait_until(end_ts + 2)

    # settle normal market
    settle_by_score(market_a, 1, 0)

    # claim payout
    claim_receipt = send_tx(
        "CLAIM_PAYOUT_ALICE",
        actors["alice"],
        lambda base: betting.functions.claimPayout(alice_bet).build_transaction(base),
    )

    alice_bet_after = betting.functions.getBet(alice_bet).call()
    expected_gross = accepted_alice * locked_alice // 10_000
    expected_tax = expected_gross * 500 // 10_000
    expected_net = expected_gross - expected_tax
    payout_event = next((log for log in decode_logs(claim_receipt) if log.get("event") == "PayoutClaimed"), None)
    if payout_event:
        check("CLAIM_gross_payout", payout_event["args"]["grossPayout"] == expected_gross, f"expected gross {expected_gross}, got {payout_event['args']['grossPayout']}")
        check("CLAIM_net_payout", payout_event["args"]["netPayout"] == expected_net, f"expected net {expected_net}, got {payout_event['args']['netPayout']}")
    else:
        check("CLAIM_payout_event_present", False, "PayoutClaimed missing")

    ref_reward_before_claim = betting.functions.referrerRewardsOdd(actors["referrer"].address).call()
    claim_ref_receipt = send_tx(
        "CLAIM_REFERRAL_REWARD_REFERRER",
        actors["referrer"],
        lambda base: betting.functions.claimReferralRewards(ref_reward_before_claim).build_transaction(base),
    )
    ref_reward_after_claim = betting.functions.referrerRewardsOdd(actors["referrer"].address).call()
    check("REFERRAL_claim_zeroes_balance", ref_reward_after_claim == 0, f"expected 0, got {ref_reward_after_claim}")

    # full push market B
    settle_by_score(market_b, 1, 0)
    bob_bet_b_after = betting.functions.getBet(bob_bet_b).call()
    check("PUSH_market_bet_refunded_state", int(bob_bet_b_after[7]) == 1, f"expected Refunded(1), got {int(bob_bet_b_after[7])}")

    suite_after = snapshot()

    lines: List[str] = []
    lines.append("# 2026-06-03 BSC Testnet Cash Out Upgrade Scenario Report")
    lines.append("")
    lines.append("## 环境")
    lines.append(f"- RPC: `{redacted_rpc_url()}`")
    lines.append(f"- chainId: `{CHAIN_ID}`")
    lines.append(f"- admin: `{actors['admin'].address}`")
    lines.append(f"- ODDToken: `{ADDR['ODDToken']}`")
    lines.append(f"- StakingPool: `{ADDR['StakingPool']}`")
    lines.append(f"- LiquidityPool: `{ADDR['LiquidityPool']}`")
    lines.append(f"- BettingPool: `{ADDR['BettingPool']}`")
    lines.append(f"- BettingSettlementModule: `{ADDR['BettingSettlementModule']}`")
    lines.append("")
    lines.append("## 参与账户")
    for name in ["admin", "referrer", "alice", "bob", "carol", "lpUser"]:
        lines.append(f"- `{name}`: `{actors[name].address}`")
    lines.append("")
    lines.append("## 检查结果")
    for name, ok, detail in checks:
        lines.append(f"- [{'PASS' if ok else 'FAIL'}] `{name}`: {detail}")
    if not checks:
        lines.append("- 无显式断言")
    lines.append("")
    if issues:
        lines.append("## 发现的问题")
        for issue in issues:
            lines.append(f"- {issue}")
        lines.append("")
    else:
        lines.append("## 发现的问题")
        lines.append("- 本轮执行未发现新的链上功能性失败。")
        lines.append("")

    lines.append("## 全账户汇总快照（Suite Before / After）")
    lines.append("| 账户 | 地址 | ODD Before | ODD After | BNB Before | BNB After |")
    lines.append("|---|---|---:|---:|---:|---:|")
    for label, addr in TRACKED.items():
        lines.append(
            f"| `{label}` | `{addr}` | `{fmt_odd(suite_before[label]['odd'])}` | `{fmt_odd(suite_after[label]['odd'])}` | `{fmt_bnb(suite_before[label]['bnb'])}` | `{fmt_bnb(suite_after[label]['bnb'])}` |"
        )
    lines.append("")

    lines.append("## 逐交易记录")
    for idx, item in enumerate(results, start=1):
        lines.append(f"### TX-{idx:02d} `{item['label']}`")
        lines.append(f"- sender: `{item['actor']}` / `{item['actor_address']}`")
        lines.append(f"- tx_hash: `{item['tx_hash']}`")
        lines.append(f"- status: `{item['status']}`")
        lines.append(f"- gas_price: `{item['effective_gas_price']}` wei")
        lines.append(f"- gas_used: `{item['gas_used']}`")
        lines.append(f"- tx_fee: `{item['tx_fee']}` wei")
        lines.append("")
        lines.append("#### 账户余额变化")
        lines.append("| 账户 | ODD Before | ODD After | Δ ODD | BNB Before | BNB After | Δ BNB |")
        lines.append("|---|---:|---:|---:|---:|---:|---:|")
        for label, addr in TRACKED.items():
            b = item['before'][label]
            a = item['after'][label]
            lines.append(
                f"| `{label}` | `{fmt_odd(b['odd'])}` | `{fmt_odd(a['odd'])}` | `{fmt_odd(a['odd'] - b['odd'])}` | `{fmt_bnb(b['bnb'])}` | `{fmt_bnb(a['bnb'])}` | `{fmt_bnb(a['bnb'] - b['bnb'])}` |"
            )
        lines.append("")
        lines.append("#### Event Logs")
        if item['logs']:
            for log in item['logs']:
                contract = log.get('contract', 'Unknown')
                address = log.get('address')
                event = log.get('event')
                lines.append(f"- `{contract}` @ `{address}` -> `{event}`")
                args = log.get('args', {})
                if args:
                    for k, v in args.items():
                        lines.append(f"  - `{k}`: `{v}`")
        else:
            lines.append("- 无事件")
        lines.append("")

    DOC_OUT.write_text("\n".join(lines))
    print(f"report written to {DOC_OUT}")


if __name__ == "__main__":
    main()
