/**
 * Deterministic statistics, computed from real daily closes. No AI is involved here.
 * All percentages are in percent units (1.5 means +1.5%).
 */
import type { Analog, Episode, ForwardStats, MarketStats, Mood, Relation } from '../src/types/report.js';
import { DRIVER_FACTOR_IDS } from '../src/data/catalog.js';

export interface Bar {
  date: string; // YYYY-MM-DD
  close: number;
}

const pct = (from: number, to: number) => ((to - from) / from) * 100;

export function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push(pct(closes[i - 1], closes[i]));
  return out;
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function sma(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  return mean(closes.slice(-n));
}

/** Wilder's RSI. */
export function rsi(closes: number[], n = 14): number | null {
  if (closes.length < n + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

const annVol = (rets: number[]) => stdev(rets) * Math.sqrt(252);

function forward(values: number[]): ForwardStats | null {
  if (values.length < 30) return null;
  const s = [...values].sort((a, b) => a - b);
  return {
    n: values.length,
    pctUp: (values.filter((v) => v > 0).length / values.length) * 100,
    median: quantile(s, 0.5),
    p10: quantile(s, 0.1),
    p90: quantile(s, 0.9),
  };
}

const round = (v: number | null, d = 2) => (v === null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

export function computeStats(bars: Bar[]): MarketStats | null {
  if (bars.length < 25) return null;
  const closes = bars.map((b) => b.close);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const lastDate = bars[bars.length - 1].date;
  const back = (n: number) => (closes.length > n ? pct(closes[closes.length - 1 - n], last) : null);

  const year = lastDate.slice(0, 4);
  let ytdBase: number | null = null;
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].date.slice(0, 4) < year) {
      ytdBase = bars[i].close;
      break;
    }
  }

  const rets = dailyReturns(closes);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const year1 = closes.slice(-252);
  const hi = Math.max(...year1);
  const lo = Math.min(...year1);

  let volPercentile: number | null = null;
  let vol20: number | null = null;
  if (rets.length >= 20) {
    vol20 = annVol(rets.slice(-20));
    const series: number[] = [];
    for (let i = 20; i <= rets.length; i++) series.push(annVol(rets.slice(i - 20, i)));
    if (series.length >= 60) volPercentile = (series.filter((v) => v <= vol20!).length / series.length) * 100;
  }

  let z: number | null = null;
  if (rets.length >= 61) {
    const sd = stdev(rets.slice(-61, -1));
    z = sd > 0 ? rets[rets.length - 1] / sd : null;
  }

  let trend: MarketStats['trend'] = null;
  if (s50 !== null && s200 !== null) trend = last > s50 && s50 > s200 ? 'up' : last < s50 && s50 < s200 ? 'down' : 'sideways';

  return {
    last,
    prevClose: prev,
    asOf: lastDate,
    change1d: round(pct(prev, last))!,
    change5d: round(back(5)),
    change1m: round(back(21)),
    change3m: round(back(63)),
    changeYtd: ytdBase ? round(pct(ytdBase, last)) : null,
    change1y: round(back(252)),
    sma50: round(s50),
    sma200: round(s200),
    pctVsSma50: s50 ? round(pct(s50, last)) : null,
    pctVsSma200: s200 ? round(pct(s200, last)) : null,
    rsi14: round(rsi(closes)),
    vol20: round(vol20, 1),
    volPercentile: round(volPercentile, 0),
    drawdown: closes.length >= 60 ? round(pct(hi, last)) : null,
    high52: closes.length >= 60 ? round(hi) : null,
    low52: closes.length >= 60 ? round(lo) : null,
    zScore1d: round(z),
    trend,
    observations: closes.length,
  };
}

/**
 * Historical frequency: what happened after days that looked like the latest day
 * (same size-of-move bucket relative to the prior 60 days). This is a base rate, not a prediction.
 */
export function computeAnalog(bars: Bar[]): Analog | null {
  const closes = bars.map((b) => b.close);
  const rets = dailyReturns(closes); // rets[i] is the move INTO closes[i+1]
  if (rets.length < 200) return null;
  const bucketAt = (i: number) => {
    const sd = stdev(rets.slice(i - 60, i));
    if (!(sd > 0)) return null;
    const z = rets[i] / sd;
    return z <= -1 ? 'down' : z >= 1 ? 'up' : 'normal';
  };
  const today = bucketAt(rets.length - 1);
  if (!today) return null;
  const n1: number[] = [];
  const n5: number[] = [];
  for (let i = 60; i < rets.length - 1; i++) {
    if (bucketAt(i) !== today) continue;
    n1.push(rets[i + 1]);
    // closes index of the day with move rets[i] is i+1
    if (i + 6 < closes.length) n5.push(pct(closes[i + 1], closes[i + 6]));
  }
  const condition =
    today === 'down'
      ? 'days when the one-day fall was bigger than 1 standard deviation of the previous 60 days'
      : today === 'up'
        ? 'days when the one-day rise was bigger than 1 standard deviation of the previous 60 days'
        : 'ordinary days (one-day move within 1 standard deviation of the previous 60 days)';
  const a = { condition, next1d: forward(n1), next5d: forward(n5) };
  return a.next1d || a.next5d ? { ...a, next1d: round1(a.next1d), next5d: round1(a.next5d) } : null;
}

