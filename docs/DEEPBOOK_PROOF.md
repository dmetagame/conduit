# DeepBook settlement-time FX — proof & honest limitations

Conduit can settle a payout in an asset the treasury **doesn't hold** by swapping through
DeepBook v3 atomically, in the same transaction as the settlement. This documents exactly
what is proven, what isn't, and why.

## What the code does

[`conduit::settle_deepbook::execute_payout_swapped<Out, T>`](../sources/settle_deepbook.move):

1. Pulls the budgeted `rule.amount` of treasury asset `T` (validates the rule is due and
   funded — same guard as the same-asset path).
2. Swaps quote (`T`) → base (`Out`) via `deepbook::pool::swap_exact_quote_for_base`, with a
   caller-supplied `min_out` slippage floor.
3. Pays DeepBook fees **from the input token** (passes a zero-value `DEEP` coin) so a
   Conduit treasury never has to hold `DEEP`.
4. Refunds unspent quote back to the treasury, transfers the `Out` proceeds to the payee,
   then emits `PaymentExecuted` and advances/deactivates the rule.

All atomic: if the swap can't meet `min_out`, the whole settlement reverts.

## What is proven

- **The module compiles and links against the *live* testnet DeepBook package.** DeepBook's
  published package on testnet was upgraded mid-event, disabling the version this repo's
  manifest originally pointed at (calls aborted with `EPackageVersionDisabled`). We vendored
  DeepBook and pinned its `published-at` to the currently-enabled package, then upgraded
  Conduit so the integration builds and dispatches against live pools.

| Thing | Id |
| --- | --- |
| Live DeepBook package (`published-at`) | `0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c` |
| DeepBook package original id | `0xfb28c4cbc6865bd1c897d26aecbe1f8792d1509a20ffec692c800660cbec6982` |
| Conduit package, DeepBook-linked version | `0x057871e0da3751c3d328e17cd7ee7291f28742aa81a55c771e117561a8c680eb` |
| Target pool — `DEEP_SUI` (base DEEP / quote SUI) | `0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f` |

  In this configuration a SUI treasury (`T = SUI`, the pool quote) pays a payee in DEEP
  (`Out = DEEP`, the pool base).

- **The swap path dispatches on-chain** against that live package — the version gate that
  previously aborted is cleared.

## The honest limitation

A **non-zero fill** additionally requires the DeepBook testnet pool to have **resting ask
liquidity** at the moment of settlement. The `DEEP_SUI` testnet pool was repeatedly empty
on the ask side during testing, so a market `swap_exact_quote_for_base` returns zero base —
not a code fault, but a property of the shared testnet pool we don't control. Seeding both
sides of a testnet orderbook to force a fill was out of scope for the submission window.

So, precisely:

- Same-asset settlement (`execute_payout<T>`) — **end-to-end proven** on-chain, with a live
  tx and Walrus receipt (see [VERIFICATION.md](VERIFICATION.md)).
- DeepBook-swapped settlement (`execute_payout_swapped<Out,T>`) — **integration-proven**:
  builds and dispatches against the live DeepBook package; a non-zero settlement fill is
  gated only by testnet pool liquidity.

We deliberately do **not** claim a non-zero live swap fill we can't reproduce on demand.
