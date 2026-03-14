import 'dotenv/config';
import { publicClient, getWalletClient, getAccount } from '../src/chain.js';
import { IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI } from '../src/config.js';

const UPDATED_METADATA = {
  name: 'Sentinel8004',
  description: 'Autonomous ERC-8004 trust scoring agent (v2). Scans all registered agents on Celo, scores them across 5 layers with circuit breakers (registration quality, endpoint liveness, on-chain behavior, Sybil/spam detection, existing reputation), and writes trust attestations to the ReputationRegistry on-chain.',
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  version: '0.2.0',
  image: 'https://yonkoo11.github.io/sentinel8004/favicon.svg',
  services: [
    {
      type: 'mcp',
      name: 'Sentinel8004 MCP',
      endpoint: 'stdio',
      description: 'MCP server: check_agent_trust, list_flagged_agents, get_agent_report',
    },
    {
      type: 'dashboard',
      name: 'Sentinel8004 Dashboard',
      endpoint: 'https://yonkoo11.github.io/sentinel8004/',
      description: 'Live trust dashboard for all Celo ERC-8004 agents',
    },
  ],
  tags: ['trust', 'security', 'sybil-detection', 'reputation', 'erc-8004'],
  source: 'https://github.com/yonkoo11/sentinel8004',
  active: true,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const account = getAccount();
  console.log(`Updating agent #1853 metadata on-chain`);
  console.log(`From: ${account.address}`);

  const metadataJSON = JSON.stringify(UPDATED_METADATA);
  const agentURI = `data:application/json;base64,${Buffer.from(metadataJSON).toString('base64')}`;
  console.log(`New metadata: ${agentURI.length} chars`);
  console.log(`Name: ${UPDATED_METADATA.name}`);

  if (dryRun) {
    console.log('\nDRY RUN — would update tokenURI to:');
    console.log(JSON.stringify(UPDATED_METADATA, null, 2));
    return;
  }

  const walletClient = getWalletClient();

  // Simulate first
  const { request } = await publicClient.simulateContract({
    account,
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'setAgentURI',
    args: [BigInt(1853), agentURI],
  });
  console.log('Simulation passed');

  const txHash = await walletClient.writeContract(request);
  console.log(`TX: ${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Status: ${receipt.status}`);
  console.log(`Gas used: ${receipt.gasUsed}`);
  console.log(`\nVerify: https://celoscan.io/tx/${txHash}`);

  // Verify the update
  const newURI = await publicClient.readContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'tokenURI',
    args: [BigInt(1853)],
  });
  const decoded = JSON.parse(Buffer.from(newURI.split(',')[1], 'base64').toString());
  console.log(`\nVerified on-chain name: ${decoded.name}`);
}

main().catch(console.error);
