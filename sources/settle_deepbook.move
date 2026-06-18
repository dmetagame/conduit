/// Settlement-time FX for Conduit payouts via DeepBook v3.
///
/// `execute_payout_swapped` settles a due rule by converting the treasury's asset
/// `T` into the payee's desired asset `Out` through a DeepBook pool, atomically, in
/// the same transaction. The treasury asset is the pool's QUOTE and the payee asset
/// is the BASE, so we call `deepbook::pool::swap_exact_quote_for_base`.
///
/// Fees are paid from the input token (we pass a zero-value DEEP coin), so a Conduit
/// treasury never needs to hold DEEP. Any unspent quote is returned to the treasury.
module conduit::settle_deepbook;

use conduit::treasury::{Self, Treasury, PaymentRule};
use deepbook::pool::{Self, Pool};
use sui::clock::Clock;
use sui::coin;
use token::deep::DEEP;

/// Settle a due payout in the payee's preferred asset `Out`, sourcing it by swapping
/// `rule.amount` of the treasury asset `T` on `pool`. `min_out` is the slippage floor
/// (minimum `Out` the payee must receive) and `walrus_blob_id` is the receipt blob the
/// agent uploaded before submitting.
public fun execute_payout_swapped<Out, T>(
    t: &mut Treasury<T>,
    rule: &mut PaymentRule,
    pool: &mut Pool<Out, T>,
    min_out: u64,
    walrus_blob_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Pull the budgeted quote amount out of the treasury (validates rule + funds).
    let quote_in = treasury::withdraw_for_settlement(t, rule, clock, ctx);

    // Swap quote (treasury asset T) -> base (payee asset Out), fees in input token.
    let (base_out, quote_leftover, deep_leftover) = pool::swap_exact_quote_for_base<Out, T>(
        pool,
        quote_in,
        coin::zero<DEEP>(ctx),
        min_out,
        clock,
        ctx,
    );

    // Unspent quote goes back to the treasury; the untouched DEEP coin is zero.
    treasury::refund(t, quote_leftover);
    deep_leftover.destroy_zero();

    let paid = base_out.value();
    let payee = treasury::rule_payee(rule);
    transfer::public_transfer(base_out, payee);

    // Record the settlement (emits PaymentExecuted, advances/deactivates the rule).
    treasury::record_settlement(t, rule, payee, paid, walrus_blob_id, clock);
}
