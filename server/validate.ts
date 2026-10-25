/**
 * Step 3: nothing Claude wrote is trusted. Each item is kept only if
 *   - the notes it cites exist and point to pages the search tool really returned,
 *   - the market ids it cites exist (their numbers are computed by code),
 *   - every number in its text can be found in that evidence (after rounding),
 * otherwise it is dropped and a warning is recorded.
 */
import { CATALOG, CATALOG_BY_ID } from '../src/data/catalog.js';
import type { EventItem, Insight, Report, TwoLevel } from '../src/types/report.js';
import type { Note } from './news.js';
import type { SourceRegistry } from './sources.js';

export interface ValidateCtx {
  notes: Map<string, Note>;
  /** Evidence text for each market id (the same strings Claude was shown). */
  marketText: Map<string, string>;
  registry: SourceRegistry;
}

export interface Validated {
  report: Omit<Report, 'generatedAt'>;
  why: Record<string, TwoLevel & { sources: number[] }>;
  warnings: string[];
}

const NAME_PATTERNS = CATALOG.map((c) => c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const IGNORE = new RegExp(
  [
    ...NAME_PATTERNS,
    'S&P ?500', 'Nasdaq[- ]100', 'Dow 30', 'Q[1-4]', 'G7', 'G20', 'COVID-19', 'RSI ?14', 'RSI14',
    '\\b\\d+[- ](?:year|day|week|month|hour|minute|session)s?\\b',
    '\\b\\d+(?:st|nd|rd|th)\\b',
  ].join('|'),
  'gi'
);

function numbersIn(s: string): Array<{ raw: string; value: number; decimals: number; small: boolean }> {
  const out: Array<{ raw: string; value: number; decimals: number; small: boolean }> = [];
  for (const m of s.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const clean = m[0].replace(/,$/, '').replace(/,/g, '');
    const value = Number(clean);
    if (!Number.isFinite(value)) continue;
    const decimals = clean.includes('.') ? clean.split('.')[1].length : 0;
    const next = s[(m.index ?? 0) + m[0].length];
    out.push({ raw: m[0], value, decimals, small: decimals === 0 && value <= 31 && next !== '%' });
  }
  return out;
}

/** Numbers in `claim` that cannot be found (within rounding) in `evidence`. */
export function unsupportedNumbers(claim: string, evidence: string): string[] {
  const ev = numbersIn(evidence.replace(IGNORE, ' ')).map((n) => n.value);
  const bad: string[] = [];
  for (const n of numbersIn(claim.replace(IGNORE, ' '))) {
    if (n.small) continue;
    if (n.decimals === 0 && n.value >= 1900 && n.value <= 2100) continue; // years
    const tol = Math.max(0.5 * 10 ** -n.decimals, n.decimals === 0 && n.value >= 100 ? 0.005 * n.value : 0) + 1e-9;
    if (!ev.some((e) => Math.abs(e - n.value) <= tol)) bad.push(n.raw);
  }
  return bad;
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

function two(v: any, mt = 480, ml = 360): TwoLevel | null {
  const technical = str(v?.technical, mt);
  const layman = str(v?.layman, ml);
  return technical.length >= 15 && layman.length >= 15 ? { technical, layman } : null;
}

export function validateReport(raw: any, ctx: ValidateCtx): Validated {
  const warnings: string[] = [];

  /** Resolves cited ids to usable notes and market ids. */
  const resolve = (noteIds: unknown, marketIds: unknown) => {
    const notes = [...new Set(strs(noteIds))].map((id) => ctx.notes.get(id)).filter((n): n is Note => !!n);
    const usable = notes.filter((n) => n.urls.some((u) => ctx.registry.isReal(u)));
    const market = [...new Set(strs(marketIds))].filter((id) => ctx.marketText.has(id));
    return { notes: usable, market };
  };
  const evidenceText = (notes: Note[], market: string[]) =>
    [...notes.map((n) => `${n.text} ${n.excerpts.join(' ')}`), ...market.map((m) => ctx.marketText.get(m)!)].join('\n');
  const sourceNumbers = (notes: Note[]) => {
    const nums = new Set<number>();
    for (const n of notes) for (const u of n.urls) {
      const k = ctx.registry.numberFor(u);
      if (k) nums.add(k);
    }
    return [...nums].sort((a, b) => a - b);
  };
  const lint = (label: string, texts: string[], ev: string): boolean => {
    const bad = texts.flatMap((t) => unsupportedNumbers(t, ev));
    if (bad.length) {
      warnings.push(`Dropped "${label}": number(s) ${[...new Set(bad)].join(', ')} not found in its cited evidence.`);
      return false;
    }
    return true;
  };

  const insight = (v: any, label: string): Insight | null => {
    const title = str(v?.title, 80);
    const parts = { status: two(v?.status), consequence: two(v?.consequence), impact: two(v?.impact), outlook: two(v?.outlook) };
    if (!title || !parts.status || !parts.consequence || !parts.impact || !parts.outlook) {
      warnings.push(`Dropped "${title || label}": incomplete (needs status, consequence, impact and outlook in both voices).`);
      return null;
    }
    const { notes, market } = resolve(v?.notes, v?.market);
    if (notes.length === 0 || market.length === 0) {
      warnings.push(`Dropped "${title}": it must cite at least one source note and one market data series.`);
      return null;
    }
    const texts = Object.values(parts).flatMap((p) => [p!.technical, p!.layman]);
    if (!lint(title, texts, evidenceText(notes, market))) return null;
    return { title, ...(parts as Record<'status' | 'consequence' | 'impact' | 'outlook', TwoLevel>), quant: market, sources: sourceNumbers(notes) };
  };

  // headline (optional: UI falls back to the global status)
  let headline: TwoLevel | null = null;
  const h = two(raw?.headline, 320, 260);
  if (h) {
    const { notes, market } = resolve(raw.headline.notes, raw.headline.market);
    if (notes.length && market.length && lint('headline', [h.technical, h.layman], evidenceText(notes, market))) headline = h;
    else if (!notes.length || !market.length) warnings.push('Dropped "headline": missing citations.');
  }

  const global = raw?.global ? insight(raw.global, 'global overview') : null;
  const regions = (Array.isArray(raw?.regions) ? raw.regions : []).slice(0, 3).map((r: any) => insight(r, 'region')).filter(Boolean) as Insight[];
  const drivers = (Array.isArray(raw?.drivers) ? raw.drivers : []).slice(0, 5).map((r: any) => insight(r, 'driver')).filter(Boolean) as Insight[];

  const why: Validated['why'] = {};
  for (const v of Array.isArray(raw?.indexNotes) ? raw.indexNotes : []) {
    const id = str(v?.id, 40);
    const cat = CATALOG_BY_ID[id];
    if (!cat || cat.kind !== 'index' || !ctx.marketText.has(id)) continue;
    const t = two(v, 300, 260);
    const { notes } = resolve(v?.notes, []);
    if (!t || notes.length === 0) {
      warnings.push(`Dropped explanation for ${cat.name}: missing text or source.`);
      continue;
    }
    if (!lint(cat.name, [t.technical, t.layman], evidenceText(notes, [id]))) continue;
    why[id] = { ...t, sources: sourceNumbers(notes) };
  }

  const events: EventItem[] = [];
  for (const v of (Array.isArray(raw?.events) ? raw.events : []).slice(0, 12)) {
    const t = two(v, 300, 260);
    const title = str(v?.title, 100);
    const { notes } = resolve(v?.notes, []);
    if (!t || !title || notes.length === 0) continue;
    if (!lint(title, [t.technical, t.layman], evidenceText(notes, []))) continue;
    events.push({ when: str(v?.when, 50), title, ...t, sources: sourceNumbers(notes) });
  }

  return { report: { headline, global, regions, drivers, events }, why, warnings };
}
