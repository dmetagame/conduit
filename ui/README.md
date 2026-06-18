# Conduit UI

Minimal owner console for the Conduit settlement rails — Vite + React + `@mysten/dapp-kit`.

Covers the demo flow:

1. **Connect** a Sui wallet.
2. **Create** a treasury for an asset `T` (defaults to SUI; paste a USDC type for the real demo).
3. **Deposit** funds (split from gas for SUI, or an owned coin object id for other assets).
4. **Add a payout rule** — payee, amount, interval (0 = one-shot), and first-run delay.
5. **Watch the Payments feed** — live `PaymentExecuted` events, each linking to its **Walrus receipt**.

The off-chain [`agent`](../agent) settles due rules; this UI is the owner's control surface plus the live feed.

## Setup

```bash
cd ui
npm install
cp .env.example .env.local   # set VITE_CONDUIT_PACKAGE_ID after publishing
npm run dev
```

| var | meaning |
| --- | --- |
| `VITE_SUI_NETWORK` | `testnet` (default) or `mainnet` |
| `VITE_CONDUIT_PACKAGE_ID` | published Conduit package id (from `sui client publish`) |

## Commands

- `npm run dev` — local dev server
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + `vite build` to `dist/` (Vercel-deployable static output)

## Notes

- `@mysten/sui` is pinned to `1.36.1` (matched to `@mysten/dapp-kit@0.16`) and forced tree-wide via
  `overrides` — without this, two copies of `@mysten/sui` produce a `#private` Transaction type clash
  when passing a `Transaction` into dapp-kit's `signAndExecuteTransaction`.
- The DeepBook-swap payout path isn't surfaced in this minimal UI; rules settle in the treasury's own
  asset. Adding a "payee asset + pool" field to the rule form is the natural next step.
- Treasury balance reads the raw `Balance<T>` value (base units); no decimal formatting yet.
