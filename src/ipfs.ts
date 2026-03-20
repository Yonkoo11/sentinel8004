import { fetchWithTimeout } from './utils.js';

const LIGHTHOUSE_API_URL = 'https://upload.lighthouse.storage/api/v0/add';

/**
 * Pin JSON to IPFS via Lighthouse.storage.
 * Requires LIGHTHOUSE_API_KEY env var.
 * Falls back to PINATA_JWT if Lighthouse key not set.
 */
export async function pinJSON(data: unknown, name: string): Promise<string> {
  const lighthouseKey = process.env.LIGHTHOUSE_API_KEY;
  if (lighthouseKey) {
    return pinViaLighthouse(data, name, lighthouseKey);
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (pinataJwt) {
    return pinViaPinata(data, name, pinataJwt);
  }

  throw new Error('No IPFS provider configured. Set LIGHTHOUSE_API_KEY or PINATA_JWT.');
}

async function pinViaLighthouse(data: unknown, name: string, apiKey: string): Promise<string> {
  const jsonStr = JSON.stringify(data);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  const formData = new FormData();
  formData.append('file', blob, `${name}.json`);

  const response = await fetchWithTimeout(LIGHTHOUSE_API_URL, 30000, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Lighthouse error ${response.status}: ${text}`);
  }

  const result = (await response.json()) as { data?: { Hash: string }; Hash?: string };
  const hash = result.data?.Hash ?? result.Hash;
  if (!hash) {
    throw new Error(`Lighthouse returned no CID: ${JSON.stringify(result)}`);
  }
  return hash;
}

async function pinViaPinata(data: unknown, name: string, jwt: string): Promise<string> {
  // Use pinFileToIPFS with exact JSON bytes to ensure the CID matches
  // what we hash on-chain (pinJSONToIPFS may re-serialize differently)
  const jsonStr = JSON.stringify(data);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  const formData = new FormData();
  formData.append('file', blob, `${name}.json`);
  formData.append('pinataMetadata', JSON.stringify({ name }));

  const response = await fetchWithTimeout('https://api.pinata.cloud/pinning/pinFileToIPFS', 30000, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata error ${response.status}: ${text}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return result.IpfsHash;
}

/**
 * Verify a CID is accessible on a public IPFS gateway.
 * Returns the resolved URL or null if unreachable.
 */
export async function verifyCID(cid: string): Promise<string | null> {
  const gateways = [
    `https://gateway.lighthouse.storage/ipfs/${cid}`,
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
