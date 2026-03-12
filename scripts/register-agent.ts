import 'dotenv/config';
import { publicClient, getWalletClient, getAccount } from '../src/chain.js';
import { IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI } from '../src/config.js';
import { pinJSON } from '../src/ipfs.js';

const AGENT_METADATA = {
  name: 'AgentGuard',
  description: 'Autonomous ERC-8004 trust scoring agent (v2). Scans all 1,835+ registered agents on Celo, scores them across 5 layers with circuit breakers (registration quality, endpoint liveness, on-chain behavior, Sybil/spam detection, existing reputation), and writes trust attestations to the ReputationRegistry on-chain.',
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  version: '0.2.0',
  image: 'https://yonkoo11.github.io/agentguard/favicon.svg',
  services: [
    {
      type: 'mcp',
      name: 'AgentGuard MCP',
      endpoint: 'stdio',
      description: 'MCP server: check_agent_trust, list_flagged_agents, get_agent_report',
    },
    {
      type: 'dashboard',
      name: 'AgentGuard Dashboard',
      endpoint: 'https://yonkoo11.github.io/agentguard/',
      description: 'Live trust dashboard for all Celo ERC-8004 agents',
    },
  ],
  tags: ['trust', 'security', 'sybil-detection', 'reputation', 'erc-8004'],
  source: 'https://github.com/yonkoo11/agentguard',
  active: true,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const account = getAccount();
  console.log(`Registering AgentGuard as ERC-8004 agent`);
  console.log(`From: ${account.address}`);

  if (dryRun) {
    console.log('\nDRY RUN — metadata:');
    console.log(JSON.stringify(AGENT_METADATA, null, 2));
    return;
  }

  // Pin metadata to IPFS
  console.log('Pinning metadata to IPFS...');
  const cid = await pinJSON(AGENT_METADATA, 'agentguard-metadata');
  const agentURI = `ipfs://${cid}`;
  console.log(`Pinned: ${agentURI}`);

  // Register on IdentityRegistry
  console.log('Registering on-chain...');
  const walletClient = getWalletClient();

  const { request } = await publicClient.simulateContract({
    account,
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  const txHash = await walletClient.writeContract(request);
  console.log(`TX: ${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Status: ${receipt.status}`);

  // Parse the agentId from the Transfer event log
  if (receipt.logs.length > 0) {
    const tokenId = BigInt(receipt.logs[0].topics?.[3] || '0');
    console.log(`AgentGuard registered as agent #${tokenId}`);
  }
}

main().catch(console.error);
