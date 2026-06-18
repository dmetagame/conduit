import { loadConfig, type AgentConfig } from './config.js';
import { makeKeypair, makeSuiClient, makeWalrusClient } from './sui.js';
import { discoverRuleIds, isDue, readRule, readTreasuryCoinType } from './rules.js';
import { encodeReceipt } from './receipt.js';
import { settlePayout } from './settle.js';
import type { SuiClient } from '@mysten/sui/client';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { WalrusClient } from '@mysten/walrus';

interface Ctx {
  cfg: AgentConfig;
  sui: SuiClient;
  walrus: WalrusClient;
  keypair: Ed25519Keypair;
  coinType: string;
}

async function tick(ctx: Ctx): Promise<void> {
  const { cfg, sui, walrus, keypair, coinType } = ctx;
  const now = Date.now();
  const ruleIds = await discoverRuleIds(sui, cfg.packageId, cfg.treasuryId);
  console.log(`[tick ${new Date(now).toISOString()}] ${ruleIds.length} rule(s) for treasury`);

  for (const ruleId of ruleIds) {
    const rule = await readRule(sui, ruleId);
    if (!rule) {
      console.log(`  · ${ruleId}: gone, skipping`);
      continue;
    }
    if (!isDue(rule, now)) {
      const when = rule.active ? `due in ${Number(rule.nextRunMs) - now}ms` : 'inactive';
      console.log(`  · ${ruleId}: not due (${when})`);
      continue;
    }

    console.log(`  → ${ruleId}: settling ${rule.amount} to ${rule.payee}`);
    try {
      const receipt = encodeReceipt({
        schema: 'conduit/receipt@1',
        network: cfg.network,
        treasury: cfg.treasuryId,
        rule: ruleId,
        payee: rule.payee,
        amount: rule.amount.toString(),
        coinType,
        scheduledForMs: Number(rule.nextRunMs),
        settledAtMs: now,
      });

      const { blobId } = await walrus.writeBlob({
        blob: receipt,
        deletable: true,
        epochs: cfg.walrusEpochs,
        signer: keypair,
      });
      console.log(`    walrus receipt: ${blobId}`);

      const digest = await settlePayout(sui, keypair, {
        packageId: cfg.packageId,
        treasuryId: cfg.treasuryId,
        ruleId,
        coinType,
        blobId,
      });
      console.log(`    settled: ${digest}`);
    } catch (err) {
      console.error(`    failed to settle ${ruleId}:`, err instanceof Error ? err.message : err);
    }
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const sui = makeSuiClient(cfg.network);
  const walrus = makeWalrusClient(cfg.network, sui);
  const keypair = makeKeypair(cfg);
  const coinType = await readTreasuryCoinType(sui, cfg.treasuryId);

  console.log(`Conduit agent`);
  console.log(`  network : ${cfg.network}`);
  console.log(`  signer  : ${keypair.toSuiAddress()}`);
  console.log(`  treasury: ${cfg.treasuryId}`);
  console.log(`  asset   : ${coinType}`);

  const ctx: Ctx = { cfg, sui, walrus, keypair, coinType };
  const once = process.argv.includes('--once');

  do {
    try {
      await tick(ctx);
    } catch (err) {
      console.error('[tick] error:', err instanceof Error ? err.message : err);
    }
    if (!once) await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
  } while (!once);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
