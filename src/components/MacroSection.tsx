import React from 'react';
import type { CompanyEffect, HeavyweightRow, MacroItem, MarketItem } from '../types/report.js';
import { Cites } from './Cite.js';
import { fmtPct, pctClass } from '../utils/format.js';

const Wrap: React.FC<{ title: string; blurb: string; children: React.ReactNode }> = ({ title, blurb, children }) => (
  <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{blurb}</p>
    {children}
  </section>
);

/** Official macro statistics (central banks, statistics offices) collected by the Python step. */
export const MacroTable: React.FC<{ macro: MacroItem[] }> = ({ macro }) => {
  if (macro.length === 0) return null;
  const regions = [...new Set(macro.map((m) => m.region))];
  return (
    <Wrap title="Macro indicators" blurb="Inflation, interest rates, jobs and growth from official sources. Each value links to where it came from.">
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-950/40 text-left text-xs uppercase text-neutral-500">
            <tr><th className="px-3 py-2">Indicator</th><th className="px-3 py-2">Region</th><th className="px-3 py-2 text-right">Latest</th><th className="px-3 py-2 text-right">Previous</th><th className="px-3 py-2">For</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {regions.flatMap((r) => macro.filter((m) => m.region === r)).map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2"><a href={m.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted" title={`Source: ${m.source}`}>{m.name}</a></td>
                <td className="px-3 py-2">{m.region}</td>
                <td className="px-3 py-2 text-right font-semibold">{m.value} <span className="text-xs text-neutral-500">{m.unit}</span></td>
                <td className="px-3 py-2 text-right text-neutral-500">{m.previous ?? 'n/a'}</td>
                <td className="px-3 py-2 text-neutral-500">{m.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Wrap>
  );
};

/** Which big companies moved, and which indices they sit in. */
export const Heavyweights: React.FC<{ rows: HeavyweightRow[]; market: MarketItem[] }> = ({ rows, market }) => {
  if (rows.length === 0) return null;
  const name = (id: string) => market.find((m) => m.id === id)?.name ?? id;
  const sorted = [...rows].sort((a, b) => Math.abs(b.change1d) - Math.abs(a.change1d));
  return (
    <Wrap title="Biggest companies: who moved today" blurb="Large companies inside the tracked indices (a hand-kept list, not exact index weights), sorted by the size of the one-day move.">
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-950/40 text-left text-xs uppercase text-neutral-500">
            <tr><th className="px-3 py-2">Company</th><th className="px-3 py-2">In index</th><th className="px-3 py-2 text-right">1 day</th><th className="px-3 py-2 text-right">5 days</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sorted.slice(0, 30).map((r) => (
              <tr key={r.symbol}>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-neutral-500">{r.indices.map(name).join(', ')}</td>
                <td className={`px-3 py-2 text-right ${pctClass(r.change1d)}`}>{fmtPct(r.change1d)}</td>
                <td className={`px-3 py-2 text-right ${r.change5d === null ? '' : pctClass(r.change5d)}`}>{r.change5d === null ? 'n/a' : fmtPct(r.change5d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Wrap>
  );
};

/** Companies the news says are moving an index, in two voices, with sources. */
export const CompanyEffects: React.FC<{ items: CompanyEffect[]; market: MarketItem[] }> = ({ items, market }) => {
  if (items.length === 0) return null;
  const name = (id: string) => market.find((m) => m.id === id)?.name ?? id;
  const arrow = { up: '▲ lifting', down: '▼ weighing on', mixed: '◆ mixed effect on' } as const;
  return (
    <Wrap title="Companies moving markets" blurb="Only companies the cited news actually links to an index move.">
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((c, i) => (
          <article key={i} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 text-sm space-y-2">
            <h3 className="font-bold">{c.company} <span className="font-normal text-neutral-500">{arrow[c.direction]} {c.indices.map(name).join(', ')}</span></h3>
            <p><span className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">In plain English </span>{c.layman}</p>
            <p className="text-neutral-700 dark:text-neutral-300"><span className="text-[10px] font-semibold uppercase text-neutral-500">Technical </span>{c.technical}</p>
            <div className="text-xs"><span className="font-semibold text-neutral-600 dark:text-neutral-400">Reported by:</span> <Cites sources={c.sources} /></div>
          </article>
        ))}
      </div>
    </Wrap>
  );
};
