import { fetchWithTimeout, canonicalJSON } from './utils.js';

const LIGHTHOUSE_API_URL = 'https://upload.lighthouse.storage/api/v0/add';

/**
 * Pin JSON to IPFS.
 * Provider priority: Filebase (S3) > Lighthouse > Pinata.
 */
export async function pinJSON(data: unknown, name: string): Promise<string> {
  const errors: string[] = [];

  const filebaseKey = process.env.FILEBASE_ACCESS_KEY;
  const filebaseSecret = process.env.FILEBASE_SECRET_KEY;
  const filebaseBucket = process.env.FILEBASE_BUCKET || 'sentinel8004';
  if (filebaseKey && filebaseSecret) {
    try {
      return await pinViaFilebase(data, name, filebaseKey, filebaseSecret, filebaseBucket);
    } catch (e) {
      errors.push(`Filebase: ${(e as Error).message}`);
    }
  }

  const lighthouseKey = process.env.LIGHTHOUSE_API_KEY;
  if (lighthouseKey) {
    try {
      return await pinViaLighthouse(data, name, lighthouseKey);
    } catch (e) {
      errors.push(`Lighthouse: ${(e as Error).message}`);
    }
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (pinataJwt) {
    try {
      return await pinViaPinata(data, name, pinataJwt);
    } catch (e) {
      errors.push(`Pinata: ${(e as Error).message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`All IPFS providers failed: ${errors.join('; ')}`);
  }
  throw new Error('No IPFS provider configured. Set FILEBASE_ACCESS_KEY+FILEBASE_SECRET_KEY, LIGHTHOUSE_API_KEY, or PINATA_JWT.');
}

async function pinViaFilebase(
  data: unknown,
  name: string,
  accessKey: string,
  secretKey: string,
  bucket: string
): Promise<string> {
  const { createHmac, createHash } = await import('node:crypto');
  const jsonStr = canonicalJSON(data);
  const body = Buffer.from(jsonStr, 'utf-8');
  const key = `${name}.json`;

  const host = `${bucket}.s3.filebase.com`;
  const region = 'us-east-1';
  const service = 's3';
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const contentHash = createHash('sha256').update(body).digest('hex');

  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${contentHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    `/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    contentHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const sign = (k: Buffer | string, msg: string) =>
    createHmac('sha256', k).update(msg).digest();
  const kDate = sign(`AWS4${secretKey}`, dateStamp);
  const kRegion = sign(kDate, region);
  const kService = sign(kRegion, service);
  const kSigning = sign(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetchWithTimeout(`https://${host}/${key}`, 30000, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      'x-amz-content-sha256': contentHash,
      'x-amz-date': amzDate,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Filebase error ${response.status}: ${text}`);
  }

  // Filebase returns the CID in the x-amz-meta-cid header
  const cid = response.headers.get('x-amz-meta-cid');
  if (!cid) {
    throw new Error('Filebase did not return a CID in x-amz-meta-cid header');
  }
  return cid;
}

async function pinViaLighthouse(data: unknown, name: string, apiKey: string): Promise<string> {
  const jsonStr = canonicalJSON(data);
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
  const jsonStr = canonicalJSON(data);
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
    `https://ipfs.filebase.io/ipfs/${cid}`,
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
