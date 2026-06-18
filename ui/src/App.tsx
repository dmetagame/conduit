import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { NETWORK, PACKAGE_ID } from './config';
import { Treasuries } from './components/Treasuries';
import { PaymentsFeed } from './components/PaymentsFeed';

export function App() {
  const account = useCurrentAccount();

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Conduit</h1>
          <p className="muted">Programmable USDC settlement rails on Sui · {NETWORK}</p>
        </div>
        <ConnectButton />
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
