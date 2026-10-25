import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, computeAnalog, computeRelations, computeMood, rsi, sma, quantile, type Bar } from './stats.js';
import { parseChart } from './yahoo.js';

function series(n: number, f: (i: number) => number, start = '2021-01-01'): Bar[] {
  const out: Bar[] = [];
  const d = new Date(start + 'T00:00:00Z');
  for (let i = 0; out.length < n; i++) {
    const day = new Date(d.getTime() + i * 86400000);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    out.push({ date: day.toISOString().slice(0, 10), close: f(out.length) });
  }
  return out;
}

test('sma, quantile and rsi on known values', () => {
  assert.equal(sma([1, 2, 3, 4], 2), 3.5);
  assert.equal(sma([1], 2), null);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(rsi(Array.from({ length: 30 }, (_, i) => 100 + i)), 100); // only gains
  const flatThenDrop = rsi([...Array(20).fill(100), 90, 80, 70]);
  assert.ok(flatThenDrop !== null && flatThenDrop < 40);
});

test('computeStats: exact 1d and 5d changes, ytd and drawdown', () => {
  const bars = series(300, (i) => 100 + i * 0.5);
  bars[bars.length - 1].close = 100 + 298 * 0.5; // last close
  const s = computeStats(bars)!;
  const c = bars.map((b) => b.close);
  assert.equal(s.last, c[299]);
  assert.equal(s.change1d, Number((((c[299] - c[298]) / c[298]) * 100).toFixed(2)));
  assert.equal(s.change5d, Number((((c[299] - c[294]) / c[294]) * 100).toFixed(2)));
  assert.equal(s.trend, 'up');
  assert.equal(s.drawdown, 0);
  assert.equal(s.observations, 300);
  assert.ok(s.changeYtd !== null);
});

test('computeStats refuses tiny histories', () => {
  assert.equal(computeStats(series(10, () => 100)), null);
});

test('computeAnalog gives base rates with sample sizes, or null when data is thin', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 4;
  let p = 100;
  const bars = series(1200, () => (p = p * (1 + rnd() / 100)));
  const a = computeAnalog(bars)!;
  assert.ok(a.next1d && a.next1d.n >= 30);
  assert.ok(a.next1d!.pctUp >= 0 && a.next1d!.pctUp <= 100);
  assert.ok(a.next1d!.p10 <= a.next1d!.median && a.next1d!.median <= a.next1d!.p90);
  assert.equal(computeAnalog(series(100, () => 100)), null);
});

test('computeRelations finds a built-in relationship and its sign', () => {
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  const f: Bar[] = [];
  const x: Bar[] = [];
  const base = series(300, () => 0);
  let fp = 100;
  let xp = 100;
  base.forEach((b, i) => {
    const r = rnd();
    fp *= 1 + r / 50;
    xp *= 1 - r / 100 + rnd() / 5000; // index moves opposite to the factor
    f.push({ date: b.date, close: fp });
    x.push({ date: b.date, close: xp });
  });
  const rel = computeRelations(x, { vix: f });
  assert.equal(rel[0].factorId, 'vix');
  assert.ok(rel[0].corr < -0.8);
  assert.ok(rel[0].beta < 0);
});

test('computeMood is rule based and publishes its inputs', () => {
  assert.equal(computeMood([1, 1, 1, 1, -1], { last: 15, change1d: -2 }).label, 'Risk-on');
  assert.equal(computeMood([-1, -1, -1, 1], { last: 25, change1d: 3 }).label, 'Risk-off');
  assert.equal(computeMood([1, -1], null).label, 'Mixed');
  assert.match(computeMood([1], null).basis[0], /1 of 1/);
});

test('parseChart drops null closes and uses exchange-local dates', () => {
  const ts = Array.from({ length: 30 }, (_, i) => 1700000000 + i * 86400);
  const closes: Array<number | null> = ts.map((_, i) => 100 + i);
  closes[5] = null;
  const s = parseChart({ chart: { result: [{ timestamp: ts, meta: { gmtoffset: 32400, currency: 'JPY' }, indicators: { quote: [{ close: closes }] } }] } }, '^N225');
  assert.equal(s.bars.length, 29);
  assert.equal(s.currency, 'JPY');
  assert.throws(() => parseChart({ chart: { result: null, error: { description: 'Not Found' } } }, 'X'), /Not Found/);
});

test('computeEpisodes returns separated look-alike days with correctly computed outcomes', async () => {
  const { computeEpisodes } = await import('./stats.js');
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 3;
  let p = 100;
  const bars = series(1300, () => (p = p * (1 + rnd() / 100)));
  const eps = computeEpisodes(bars);
  assert.equal(eps.length, 5);
  const idx = eps.map((e) => bars.findIndex((b) => b.date === e.date));
  assert.ok(idx.every((i) => i >= 252 && i + 21 < bars.length - 1));
  const sorted = [...idx].sort((a, b) => a - b);
  for (let k = 1; k < sorted.length; k++) assert.ok(sorted[k] - sorted[k - 1] >= 10);
  const e = eps[0];
  const i = idx[0];
  assert.equal(e.next5d, Number((((bars[i + 5].close - bars[i].close) / bars[i].close) * 100).toFixed(2)));
  assert.equal(e.next21d, Number((((bars[i + 21].close - bars[i].close) / bars[i].close) * 100).toFixed(2)));
  assert.deepEqual(computeEpisodes(series(100, () => 100)), []);
});
