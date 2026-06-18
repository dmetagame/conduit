/// The verifiable receipt the agent stores on Walrus before settling. Its Walrus
/// blob id is recorded on-chain in the PaymentExecuted event, so anyone can fetch
/// and independently verify the record.
export interface Receipt {
  schema: 'conduit/receipt@1';
  network: string;
  treasury: string;
  rule: string;
  payee: string;
  /** amount in base units of the treasury asset T */
  amount: string;
  coinType: string;
  scheduledForMs: number;
  settledAtMs: number;
}

export function encodeReceipt(r: Receipt): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(r, null, 2));
}
