/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUI_NETWORK?: 'testnet' | 'mainnet';
  readonly VITE_CONDUIT_PACKAGE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
