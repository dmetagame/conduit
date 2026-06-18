/// Conduit — programmable USDC settlement rails on Sui.
///
/// A `Treasury<T>` is a shared, fundable payment account. `PaymentRule`s describe
/// recurring or one-shot payouts. Anyone (the off-chain agent) may call
/// `execute_payout` once a rule is due; each execution emits a `PaymentExecuted`
/// event carrying the Walrus blob id of the signed receipt for that payment.
///
/// The settlement-time DeepBook FX leg (convert treasury asset -> payee asset before
/// transfer) is intentionally out of this MVP module — see `execute_payout` notes.
module conduit::treasury;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::clock::Clock;
use sui::event;

// === Errors ===
const ENotOwner: u64 = 0;
const ERuleNotDue: u64 = 1;
const ERuleInactive: u64 = 2;
const EInsufficientFunds: u64 = 3;

// === Objects ===

/// Shared, fundable payment account holding a balance of asset `T` (e.g. USDC).
public struct Treasury<phantom T> has key {
    id: UID,
    owner: address,
    funds: Balance<T>,
}

/// Owner capability minted at treasury creation; required to author rules.
public struct OwnerCap has key, store {
    id: UID,
    treasury: ID,
}

/// A payout instruction. `interval_ms == 0` means one-shot. Shared so the agent
/// can advance its schedule when it settles the payment.
public struct PaymentRule has key, store {
    id: UID,
    treasury: ID,
    payee: address,
    amount: u64,
    interval_ms: u64,
    next_run_ms: u64,
    active: bool,
}

// === Events ===

/// Emitted on every settled payout. `walrus_blob_id` points at the verifiable
/// receipt blob the agent uploaded before submitting the txn.
public struct PaymentExecuted has copy, drop {
    rule: ID,
    treasury: ID,
    payee: address,
    amount: u64,
    walrus_blob_id: vector<u8>,
    timestamp_ms: u64,
}

/// Emitted when a rule is authored, so the off-chain agent can discover the shared
/// rule object ids to watch without an external index.
public struct RuleCreated has copy, drop {
    rule: ID,
    treasury: ID,
    payee: address,
    amount: u64,
    interval_ms: u64,
    next_run_ms: u64,
}

// === Internal constructors ===

fun new<T>(ctx: &mut TxContext): (Treasury<T>, OwnerCap) {
    let treasury = Treasury<T> {
        id: object::new(ctx),
        owner: ctx.sender(),
        funds: balance::zero<T>(),
    };
    let cap = OwnerCap { id: object::new(ctx), treasury: object::id(&treasury) };
    (treasury, cap)
}

fun build_rule<T>(
    cap: &OwnerCap,
    t: &Treasury<T>,
    payee: address,
    amount: u64,
    interval_ms: u64,
    start_ms: u64,
    ctx: &mut TxContext,
): PaymentRule {
    assert!(cap.treasury == object::id(t), ENotOwner);
    PaymentRule {
        id: object::new(ctx),
        treasury: object::id(t),
        payee,
        amount,
        interval_ms,
        next_run_ms: start_ms,
        active: true,
    }
}

// === Entry API ===

/// Create a shared treasury for asset `T` and send the owner cap to the sender.
public fun create_treasury<T>(ctx: &mut TxContext) {
    let (treasury, cap) = new<T>(ctx);
    transfer::share_object(treasury);
    transfer::public_transfer(cap, ctx.sender());
}

/// Fund the treasury with a coin of its asset type.
public fun deposit<T>(t: &mut Treasury<T>, c: Coin<T>) {
    balance::join(&mut t.funds, c.into_balance());
}

/// Author a payout rule (owner only) and share it for the agent to settle.
#[allow(lint(share_owned))] // rule is freshly built above; sharing is intended
public fun add_rule<T>(
    cap: &OwnerCap,
    t: &Treasury<T>,
    payee: address,
    amount: u64,
    interval_ms: u64,
    start_ms: u64,
    ctx: &mut TxContext,
) {
    let rule = build_rule(cap, t, payee, amount, interval_ms, start_ms, ctx);
    event::emit(RuleCreated {
        rule: object::id(&rule),
        treasury: object::id(t),
        payee,
        amount,
        interval_ms,
        next_run_ms: start_ms,
    });
    transfer::share_object(rule);
}

/// Settle a due payout. Callable by anyone (the agent) once `now >= next_run_ms`.
/// The agent uploads the receipt to Walrus first and passes its `walrus_blob_id`.
///
/// MVP pays in the treasury's own asset. The DeepBook FX leg would slot in here:
/// take `amount` of `T`, swap to the payee's desired asset via a DeepBook pool,
/// then transfer the proceeds — keeping settlement atomic in one txn.
public fun execute_payout<T>(
    t: &mut Treasury<T>,
    rule: &mut PaymentRule,
    walrus_blob_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let paid = withdraw_for_settlement(t, rule, clock, ctx);
    let amount = paid.value();
    let payee = rule.payee;
    transfer::public_transfer(paid, payee);
    record_settlement(t, rule, payee, amount, walrus_blob_id, clock);
}

// === Settlement core (shared with conduit::settle_deepbook) ===

/// Validate a due rule and take its budgeted amount out of the treasury. Does not
/// advance the schedule — call `record_settlement` once the payout actually lands.
public(package) fun withdraw_for_settlement<T>(
    t: &mut Treasury<T>,
    rule: &PaymentRule,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(rule.treasury == object::id(t), ENotOwner);
    assert!(rule.active, ERuleInactive);
    assert!(clock.timestamp_ms() >= rule.next_run_ms, ERuleNotDue);
    assert!(t.funds.value() >= rule.amount, EInsufficientFunds);
    coin::take(&mut t.funds, rule.amount, ctx)
}

/// Return unspent funds (e.g. swap leftover) to the treasury.
public(package) fun refund<T>(t: &mut Treasury<T>, c: Coin<T>) {
    balance::join(&mut t.funds, c.into_balance());
}

public(package) fun rule_payee(rule: &PaymentRule): address { rule.payee }

/// Emit the receipt event and advance (or deactivate) the rule's schedule.
public(package) fun record_settlement<T>(
    t: &Treasury<T>,
    rule: &mut PaymentRule,
    payee: address,
    amount: u64,
    walrus_blob_id: vector<u8>,
    clock: &Clock,
) {
    let now = clock.timestamp_ms();
    event::emit(PaymentExecuted {
        rule: object::id(rule),
        treasury: object::id(t),
        payee,
        amount,
        walrus_blob_id,
        timestamp_ms: now,
    });
    if (rule.interval_ms == 0) {
        rule.active = false;
    } else {
        rule.next_run_ms = now + rule.interval_ms;
    };
}

// === Views ===

public fun balance<T>(t: &Treasury<T>): u64 { t.funds.value() }

public fun is_active(rule: &PaymentRule): bool { rule.active }

public fun next_run_ms(rule: &PaymentRule): u64 { rule.next_run_ms }

// === Test-only helpers ===

#[test_only]
public fun new_for_testing<T>(ctx: &mut TxContext): (Treasury<T>, OwnerCap) {
    new<T>(ctx)
}

#[test_only]
public fun new_rule_for_testing<T>(
    cap: &OwnerCap,
    t: &Treasury<T>,
    payee: address,
    amount: u64,
    interval_ms: u64,
    start_ms: u64,
    ctx: &mut TxContext,
): PaymentRule {
    build_rule(cap, t, payee, amount, interval_ms, start_ms, ctx)
}
