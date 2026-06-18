import { useSuiClientQuery } from '@mysten/dapp-kit';
import { PACKAGE_ID, walrusReceiptUrl } from '../config';
import { decodeBlobId, shortId } from '../lib/conduit';

interface PaymentExecuted {
  payee: string;
  amount: string;
  // Sui renders a Move `vector<u8>` as a base64 string in parsedJson.
  walrus_blob_id: string | number[];
  timestamp_ms: string;
}

export function PaymentsFeed() {
  const events = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::treasury::PaymentExecuted` },
      limit: 25,
      order: 'descending',
    },
    { enabled: !!PACKAGE_ID, refetchInterval: 5000 },
  );

  return (
    <section>
      <h2>Payments</h2>
      {events.isPending && <p className="muted">Loading…</p>}
      {events.data?.data.length === 0 && <p className="muted">No payouts settled yet.</p>}
      <ul className="feed">
        {events.data?.data.map((e, i) => {
          const f = e.parsedJson as PaymentExecuted;
          const blobId = decodeBlobId(f.walrus_blob_id ?? '');
          const when = new Date(Number(f.timestamp_ms)).toLocaleString();
          return (
            <li key={`${e.id.txDigest}:${i}`}>
              <span>
                <strong>{f.amount}</strong> → <span className="mono">{shortId(f.payee)}</span>
              </span>
              <span className="muted">{when}</span>
              <a href={walrusReceiptUrl(blobId)} target="_blank" rel="noreferrer">
                receipt ↗
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
