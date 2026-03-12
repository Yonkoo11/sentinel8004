import 'dotenv/config';
import { publicClient, getWalletClient, getAccount } from '../src/chain.js';
import { IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI } from '../src/config.js';
import { pinJSON } from '../src/ipfs.js';

const AGENT_METADATA = {
  name: 'AgentGuard',
  description: 'Autonomous ERC-8004 trust scoring agent. Scans all registered agents on Celo, scores them across 4 layers (registration quality, endpoint liveness, on-chain behavior, Sybil/spam detection), and writes trust attestations to the ReputationRegistry.',
  type: 'service',
  version: '0.1.0',
  services: [
    {
      type: 'mcp',
      endpoint: 'stdio',
      description: 'MCP server with check_agent_trust, list_flagged_agents, get_agent_report tools',
    },
  ],
  tags: ['trust', 'security', 'sybil-detection', 'reputation'],
  source: 'https://github.com/yonkoo11/agentguard',
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
