import { createPublicClient, createWalletClient, http } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  CELO_RPC_URL,
  IDENTITY_REGISTRY_ADDRESS,
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ABI,
} from './config.js';

export const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC_URL),
});

export function getWalletClient() {
  const pk = process.env.AGENTGUARD_PRIVATE_KEY;
  if (!pk) {
    throw new Error('AGENTGUARD_PRIVATE_KEY not set in environment');
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: celo,
    transport: http(CELO_RPC_URL),
  });
}

export function getAccount() {
  const pk = process.env.AGENTGUARD_PRIVATE_KEY;
  if (!pk) {
    throw new Error('AGENTGUARD_PRIVATE_KEY not set in environment');
  }
  return privateKeyToAccount(pk as `0x${string}`);
}

// Contract read helpers
export async function ownerOf(agentId: number): Promise<string | null> {
  try {
    const owner = await publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'ownerOf',
      args: [BigInt(agentId)],
    });
    return owner as string;
  } catch {
    return null; // Agent doesn't exist
  }
}

export async function tokenURI(agentId: number): Promise<string> {
  const uri = await publicClient.readContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'tokenURI',
    args: [BigInt(agentId)],
  });
  return uri as string;
}

export async function getAgentWallet(agentId: number): Promise<string | null> {
  try {
    const wallet = await publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'getAgentWallet',
      args: [BigInt(agentId)],
    });
    const addr = wallet as string;
    if (addr === '0x0000000000000000000000000000000000000000') return null;
    return addr;
  } catch {
    return null;
  }
}

export async function getClients(agentId: number): Promise<string[]> {
  const clients = await publicClient.readContract({
    address: REPUTATION_REGISTRY_ADDRESS,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'getClients',
    args: [BigInt(agentId)],
  });
  return clients as string[];
}
