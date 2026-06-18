import type { SuiClient } from '@mysten/sui/client';
import { normalizeSuiObjectId } from '@mysten/sui/utils';

export interface RuleState {
  id: string;
  treasury: string;
  payee: string;
  amount: bigint;
  intervalMs: bigint;
  nextRunMs: bigint;
  active: boolean;
}

/** Read the treasury's coin type T from its object type, e.g. `0x..::usdc::USDC`. */
export async function readTreasuryCoinType(client: SuiClient, treasuryId: string): Promise<string> {
  const obj = await client.getObject({ id: treasuryId, options: { showType: true } });
  const type = obj.data?.type;
  if (!type) throw new Error(`Treasury ${treasuryId} not found (no type)`);
  const m = type.match(/<(.+)>$/);
  if (!m) throw new Error(`Could not parse coin type from treasury type: ${type}`);
  return m[1] as string;
}

/** Discover every PaymentRule shared object created for this treasury via RuleCreated events. */
export async function discoverRuleIds(
  client: SuiClient,
  packageId: string,
  treasuryId: string,
): Promise<string[]> {
  const target = normalizeSuiObjectId(treasuryId);
  const ids = new Set<string>();
  let cursor: { txDigest: string; eventSeq: string } | null = null;

  for (;;) {
    const page = await client.queryEvents({
      query: { MoveEventType: `${packageId}::treasury::RuleCreated` },
      cursor,
      limit: 50,
    });
    for (const e of page.data) {
      const f = e.parsedJson as { rule?: string; treasury?: string } | undefined;
      if (f?.rule && f.treasury && normalizeSuiObjectId(f.treasury) === target) {
        ids.add(normalizeSuiObjectId(f.rule));
      }
    }
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return [...ids];
}

/** Fetch the current on-chain state of a PaymentRule. Returns null if it's gone. */
export async function readRule(client: SuiClient, ruleId: string): Promise<RuleState | null> {
  const obj = await client.getObject({ id: ruleId, options: { showContent: true } });
  const content = obj.data?.content;
  if (!content || content.dataType !== 'moveObject') return null;
  const f = content.fields as Record<string, unknown>;
  return {
    id: ruleId,
    treasury: String(f.treasury),
    payee: String(f.payee),
    amount: BigInt(String(f.amount)),
    intervalMs: BigInt(String(f.interval_ms)),
    nextRunMs: BigInt(String(f.next_run_ms)),
    active: Boolean(f.active),
  };
}

export function isDue(rule: RuleState, nowMs: number): boolean {
  return rule.active && rule.nextRunMs <= BigInt(nowMs);
}
