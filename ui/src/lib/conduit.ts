import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG } from '@mysten/sui/utils';

/** `create_treasury<T>()` — creates a shared treasury and sends the OwnerCap to the sender. */
export function createTreasuryTx(pkg: string, coinType: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::treasury::create_treasury`,
    typeArguments: [coinType],
    arguments: [],
  });
  return tx;
}

/** `deposit<T>()` — split `amount` (from gas for SUI, else from `coinId`) and deposit it. */
export function depositTx(
  pkg: string,
  coinType: string,
  a: { treasury: string; amount: bigint; coinId?: string },
): Transaction {
  const tx = new Transaction();
  const isSui = coinType === SUI_TYPE_ARG || coinType === '0x2::sui::SUI';
  if (!isSui && !a.coinId) {
    throw new Error('Depositing a non-SUI asset requires an owned coin object id');
  }
  const source = isSui ? tx.gas : tx.object(a.coinId as string);
  const [coin] = tx.splitCoins(source, [tx.pure.u64(a.amount)]);
  tx.moveCall({
    target: `${pkg}::treasury::deposit`,
    typeArguments: [coinType],
    arguments: [tx.object(a.treasury), coin],
  });
  return tx;
}

/** `add_rule<T>()` — author a payout rule (owner only) and share it for the agent. */
export function addRuleTx(
  pkg: string,
  coinType: string,
  a: { cap: string; treasury: string; payee: string; amount: bigint; intervalMs: bigint; startMs: bigint },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::treasury::add_rule`,
    typeArguments: [coinType],
    arguments: [
      tx.object(a.cap),
      tx.object(a.treasury),
      tx.pure.address(a.payee),
      tx.pure.u64(a.amount),
      tx.pure.u64(a.intervalMs),
      tx.pure.u64(a.startMs),
    ],
  });
  return tx;
}

/**
 * Recover the Walrus blob id from a PaymentExecuted event. The on-chain value is the
 * UTF-8 bytes of the blob id; Sui's `parsedJson` renders a `vector<u8>` as a base64
 * string (not a number[]), so handle both shapes.
 */
export function decodeBlobId(value: string | number[]): string {
  const bytes =
    typeof value === 'string'
      ? Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
      : Uint8Array.from(value);
  return new TextDecoder().decode(bytes);
}

/** Parse the coin type `T` out of a `...::treasury::Treasury<T>` type string. */
export function coinTypeFromTreasuryType(type: string): string | null {
  const m = type.match(/<(.+)>$/);
  return m ? (m[1] as string) : null;
}

export function shortId(id: string, n = 6): string {
  return id.length > 2 * n + 2 ? `${id.slice(0, n + 2)}…${id.slice(-n)}` : id;
}
