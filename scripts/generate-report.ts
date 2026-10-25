/**
 * Builds public/data/snapshot.json for the static site.
 *
 *   ANTHROPIC_API_KEY=...  npm run generate
 *
 * Pipeline: Yahoo daily closes -> statistics and look-alike model (code) -> news feeds (code)
 *           -> ONE Claude call to analyse the evidence (two voices) -> validation (code) -> atomic write.
 * Any failure leaves the previous files untouched so the site never shows half-built data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATALOG, INDICES, FACTORS } from '../src/data/catalog.js';
import type { HeavyweightRow, MacroItem, MarketItem, Report, Snapshot } from '../src/types/report.js';
import { HEAVYWEIGHTS } from '../src/data/heavyweights.js';
import { createHash } from 'node:crypto';
import { computeAnalog, computeEpisodes, computeMood, computeRelations, computeStats, describeStats, type Bar } from '../server/stats.js';
import { fetchAll, type FetchLike } from '../server/yahoo.js';
import { fetchHeadlines, retrievedFrom, selectHeadlines, selectNotes, tagItem, type Headline, type TextFetch } from '../server/news.js';
import { runSynthesis, type ClaudeLike } from '../server/synthesize.js';
import { validateReport } from '../server/validate.js';
import { SourceRegistry, tierOf } from '../server/sources.js';

export const MIN_INDICES = 18; // of 25
export const MIN_FACTORS = 7; // of 11
export const MIN_HEADLINES = 20;
export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export interface GenerateDeps {
  fetchFn: FetchLike;
  /** Fetches RSS feeds as text. */
  textFetch: TextFetch;
  /** null = free mode: numbers, statistics and headlines only, no written analysis. */
  claude: ClaudeLike | null;
  dataDir: string;
  now?: () => number;
  synthesisModel?: string;
  yahooDelayMs?: number;
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}

/** Largest names per index: one short Yahoo request each; failures are simply left out. */
async function fetchHeavyweights(fetchFn: FetchLike, delayMs?: number): Promise<HeavyweightRow[]> {
  const symbols = [...new Set(HEAVYWEIGHTS.map((h) => h.symbol))];
  const { ok } = await fetchAll(symbols, fetchFn, { range: '3mo', delayMs, attempts: 2 });
  const pct = (a: number, b: number) => Number((((a - b) / b) * 100).toFixed(2));
  const rows: HeavyweightRow[] = [];
  for (const h of HEAVYWEIGHTS) {
    const bars = ok[h.symbol]?.bars;
    if (!bars || bars.length < 6) continue;
    const last = bars[bars.length - 1];
    rows.push({
      symbol: h.symbol,
      name: h.name,
      indices: h.indices,
      asOf: last.date,
      change1d: pct(last.close, bars[bars.length - 2].close),
      change5d: pct(last.close, bars[bars.length - 6].close),
    });
  }
  return rows;
}

/** Reads macro indicators written by the Python collectors (python -m markets_collect). Missing file = no macro data. */
export function readMacro(dir: string): MacroItem[] {
  const extra = readJson<{ macro?: MacroItem[] }>(path.join(dir, 'extra.json'));
  return (extra?.macro ?? []).filter((m) => m && typeof m.id === 'string' && Number.isFinite(m.value) && m.date);
}

const macroLine = (m: MacroItem) =>
  `${m.name} (${m.region}): ${m.value} ${m.unit} for ${m.date}${m.previous !== null ? `; previous ${m.previous} for ${m.previous_date}` : ''}. Source: ${m.source}`;

function heavyweightLines(rows: HeavyweightRow[], market: MarketItem[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of market) {
    if (m.kind !== 'index') continue;
    const mine = rows.filter((r) => r.indices.includes(m.id));
    if (mine.length < 2) continue;
    const up = mine.filter((r) => r.change1d > 0).length;
    out.push([
      `hw:${m.id}`,
      `Largest names in ${m.name} (hand-kept list, no weights): ${mine.map((r) => `${r.name} ${r.change1d >= 0 ? '+' : ''}${r.change1d.toFixed(2)}% (1d), ${r.change5d === null ? 'n/a' : `${r.change5d >= 0 ? '+' : ''}${r.change5d.toFixed(2)}%`} (5d)`).join('; ')}. ${up} of ${mine.length} rose on the day`,
    ]);
  }
  return out;
}

const rd = (v: number) => Number(v.toFixed(Math.abs(v) < 10 ? 4 : 2));

