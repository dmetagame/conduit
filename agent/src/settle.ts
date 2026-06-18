import type { SuiClient } from '@mysten/sui/client';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';

export interface SettleOpts {
  packageId: string;
  treasuryId: string;
  ruleId: string;
  /** treasury asset type T */
  coinType: string;
  /** Walrus blob id of the receipt, stored on-chain as bytes */
  blobId: string;
}

/**
 * Settle a due payout in the treasury's own asset by calling
 * `conduit::treasury::execute_payout<T>`. The DeepBook-swap variant would instead
 * target `conduit::settle_deepbook::execute_payout_swapped<Out, T>` and also pass
 * the pool object and a min_out — see README.
 */
export async function settlePayout(
  client: SuiClient,
  keypair: Ed25519Keypair,
  opts: SettleOpts,
): Promise<string> {
  const tx = new Transaction();
  const blobBytes = Array.from(new TextEncoder().encode(opts.blobId));

  tx.moveCall({
    target: `${opts.packageId}::treasury::execute_payout`,
    typeArguments: [opts.coinType],
    arguments: [
      tx.object(opts.treasuryId),
      tx.object(opts.ruleId),
      tx.pure.vector('u8', blobBytes),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  const res = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });

  const status = res.effects?.status?.status;
  if (status !== 'success') {
    throw new Error(`Settlement tx ${res.digest} failed: ${res.effects?.status?.error ?? status}`);
  }
  return res.digest;
}
