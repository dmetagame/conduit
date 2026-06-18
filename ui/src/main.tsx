import React from 'react';
import ReactDOM from 'react-dom/client';
import '@mysten/dapp-kit/dist/index.css';
import './index.css';
import { Providers } from './providers';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
);