export async function generate(deps: GenerateDeps): Promise<Snapshot> {
  const now = deps.now ?? Date.now;
  const today = new Date(now()).toISOString().slice(0, 10);
  const warnings: string[] = [];
  const synthesisModel = deps.synthesisModel ?? DEFAULT_MODEL;
  const file = path.join(deps.dataDir, 'snapshot.json');
  const previous = readJson<Snapshot>(file);

  // 1. Market data
  const { ok, failed } = await fetchAll(
    CATALOG.map((c) => c.symbol),
    deps.fetchFn,
    { delayMs: deps.yahooDelayMs }
  );
  const barsOf = (symbol: string): Bar[] | null => ok[symbol]?.bars ?? null;
  const factorBars: Record<string, Bar[]> = {};
  for (const f of FACTORS) {
    const b = barsOf(f.symbol);
    if (b) factorBars[f.id] = b;
  }

  const market: MarketItem[] = CATALOG.map((c) => {
    const bars = barsOf(c.symbol);
    const stats = bars ? computeStats(bars) : null;
    return {
      id: c.id, kind: c.kind, name: c.name, country: c.country, region: c.region, symbol: c.symbol, unit: c.unit, about: c.about,
      stats,
      analog: bars && stats ? computeAnalog(bars) : null,
      episodes: bars && stats ? computeEpisodes(bars) : [],
      relations: bars && stats && c.kind === 'index' ? computeRelations(bars, factorBars) : [],
      series: bars && stats ? bars.slice(-60).map((b) => rd(b.close)) : [],
      why: null,
      error: stats ? undefined : failed[c.symbol] ?? 'not enough price history',
    };
  });

  const idxOk = market.filter((m) => m.kind === 'index' && m.stats).length;
  const facOk = market.filter((m) => m.kind === 'factor' && m.stats).length;
  if (idxOk < MIN_INDICES || facOk < MIN_FACTORS) {
    throw new Error(
      `Quality gate failed: usable price history for ${idxOk}/${INDICES.length} indices and ${facOk}/${FACTORS.length} factors ` +
        `(need ${MIN_INDICES} and ${MIN_FACTORS}). Previous data kept. Yahoo Finance may be limiting requests; re-run later.`
    );
  }
  const missing = market.filter((m) => !m.stats).map((m) => m.name);
  if (missing.length) warnings.push(`No price data was available for: ${missing.join(', ')}. They are shown as unavailable.`);

  const vix = market.find((m) => m.id === 'vix')?.stats ?? null;
  const mood = computeMood(
    market.filter((m) => m.kind === 'index').map((m) => m.stats?.change1d ?? null),
    vix ? { last: vix.last, change1d: vix.change1d } : null
  );

  // 1b. Biggest names per index (best effort) and macro indicators collected by the Python step (best effort)
  const hw = await fetchHeavyweights(deps.fetchFn, deps.yahooDelayMs);
  const macro = readMacro(deps.dataDir);
  if (macro.length === 0) warnings.push('No macro indicators were available (the Python step may have failed, or no FRED key is set for US data).');

  // 2-4. Claude research -> report -> validation
  const marketText = new Map<string, string>();
  for (const m of market) if (m.stats) marketText.set(m.id, describeStats(m.name, m.stats, m.analog, m.relations, m.episodes));
  for (const m of macro) marketText.set(m.id, macroLine(m));
  for (const [id, t] of heavyweightLines(hw, market)) marketText.set(id, t);
  const brief = ['sp500', 'vix', 'us10y', 'brent']
    .filter((id) => marketText.has(id))
    .map((id) => marketText.get(id)!.split('; ').slice(0, 2).join('; '))
    .join(' | ');

  let report: Report | null = previous?.report ?? null;
  let sources = previous?.sources ?? [];
  let usage = { headlines: 0, feedsOk: 0, feedsFailed: 0, inputTokens: 0, outputTokens: 0 };
  let carriedWhy = true;
  let inputHash: string | undefined = previous?.inputHash;
  let latest: Headline[] = [];

  try {
    // 2. Headlines collected by plain code (no AI, no cost)
    const news = await fetchHeadlines(deps.textFetch, now());
    usage.feedsOk = news.ok;
    usage.feedsFailed = news.failed.length;
    if (news.failed.length) warnings.push(`${news.failed.length} news feed(s) could not be read this time: ${news.failed.slice(0, 6).join('; ')}.`);
    latest = selectHeadlines(news.items, 60).map((x) => x.h);
    usage.headlines = latest.length;
    if (!deps.claude) throw new Error('FREE_MODE');
    const notes = selectNotes(news.items);
    usage.headlines = notes.length;
    if (notes.length < MIN_HEADLINES) throw new Error(`only ${notes.length} fresh headlines were collected (need ${MIN_HEADLINES})`);

    // Skip the paid step when nothing has changed since the last run.
    inputHash = createHash('sha256')
      .update(JSON.stringify([notes.map((n) => n.urls[0]), market.map((m) => m.stats?.asOf + ':' + m.stats?.last), macro.map((m) => m.id + m.date + m.value)]))
      .digest('hex')
      .slice(0, 16);
    if (previous?.report && previous.inputHash === inputHash) {
      report = { ...previous.report, generatedAt: new Date(now()).toISOString() };
      carriedWhy = true;
      warnings.push('Headlines and prices are unchanged since the last update, so the existing analysis was reused (no Claude usage).');
    } else {
      // 3. One Claude call: analyse the collected evidence (no web search, no tools besides the report form)
      const synth = await runSynthesis(deps.claude!, {
        model: synthesisModel,
        notes,
        marketLines: [...marketText].map(([id, t]) => `${id} | ${t}`),
        today,
      });
      const registry = new SourceRegistry(retrievedFrom(news.items));
      const v = validateReport(synth.raw, { notes: new Map(notes.map((n) => [n.id, n])), marketText, registry });
      warnings.push(...v.warnings);
      if (!v.report.global && v.report.regions.length === 0 && v.report.drivers.length === 0) {
        throw new Error('every analysis item failed source validation');
      }
      report = { generatedAt: new Date(now()).toISOString(), ...v.report };
      sources = registry.list();
      usage.inputTokens = synth.inputTokens;
      usage.outputTokens = synth.outputTokens;
      for (const m of market) m.why = v.why[m.id] ?? null;
      carriedWhy = false;
    }
  } catch (err) {
    const msg = (err as Error).message;
    inputHash = previous?.inputHash;
    if (msg === 'FREE_MODE') {
      warnings.push('Free mode: no Claude key is configured, so there is no written analysis. Prices, statistics, look-alike history and the latest headlines (with links) are shown. Add ANTHROPIC_API_KEY to switch on the plain-English and technical analysis.');
      report = null;
      sources = [];
      carriedWhy = false;
    } else if (previous?.report) {
      warnings.push(`Today's analysis could not be produced (${msg}). The written analysis shown is from ${previous.report.generatedAt.slice(0, 10)}; the numbers are current.`);
    } else {
      warnings.push(`The written analysis could not be produced (${msg}). Only the computed market data is shown.`);
      report = null;
      sources = [];
    }
  }
  if (carriedWhy && previous) {
    // Explanations from the older report keep their (older) source numbers, which match the carried sources.
    for (const m of market) m.why = previous.market?.find((p) => p.id === m.id)?.why ?? null;
  }

  const snapshot: Snapshot = {
    schemaVersion: 2,
    generatedAt: new Date(now()).toISOString(),
    models: { synthesis: synthesisModel },
    inputHash,
    mood,
    market,
    report,
    macro,
    heavyweights: hw,
    headlines: latest.map((h) => ({
      title: h.title,
      url: h.url,
      publisher: h.publisher,
      tier: tierOf(h.tierUrl),
      published: new Date(h.published).toISOString(),
      about: tagItem(h),
    })),
    sources,
    warnings,
    usage,
  };
  fs.mkdirSync(deps.dataDir, { recursive: true });
  writeJsonAtomic(file, snapshot);
  return snapshot;
}

