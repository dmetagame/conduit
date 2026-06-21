# Conduit — Programmable USDC Settlement Rails on Sui

> An on-chain treasury that holds a stablecoin, settles recurring or one-shot payouts
> autonomously, converts to the payee's preferred asset through **DeepBook** at
> settlement time, and writes a **verifiable receipt to Walrus** for every payment.

*Sui Overflow 2026 submission.*

[![CI](https://github.com/dmetagame/conduit/actions/workflows/ci.yml/badge.svg)](https://github.com/dmetagame/conduit/actions/workflows/ci.yml)
[![Settlement agent](https://github.com/dmetagame/conduit/actions/workflows/conduit-agent.yml/badge.svg)](https://github.com/dmetagame/conduit/actions/workflows/conduit-agent.yml)
[![Live demo](https://img.shields.io/badge/demo-live-2ecc71)](https://conduit-ui-seven.vercel.app)
![Sui](https://img.shields.io/badge/Sui-testnet-6fbcf0)
![Move 2024](https://img.shields.io/badge/Move-2024-4cc2ff)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Walrus](https://img.shields.io/badge/Walrus-receipts-7b61ff)
![DeepBook](https://img.shields.io/badge/DeepBook-v3-4cc2ff)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**🔗 Live demo:** [conduit-ui-seven.vercel.app](https://conduit-ui-seven.vercel.app) · **Repo:** [github.com/dmetagame/conduit](https://github.com/dmetagame/conduit) · network: **Sui testnet** (the landing page shows the latest settled payout live; connect a wallet only to author rules)

**👩‍⚖️ Judges:** start with **[docs/VERIFICATION.md](docs/VERIFICATION.md)** — verify the live settlement + Walrus receipt in 30 seconds, no wallet or install. See also [docs/DEEPBOOK_PROOF.md](docs/DEEPBOOK_PROOF.md) and [SECURITY_NOTES.md](SECURITY_NOTES.md).

---

## The problem

Real-world payouts — payroll, vendor invoices, revenue splits, subscriptions — are
still glued together off-chain: a backend signs transfers, FX happens on a CEX, and the
"audit trail" is a database row nobody can independently verify. Stablecoin rails today
stop at *"send token A to address B"* — no scheduling, no settlement-time FX, no
tamper-evident record.

## What Conduit does

A Move package + autonomous operator that turns a Sui object into a programmable payment
account:

- **Schedules & rules as first-class objects** — each `PaymentRule` (recurring or
  one-shot) is a shared Sui object, not a row in a storage map. Anyone can settle a due
  rule; the treasury never depends on our infra.
- **Settlement-time FX via DeepBook** — if the payee wants a different asset than the
  treasury holds, the payout routes through DeepBook v3's on-chain orderbook atomically
  in the same transaction. No bridge, no CEX leg.
- **Verifiable receipts on Walrus** — every settled payment uploads a signed receipt
  blob to Walrus and emits its blob id on-chain, giving anyone a cryptographic,
  independently retrievable audit trail.
- **Agentic operator** — an off-chain agent discovers due rules from events, uploads the
  receipt, and submits the settlement transaction. It runs as a **serverless GitHub
  Actions cron**, so settlement happens without any machine you babysit.

## Architecture

```
   Owner (browser wallet)                     Operator (agent — serverless cron)
          │                                              │
   create treasury                              poll RuleCreated events
   deposit funds                                read on-chain rule state
   add PaymentRule ───────┐                     if due:  upload receipt → Walrus
          │               │                              call execute_payout ┐
          ▼               ▼                                                   ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  conduit::treasury        (Sui Move package, edition 2024)                 │
   │    Treasury<T>   OwnerCap   PaymentRule        ← shared objects            │
   │    execute_payout<T>                  ─────▶ transfer T to payee           │
   │    settle_deepbook::execute_payout_swapped<Out,T> ─▶ DeepBook v3 FX leg    │
   │    emits PaymentExecuted { rule, payee, amount, walrus_blob_id, ts }       │
   └──────────────────────────────────────────────────────────────────────────┘
          │                          │                           │
          ▼                          ▼                           ▼
    payee receives            DeepBook v3 pool             Walrus blob
    the asset                 (settlement-time FX)      (verifiable receipt)
```

Three components, one repo:

| Path | What it is |
| --- | --- |
| [`sources/`](sources) | Move package — `conduit::treasury` (core) + `conduit::settle_deepbook` (FX leg) |
| [`agent/`](agent) | TypeScript operator — discovers due rules, uploads Walrus receipts, settles |
| [`ui/`](ui) | Vite + dapp-kit owner console — create/fund treasury, author rules, live payments feed |
| [`.github/workflows/conduit-agent.yml`](.github/workflows/conduit-agent.yml) | Serverless cron that runs the operator |

## Live on Sui testnet

Everything below is real and verifiable on testnet — not a mock.

**Stablecoin proof:** a real **Circle USDC** payout settled end-to-end —
`execute_payout<…::usdc::USDC>`, with its own Walrus receipt. The "USDC rails" claim is
proven on-chain, not just intended.

| Thing | Id |
| --- | --- |
| Package (original id) | [`0x1b4c89db…c829433`](https://suiscan.xyz/testnet/object/0x1b4c89db10e2d5a6f97b56796d00de44e9b6dc4d49079547003fb82c1c829433) |
| Latest version (links live DeepBook) | `0x057871e0…8c680eb` |
| **USDC settlement tx** (5 USDC, `execute_payout<USDC>`) | [`22kQEtEw…LHvV`](https://suiscan.xyz/testnet/tx/22kQEtEweY32xJ6cASatBToDoxqwJPaJXUoJhxpmLHvV) |
| **USDC** treasury | [`0x1e1a20c5…36b562`](https://suiscan.xyz/testnet/object/0x1e1a20c5da4deb6c8f21c429cfb711e418c53a8fda04d607f3f18cd31936b562) |
| USDC Walrus receipt blob | [`tuCmC-UUJMolOl3Q_c4WvJ2ceUzBtXalnyNf9VwTXFM`](https://aggregator.walrus-testnet.walrus.space/v1/blobs/tuCmC-UUJMolOl3Q_c4WvJ2ceUzBtXalnyNf9VwTXFM) |
| SUI settlement tx (settled by the cron) | [`74QQyXXw…id5dF`](https://suiscan.xyz/testnet/tx/74QQyXXw9MxfUvhEkex16PPVrJsJ8jRn6zCKsryid5dF) |
| SUI treasury | [`0xb5e08e3e…8534626`](https://suiscan.xyz/testnet/object/0xb5e08e3e8d9cf7fb23ee29179f395b0868cf9957953e42ca0eca87ed68534626) |
| SUI Walrus receipt blob | [`MB7ujHGD-OKW41p3xnNp-PUeaBeYWjbjFy-capSs8KY`](https://aggregator.walrus-testnet.walrus.space/v1/blobs/MB7ujHGD-OKW41p3xnNp-PUeaBeYWjbjFy-capSs8KY) |

Each receipt is a JSON blob (`conduit/receipt@1`) reconstructable with `walrus read <blobId>` —
the actual USDC receipt:

```json
{ "schema": "conduit/receipt@1", "network": "testnet",
  "treasury": "0x1e1a20c5…36b562", "rule": "0x160b9306…ab4b61bf",
  "payee": "0x224a01864a05…01c2b", "amount": "5000000",
  "coinType": "0xa1ec7f…::usdc::USDC",
  "scheduledForMs": 1782030777425, "settledAtMs": 1782030817228 }
```

## Track fit

- **DeFi & Payments (primary)** — programmable stablecoin settlement is the core.
- **Walrus (specialized)** — verifiable receipts are genuine off-chain-data usage:
  on-chain blob id, independently retrievable, tamper-evident.
- **DeepBook (specialized)** — `settle_deepbook::execute_payout_swapped` performs a real
  settlement-time swap through a DeepBook v3 pool. See the note below.
- **Agentic Web (core)** — the operator is the autonomous "watch, act, transact" agent.

### A note on the DeepBook FX leg (honesty matters)

The swap path is implemented and **version-current against live testnet DeepBook v3**:
`execute_payout_swapped<Out,T>` pulls the budgeted amount, swaps treasury asset `T`
(pool quote) → payee asset `Out` (pool base) via `pool::swap_exact_quote_for_base`, pays
fees from the input token (zero `DEEP` coin), refunds the remainder, and transfers the
proceeds — all atomically. It is proven to **execute on-chain** against the live DeepBook
package (`0x22be4c…`).

DeepBook's published package on testnet was upgraded mid-event, disabling the version the
repo's manifest still points to; we vendored DeepBook and pinned its `published-at` to the
current enabled package so the integration compiles and runs against the live pools (see
[`vendor/deepbook`](vendor/deepbook)). A *non-zero* live fill additionally depends on the
testnet pool having resting liquidity, which is outside our control. The same-asset rail
is fully end-to-end proven; the swap is integration-proven.

## Quickstart

### Move package
```bash
sui move build        # compiles against vendored DeepBook + Walrus-less core
sui move test         # 3 tests: one-shot, recurring, not-due-aborts
```

### Agent (operator)
```bash
cd agent
npm install
cp .env.example .env.local   # set CONDUIT_PACKAGE_ID, CONDUIT_TREASURY_ID, SUI_AGENT_SECRET_KEY
npm run agent:once           # one tick: discover → upload receipt → settle
npm run agent                # continuous loop
```

### UI (owner console)
```bash
cd ui
npm install
cp .env.example .env.local   # set VITE_CONDUIT_PACKAGE_ID
npm run dev
```

### Serverless operator
The agent also runs as a GitHub Actions cron
([`.github/workflows/conduit-agent.yml`](.github/workflows/conduit-agent.yml)) — every 5
minutes plus a manual trigger. The only secret is `SUI_AGENT_SECRET_KEY`; the public
package/treasury ids are baked in. Settlement runs with no machine of your own online.

## How it fits together (the demo flow)

1. Owner connects a wallet, creates a `Treasury<T>`, and deposits funds.
2. Owner authors a `PaymentRule` (payee, amount, interval, first-run time). This emits
   `RuleCreated` and shares the rule object.
3. The operator (local or cron) discovers the rule from events, and once it's due:
   uploads a signed JSON receipt to Walrus, then calls `execute_payout`.
4. The payout lands, `PaymentExecuted` fires with the Walrus blob id, and the UI's live
   feed shows the payment with a clickable receipt link.

## Security notes

- The agent signer key lives only in `.env.local` (gitignored) / GitHub Actions secrets —
  never committed. Testnet only.
- Settlement is permissionless by design: anyone can run the operator. We ship a reference
  agent, but the treasury does not depend on it.
