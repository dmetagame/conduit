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
  formatAmount,
  shortCoinType,
  shortId,
  symbolFromCoinType,
  toBaseUnits,
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

  // Resolve the coin's real metadata so the balance renders with the right decimals
  // and symbol (e.g. 10 USDC), not raw base units.
  const meta = useSuiClientQuery('getCoinMetadata', { coinType }, { enabled: !!coinType });
  const decimals = meta.data?.decimals ?? 0;
  const symbol = meta.data?.symbol ?? (coinType ? symbolFromCoinType(coinType) : '');
  const display = symbol ? `${formatAmount(balance, decimals)} ${symbol}` : formatAmount(balance, decimals);

  // Count the real on-chain balance up to its formatted value (display only). Re-runs when
  // the balance or the resolved decimals/symbol change — never on unrelated re-renders.
  useGSAP(
    () => {
      const el = balRef.current;
      if (!el) return;
      const human = Number(BigInt(balance)) / 10 ** decimals;
      const fmt = (n: number) =>
        `${n.toLocaleString('en-US', { maximumFractionDigits: decimals })}${symbol ? ` ${symbol}` : ''}`;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        countUp(el, human, { format: fmt });
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        el.textContent = display;
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [balance, decimals, symbol] },
  );

  return (
    <div className="card" ref={root}>
      <h3>Treasury {shortId(treasuryId)}</h3>
      <p className="muted mono" title={coinType}>{coinType ? shortCoinType(coinType) : '—'}</p>
      <p>
        Balance: <strong ref={balRef}>{display}</strong>
      </p>
      <DepositForm
        treasuryId={treasuryId}
        coinType={coinType}
        decimals={decimals}
        symbol={symbol}
        onDone={() => void obj.refetch()}
      />
      <AddRuleForm
        capId={capId}
        treasuryId={treasuryId}
        coinType={coinType}
        decimals={decimals}
        symbol={symbol}
      />
    </div>
  );
}

// Leave a little SUI behind to pay for the deposit gas itself.
const SUI_GAS_BUFFER = 50_000_000n; // 0.05 SUI

function DepositForm({
  treasuryId,
  coinType,
  decimals,
  symbol,
  onDone,
}: {
  treasuryId: string;
  coinType: string;
  decimals: number;
  symbol: string;
  onDone: () => void;
}) {
  const account = useCurrentAccount();
  const { mutateAsync, isPending } = useSignAndExecuteTransaction();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const isSui = coinType === '0x2::sui::SUI';

  // For non-SUI assets the deposit must come from an owned coin object. Resolve it
  // automatically (largest balance) so both SUI and non-SUI cards have the same simple
  // {amount + button} form — no manual coin-id paste.
  const coins = useSuiClientQuery(
    'getCoins',
    { owner: account?.address ?? '', coinType },
    { enabled: !isSui && !!account && !!coinType },
  );
  const sorted = coins.data?.data
    .slice()
    .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
  const sourceCoinId = isSui ? undefined : sorted?.[0]?.coinObjectId;
  const noCoin = !isSui && coins.isFetched && !sourceCoinId;

  // Spendable wallet balance of this asset (SUI keeps a gas buffer; non-SUI uses the
  // largest single coin, since deposit splits from one object).
  const suiBal = useSuiClientQuery(
    'getBalance',
    { owner: account?.address ?? '' },
    { enabled: isSui && !!account },
  );
  const available = isSui
    ? (() => {
        const b = BigInt(suiBal.data?.totalBalance ?? '0') - SUI_GAS_BUFFER;
        return b > 0n ? b : 0n;
      })()
    : BigInt(sorted?.[0]?.balance ?? '0');

  const base = toBaseUnits(amount, decimals);
  const tooMuch = base !== null && base > available;
  const ready = base !== null && !tooMuch && !noCoin && !!coinType;

  async function onDeposit() {
    setError('');
    if (!ready || base === null) return;
    try {
      await mutateAsync({
        transaction: depositTx(PACKAGE_ID, coinType, {
          treasury: treasuryId,
          amount: base,
          coinId: sourceCoinId,
        }),
      });
      setAmount('');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deposit failed');
    }
  }

  return (
    <div className="subform">
      <strong>Deposit</strong>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`amount in ${symbol || 'tokens'}`}
        inputMode="decimal"
      />
      <span className="muted" style={{ fontSize: 12 }}>
        Available: {formatAmount(available, decimals)} {symbol}
      </span>
      {noCoin && <span className="form-error">No {symbol || 'coin'} in this wallet.</span>}
      {tooMuch && <span className="form-error">Amount exceeds available balance.</span>}
      {error && <span className="form-error">{error}</span>}
      <button disabled={isPending || !ready} onClick={onDeposit}>
        {isPending ? 'Depositing…' : 'Deposit'}
      </button>
    </div>
  );
}

function AddRuleForm({
  capId,
  treasuryId,
  coinType,
  decimals,
  symbol,
}: {
  capId: string;
  treasuryId: string;
  coinType: string;
  decimals: number;
  symbol: string;
}) {
  const { mutateAsync, isPending } = useSignAndExecuteTransaction();
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [intervalSec, setIntervalSec] = useState('0');
  const [startInSec, setStartInSec] = useState('0');
  const [error, setError] = useState('');

  const base = toBaseUnits(amount, decimals);
  const ready = !!payee.trim() && base !== null && !!coinType;

  async function onAdd() {
    setError('');
    if (!ready || base === null) return;
    try {
      const startMs = BigInt(Date.now() + Number(startInSec) * 1000);
      await mutateAsync({
        transaction: addRuleTx(PACKAGE_ID, coinType, {
          cap: capId,
          treasury: treasuryId,
          payee: payee.trim(),
          amount: base,
          intervalMs: BigInt(Number(intervalSec) * 1000),
          startMs,
        }),
      });
      setPayee('');
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add rule failed');
    }
  }

  return (
    <div className="subform">
      <strong>Add payout rule</strong>
      <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="payee address 0x…" />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`amount per payout in ${symbol || 'tokens'}`}
        inputMode="decimal"
      />
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
      {error && <span className="form-error">{error}</span>}
      <button disabled={isPending || !ready} onClick={onAdd}>
        {isPending ? 'Adding…' : 'Add rule'}
      </button>
    </div>
  );
}
