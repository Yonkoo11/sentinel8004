import { gunzipSync } from 'node:zlib';
import type { AgentMetadata, MetadataFormat } from './types.js';
import { IPFS_GATEWAYS, IPFS_FETCH_TIMEOUT_MS, HTTP_METADATA_TIMEOUT_MS } from './config.js';
import { fetchWithTimeout } from './utils.js';

interface ParseResult {
  metadata: AgentMetadata | null;
  format: MetadataFormat;
  error: string | null;
}

export async function parseMetadata(tokenURI: string): Promise<ParseResult> {
  if (!tokenURI || tokenURI.trim() === '') {
    return { metadata: null, format: 'unknown', error: 'Empty tokenURI' };
  }

  // 1. Gzip + Base64 data URI
  const gzipMatch = tokenURI.match(/^data:application\/json;(?:enc=gzip;[^,]*,|[^,]*enc=gzip[^,]*,)(.+)$/);
  if (gzipMatch) {
    return tryGzipBase64(gzipMatch[1]);
  }

  // 2. Plain Base64 data URI
  const base64Match = tokenURI.match(/^data:application\/json;base64,(.+)$/);
  if (base64Match) {
    return tryBase64(base64Match[1]);
  }

  // 3. IPFS URI
  if (tokenURI.startsWith('ipfs://')) {
    const hash = tokenURI.replace('ipfs://', '');
    return tryIPFS(hash);
  }

  // 4. HTTP(S) URL
  if (tokenURI.startsWith('http://') || tokenURI.startsWith('https://')) {
    return tryHTTP(tokenURI);
  }

  // 5. Raw JSON string (some agents store JSON directly)
  return tryRawJSON(tokenURI);
}

function tryGzipBase64(encoded: string): ParseResult {
  try {
    const buffer = Buffer.from(encoded, 'base64');
    const decompressed = gunzipSync(buffer);
    const json = JSON.parse(decompressed.toString('utf-8'));
    return { metadata: normalizeMetadata(json), format: 'gzip-base64', error: null };
  } catch (e) {
    return { metadata: null, format: 'gzip-base64', error: `Gzip decode failed: ${(e as Error).message}` };
  }
}

function tryBase64(encoded: string): ParseResult {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const json = JSON.parse(decoded);
    return { metadata: normalizeMetadata(json), format: 'base64', error: null };
  } catch (e) {
    // Might be gzipped without the enc=gzip marker
    try {
      const buffer = Buffer.from(encoded, 'base64');
      if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
        const decompressed = gunzipSync(buffer);
        const json = JSON.parse(decompressed.toString('utf-8'));
        return { metadata: normalizeMetadata(json), format: 'gzip-base64', error: null };
      }
    } catch { /* fall through */ }
    return { metadata: null, format: 'base64', error: `Base64 decode failed: ${(e as Error).message}` };
  }
}

async function tryIPFS(hash: string): Promise<ParseResult> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetchWithTimeout(`${gateway}${hash}`, IPFS_FETCH_TIMEOUT_MS);
      if (response.ok) {
        const text = await response.text();
        const json = JSON.parse(text);
        return { metadata: normalizeMetadata(json), format: 'ipfs', error: null };
      }
    } catch { /* try next gateway */ }
  }
  return { metadata: null, format: 'ipfs', error: `All IPFS gateways failed for hash: ${hash}` };
}

async function tryHTTP(url: string): Promise<ParseResult> {
  try {
    const response = await fetchWithTimeout(url, HTTP_METADATA_TIMEOUT_MS);
    if (!response.ok) {
      return { metadata: null, format: 'http', error: `HTTP ${response.status} from ${url}` };
    }
    const text = await response.text();
    const json = JSON.parse(text);
    return { metadata: normalizeMetadata(json), format: 'http', error: null };
  } catch (e) {
    return { metadata: null, format: 'http', error: `HTTP fetch failed: ${(e as Error).message}` };
  }
}

function tryRawJSON(raw: string): ParseResult {
  try {
    const json = JSON.parse(raw);
    return { metadata: normalizeMetadata(json), format: 'raw-json', error: null };
  } catch {
    return { metadata: null, format: 'unknown', error: `Not valid JSON and not a recognized URI format` };
  }
}

function normalizeMetadata(json: unknown): AgentMetadata | null {
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;

  // Normalize services: some use endpoint, some use url
  if (Array.isArray(obj.services)) {
    obj.services = obj.services.map((s: Record<string, unknown>) => ({
      ...s,
      endpoint: s.endpoint || s.url,
    }));
  }

  return obj as AgentMetadata;
}
