import 'dotenv/config';
import { config as loadEnv } from 'dotenv';

// Prefer .env.local (gitignored) over .env so real keys never sit in a tracked file.
loadEnv({ path: '.env.local', override: true });

export type SuiNetwork = 'testnet' | 'mainnet' | 'devnet' | 'localnet';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var ${name} (see .env.example)`);
  }
  return v.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : fallback;
}

export interface AgentConfig {
  network: SuiNetwork;
  packageId: string;
  treasuryId: string;
  secretKey?: string;
  mnemonic?: string;
  walrusEpochs: number;
  pollIntervalMs: number;
}

export function loadConfig(): AgentConfig {
  const network = optional('SUI_NETWORK', 'testnet') as SuiNetwork;
  const secretKey = process.env.SUI_AGENT_SECRET_KEY?.trim();
  const mnemonic = process.env.SUI_AGENT_MNEMONIC?.trim();

  if (!secretKey && !mnemonic) {
    throw new Error('Provide SUI_AGENT_SECRET_KEY or SUI_AGENT_MNEMONIC (see .env.example)');
  }

  return {
    network,
    packageId: required('CONDUIT_PACKAGE_ID'),
    treasuryId: required('CONDUIT_TREASURY_ID'),
    secretKey,
    mnemonic,
    walrusEpochs: Number(optional('WALRUS_EPOCHS', '3')),
    pollIntervalMs: Number(optional('POLL_INTERVAL_SECONDS', '30')) * 1000,
  };
}
