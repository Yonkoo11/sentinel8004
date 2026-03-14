import pLimit from 'p-limit';

export function createLimiter(concurrency: number) {
  return pLimit(concurrency);
}

/**
 * Token bucket rate limiter that actually works with concurrent calls.
 * The previous implementation was broken: concurrent callers all read the
 * same lastCall value and bypassed the limit entirely.
 */
export function createRateLimiter(maxPerSecond: number) {
  const interval = 1000 / maxPerSecond;
  let nextAvailable = 0;

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    // Reserve the next slot atomically (single-threaded JS guarantees this)
    const mySlot = Math.max(now, nextAvailable);
    nextAvailable = mySlot + interval;

    const wait = mySlot - now;
    if (wait > 0) {
      await sleep(wait);
    }
    return fn();
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Sentinel8004/0.1',
        ...init?.headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function jaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0; // No data = no similarity signal
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}
