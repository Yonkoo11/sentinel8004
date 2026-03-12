import pLimit from 'p-limit';
import type { AgentRecord, LayerScore } from '../types.js';
import { HTTP_PROBE_TIMEOUT_MS, HTTP_PROBE_CONCURRENCY } from '../config.js';
import { fetchWithTimeout } from '../utils.js';

export async function scoreLiveness(agent: AgentRecord): Promise<LayerScore> {
  const details: string[] = [];
  const flags: string[] = [];

  if (!agent.metadata) {
    details.push('No metadata — cannot check endpoints');
    return { layer: 'liveness', score: 0, maxScore: 25, details, flags };
  }

  const endpoints = extractEndpoints(agent.metadata);

  if (endpoints.length === 0) {
    details.push('No HTTP endpoints declared');
    return { layer: 'liveness', score: 0, maxScore: 25, details, flags };
  }

  const limit = pLimit(HTTP_PROBE_CONCURRENCY);
  const results = await Promise.all(
    endpoints.map(ep => limit(() => probeEndpoint(ep)))
  );

  let liveCount = 0;
  let domainVerified = false;

  for (const r of results) {
    if (r.live) {
      liveCount++;
      details.push(`LIVE: ${r.url} (${r.status})`);
    } else {
      details.push(`DEAD: ${r.url} (${r.error})`);
      flags.push(`DEAD_ENDPOINT:${r.url}`);
    }
    if (r.domainVerified) {
      domainVerified = true;
      details.push(`Domain verified: ${r.url}`);
    }
  }

  // Score: proportional to live endpoints
  const endpointScore = Math.round((liveCount / endpoints.length) * 20);
  const domainScore = domainVerified ? 5 : 0;
  const score = Math.min(25, endpointScore + domainScore);

  if (liveCount === 0) {
    flags.push('ALL_ENDPOINTS_DEAD');
  }

  details.unshift(`${liveCount}/${endpoints.length} endpoints live`);

  return { layer: 'liveness', score, maxScore: 25, details, flags };
}

function extractEndpoints(metadata: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const services = metadata.services as Array<Record<string, string>> | undefined;

  if (Array.isArray(services)) {
    for (const service of services) {
      const url = service.endpoint || service.url;
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        // Skip localhost URLs
        if (url.includes('localhost') || url.includes('127.0.0.1')) continue;
        urls.push(url);
      }
    }
  }

  // Also check top-level endpoint if present
  const topEndpoint = metadata.endpoint as string | undefined;
  if (topEndpoint && (topEndpoint.startsWith('http://') || topEndpoint.startsWith('https://'))) {
    urls.push(topEndpoint);
  }

  // Deduplicate
  return [...new Set(urls)];
}

interface ProbeResult {
  url: string;
  live: boolean;
  status?: number;
  error?: string;
  domainVerified: boolean;
}

// Known generic domains that don't indicate real agent endpoints
const GENERIC_DOMAINS = new Set([
  'google.com', 'www.google.com', 'example.com', 'www.example.com',
  'github.com', 'www.github.com', 'twitter.com', 'x.com',
  'facebook.com', 'youtube.com', 'wikipedia.org',
]);

async function probeEndpoint(url: string): Promise<ProbeResult> {
  let live = false;
  let status: number | undefined;
  let error: string | undefined;
  let domainVerified = false;

  // Check if endpoint points to a generic domain (not an agent service)
  try {
    const hostname = new URL(url).hostname;
    if (GENERIC_DOMAINS.has(hostname)) {
      return {
        url,
        live: false,
        error: 'Generic domain (not an agent endpoint)',
        domainVerified: false,
      };
    }
  } catch { /* invalid URL, will fail below */ }

  try {
    const response = await fetchWithTimeout(url, HTTP_PROBE_TIMEOUT_MS);
    status = response.status;
    // Any non-5xx response means the server is live
    if (response.status < 500) {
      live = true;
      // Check if the response is a parking/placeholder page
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          const body = await response.text();
          const lower = body.toLowerCase();
          // Common parking page indicators
          if (lower.includes('domain is for sale') ||
              lower.includes('buy this domain') ||
              lower.includes('parked domain') ||
              lower.includes('under construction') && body.length < 2000) {
            live = false;
            error = 'Parking/placeholder page detected';
          }
        }
      } catch { /* body read failed, keep live=true */ }
    }
  } catch (e) {
    error = (e as Error).message;
    if (error.includes('abort')) error = 'Timeout';
  }

  // Check .well-known for domain verification
  try {
    const domain = new URL(url).origin;
    const wellKnown = await fetchWithTimeout(
      `${domain}/.well-known/agent-registration.json`,
      HTTP_PROBE_TIMEOUT_MS
    );
    if (wellKnown.ok) {
      domainVerified = true;
    }
  } catch { /* ignore */ }

  return { url, live, status, error, domainVerified };
}
