# OddFi — On-chain Sports Prediction Market on BNB Chain

> 基于 BNB Smart Chain 的链上体育预测市场 · 为 2026 世界杯打造

**Live overview:** https://oddfi-io.github.io/oddfi/

OddFi is a full-stack sports prediction market: users connect a wallet, bet on football
markets (1X2 / Asian Handicap / Over-Under / parlays), and funds are custodied and settled
by smart contracts on BSC. This repository is the open-source archive of the complete
system — smart contracts, Go SDKs, backend services, web apps, the admin console, and an
AI agent — published after the project stopped operating.

## Highlights

| Area | What's inside |
|---|---|
| Smart contracts | `ODDToken`, `StakingPool`, `LiquidityPool`, `BettingPool`, `BettingSettlementModule` (delegatecall), UUPS upgradeable, Gnosis Safe multisig settlement, Foundry tests |
| Token economics | Clean BEP-20 (100M fixed supply, zero transfer tax); application-layer fees: 1% bet fee + 5% payout fee split across stakers / buffer / treasury / referrer |
| Risk engine | Traffic-light market limits, per-match payout cap, VIP tiers driven by effective stake, open-interest limits tied to stake |
| Backend (Go) | Wallet login + JWT, balances, betting, cash-out, withdrawals, presale, referrals, odds spider (SportMonks), settlement worker, chain indexer/crawler, cron jobs |
| Signing | `magic-signer` — TEE-backed signing service; EIP-7702 sponsored (gasless) user transactions via the business layer |
| Web | Next.js 15 + React 19 + wagmi/viem, real-time odds over WebSocket, i18n |
| Admin | React 19 + Vite + Refine + Ant Design, Lark SSO, 4-role RBAC, audit log |
| AI agent | TypeScript agent with memory, user tagging and personalized push; tweet → LLM → market card pipeline |

~14k lines Solidity · ~240k lines Go · ~180k lines TypeScript · 600+ test files

## Repository layout

```
contracts/
  odd-token-edition/     ODD token edition (main) — Foundry
  usdt-edition/          Earlier USDT-settled edition — Foundry
sdk/
  odd-sdk-go/            Go bindings + client for the ODD edition contracts
  contracts-sdk-go/      Go SDK for the USDT edition (signer / multisig / reader)
  business-layer-go/     admin / relay (gasless) / read packages on top of the SDK
apps/
  web/                   User-facing app (Next.js)
  admin-web/             Operations console (React + Refine)
  agent-web/             Agent push panel (Next.js)
services/
  backend/               web-api, odds spider, market api, odds engine (Go monorepo)
  bet-settle/            Settlement engine
  chain-consumer/        On-chain event consumer / indexer
  chain-crawler/         Multi-chain block crawler
  cron-job/              Scheduled jobs
  magic-signer/          TEE signing service + Go client
  admin-api/             Admin backend (Lark OAuth, RBAC)
  agent-api/             Agent backend (tweet ingest → LLM parse → push cards)
agent/
  odd-agent/             AI agent runtime (foundation / memory / user-tag)
```

Each sub-project keeps its own README and `docs/` (architecture, ADRs, test reports).

## Getting started

Each module builds on its own. Typical entry points:

```bash
# Contracts (Foundry). Dependencies were git submodules; reinstall them:
cd contracts/odd-token-edition
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts \
  OpenZeppelin/openzeppelin-contracts-upgradeable transmissions11/solmate --no-git
forge test

# Web app
cd apps/web && pnpm install && pnpm dev

# Go services — copy the example config first
cd services/backend/web-api && go run ./cmd/...
```

Notes:
- Go modules keep their original import paths (`github.com/Crypto-Barrett/<repo>`); this
  archive merges 17 repositories, so cross-module builds may need `replace` directives.
- All credentials, server addresses and environment configs have been removed. Placeholders
  like `<DB_PASSWORD>` or `<SERVER_IP>` mark where they used to be.

## Status

The project is **no longer operated**. Contracts were deployed to BSC testnet during
development; nothing here should be treated as audited production code. See
[DISCLAIMER.md](DISCLAIMER.md).

## License

[MIT](LICENSE)
