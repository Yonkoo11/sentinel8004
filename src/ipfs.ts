import { fetchWithTimeout } from './utils.js';

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

/**
 * Pin JSON to IPFS via Pinata.
 * Requires PINATA_JWT env var.
 */
export async function pinJSON(data: unknown, name: string): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error('PINATA_JWT not set — cannot pin to IPFS');
  }

  const body = JSON.stringify({
    pinataContent: data,
    pinataMetadata: { name },
  });

  const response = await fetchWithTimeout(PINATA_API_URL, 15000, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata error ${response.status}: ${text}`);
  }

  const result = await response.json() as { IpfsHash: string };
  return result.IpfsHash;
}

/**
 * Verify a CID is accessible on a public IPFS gateway.
 * Returns the resolved URL or null if unreachable.
 */
export async function verifyCID(cid: string): Promise<string | null> {
  const gateways = [
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
  ];

  for (const url of gateways) {
    try {
      const res = await fetchWithTimeout(url, 10000);
      if (res.ok) return url;
    } catch {
      // try next gateway
    }
  }
  return null;
}
