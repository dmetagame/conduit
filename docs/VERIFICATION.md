# Verification — Judge Quickstart

Everything below is real on **Sui testnet** and independently checkable. You do **not**
need a wallet or a local setup to verify the core claim: a real payment settled and its
receipt is on Walrus.

## 1. Verify in 30 seconds (no install)

- **Live app:** https://conduit-ui-seven.vercel.app/ — the landing page shows the
  **latest settled payout** (amount, payee, tx, Walrus receipt) live from chain, before
  any wallet connect.
- **USDC settlement tx** (5 Circle USDC, `execute_payout<…::usdc::USDC>`):
  https://suiscan.xyz/testnet/tx/22kQEtEweY32xJ6cASatBToDoxqwJPaJXUoJhxpmLHvV
- **USDC Walrus receipt blob:**
  https://aggregator.walrus-testnet.walrus.space/v1/blobs/tuCmC-UUJMolOl3Q_c4WvJ2ceUzBtXalnyNf9VwTXFM
- **SUI settlement tx** (settled by the cron):
  https://suiscan.xyz/testnet/tx/74QQyXXw9MxfUvhEkex16PPVrJsJ8jRn6zCKsryid5dF
- **SUI Walrus receipt blob:**
  https://aggregator.walrus-testnet.walrus.space/v1/blobs/MB7ujHGD-OKW41p3xnNp-PUeaBeYWjbjFy-capSs8KY

The Sui tx emits a `PaymentExecuted` event carrying the Walrus blob id; the blob
reconstructs the full payment record. That link between an on-chain event and an
off-chain, independently retrievable receipt is the heart of the project.

## 2. On-chain ids

| Thing | Id |
| --- | --- |
| Package — original id (type identity) | `0x1b4c89db10e2d5a6f97b56796d00de44e9b6dc4d49079547003fb82c1c829433` |
| Package — latest version (links live DeepBook) | `0x057871e0da3751c3d328e17cd7ee7291f28742aa81a55c771e117561a8c680eb` |
| Treasury (USDC) | `0x1e1a20c5da4deb6c8f21c429cfb711e418c53a8fda04d607f3f18cd31936b562` |
| Treasury (SUI) | `0xb5e08e3e8d9cf7fb23ee29179f395b0868cf9957953e42ca0eca87ed68534626` |
| UpgradeCap | `0xde364918bc64877b6cc92d19d32c8df2a66456516c6cbb0a881a55940315e556` |

## 3. Reproduce locally

```bash
# Move package — compiles against vendored DeepBook; runs the unit tests
sui move build
sui move test            # 3 tests: one-shot, recurring, not-due-aborts

# Agent (operator)
cd agent && npm ci && npm run typecheck && npm run build

# UI (owner console)
cd ../ui && npm ci && npm run build
```

Expected Move test output:

```text
[ PASS ] conduit::treasury_tests::test_one_shot_payout
[ PASS ] conduit::treasury_tests::test_payout_before_due_aborts
[ PASS ] conduit::treasury_tests::test_recurring_advances_schedule
Test result: OK. Total tests: 3; passed: 3; failed: 0
```

## 4. Read a receipt yourself

```bash
walrus read tuCmC-UUJMolOl3Q_c4WvJ2ceUzBtXalnyNf9VwTXFM
# or just open the aggregator URL above
```

The receipt is a JSON blob (`conduit/receipt@1`) — the actual USDC settlement:

```json
{ "schema": "conduit/receipt@1", "network": "testnet",
  "treasury": "0x1e1a20c5…36b562", "rule": "0x160b9306…ab4b61bf",
  "payee": "0x224a01864a05…01c2b", "amount": "5000000",
  "coinType": "0xa1ec7f…::usdc::USDC",
  "scheduledForMs": 1782030777425, "settledAtMs": 1782030817228 }
```

## 5. Always-on settlement

The reference operator runs as a **GitHub Actions cron**
([`.github/workflows/conduit-agent.yml`](../.github/workflows/conduit-agent.yml)) every 5
minutes, plus a manual trigger. The only secret is the signer key; the package/treasury
ids are public. Settlement happens with no machine of your own online — check the Actions
tab for green runs.

See also: [DEEPBOOK_PROOF.md](DEEPBOOK_PROOF.md) for the settlement-time FX leg, and
[../SECURITY_NOTES.md](../SECURITY_NOTES.md) for the dependency-advisory disclosure.
