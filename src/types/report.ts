/** Shape of public/data/snapshot.json, shared by the generator and the website. */
import type { Region, ItemKind } from '../data/catalog.js';

export type Tier = 'official' | 'press' | 'data' | 'other';

export interface Source {
  /** Footnote number shown as [n] on the site. */
  n: number;
  url: string;
  title: string;
  publisher: string;
  tier: Tier;
  /** Page age as reported by the search tool, when available. */
  pageAge?: string | null;
}

export interface TwoLevel {
  technical: string;
  layman: string;
}

export interface ForwardStats {
  /** Number of historical days in the comparison set. */
  n: number;
  pctUp: number;
  median: number;
  p10: number;
  p90: number;
}

export interface MarketStats {
  last: number;
  prevClose: number;
  asOf: string; // YYYY-MM-DD of the last close
  change1d: number;
  change5d: number | null;
  change1m: number | null;
  change3m: number | null;
  changeYtd: number | null;
  change1y: number | null;
  sma50: number | null;
  sma200: number | null;
  pctVsSma50: number | null;
  pctVsSma200: number | null;
  rsi14: number | null;
  vol20: number | null; // annualised %, from 20 daily returns
  volPercentile: number | null; // 0-100, rank of vol20 within its own history
  drawdown: number | null; // % below the 52-week high (<= 0)
  high52: number | null;
  low52: number | null;
  zScore1d: number | null;
  trend: 'up' | 'down' | 'sideways' | null;
  /** How many daily closes the statistics are based on. */
  observations: number;
}

export interface Analog {
  /** Plain description of the historical condition that was matched. */
  condition: string;
  next1d: ForwardStats | null;
  next5d: ForwardStats | null;
}

export interface Relation {
  factorId: string;
  corr: number; // Pearson correlation of daily returns
  beta: number;
  lag: 0 | 1;
  n: number;
}

export interface Episode {
  date: string; // a past day that looked like the latest one
  move1d: number; // that day's move %
  prior5d: number; // move over the 5 days up to it %
  next5d: number; // what happened over the following 5 trading days %
  next21d: number; // ... and 21 trading days %
}

export interface MarketItem {
  id: string;
  kind: ItemKind;
  name: string;
  country: string;
  region: Region;
  symbol: string;
  unit?: string;
  about: string;
  stats: MarketStats | null;
  analog: Analog | null;
  /** The five most similar past days (by size of move, 5-day move, volatility and drawdown) and what followed. */
  episodes: Episode[];
  relations: Relation[];
  series: number[]; // last ~60 closes, for the sparkline
  /** Sourced explanation of the latest move, only present if it passed validation. */
  why: (TwoLevel & { sources: number[] }) | null;
  error?: string;
}

export interface Insight {
  title: string;
  status: TwoLevel;
  consequence: TwoLevel;
  impact: TwoLevel;
  outlook: TwoLevel;
  /** Market item ids whose computed numbers back this insight (quantitative). */
  quant: string[];
  /** Source numbers for the qualitative claims. */
  sources: number[];
}

export interface EventItem {
  when: string;
  title: string;
  technical: string;
  layman: string;
  sources: number[];
}

export interface Report {
  generatedAt: string;
  headline: TwoLevel | null;
  global: Insight | null;
  regions: Insight[];
  drivers: Insight[];
  events: EventItem[];
}

export interface Mood {
  label: 'Risk-on' | 'Risk-off' | 'Mixed';
  /** Plain statements of the rule inputs, each computed from the data. */
  basis: string[];
}

export interface HeadlineItem {
  title: string;
  url: string;
  publisher: string;
  tier: Tier;
  published: string; // ISO
  about: string[]; // tracked index ids the headline mentions
}

export interface Snapshot {
  schemaVersion: 2;
  generatedAt: string;
  models: { synthesis: string };
  /** Fingerprint of the inputs; if unchanged next run, Claude is not called again. */
  inputHash?: string;
  mood: Mood;
  market: MarketItem[];
  report: Report | null;
  /** The newest headlines read by the code, shown even when no written analysis is available. */
  headlines: HeadlineItem[];
  sources: Source[];
  warnings: string[];
  usage: { headlines: number; feedsOk: number; feedsFailed: number; inputTokens: number; outputTokens: number };
}

/** public/data/extra.json, written by the Python collectors (official NSE and BSE files). */
export interface NseIndexRow {
  index: string;
  date: string;
  close: number;
  change_pct: number | null;
  pe: number | null;
  pb: number | null;
  div_yield: number | null;
  source: string;
}
export interface BseMover {
  symbol: string;
  name: string;
  close: number;
  prev_close: number;
  change_pct: number;
  volume: number | null;
}
export interface Extra {
  generatedAt: string;
  problems: string[];
  nse_indices?: NseIndexRow[];
  bse_movers?: { date: string; gainers: BseMover[]; losers: BseMover[]; source: string };
}
