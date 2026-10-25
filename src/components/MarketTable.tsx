import React, { useState } from 'react';
import type { MarketItem } from '../types/report.js';
import { CATALOG_BY_ID, yahooQuoteUrl, type Region } from '../data/catalog.js';
import { Cites } from './Cite.js';
import { fmtNum, fmtPct, pctClass, sparkPath } from '../utils/format.js';

const Spark: React.FC<{ values: number[] }> = ({ values }) => {
  const { d, up } = sparkPath(values);
  if (!d) return <span className="text-neutral-400">n/a</span>;
  return (
    <svg width="90" height="26" viewBox="0 0 90 26" role="img" aria-label="Last 60 closes">
      <path d={d} fill="none" strokeWidth="1.5" className={up ? 'stroke-emerald-600' : 'stroke-rose-600'} />
    </svg>
  );
};

const TREND: Record<string, string> = {
  up: 'Uptrend: price above its 50-day and 200-day averages',
  down: 'Downtrend: price below its 50-day and 200-day averages',
  sideways: 'Sideways: price and the two averages are not lined up',
};

const Stat: React.FC<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => (
  <div title={hint} className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5">
    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">{label}</div>
    <div className="font-mono text-xs font-semibold">{value}</div>
  </div>
);

const Detail: React.FC<{ m: MarketItem; byId: Record<string, MarketItem> }> = ({ m, byId }) => {
  const s = m.stats!;
  const a = m.analog;
  return (
    <div className="px-4 py-4 space-y-4 bg-neutral-50 dark:bg-neutral-950/40">
      {m.why ? (
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">Why it moved - plain English</div>
            <p className="text-sm">{m.why.layman}</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-neutral-500">Why it moved - technical</div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">{m.why.technical} <Cites sources={m.why.sources} /></p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No sourced reason for this move was found in the latest research, so none is shown rather than a guess. The numbers below are still computed from price data.
        </p>
      )}

      <div>
        <div className="text-xs font-semibold mb-1.5">Quantitative picture <span className="font-normal text-neutral-500">(computed from {s.observations} daily closes; last close {s.asOf})</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <Stat label="vs 50-day avg" value={fmtPct(s.pctVsSma50)} hint="How far the price is from its average of the last 50 trading days" />
          <Stat label="vs 200-day avg" value={fmtPct(s.pctVsSma200)} hint="How far the price is from its average of the last 200 trading days" />
          <Stat label="RSI (14)" value={s.rsi14 === null ? 'n/a' : s.rsi14.toFixed(1)} hint="Momentum gauge 0-100. Above 70 is often called overbought, below 30 oversold" />
          <Stat label="Volatility (20d)" value={s.vol20 === null ? 'n/a' : `${s.vol20}%`} hint="Annualised size of recent daily swings" />
          <Stat label="Volatility rank" value={s.volPercentile === null ? 'n/a' : `${s.volPercentile}th pct`} hint="Where today's volatility sits within this index's own 5-year history" />
          <Stat label="From 52w high" value={fmtPct(s.drawdown)} hint="How far below its highest close of the past year" />
          <Stat label="52w range" value={s.low52 === null ? 'n/a' : `${fmtNum(s.low52)} - ${fmtNum(s.high52)}`} hint="Lowest and highest close in the past year" />
          <Stat label="Move z-score" value={s.zScore1d === null ? 'n/a' : s.zScore1d.toFixed(2)} hint="Latest 1-day move divided by the typical daily move of the prior 60 days. Beyond +/-2 is unusual" />
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5">{s.trend ? TREND[s.trend] : 'Trend needs 200 days of history.'}</p>
      </div>

      {a && (
        <div>
          <div className="text-xs font-semibold mb-1.5">What usually happened next (historical base rates, not predictions)</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-1.5">Comparison set: {a.condition}, in this index's own last ~5 years.</p>
          <div className="overflow-x-auto">
            <table className="text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <thead className="bg-neutral-100 dark:bg-neutral-900">
                <tr><th className="px-3 py-1.5 text-left">Horizon</th><th className="px-3 py-1.5">Times it rose</th><th className="px-3 py-1.5">Median move</th><th className="px-3 py-1.5">Typical range (10th-90th pct)</th><th className="px-3 py-1.5">Sample size</th></tr>
              </thead>
              <tbody>
                {([['Next day', a.next1d], ['Next 5 days', a.next5d]] as const).map(([label, f]) =>
                  f ? (
                    <tr key={label} className="border-t border-neutral-200 dark:border-neutral-800 text-center">
                      <td className="px-3 py-1.5 text-left font-medium">{label}</td>
                      <td className="px-3 py-1.5">{f.pctUp}%</td>
                      <td className={`px-3 py-1.5 ${pctClass(f.median)}`}>{fmtPct(f.median)}</td>
                      <td className="px-3 py-1.5">{fmtPct(f.p10)} to {fmtPct(f.p90)}</td>
                      <td className="px-3 py-1.5">{f.n}</td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {m.episodes.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5">The 5 most similar past days, and what followed</div>
          <div className="overflow-x-auto">
            <table className="text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <thead className="bg-neutral-100 dark:bg-neutral-900"><tr><th className="px-3 py-1.5 text-left">Date</th><th className="px-3 py-1.5">That day</th><th className="px-3 py-1.5">Prior 5 days</th><th className="px-3 py-1.5">Next 5 days</th><th className="px-3 py-1.5">Next 21 days</th></tr></thead>
              <tbody>
                {m.episodes.map((e) => (
                  <tr key={e.date} className="border-t border-neutral-200 dark:border-neutral-800 text-center">
                    <td className="px-3 py-1.5 text-left">{e.date}</td>
                    <td className={`px-3 py-1.5 ${pctClass(e.move1d)}`}>{fmtPct(e.move1d)}</td>
                    <td className={`px-3 py-1.5 ${pctClass(e.prior5d)}`}>{fmtPct(e.prior5d)}</td>
                    <td className={`px-3 py-1.5 ${pctClass(e.next5d)}`}>{fmtPct(e.next5d)}</td>
                    <td className={`px-3 py-1.5 ${pctClass(e.next21d)}`}>{fmtPct(e.next21d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {m.relations.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5">What it has moved with over the past year (correlation is not cause)</div>
          <ul className="text-xs space-y-0.5">
            {m.relations.map((r) => (
              <li key={r.factorId}>
                <strong>{byId[r.factorId]?.name ?? CATALOG_BY_ID[r.factorId]?.name}</strong>: correlation {r.corr.toFixed(2)}, beta {r.beta.toFixed(2)}
                {r.lag ? ' (using the factor\'s previous-day move)' : ''} - {r.corr < 0 ? 'tends to move in the opposite direction' : 'tends to move in the same direction'} (n={r.n} days)
              </li>
            ))}
          </ul>
        </div>
      )}
      <a href={yahooQuoteUrl(m.symbol)} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-700 dark:text-blue-400 hover:underline">
        Price source: Yahoo Finance ({m.symbol})
      </a>
    </div>
  );
};

export const MarketTable: React.FC<{ items: MarketItem[]; all: MarketItem[]; groupByRegion?: boolean; title: string; blurb: string }> = ({ items, all, groupByRegion, title, blurb }) => {
  const [open, setOpen] = useState<string | null>(null);
  const byId = Object.fromEntries(all.map((m) => [m.id, m]));
  const regions: Region[] = groupByRegion ? ['Americas', 'Europe', 'Asia-Pacific'] : ['Global'];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">{blurb}</p>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 dark:bg-neutral-950 text-xs text-neutral-600 dark:text-neutral-400">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-right">Last close</th>
              <th className="px-3 py-2 text-right">1 day</th>
              <th className="px-3 py-2 text-right">5 days</th>
              <th className="px-3 py-2 text-right">1 month</th>
              <th className="px-3 py-2 text-right">YTD</th>
              <th className="px-3 py-2 text-right">1 year</th>
              <th className="px-3 py-2">60 days</th>
              <th className="px-3 py-2 text-right">As of</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => {
              const rows = items.filter((i) => (groupByRegion ? i.region === region : true));
              return (
                <React.Fragment key={region}>
                  {groupByRegion && (
                    <tr className="bg-neutral-50 dark:bg-neutral-950/60"><td colSpan={9} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{region}</td></tr>
                  )}
                  {rows.map((m) => {
                    const s = m.stats;
                    const isOpen = open === m.id;
                    return (
                      <React.Fragment key={m.id}>
                        <tr
                          className={`border-t border-neutral-200 dark:border-neutral-800 ${s ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50' : 'opacity-60'}`}
                          onClick={() => s && setOpen(isOpen ? null : m.id)}
                        >
                          <td className="px-3 py-2">
                            <button className="text-left" aria-expanded={isOpen} disabled={!s}>
                              <span className="font-semibold">{m.name}</span>
                              <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">{m.country} - {m.about}</span>
                            </button>
                          </td>
                          {s ? (
                            <>
                              <td className="px-3 py-2 text-right font-mono">{fmtNum(s.last)}{m.unit && m.kind === 'factor' ? <span className="text-[10px] text-neutral-500"> {m.unit}</span> : null}</td>
                              <td className={`px-3 py-2 text-right font-mono font-semibold ${pctClass(s.change1d)}`}>{fmtPct(s.change1d)}</td>
                              <td className={`px-3 py-2 text-right font-mono ${pctClass(s.change5d)}`}>{fmtPct(s.change5d)}</td>
                              <td className={`px-3 py-2 text-right font-mono ${pctClass(s.change1m)}`}>{fmtPct(s.change1m)}</td>
                              <td className={`px-3 py-2 text-right font-mono ${pctClass(s.changeYtd)}`}>{fmtPct(s.changeYtd)}</td>
                              <td className={`px-3 py-2 text-right font-mono ${pctClass(s.change1y)}`}>{fmtPct(s.change1y)}</td>
                              <td className="px-3 py-2"><Spark values={m.series} /></td>
                              <td className="px-3 py-2 text-right text-xs text-neutral-500">{s.asOf}</td>
                            </>
                          ) : (
                            <td colSpan={8} className="px-3 py-2 text-xs text-neutral-500">Unavailable in this update ({m.error ?? 'no data'})</td>
                          )}
                        </tr>
                        {isOpen && s && (
                          <tr className="border-t border-neutral-200 dark:border-neutral-800"><td colSpan={9} className="p-0"><Detail m={m} byId={byId} /></td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-500 mt-1.5">Click a row for the reason it moved, the numbers behind it and what usually happened next in similar past situations.</p>
    </section>
  );
};
