import { useRef } from 'react';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { PACKAGE_ID, walrusReceiptUrl } from '../config';
import {
  coinTypeFromTreasuryType,
  decodeBlobId,
  formatAmount,
  shortId,
  symbolFromCoinType,
} from '../lib/conduit';
import { DUR, EASE } from '../lib/animations';

gsap.registerPlugin(ScrollTrigger);

interface PaymentExecuted {
  treasury: string;
  payee: string;
  amount: string;
  // Sui renders a Move `vector<u8>` as a base64 string in parsedJson.
  walrus_blob_id: string | number[];
  timestamp_ms: string;
}

/** One settlement row. Resolves its treasury's coin metadata so the amount renders with decimals. */
function FeedRow({ rowid, f }: { rowid: string; f: PaymentExecuted }) {
  const treasury = useSuiClientQuery(
    'getObject',
    { id: f.treasury, options: { showType: true } },
    { enabled: !!f.treasury },
  );
  const coinType = treasury.data?.data?.type
    ? coinTypeFromTreasuryType(treasury.data.data.type)
    : null;
  const meta = useSuiClientQuery('getCoinMetadata', { coinType: coinType ?? '' }, { enabled: !!coinType });

  const decimals = meta.data?.decimals ?? 0;
  const symbol = meta.data?.symbol ?? (coinType ? symbolFromCoinType(coinType) : '');
  const amount = formatAmount(f.amount, decimals);
  const blobId = decodeBlobId(f.walrus_blob_id ?? '');
  const when = new Date(Number(f.timestamp_ms)).toLocaleString();

  return (
    <li data-rowid={rowid}>
      <span>
        <strong className="feed-amount">{amount}</strong>{' '}
        <span className="muted">{symbol}</span> → <span className="mono">{shortId(f.payee)}</span>
      </span>
      <span className="muted">{when}</span>
      <a href={walrusReceiptUrl(blobId)} target="_blank" rel="noreferrer">
        receipt ↗
      </a>
    </li>
  );
}

export function PaymentsFeed() {
  const root = useRef<HTMLElement>(null);
  // Stable ids of rows we've already shown, so polling only animates genuinely new rows.
  const seen = useRef<Set<string>>(new Set());

  const events = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::treasury::PaymentExecuted` },
      limit: 25,
      order: 'descending',
    },
    { enabled: !!PACKAGE_ID, refetchInterval: 5000 },
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const h2 = root.current?.querySelector('h2');
        if (h2) {
          gsap.from(h2, {
            y: 16,
            opacity: 0,
            duration: DUR.base,
            ease: EASE,
            scrollTrigger: { trigger: h2, start: 'top 85%', once: true },
          });
        }

        const rows = gsap.utils.toArray<HTMLElement>('.feed li', root.current);
        const firstFill = seen.current.size === 0;
        const fresh = rows.filter((li) => li.dataset.rowid && !seen.current.has(li.dataset.rowid));
        rows.forEach((li) => li.dataset.rowid && seen.current.add(li.dataset.rowid));
        if (!fresh.length) return;

        const stagger = firstFill ? 0.05 : 0.04;
        // Newly-settled rows slide + fade in from the top…
        gsap.from(fresh, {
          y: -12,
          opacity: 0,
          duration: DUR.base,
          ease: EASE,
          stagger,
          onComplete: () => ScrollTrigger.refresh(),
        });
        // …with a brief accent pulse so live settlements feel alive.
        gsap.fromTo(
          fresh,
          { boxShadow: '0 0 0 0 rgba(76, 194, 255, 0)' },
          {
            boxShadow: '0 0 0 1px rgba(76, 194, 255, 0.65)',
            duration: DUR.fast,
            ease: 'sine.out',
            yoyo: true,
            repeat: 1,
            stagger,
            clearProps: 'boxShadow',
          },
        );
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        // No motion: remember every row so nothing retroactively animates.
        gsap.utils
          .toArray<HTMLElement>('.feed li', root.current)
          .forEach((li) => li.dataset.rowid && seen.current.add(li.dataset.rowid));
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [events.data] },
  );

  return (
    <section ref={root}>
      <h2>Payments</h2>
      {events.isPending && <p className="muted">Loading…</p>}
      {events.data?.data.length === 0 && <p className="muted">No payouts settled yet.</p>}
      <ul className="feed">
        {events.data?.data.map((e) => {
          const f = e.parsedJson as PaymentExecuted;
          const rowid = `${e.id.txDigest}:${e.id.eventSeq}`;
          return <FeedRow key={rowid} rowid={rowid} f={f} />;
        })}
      </ul>
    </section>
  );
}
