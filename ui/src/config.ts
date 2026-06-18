export const NETWORK = (import.meta.env.VITE_SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

export const PACKAGE_ID = import.meta.env.VITE_CONDUIT_PACKAGE_ID ?? '';

export const WALRUS_AGGREGATOR =
  NETWORK === 'mainnet'
    ? 'https://aggregator.walrus-mainnet.walrus.space'
    : 'https://aggregator.walrus-testnet.walrus.space';

export function walrusReceiptUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}