function round1(f: ForwardStats | null): ForwardStats | null {
  return f && { n: f.n, pctUp: round(f.pctUp, 0)!, median: round(f.median)!, p10: round(f.p10)!, p90: round(f.p90)! };
}

function corrBeta(x: number[], y: number[]): { corr: number; beta: number } {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return { corr: sxy / Math.sqrt(sxx * syy), beta: sxy / sxx };
}

function returnsByDate(bars: Bar[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 1; i < bars.length; i++) m.set(bars[i].date, pct(bars[i - 1].close, bars[i].close));
  return m;
}

/**
 * Correlation of an index's daily returns with each macro factor over the last ~year, same day and with the
 * factor's PREVIOUS trading day (Asian markets close before US markets open, so the lag matters).
 * Correlation is not causation; the site says so.
 */
export function computeRelations(index: Bar[], factors: Record<string, Bar[]>, window = 250): Relation[] {
  const idxRet = returnsByDate(index);
  const dates = [...idxRet.keys()].slice(-window);
  const out: Relation[] = [];
  for (const fid of DRIVER_FACTOR_IDS) {
    const fb = factors[fid];
    if (!fb || fb.length < 80) continue;
    const fRet = returnsByDate(fb);
    const fDates = [...fRet.keys()];
    let best: Relation | null = null;
    for (const lag of [0, 1] as const) {
      const xs: number[] = [];
      const ys: number[] = [];
      let p = 0;
      for (const d of dates) {
        let fd: string | undefined;
        if (lag === 0) fd = fRet.has(d) ? d : undefined;
        else {
          while (p < fDates.length && fDates[p] < d) p++;
          fd = p > 0 ? fDates[p - 1] : undefined;
        }
        if (!fd) continue;
        xs.push(fRet.get(fd)!);
        ys.push(idxRet.get(d)!);
      }
      if (xs.length < 60) continue;
      const { corr, beta } = corrBeta(xs, ys);
      if (!Number.isFinite(corr)) continue;
      if (!best || Math.abs(corr) > Math.abs(best.corr)) {
        best = { factorId: fid, corr: Number(corr.toFixed(2)), beta: Number(beta.toFixed(2)), lag, n: xs.length };
      }
    }
    if (best && Math.abs(best.corr) >= 0.2) out.push(best);
  }
  return out.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr)).slice(0, 3);
}

/** Rule-based market mood. The rule inputs are published so the label can be checked. */
export function computeMood(indexChanges: Array<number | null>, vix: { last: number; change1d: number } | null): Mood {
  const vals = indexChanges.filter((v): v is number => v !== null);
  const up = vals.filter((v) => v > 0).length;
  const share = vals.length ? up / vals.length : 0.5;
  const basis = [`${up} of ${vals.length} tracked indices rose in their latest session.`];
  if (vix) basis.push(`VIX closed at ${vix.last.toFixed(2)} (${vix.change1d >= 0 ? '+' : ''}${vix.change1d.toFixed(2)}% on the day).`);
  const vixJump = vix ? vix.change1d >= 8 : false;
  const vixFall = vix ? vix.change1d <= 0 : true;
  let label: Mood['label'] = 'Mixed';
  if (share <= 0.35 || vixJump) label = 'Risk-off';
  else if (share >= 0.65 && vixFall) label = 'Risk-on';
  basis.push('Rule: Risk-on = 65%+ of indices up and VIX not rising; Risk-off = 35% or fewer up, or VIX up 8%+; otherwise Mixed.');
  return { label, basis };
}

/**
 * Nearest-neighbour look-alikes: finds the past days whose situation was most like the latest day, using
 * four standardised features (today's move vs normal, 5-day move, 20-day volatility, drawdown from the
 * 1-year high), and reports what followed. A statistical model, not a forecast.
 */
