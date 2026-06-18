#[test_only]
module conduit::treasury_tests;

use conduit::treasury;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use std::unit_test::destroy;

const PAYEE: address = @0xB0B;

#[test]
fun test_one_shot_payout() {
    let mut ctx = tx_context::dummy();

    let (mut t, cap) = treasury::new_for_testing<SUI>(&mut ctx);
    treasury::deposit(&mut t, coin::mint_for_testing<SUI>(1_000, &mut ctx));

    // one-shot rule (interval 0), due from t=0
    let mut rule = treasury::new_rule_for_testing(&cap, &t, PAYEE, 100, 0, 0, &mut ctx);

    let mut c = clock::create_for_testing(&mut ctx);
    c.set_for_testing(5);

    treasury::execute_payout(&mut t, &mut rule, b"walrus-blob-1", &c, &mut ctx);

    assert!(treasury::balance(&t) == 900, 0);
    assert!(!treasury::is_active(&rule), 1); // one-shot deactivates

    c.destroy_for_testing();
    destroy(t);
    destroy(cap);
    destroy(rule);
}

#[test]
fun test_recurring_advances_schedule() {
    let mut ctx = tx_context::dummy();

    let (mut t, cap) = treasury::new_for_testing<SUI>(&mut ctx);
    treasury::deposit(&mut t, coin::mint_for_testing<SUI>(1_000, &mut ctx));

    // recurring every 1000ms, first due at 0
    let mut rule = treasury::new_rule_for_testing(&cap, &t, PAYEE, 250, 1_000, 0, &mut ctx);

    let mut c = clock::create_for_testing(&mut ctx);
    c.set_for_testing(10);

    treasury::execute_payout(&mut t, &mut rule, b"r1", &c, &mut ctx);

    assert!(treasury::balance(&t) == 750, 0);
    assert!(treasury::is_active(&rule), 1);                 // stays active
    assert!(treasury::next_run_ms(&rule) == 1_010, 2);      // now + interval

    c.destroy_for_testing();
    destroy(t);
    destroy(cap);
    destroy(rule);
}

#[test]
#[expected_failure(abort_code = conduit::treasury::ERuleNotDue)]
fun test_payout_before_due_aborts() {
    let mut ctx = tx_context::dummy();

    let (mut t, cap) = treasury::new_for_testing<SUI>(&mut ctx);
    treasury::deposit(&mut t, coin::mint_for_testing<SUI>(1_000, &mut ctx));

    // not due until t=5_000
    let mut rule = treasury::new_rule_for_testing(&cap, &t, PAYEE, 100, 0, 5_000, &mut ctx);

    let mut c = clock::create_for_testing(&mut ctx);
    c.set_for_testing(10); // too early

    treasury::execute_payout(&mut t, &mut rule, b"early", &c, &mut ctx);

    // unreachable
    c.destroy_for_testing();
    destroy(t);
    destroy(cap);
    destroy(rule);
}
