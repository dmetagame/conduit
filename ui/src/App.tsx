import { useRef } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { NETWORK, PACKAGE_ID } from './config';
import { Treasuries } from './components/Treasuries';
import { PaymentsFeed } from './components/PaymentsFeed';
import { Logo } from './components/Logo';
import { useSmoothScroll } from './hooks/useSmoothScroll';
import { EASE } from './lib/animations';

export function App() {
  const account = useCurrentAccount();
  const root = useRef<HTMLDivElement>(null);

  useSmoothScroll();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap
          .timeline({ defaults: { ease: EASE } })
          .from('.logo__char', { y: 18, opacity: 0, duration: 0.5, stagger: 0.04 })
          .from('.topbar .muted', { y: 12, opacity: 0, duration: 0.5 }, '-=0.25')
          .from('.connect-fade', { opacity: 0, duration: 0.5 }, '-=0.4'); // opacity only — never transform the ConnectButton

        // Ambient hero glow: fade in, then breathe very slowly.
        gsap.fromTo('.hero-glow', { opacity: 0 }, { opacity: 1, duration: 1, ease: 'sine.out' });
        gsap.to('.hero-glow', {
          opacity: 0.6,
          duration: 4.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 1,
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div className="app" ref={root}>
      <div className="hero-glow" aria-hidden="true" />

      <header className="topbar">
        <div>
          <h1 className="brand">
            <Logo gradient markSize={24} />
          </h1>
          <p className="muted">Programmable USDC settlement rails on Sui · {NETWORK}</p>
        </div>
        <span className="connect-fade">
          <ConnectButton />
        </span>
      </header>

      {!PACKAGE_ID && (
        <div className="banner">
          Set <code>VITE_CONDUIT_PACKAGE_ID</code> in <code>.env.local</code> after{' '}
          <code>sui client publish</code>.
        </div>
      )}

      {!account ? (
        <div className="card">
          <p>Connect a wallet to create and manage treasuries.</p>
        </div>
      ) : (
        <>
          <Treasuries />
          <PaymentsFeed />
        </>
      )}

      <footer className="muted">
        Each settled payout stores a receipt on Walrus and links to its verifiable blob.
      </footer>
    </div>
  );
}
