# Conduit Agent

Off-chain operator for the Conduit settlement rails. Each tick it:

1. **Discovers** every `PaymentRule` for a treasury via `RuleCreated` events (no indexer needed).
2. **Checks** each rule's on-chain state and skips any that aren't due (`active && now >= next_run_ms`).
3. **Uploads** a signed JSON receipt to **Walrus** and gets back a `blobId`.
4. **Settles** the payout on Sui by calling `conduit::treasury::execute_payout<T>`, recording the Walrus `blobId` on-chain in the `PaymentExecuted` event.

## Setup

```bash
cd agent
npm install
cp .env.example .env.local   # .env.local is gitignored — keep the key here
```

Fill in `.env.local`:

| var | meaning |
| --- | --- |
| `SUI_NETWORK` | `testnet` (default) or `mainnet` |
| `CONDUIT_PACKAGE_ID` | published Conduit package id (from `sui client publish`) |
| `CONDUIT_TREASURY_ID` | the shared `Treasury` object to operate; coin type `T` is read from it |
| `SUI_AGENT_SECRET_KEY` | agent signer, `suiprivkey1...` (or use `SUI_AGENT_MNEMONIC`) |
| `WALRUS_EPOCHS` | how long to store receipts (default 3) |
| `POLL_INTERVAL_SECONDS` | loop cadence (default 30) |

> **Key handling:** the signer key lives only in `.env.local` (gitignored). Never commit it,
> never paste it into chat. Fund only a **testnet** address for development.

## Run

```bash
npm run agent:once   # single pass — settle whatever is due now, then exit
npm run agent        # continuous loop at POLL_INTERVAL_SECONDS
```

## Commands

- `npm run typecheck` — type-check without emitting
- `npm run build` — compile to `dist/`
- `npm run agent` / `npm run agent:once` — run via `tsx`

## DeepBook swap variant

`src/settle.ts` targets the same-asset `execute_payout`. To pay a payee in a **different**
asset, point the move call at `conduit::settle_deepbook::execute_payout_swapped<Out, T>` and
add two arguments: the DeepBook `Pool<Out, T>` object (`tx.object(poolId)`) and a `min_out`
slippage floor (`tx.pure.u64(...)`). `Out` is the payee's asset, `T` the treasury's. Fees are
paid from the input token, so the treasury needs no DEEP.

## Notes / known gaps

- The settle path is verified end-to-end only against a **published** package on a live
  network; set the env vars after `sui client publish`, then `npm run agent:once`.
- `npm audit` reports a transitive `valibot` advisory inside the Mysten SDK chain
  (`@mysten/sui`/`@mysten/walrus`). `audit fix --force` breaks the pinned sui/walrus version
  alignment, so it's left as-is; low impact for a self-signing CLI.
- `@mysten/sui` is pinned to `1.37.6` (matched to `@mysten/walrus@0.6.7`) and forced tree-wide
  via `overrides` to avoid a dual-copy type clash.