async function main() {
  try {
    const { default: dotenv } = await import('dotenv');
    dotenv.config();
  } catch {
    /* .env support is optional: on GitHub the key comes from repository secrets */
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) console.log('::notice::No ANTHROPIC_API_KEY set: running in free mode (numbers, statistics and headlines, no written analysis).');
  try {
    let claude: ClaudeLike | null = null;
    if (key) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      claude = new Anthropic({ apiKey: key, maxRetries: 6, timeout: 600_000 }) as unknown as ClaudeLike;
    }
    const snap = await generate({
      fetchFn: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }) as any,
      textFetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }) as any,
      claude,
      dataDir: path.resolve('public/data'),
      synthesisModel: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      yahooDelayMs: 1500,
    });
    const n = snap.market.filter((m) => m.stats).length;
    console.log(
      `Snapshot written: ${n}/${snap.market.length} market series, ${snap.usage.headlines} headlines from ${snap.usage.feedsOk} feeds, ` +
        `${snap.sources.length} sources cited, Claude tokens: ${snap.usage.inputTokens} in / ${snap.usage.outputTokens} out.`
    );
    for (const w of snap.warnings) console.log(`::warning::${w}`);
  } catch (err) {
    console.error(`::error::Data update failed. The previous data was kept. ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(`::error::Unexpected failure. The previous data was kept. ${(err as Error).message}`);
    process.exitCode = 1;
  });
}