export function computeEpisodes(bars: Bar[], k = 5, minGap = 10): Episode[] {
  const c = bars.map((b) => b.close);
  const n = c.length;
  if (n < 420) return [];
  const rets = dailyReturns(c); // rets[j] = move into c[j+1]
  const feat: Array<{ i: number; f: number[] }> = [];
  for (let i = 252; i < n; i++) {
    const sd = stdev(rets.slice(i - 61, i - 1));
    if (!(sd > 0)) continue;
    const hi = Math.max(...c.slice(i - 251, i + 1));
    feat.push({ i, f: [rets[i - 1] / sd, pct(c[i - 5], c[i]), stdev(rets.slice(i - 20, i)), pct(hi, c[i])] });
  }
  if (feat.length < 100) return [];
  const dims = 4;
  const mu = Array.from({ length: dims }, (_, d) => mean(feat.map((x) => x.f[d])));
  const sg = Array.from({ length: dims }, (_, d) => stdev(feat.map((x) => x.f[d])) || 1);
  const z = (f: number[]) => f.map((v, d) => (v - mu[d]) / sg[d]);
  const q = feat[feat.length - 1];
  if (q.i !== n - 1) return [];
  const qz = z(q.f);
  const cands = feat
    .filter((x) => x.i + 21 <= n - 1)
    .map((x) => ({ x, dist: Math.hypot(...z(x.f).map((v, d) => v - qz[d])) }))
    .sort((a, b) => a.dist - b.dist);
  const chosen: typeof cands = [];
  for (const cand of cands) {
    if (chosen.every((o) => Math.abs(o.x.i - cand.x.i) >= minGap)) chosen.push(cand);
    if (chosen.length === k) break;
  }
  return chosen
    .sort((a, b) => a.x.i - b.x.i)
    .map(({ x }) => ({
      date: bars[x.i].date,
      move1d: Number(pct(c[x.i - 1], c[x.i]).toFixed(2)),
      prior5d: Number(pct(c[x.i - 5], c[x.i]).toFixed(2)),
      next5d: Number(pct(c[x.i], c[x.i + 5]).toFixed(2)),
      next21d: Number(pct(c[x.i], c[x.i + 21]).toFixed(2)),
    }));
}

/** Compact text used both for the UI and as the ONLY numbers Claude may quote for a market item. */
export function describeStats(name: string, s: MarketStats, a: Analog | null, rel: Relation[], eps: Episode[] = []): string {
  const f = (v: number | null, d = 2, suffix = '') => (v === null ? 'n/a' : `${v.toFixed(d)}${suffix}`);
  const parts = [
    `${name}: close ${s.last.toFixed(2)} on ${s.asOf}`,
    `1d ${f(s.change1d, 2, '%')}, 5d ${f(s.change5d, 2, '%')}, 1m ${f(s.change1m, 2, '%')}, 3m ${f(s.change3m, 2, '%')}, YTD ${f(s.changeYtd, 2, '%')}, 1y ${f(s.change1y, 2, '%')}`,
    `vs 50-day average ${f(s.pctVsSma50, 2, '%')}, vs 200-day average ${f(s.pctVsSma200, 2, '%')}, trend ${s.trend ?? 'n/a'}`,
    `RSI14 ${f(s.rsi14, 1)}, 20-day volatility ${f(s.vol20, 1, '%')} (percentile ${f(s.volPercentile, 0)}), drawdown from 52w high ${f(s.drawdown, 2, '%')}, 1-day move z-score ${f(s.zScore1d, 2)}`,
  ];
  if (a?.next1d) parts.push(`History after ${a.condition}: next day rose ${a.next1d.pctUp}% of ${a.next1d.n} times (median ${a.next1d.median}%, 10th-90th pct ${a.next1d.p10}% to ${a.next1d.p90}%)`);
  if (a?.next5d) parts.push(`next 5 days rose ${a.next5d.pctUp}% of ${a.next5d.n} times (median ${a.next5d.median}%, 10th-90th pct ${a.next5d.p10}% to ${a.next5d.p90}%)`);
  if (eps.length) {
    const med = (xs: number[]) => quantile([...xs].sort((p, q) => p - q), 0.5);
    parts.push(
      `Look-alike days (${eps.length} most similar past days by move size, 5-day move, volatility and drawdown): next 5 days rose ${eps.filter((e) => e.next5d > 0).length} of ${eps.length} times (median ${med(eps.map((e) => e.next5d)).toFixed(2)}%), next 21 days rose ${eps.filter((e) => e.next21d > 0).length} of ${eps.length} times (median ${med(eps.map((e) => e.next21d)).toFixed(2)}%)`
    );
  }
  if (rel.length) parts.push(`Daily-move correlation (past year): ${rel.map((r) => `${r.factorId} ${r.corr}${r.lag ? ' (prior-day)' : ''}`).join(', ')}`);
  return parts.join('; ');
}
