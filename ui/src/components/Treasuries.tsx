import { useRef, useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClientQuery,
} from '@mysten/dapp-kit';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { PACKAGE_ID } from '../config';
import {
  addRuleTx,
  coinTypeFromTreasuryType,
  createTreasuryTx,
  depositTx,
  shortId,
} from '../lib/conduit';
import { countUp, DUR, EASE } from '../lib/animations';

gsap.registerPlugin(ScrollTrigger);

export function Treasuries() {
  const account = useCurrentAccount();
  const root = useRef<HTMLElement>(null);
  const caps = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: account?.address ?? '',
      filter: { StructType: `${PACKAGE_ID}::treasury::OwnerCap` },
      options: { showContent: true },
    },
    { enabled: !!PACKAGE_ID && !!account },
  );

  // Reveal the heading on scroll and stagger cards in as they mount (incl. async-loaded
  // treasury rows). Only un-animated cards are touched, so polling never re-runs the list.
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
        const fresh = gsap.utils
          .toArray<HTMLElement>('.card', root.current)
          .filter((c) => !c.dataset.animated);
        fresh.forEach((c) => (c.dataset.animated = 'true'));
        if (fresh.length) {
          gsap.from(fresh, {
            y: 24,
            opacity: 0,
            duration: DUR.base,
            ease: EASE,
            stagger: 0.08,
            onComplete: () => ScrollTrigger.refresh(),
          });
        }
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [caps.data] },
  );

  return (
    <section ref={root}>
      <h2>Your treasuries</h2>
      <CreateTreasury onCreated={() => void caps.refetch()} />
      {caps.isPending && <p className="muted">Loading…</p>}
      {caps.data?.data.length === 0 && (
        <p className="muted">No treasuries yet — create one above.</p>
      )}
      <div className="grid">
        {caps.data?.data.map((c) => {
          const fields = (c.data?.content as { fields?: { treasury?: string } } | undefined)?.fields;
          const capId = c.data?.objectId;
          const treasuryId = fields?.treasury;
          if (!capId || !treasuryId) return null;
          return <TreasuryRow key={capId} capId={capId} treasuryId={treasuryId} />;
        })}
      </div>
    </section>
  );
}

function CreateTreasury({ onCreated }: { onCreated: () => void }) {
  const { mutateAsync, isPending } = useSignAndExecuteTransaction();
  const [coinType, setCoinType] = useState('0x2::sui::SUI');

  return (
    <div className="card">
      <h3>Create treasury</h3>
      <label>
        Asset type (T)
        <input
          value={coinType}
          onChange={(e) => setCoinType(e.target.value)}
          placeholder="0x…::usdc::USDC"
        />
      </label>
      <button
        disabled={isPending || !PACKAGE_ID}
        onClick={async () => {
          await mutateAsync({ transaction: createTreasuryTx(PACKAGE_ID, coinType.trim()) });
          onCreated();
        }}
      >
        {isPending ? 'Creating…' : 'Create'}
      </button>
    </div>
  );
}

function TreasuryRow({ capId, treasuryId }: { capId: string; treasuryId: string }) {
  const root = useRef<HTMLDivElement>(null);
  const balRef = useRef<HTMLElement>(null);
  const obj = useSuiClientQuery('getObject', {
    id: treasuryId,
    options: { showType: true, showContent: true },
  });

  const type = obj.data?.data?.type ?? '';
  const coinType = coinTypeFromTreasuryType(type) ?? '';
  const fields = (obj.data?.data?.content as { fields?: Record<string, unknown> } | undefined)?.fields;
  const fundsField = fields?.funds as { fields?: { value?: string } } | string | undefined;
  const balance =
    typeof fundsField === 'object' ? (fundsField?.fields?.value ?? '0') : (fundsField ?? '0');

  // Count the balance up from 0 → value (display only). Re-runs only when the balance
  // actually changes (e.g. after a deposit), not on unrelated re-renders.
  useGSAP(
    () => {
      const el = balRef.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        countUp(el, Number(balance));
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        el.textContent = String(balance);
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [balance] },
  );

  return (
    <div className="card" ref={root}>
      <h3>Treasury {shortId(treasuryId)}</h3>
      <p className="muted mono">{coinType || '—'}</p>
      <p>
        Balance: <strong ref={balRef}>{String(balance)}</strong>
      </p>
      <DepositForm
        treasuryId={treasuryId}
        coinType={coinType}
        onDone={() => void obj.refetch()}
      />
      <AddRuleForm capId={capId} treasuryId={treasuryId} coinType={coinType} />
    </div>
  );
}

function DepositForm({
  treasuryId,
  coinType,
  onDone,
}: {
  treasuryId: string;
  coinType: string;
  onDone: () => void;
}) {
  const { mutateAsync, isPending } = useSignAndExecuteTransaction();
  const [amount, setAmount] = useState('1000000000');
  const [coinId, setCoinId] = useState('');
  const isSui = coinType === '0x2::sui::SUI';

  return (
    <div className="subform">
      <strong>Deposit</strong>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="amount (base units)" />
      {!isSui && (
        <input value={coinId} onChange={(e) => setCoinId(e.target.value)} placeholder="owned coin object id" />
      )}
      <button
        disabled={isPending || !coinType}
        onClick={async () => {
          await mutateAsync({
            transaction: depositTx(PACKAGE_ID, coinType, {
              treasury: treasuryId,
              amount: BigInt(amount),
              coinId: coinId || undefined,
            }),
          });
          onDone();
        }}
      >
        {isPending ? 'Depositing…' : 'Deposit'}
      </button>
    </div>
  );
}

function AddRuleForm({
  capId,
  treasuryId,
  coinType,
}: {
  capId: string;
  treasuryId: string;
  coinType: string;
}) {
  const { mutateAsync, isPending } = useSignAndExecuteTransaction();
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('100000000');
  const [intervalSec, setIntervalSec] = useState('0');
  const [startInSec, setStartInSec] = useState('0');

  return (
    <div className="subform">
      <strong>Add payout rule</strong>
      <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="payee address 0x…" />
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="amount per payout" />
      <input
        value={intervalSec}
        onChange={(e) => setIntervalSec(e.target.value)}
        placeholder="interval seconds (0 = one-shot)"
      />
      <input
        value={startInSec}
        onChange={(e) => setStartInSec(e.target.value)}
        placeholder="first run in N seconds"
      />
      <button
        disabled={isPending || !payee || !coinType}
        onClick={async () => {
          const startMs = BigInt(Date.now() + Number(startInSec) * 1000);
          await mutateAsync({
            transaction: addRuleTx(PACKAGE_ID, coinType, {
              cap: capId,
              treasury: treasuryId,
              payee: payee.trim(),
              amount: BigInt(amount),
              intervalMs: BigInt(Number(intervalSec) * 1000),
              startMs,
            }),
          });
          setPayee('');
        }}
      >
        {isPending ? 'Adding…' : 'Add rule'}
      </button>
    </div>
  );
}
