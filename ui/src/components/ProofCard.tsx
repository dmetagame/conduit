import { useRef } from 'react';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { PACKAGE_ID, suiscanTxUrl, walrusReceiptUrl } from '../config';
import {
  coinTypeFromTreasuryType,
  decodeBlobId,
  formatAmount,
  shortId,
  symbolFromCoinType,
} from '../lib/conduit';
import { DUR, EASE } from '../lib/animations';

interface PaymentExecuted {
  treasury: string;
  payee: string;
  amount: string;
  // Sui renders a Move `vector<u8>` as a base64 string in parsedJson.
  walrus_blob_id: string | number[];
  timestamp_ms: string;
}

/**
 * Public, wallet-free proof of the most recent real settlement: amount, payee,
 * on-chain tx, and the verifiable Walrus receipt. Reads the latest
 * `PaymentExecuted` event live, then resolves the treasury's coin type and its
 * metadata so the amount renders with the right symbol and decimals.
 */
export function ProofCard() {
  const root = useRef<HTMLDivElement>(null);

  const events = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::treasury::PaymentExecuted` },
      limit: 1,
      order: 'descending',
    },
    { enabled: !!PACKAGE_ID, refetchInterval: 15000 },
  );

  const ev = events.data?.data[0];
  const f = ev?.parsedJson as PaymentExecuted | undefined;

  // Resolve the treasury's coin type, then its metadata (decimals + symbol).
  const treasury = useSuiClientQuery(
    'getObject',
    { id: f?.treasury ?? '', options: { showType: true } },
    { enabled: !!f?.treasury },
  );
  const coinType = treasury.data?.data?.type
    ? coinTypeFromTreasuryType(treasury.data.data.type)
    : null;

  const meta = useSuiClientQuery(
    'getCoinMetadata',
    { coinType: coinType ?? '' },
    { enabled: !!coinType },
  );

  useGSAP(
    () => {
      if (!f) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(root.current, { y: 16, opacity: 0, duration: DUR.base, ease: EASE });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [!!f] },
  );

  if (!PACKAGE_ID || (events.isPending && !ev)) return null;
  if (!f) return null;

  const decimals = meta.data?.decimals ?? (coinType ? 0 : 0);
  const symbol = meta.data?.symbol ?? (coinType ? symbolFromCoinType(coinType) : '');
  const amount = formatAmount(f.amount, decimals);
  const blobId = decodeBlobId(f.walrus_blob_id ?? '');
  const when = new Date(Number(f.timestamp_ms)).toLocaleString();
  const digest = ev?.id.txDigest;

  return (
    <div className="proof-card" ref={root}>
      <div className="proof-card__label">
        <span className="dot dot--live" /> Latest settlement · live on-chain
      </div>
      <div className="proof-card__amount mono">
        {amount} <span className="proof-card__sym">{symbol}</span>
      </div>
      <div className="proof-card__meta">
        <span>
          to <span className="mono">{shortId(f.payee)}</span>
        </span>
        <span className="muted">{when}</span>
      </div>
      <div className="proof-card__links">
        {digest && (
          <a className="proof-link" href={suiscanTxUrl(digest)} target="_blank" rel="noreferrer">
            Open Sui tx ↗
          </a>
        )}
        {blobId && (
          <a
            className="proof-link"
            href={walrusReceiptUrl(blobId)}
            target="_blank"
            rel="noreferrer"
          >
            Open Walrus receipt ↗
          </a>
        )}
      </div>
    </div>
  );
}
