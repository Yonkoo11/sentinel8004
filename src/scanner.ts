import pLimit from 'p-limit';
import { ownerOf, tokenURI, getAgentWallet } from './chain.js';
import { parseMetadata } from './metadata.js';
import { SCAN_CONCURRENCY } from './config.js';
import type { AgentRecord } from './types.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const CHECKPOINT_FILE = 'data/scan-checkpoint.json';
const CHECKPOINT_INTERVAL = 100;

interface ScanOptions {
  maxAgents?: number;
  startFrom?: number;
  skipMetadata?: boolean;
}

export async function findTotalAgents(): Promise<number> {
  // Binary search for the last valid agentId
  let low = 1;
  let high = 10000;
  const MAX_BOUND = 100_000; // Safety cap to prevent infinite loop

  // First find an upper bound
  while (await ownerOf(high) !== null) {
    high *= 2;
    if (high > MAX_BOUND) {
      high = MAX_BOUND;
      break;
    }
  }

  // Binary search between low and high
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const owner = await ownerOf(mid);
    if (owner !== null) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

export async function enumerateAgents(options: ScanOptions = {}): Promise<AgentRecord[]> {
  const { maxAgents, startFrom = 1, skipMetadata = false } = options;

  console.log('Finding total agent count...');
  const totalAgents = await findTotalAgents();
  console.log(`Found ${totalAgents} agents on Celo IdentityRegistry`);

  const endId = maxAgents ? Math.min(startFrom + maxAgents - 1, totalAgents) : totalAgents;
  const limit = pLimit(SCAN_CONCURRENCY);
  const agents: AgentRecord[] = [];

  // Load checkpoint if exists
  let checkpoint: AgentRecord[] = [];
  if (existsSync(CHECKPOINT_FILE)) {
    try {
      checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));
      console.log(`Loaded ${checkpoint.length} agents from checkpoint`);
    } catch { /* ignore */ }
  }

  const alreadyScanned = new Set(checkpoint.map(a => a.agentId));
  agents.push(...checkpoint.filter(a => a.agentId >= startFrom && a.agentId <= endId));

  const toScan: number[] = [];
  for (let id = startFrom; id <= endId; id++) {
    if (!alreadyScanned.has(id)) {
      toScan.push(id);
    }
  }

  console.log(`Scanning ${toScan.length} agents (${startFrom} to ${endId})...`);
  let completed = 0;

  const promises = toScan.map(id =>
    limit(async () => {
      const agent = await scanAgent(id, skipMetadata);
      if (agent) {
        agents.push(agent);
      }
      completed++;
      if (completed % 50 === 0) {
        console.log(`  Scanned ${completed}/${toScan.length}`);
      }
      if (completed % CHECKPOINT_INTERVAL === 0) {
        saveCheckpoint(agents);
      }
      return agent;
    })
  );

  await Promise.all(promises);

  // Sort by ID
  agents.sort((a, b) => a.agentId - b.agentId);

  // Save final checkpoint
  saveCheckpoint(agents);

  return agents;
}

async function scanAgent(agentId: number, skipMetadata: boolean): Promise<AgentRecord | null> {
  const owner = await ownerOf(agentId);
  if (!owner) return null;

  let uri = '';
  try {
    uri = await tokenURI(agentId);
  } catch {
    return {
      agentId,
      owner,
      tokenURI: '',
      agentWallet: null,
      metadata: null,
      metadataFormat: 'unknown',
      metadataError: 'Failed to fetch tokenURI',
    };
  }

  let wallet: string | null = null;
  try {
    wallet = await getAgentWallet(agentId);
  } catch { /* ignore */ }

  if (skipMetadata) {
    return {
      agentId,
      owner,
      tokenURI: uri,
      agentWallet: wallet,
      metadata: null,
      metadataFormat: 'unknown',
      metadataError: 'Skipped',
    };
  }

  const { metadata, format, error } = await parseMetadata(uri);

  return {
    agentId,
    owner,
    tokenURI: uri,
    agentWallet: wallet,
    metadata,
    metadataFormat: format,
    metadataError: error,
  };
}

function saveCheckpoint(agents: AgentRecord[]) {
  try {
    writeFileSync(CHECKPOINT_FILE, JSON.stringify(agents, null, 2));
  } catch { /* ignore */ }
}
