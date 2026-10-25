import type { Source, Tier } from '../src/types/report.js';

/**
 * Headlines are accepted only from these domains, so every citation comes from an established
 * official, press or data source. Edit this list to add or remove sources.
 * (Domains must be plain hostnames, no https:// and no wildcards.)
 */
export const OFFICIAL = [
  'federalreserve.gov', 'ecb.europa.eu', 'bankofengland.co.uk', 'boj.or.jp', 'rbi.org.in', 'pbc.gov.cn', 'imf.org',
  'worldbank.org', 'bls.gov', 'bea.gov', 'treasury.gov', 'eia.gov', 'opec.org', 'nseindia.com', 'bseindia.com',
  'sebi.gov.in', 'msci.com', 'spglobal.com', 'ftserussell.com', 'cmegroup.com', 'cboe.com', 'lseg.com',
  'deutsche-boerse.com', 'jpx.co.jp', 'hkex.com.hk', 'sgx.com', 'asx.com.au', 'krx.co.kr', 'twse.com.tw', 'nasdaq.com',
];
export const PRESS = [
  'reuters.com', 'bloomberg.com', 'ft.com', 'wsj.com', 'cnbc.com', 'marketwatch.com', 'barrons.com', 'economist.com',
  'apnews.com', 'bbc.com', 'nytimes.com', 'theguardian.com', 'aljazeera.com', 'dw.com', 'asia.nikkei.com', 'scmp.com',
  'livemint.com', 'economictimes.indiatimes.com', 'business-standard.com', 'moneycontrol.com', 'thehindubusinessline.com',
  'thehindu.com', 'kitco.com', 'oilprice.com', 'euronews.com', 'france24.com', 'straitstimes.com', 'abc.net.au',
  'afr.com', 'japantimes.co.jp', 'koreaherald.com', 'financialexpress.com', 'ndtvprofit.com', 'businesstoday.in',
];
export const DATA = [
  'morningstar.com', 'morningstar.in', 'screener.in', 'tradingeconomics.com', 'finance.yahoo.com', 'investing.com',
  'stockanalysis.com', 'multpl.com', 'worldgovernmentbonds.com', 'macrotrends.net', 'investopedia.com',
];
export const TRUSTED_DOMAINS = [...OFFICIAL, ...PRESS, ...DATA];

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

const matches = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));

export function tierOf(url: string): Tier {
  const host = hostOf(url);
  if (host.endsWith('.gov') || host.endsWith('.gov.in') || matches(host, OFFICIAL)) return 'official';
  if (matches(host, PRESS)) return 'press';
  if (matches(host, DATA)) return 'data';
  return 'other';
}

export const TIER_LABEL: Record<Tier, string> = {
  official: 'Official / exchange / index provider',
  press: 'Established news outlet',
  data: 'Data provider / research',
  other: 'Other',
};

export interface Retrieved {
  title: string;
  pageAge?: string | null;
  /** Publisher name when the feed gives one (needed for aggregators such as Google News). */
  publisher?: string;
  /** URL whose host decides the tier, when the link itself is an aggregator redirect. */
  tierUrl?: string;
}

/**
 * Numbers sources in order of first use. Only URLs that the search tool actually returned
 * can be registered, which is what makes a citation checkable.
 */
export class SourceRegistry {
  private order: string[] = [];
  constructor(private retrieved: Map<string, Retrieved>) {}

  isReal(url: string) {
    return this.retrieved.has(url);
  }

  numberFor(url: string): number | null {
    if (!this.retrieved.has(url)) return null;
    let i = this.order.indexOf(url);
    if (i < 0) {
      this.order.push(url);
      i = this.order.length - 1;
    }
    return i + 1;
  }

  list(): Source[] {
    return this.order.map((url, i) => {
      const r = this.retrieved.get(url)!;
      return { n: i + 1, url, title: r.title || hostOf(url), publisher: r.publisher || hostOf(url), tier: tierOf(r.tierUrl ?? url), pageAge: r.pageAge ?? null };
    });
  }
}
