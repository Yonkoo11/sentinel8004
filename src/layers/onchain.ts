import type { LayerScore } from '../types.js';
import { BLOCKSCOUT_API_URL, BLOCKSCOUT_RATE_LIMIT_PER_SEC } from '../config.js';
import { fetchWithTimeout, createRateLimiter } from '../utils.js';

const rateLimiter = createRateLimiter(BLOCKSCOUT_RATE_LIMIT_PER_SEC);

interface TxListResponse {
  status: string;
  result: Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    timeStamp: string;
    blockNumber: string;
    input: string;
  }>;
}

export async function scoreOnchain(agentWallet: string | null): Promise<LayerScore> {
  const details: string[] = [];
  const flags: string[] = [];

  if (!agentWallet) {
    details.push('No agent wallet set — no on-chain behavior to evaluate');
    return { layer: 'onchain', score: 0, maxScore: 25, details, flags };
  }

  let txs: TxListResponse['result'] = [];

  try {
    txs = await rateLimiter(async () => {
      const url = `${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${agentWallet}&page=1&offset=100&sort=desc`;
      const response = await fetchWithTimeout(url, 10000);
      const data = await response.json() as TxListResponse;
      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result;
      }
      return [];
    });
  } catch (e) {
    details.push(`Blockscout API error: ${(e as Error).message}`);
    flags.push('BLOCKSCOUT_ERROR');
    return { layer: 'onchain', score: 0, maxScore: 25, details, flags };
  }

  let score = 0;

  // Wallet age >30 days (5pts)
  // Note: uses oldest tx in the 100-tx window (sort=desc). For wallets with 100+ txs,
  // this may underreport age. Acceptable for scoring purposes.
  if (txs.length > 0) {
    const oldestTx = txs[txs.length - 1];
    const ageMs = Date.now() - parseInt(oldestTx.timeStamp) * 1000;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (ageDays > 30) {
      score += 5;
      details.push(`+5 Wallet age: ${ageDays} days`);
    } else {
      score += Math.min(3, Math.floor(ageDays / 10));
      details.push(`+${Math.min(3, Math.floor(ageDays / 10))} Wallet age: ${ageDays} days (< 30)`);
    }
  } else {
    details.push('+0 No transactions found');
    flags.push('NO_TRANSACTIONS');
  }

  // Transaction count >10 (5pts)
  if (txs.length > 10) {
    score += 5;
    details.push(`+5 Transaction count: ${txs.length}+`);
  } else if (txs.length > 0) {
    score += Math.min(3, txs.length);
    details.push(`+${Math.min(3, txs.length)} Transaction count: ${txs.length} (< 10)`);
  }

  // Check for unlimited approvals (5pts if none found)
  const approvals = txs.filter(tx => {
    const input = tx.input.toLowerCase();
    return input.startsWith('0x095ea7b3') && // approve(address,uint256)
           input.endsWith('f'.repeat(64)); // max uint256
  });
  if (approvals.length === 0) {
    score += 5;
    details.push('+5 No unlimited token approvals');
  } else {
    details.push(`+0 Found ${approvals.length} unlimited approval(s)`);
    flags.push(`UNLIMITED_APPROVALS:${approvals.length}`);
  }

  // Has balance (we check if there are recent outgoing txs as proxy) (5pts)
  const recentTxs = txs.filter(tx => {
    const age = Date.now() - parseInt(tx.timeStamp) * 1000;
    return age < 90 * 24 * 60 * 60 * 1000; // last 90 days
  });
  if (recentTxs.length > 0) {
    score += 5;
    details.push(`+5 Active in last 90 days (${recentTxs.length} txs)`);
  } else if (txs.length > 0) {
    score += 2;
    details.push('+2 Has history but inactive recently');
    flags.push('INACTIVE_WALLET');
  }

  // Diverse interaction partners (5pts)
  const uniquePartners = new Set<string>();
  for (const tx of txs) {
    if (tx.from.toLowerCase() !== agentWallet.toLowerCase()) uniquePartners.add(tx.from.toLowerCase());
    if (tx.to && tx.to.toLowerCase() !== agentWallet.toLowerCase()) uniquePartners.add(tx.to.toLowerCase());
  }
  if (uniquePartners.size > 3) {
    score += 5;
    details.push(`+5 Diverse interactions: ${uniquePartners.size} unique partners`);
  } else if (uniquePartners.size > 0) {
    score += uniquePartners.size;
    details.push(`+${uniquePartners.size} Limited interactions: ${uniquePartners.size} partners`);
  }

  score = Math.min(25, score);

  return { layer: 'onchain', score, maxScore: 25, details, flags };
}
