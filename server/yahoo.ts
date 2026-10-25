/**
 * Fetches daily closes from Yahoo Finance's public chart endpoint (no API key).
 * Unofficial endpoint: it can change or rate-limit, so every failure is reported per symbol and the
 * pipeline's quality gate decides whether enough data arrived.
 */
import type { Bar } from './stats.js';

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}>;

export interface PriceSeries {
  symbol: string;
  currency: string | null;
  bars: Bar[];
}

export function parseChart(json: any, symbol: string): PriceSeries {
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(json?.chart?.error?.description ?? 'no chart result');
  const ts: number[] = r.timestamp ?? [];
  const closes: Array<number | null> = r.indicators?.quote?.[0]?.close ?? [];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c !== 'number' || !Number.isFinite(c) || c <= 0) continue;
    // Use the exchange-local date so Asian sessions are not shifted into the previous UTC day.
    const offset: number = r.meta?.gmtoffset ?? 0;
    const date = new Date((ts[i] + offset) * 1000).toISOString().slice(0, 10);
    if (bars.length && bars[bars.length - 1].date === date) bars[bars.length - 1].close = c;
    else bars.push({ date, close: c });
  }
  if (bars.length < 25) throw new Error(`only ${bars.length} usable daily closes`);
  return { symbol, currency: r.meta?.currency ?? null, bars };
}

export async function fetchSeries(
  symbol: string,
  fetchFn: FetchLike,
  opts: { attempts?: number; delayMs?: number } = {}
): Promise<PriceSeries> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 1500;
  let lastErr = 'unknown error';
  for (let i = 1; i <= attempts; i++) {
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      try {
        const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&includePrePost=false`;
        const res = await fetchFn(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; global-markets-intelligence)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseChart(await res.json(), symbol);
      } catch (err) {
        lastErr = (err as Error).message;
      }
    }
    if (i < attempts && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs * i));
  }
  throw new Error(`${symbol}: ${lastErr}`);
}

/** Fetches many symbols with limited parallelism. Failures are returned, not thrown. */
export async function fetchAll(
  symbols: string[],
  fetchFn: FetchLike,
  opts: { concurrency?: number; attempts?: number; delayMs?: number } = {}
): Promise<{ ok: Record<string, PriceSeries>; failed: Record<string, string> }> {
  const ok: Record<string, PriceSeries> = {};
  const failed: Record<string, string> = {};
  const queue = [...symbols];
  const worker = async () => {
    for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
      try {
        ok[s] = await fetchSeries(s, fetchFn, opts);
      } catch (err) {
        failed[s] = (err as Error).message;
      }
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  return { ok, failed };
}
