/**
 * Collects headlines with plain code (RSS/Atom feeds), so Claude does not have to search the web.
 * Every item keeps the link, publisher and date given by its feed. Items from sites outside the trusted
 * list (server/sources.ts) are discarded.
 */
import { CATALOG } from '../src/data/catalog.js';
import { hostOf, tierOf, type Retrieved } from './sources.js';

export type TextFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export interface Feed {
  name: string;
  url: string;
}

const google = (q: string): Feed => ({
  name: `Google News: ${q}`,
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=en-US&gl=US&ceid=US:en`,
});

/** Edit freely: a feed that stops working is skipped with a warning, it never breaks the update. */
export const FEEDS: Feed[] = [
  { name: 'Federal Reserve press releases', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { name: 'ECB press', url: 'https://www.ecb.europa.eu/rss/press.html' },
  { name: 'Bank of England news', url: 'https://www.bankofengland.co.uk/rss/news' },
  { name: 'RBI press releases', url: 'https://rbi.org.in/pressreleases_rss.xml' },
  { name: 'CNBC finance', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
  { name: 'CNBC top news', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'MarketWatch market pulse', url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse' },
  { name: 'BBC business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Guardian business', url: 'https://www.theguardian.com/business/rss' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar' },
  { name: 'SCMP business', url: 'https://www.scmp.com/rss/92/feed' },
  { name: 'Economic Times markets', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  { name: 'Mint markets', url: 'https://www.livemint.com/rss/markets' },
  { name: 'Business Standard markets', url: 'https://www.business-standard.com/rss/markets-106.rss' },
  { name: 'Moneycontrol market reports', url: 'https://www.moneycontrol.com/rss/marketreports.xml' },
  google('stock market today Wall Street'),
  google('Federal Reserve interest rates Treasury yields'),
  google('oil prices Brent OPEC'),
  google('gold price dollar index'),
  google('tariffs trade war markets'),
  google('European shares STOXX DAX FTSE ECB'),
  google('Nikkei Tokyo stocks Bank of Japan yen'),
  google('Hang Seng China stocks PBOC'),
  google('Sensex Nifty India stocks RBI FII'),
  google('KOSPI Taiwan Taiex Asian markets'),
  google('ASX 200 Australian shares RBA'),
  google('Bovespa Brazil Mexico stocks'),
  google('week ahead markets calendar central bank earnings'),
];

export interface Headline {
  title: string;
  snippet: string;
  url: string;
  publisher: string;
  /** URL whose host decides the trust tier (for aggregators, the real publisher's site). */
  tierUrl: string;
  published: number; // epoch ms
  feed: string;
}

export interface Note {
  id: string; // N1, N2, ...
  topic: string;
  text: string;
  excerpts: string[];
  urls: string[];
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m);
const strip = (s: string) => decode(decode(s)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}

export interface RawItem {
  title: string;
  snippet: string;
  url: string;
  published: number | null;
  sourceName: string;
  sourceUrl: string;
}

/** Parses RSS 2.0 and Atom without extra packages. */
export function parseFeed(xml: string): RawItem[] {
  const out: RawItem[] = [];
  for (const m of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const b = m[2];
    const title = strip(tag(b, 'title'));
    let url = strip(tag(b, 'link'));
    if (!url) url = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '';
    if (!url) url = strip(tag(b, 'guid'));
    const date = strip(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const t = Date.parse(date);
    const desc = strip(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'));
    const src = b.match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/i);
    if (!title || !/^https?:\/\//.test(url)) continue;
    out.push({
      title,
      snippet: desc === title ? '' : desc.slice(0, 280),
      url,
      published: Number.isFinite(t) ? t : null,
      sourceName: src ? strip(src[2]) : '',
      sourceUrl: src?.[1] ?? '',
    });
  }
  return out;
}

export function toHeadline(r: RawItem, feed: Feed): Headline | null {
  if (r.published === null) return null; // an undated item cannot be vetted for freshness
  // Google News titles end with " - Publisher"; remove it, the publisher is kept separately.
  let title = r.title;
  if (r.sourceName && title.endsWith(` - ${r.sourceName}`)) title = title.slice(0, -(r.sourceName.length + 3));
  const tierUrl = r.sourceUrl || r.url;
  if (tierOf(tierUrl) === 'other') return null;
  const publisher = r.sourceName || hostOf(r.url).replace(/^(www|feeds|rss)\./, '');
  return { title, snippet: r.snippet, url: r.url, publisher, tierUrl, published: r.published, feed: feed.name };
}

export async function fetchHeadlines(
  fetchFn: TextFetch,
  now: number,
  opts: { feeds?: Feed[]; maxAgeHours?: number; concurrency?: number } = {}
): Promise<{ items: Headline[]; ok: number; failed: string[] }> {
  const feeds = opts.feeds ?? FEEDS;
  const maxAge = (opts.maxAgeHours ?? 72) * 3600_000;
  const items: Headline[] = [];
  const failed: string[] = [];
  let ok = 0;
  const queue = [...feeds];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      try {
        const res = await fetchFn(f.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; global-markets-intelligence)', Accept: 'application/rss+xml, application/atom+xml, text/xml, */*' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseFeed(await res.text());
        if (parsed.length === 0) throw new Error('no items');
        ok++;
        for (const r of parsed) {
          const h = toHeadline(r, f);
          if (h && now - h.published <= maxAge && h.published <= now + 3600_000) items.push(h);
        }
      } catch (err) {
        failed.push(`${f.name} (${(err as Error).message})`);
      }
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  return { items, ok, failed };
}

const KEYWORDS: Record<string, string[]> = {
  sp500: ['s&p 500', 'wall street', 'us stocks'],
  dow: ['dow jones'],
  nasdaq: ['nasdaq'],
  russell2000: ['russell 2000', 'small-cap', 'small caps'],
  tsx: ['tsx', 'toronto'],
  bovespa: ['bovespa', 'ibovespa', 'brazil'],
  ipc: ['mexican stocks', 'mexico'],
  ftse100: ['ftse 100', 'ftse', 'london stocks'],
  dax: ['dax', 'frankfurt', 'german stocks'],
  cac40: ['cac 40', 'paris', 'french stocks'],
  eurostoxx50: ['stoxx', 'european shares', 'european stocks', 'euro zone', 'eurozone'],
  ibex35: ['ibex', 'spanish stocks'],
  ftsemib: ['ftse mib', 'milan', 'italian stocks'],
  smi: ['swiss market index', 'swiss stocks', 'zurich'],
  aex: ['aex', 'amsterdam', 'dutch stocks'],
  nikkei: ['nikkei', 'tokyo', 'japan', 'yen'],
  hangseng: ['hang seng', 'hong kong'],
  shanghai: ['shanghai', 'china stocks', 'csi 300'],
  shenzhen: ['shenzhen', 'chinext'],
  nifty50: ['nifty'],
  sensex: ['sensex'],
  kospi: ['kospi', 'seoul', 'south korea'],
  asx200: ['asx', 'australian shares', 'sydney'],
  taiex: ['taiex', 'taiwan'],
  straitstimes: ['straits times', 'singapore'],
};
const KEY_RE = Object.fromEntries(
  Object.entries(KEYWORDS).map(([id, ks]) => [id, new RegExp(`(?:^|[^a-z0-9])(?:${ks.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:$|[^a-z0-9])`, 'i')])
);

/** Which tracked indices a headline is about (by name or country keywords). */
export function tagItem(h: Pick<Headline, 'title' | 'snippet'>): string[] {
  const t = `${h.title} ${h.snippet}`;
  return CATALOG.filter((c) => c.kind === 'index' && KEY_RE[c.id]?.test(t)).map((c) => c.id);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 70);

/**
 * Picks the headlines Claude will read: newest first, duplicates removed, and a guaranteed few per index
 * so smaller markets are not crowded out by US news. Keeps Claude's input (and your bill) small.
 */
export function selectNotes(items: Headline[], cap = 130, perIndex = 3): Note[] {
  const seen = new Set<string>();
  const fresh = [...items]
    .sort((a, b) => b.published - a.published)
    .filter((h) => {
      const k = norm(h.title);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((h) => ({ h, tags: tagItem(h) }));
  const chosen = new Set<(typeof fresh)[number]>();
  const count: Record<string, number> = {};
  for (const x of fresh) {
    const need = x.tags.filter((t) => (count[t] ?? 0) < perIndex);
    if (need.length) {
      chosen.add(x);
      for (const t of x.tags) count[t] = (count[t] ?? 0) + 1;
    }
  }
  for (const x of fresh) if (chosen.size < cap) chosen.add(x);
  return fresh
    .filter((x) => chosen.has(x))
    .slice(0, cap)
    .map(({ h, tags }, i) => ({
      id: `N${i + 1}`,
      topic: tags.length ? tags.join(',') : 'macro',
      text: `${h.title}${h.snippet ? ` - ${h.snippet}` : ''} (${h.publisher}, ${new Date(h.published).toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
      excerpts: [],
      urls: [h.url],
    }));
}

/** The set of pages the code itself fetched; used to make sure every citation is real. */
export function retrievedFrom(items: Headline[]): Map<string, Retrieved> {
  return new Map(items.map((h) => [h.url, { title: h.title, pageAge: new Date(h.published).toISOString().slice(0, 10), publisher: h.publisher, tierUrl: h.tierUrl }]));
}
