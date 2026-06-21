import { Fragment, useRef } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ConduitMark } from './Logo';
import { ProofCard } from './ProofCard';
import { DUR, EASE } from '../lib/animations';

gsap.registerPlugin(ScrollTrigger);

const REPO = 'https://github.com/dmetagame/conduit';

// Rails fan in from the left edge and converge on a settlement hub on the right.
const HUB = { x: 940, y: 300 };
const LEFT_X = -60;
const RAIL_Y = [110, 205, 300, 395, 490];

// Two value-nodes per rail, staggered, flowing left → hub.
const DOTS = RAIL_Y.flatMap((y, rail) =>
  [0, 1].map((n) => ({
    key: `${rail}-${n}`,
    x0: LEFT_X,
    y0: y,
    x1: HUB.x,
    y1: HUB.y,
    delay: rail * 0.6 + n * 2.4,
    dur: 4.2 + rail * 0.35,
  })),
);

const STEPS = [
  {
    n: '01',
    title: 'Author a rule',
    body: 'Create a treasury and add a payout rule — recurring or one-shot — as a first-class on-chain object.',
  },
  {
    n: '02',
    title: 'The agent settles',
    body: 'A permissionless operator discovers due rules and settles them. It runs as a serverless cron — no infra to babysit.',
  },
  {
    n: '03',
    title: 'Verifiable receipt',
    body: 'Every payout writes a signed receipt to Walrus; its blob id is emitted on-chain for anyone to verify.',
  },
];

const BADGES = ['Sui', 'Native USDC', 'DeepBook v3', 'Walrus', 'DeFi & Payments'];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero content reveal.
        gsap
          .timeline({ defaults: { ease: EASE } })
          .from('.landing__eyebrow', { y: 14, opacity: 0, duration: DUR.base })
          .from('.hero-title .word', { y: 26, opacity: 0, duration: DUR.slow, stagger: 0.08 }, '-=0.2')
          .from('.hero-sub', { y: 14, opacity: 0, duration: DUR.base }, '-=0.55')
          .from('.landing__cta > *', { y: 12, opacity: 0, duration: DUR.base, stagger: 0.1 }, '-=0.4');

        // Value-nodes flow along the rails and settle at the hub, looping.
        gsap.utils.toArray<SVGGElement>('.rail-dot', root.current).forEach((dot) => {
          const d = dot.dataset;
          const dur = Number(d.dur);
          gsap
            .timeline({ repeat: -1, delay: Number(d.delay) })
            .set(dot, { x: Number(d.x0), y: Number(d.y0), opacity: 0 })
            .to(dot, { opacity: 1, duration: 0.6, ease: 'sine.out' }, 0)
            .to(dot, { x: Number(d.x1), y: Number(d.y1), duration: dur, ease: 'none' }, 0)
            .to(dot, { opacity: 0, duration: 0.9, ease: 'sine.in' }, dur - 0.9);
        });

        // Settlement hub breathes.
        gsap.to('.hub-core', {
          scale: 1.5,
          opacity: 0.5,
          transformOrigin: 'center',
          duration: 1.8,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });

        // How-it-works steps + badges reveal on scroll.
        gsap.from('.step', {
          y: 24,
          opacity: 0,
          duration: DUR.base,
          ease: EASE,
          stagger: 0.1,
          scrollTrigger: { trigger: '.landing__how', start: 'top 80%', once: true },
        });
        gsap.from('.badge', {
          y: 10,
          opacity: 0,
          duration: DUR.fast,
          ease: EASE,
          stagger: 0.05,
          scrollTrigger: { trigger: '.badges', start: 'top 92%', once: true },
        });
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        // Settle the nodes statically near the hub; no looping motion.
        gsap.utils.toArray<SVGGElement>('.rail-dot', root.current).forEach((dot, i) => {
          const d = dot.dataset;
          const t = 0.6 + (i % 3) * 0.12;
          gsap.set(dot, {
            x: Number(d.x0) + (Number(d.x1) - Number(d.x0)) * t,
            y: Number(d.y0) + (Number(d.y1) - Number(d.y0)) * t,
            opacity: 0.55,
          });
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div className="landing" ref={root}>
      <section className="landing__hero">
        <svg
          className="rails"
          viewBox="0 0 1200 600"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="railGrad" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#4cc2ff" stopOpacity="0" />
              <stop offset="0.55" stopColor="#4cc2ff" stopOpacity="0.45" />
              <stop offset="1" stopColor="#7b61ff" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {RAIL_Y.map((y, i) => (
            <path
              key={i}
              d={`M ${LEFT_X} ${y} L ${HUB.x} ${HUB.y}`}
              stroke="url(#railGrad)"
              strokeWidth="1.5"
              fill="none"
            />
          ))}

          {/* settlement hub */}
          <circle cx={HUB.x} cy={HUB.y} r="46" fill="none" stroke="#4cc2ff" strokeOpacity="0.12" />
          <circle cx={HUB.x} cy={HUB.y} r="26" fill="none" stroke="#4cc2ff" strokeOpacity="0.22" />
          <circle className="hub-core" cx={HUB.x} cy={HUB.y} r="6" fill="#4cc2ff" />

          {/* flowing value-nodes */}
          {DOTS.map((d) => (
            <g
              key={d.key}
              className="rail-dot"
              style={{ opacity: 0 }}
              data-x0={d.x0}
              data-y0={d.y0}
              data-x1={d.x1}
              data-y1={d.y1}
              data-delay={d.delay}
              data-dur={d.dur}
            >
              <circle r="7" fill="#4cc2ff" fillOpacity="0.18" />
              <circle r="2.6" fill="#9bd9ff" />
            </g>
          ))}
        </svg>

        <div className="landing__content">
          <span className="landing__eyebrow">
            <span className="dot" /> Live on Sui testnet
          </span>
          <h1 className="hero-title">
            {'Programmable settlement rails for USDC on Sui'.split(' ').map((w, i) => (
              <Fragment key={i}>
                <span className="word">{w}</span>{' '}
              </Fragment>
            ))}
          </h1>
          <p className="hero-sub">
            Conduit turns a Sui object into a programmable treasury — schedule payouts, convert
            assets through DeepBook at settlement, and write a verifiable Walrus receipt for every
            payment. Autonomous, on-chain, permissionless.
          </p>
          <div className="landing__cta">
            <ConnectButton />
            <a className="ghost-link" href={REPO} target="_blank" rel="noreferrer">
              View on GitHub →
            </a>
          </div>
          <ProofCard />
        </div>
      </section>

      <section className="landing__how">
        <h2 className="how-title">How a payment settles</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="step__top">
                <span className="step__n mono">{s.n}</span>
                <span className="step__mark">
                  <ConduitMark size={18} />
                </span>
              </div>
              <h3>{s.title}</h3>
              <p className="muted">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="badges">
          {BADGES.map((b) => (
            <span className="badge" key={b}>
              {b}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
