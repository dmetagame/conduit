import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { WalrusClient } from '@mysten/walrus';
import type { AgentConfig, SuiNetwork } from './config.js';

export function makeKeypair(cfg: AgentConfig): Ed25519Keypair {
  if (cfg.secretKey) return Ed25519Keypair.fromSecretKey(cfg.secretKey);
  // mnemonic guaranteed present by loadConfig() when secretKey is absent
  return Ed25519Keypair.deriveKeypair(cfg.mnemonic as string);
}

export function makeSuiClient(network: SuiNetwork): SuiClient {
  return new SuiClient({ url: getFullnodeUrl(network) });
}

export function makeWalrusClient(network: SuiNetwork, suiClient: SuiClient): WalrusClient {
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new Error(`Walrus is only available on testnet/mainnet, not ${network}`);
  }
  return new WalrusClient({
    network,
    suiClient,
    // Offload blob distribution to the relay so the agent doesn't write to every node.
    uploadRelay: {
      host: `https://upload-relay.${network}.walrus.space`,
      sendTip: { max: 1_000 },
    },
  });
}
