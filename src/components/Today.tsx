import React from 'react';
import type { ForwardStats, MarketItem, Snapshot, TwoLevel } from '../types/report.js';
import { fmtPct, fmtWhen, pctClass } from '../utils/format.js';
import { Say, useVoice } from './Reader.js';

const REGIONS = ['Americas', 'Europe', 'Asia-Pacific'] as const;
const MOOD_STYLE = {
  'Risk-on': 'bg-emerald-700 text-white',
  'Risk-off': 'bg-rose-700 text-white',
  Mixed: 'bg-neutral-700 text-white',
} as const;

/** A sentence built only from the computed numbers, used when no sourced written summary exists. */
function computedHeadline(idx: MarketItem[]): TwoLevel | null {
  if (idx.length < 5) return null;
  const sorted = [...idx].sort((a, b) => b.stats!.change1d - a.stats!.change1d);
  const up = idx.filter((m) => m.stats!.change1d > 0).length;
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const n = idx.length;
  return {
    layman: `${up} of ${n} stock markets rose in their latest session. ${best.name} did best (${fmtPct(best.stats!.change1d)}) and ${worst.name} did worst (${fmtPct(worst.stats!.change1d)}).`,
    technical: `Advance/decline: ${up} up, ${n - up} down across ${n} tracked indices. Leader ${best.name} ${fmtPct(best.stats!.change1d)}; laggard ${worst.name} ${fmtPct(worst.stats!.change1d)}.`,
  };
}

export const Today: React.FC<{ snap: Snapshot; onTerm: (t: string) => void }> = ({ snap, onTerm }) => {
  const idx = snap.market.filter((m) => m.kind === 'index' && m.stats);
  const r = snap.report;
  const written = r?.headline ?? r?.global?.status ?? null;
  const head = written ?? computedHeadline(idx);
  const ranked = [...idx].sort((a, b) => b.stats!.change1d - a.stats!.change1d);
  return (
    <section id="today" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6 scroll-mt-28">
      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
            Market brief, data as of {fmtWhen(snap.generatedAt)}
            {!written && head ? ' (summary written by code from the numbers)' : ''}
          </p>
          {head ? <Say t={head} big /> : <p className="text-neutral-600 dark:text-neutral-400">No summary is available in this update. The numbers are below.</p>}
        </div>
        <aside className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 self-start">
          <div className="flex items-center gap-2 mb-2">
            <span className={`rounded-md px-2.5 py-1 text-sm font-semibold ${MOOD_STYLE[snap.mood.label]}`}>{snap.mood.label}</span>
            <button onClick={() => onTerm('risk-on')} className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline">What does this mean?</button>
          </div>
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">How this was decided</p>
          <ul className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400 list-disc pl-4">{snap.mood.basis.map((b) => <li key={b}>{b}</li>)}</ul>
          {ranked.length >= 6 && (
            <dl className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-sm grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <dt className="col-span-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">Biggest moves, latest session</dt>
              {[...ranked.slice(0, 2), ...ranked.slice(-2)].map((m) => (
                <React.Fragment key={m.id}>
                  <dd>{m.name}</dd>
                  <dd className={`tabular-nums font-medium ${pctClass(m.stats!.change1d)}`}>{fmtPct(m.stats!.change1d)}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </aside>
      </div>
    </section>
  );
};

/** Every tracked index as a tile, shaded by its latest move: green up, red down, deeper = bigger. */
export const MarketMap: React.FC<{ market: MarketItem[] }> = ({ market }) => {
  const idx = market.filter((m) => m.kind === 'index');
  return (
    <section id="markets" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 scroll-mt-28">
      <h2 className="text-xl font-semibold tracking-tight">Where markets moved</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 mb-4 max-w-[75ch]">Each tile is one stock market. Green means it rose in its latest session, red means it fell, and a deeper shade means a bigger move. Markets close at different times, so each tile shows its own latest session.</p>
      <div className="grid md:grid-cols-3 gap-5">
        {REGIONS.map((region) => (
          <div key={region}>
            <h3 className="text-sm font-semibold mb-2">{region}</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {idx.filter((m) => m.region === region).map((m) => {
                const c = m.stats?.change1d ?? null;
                const a = c === null ? 0 : Math.min(0.85, 0.1 + (Math.abs(c) / 3) * 0.7);
                const rgb = c === null ? null : c >= 0 ? 'var(--gain)' : 'var(--loss)';
                return (
                  <a
                    key={m.id}
                    href="#table-indices"
                    title={`${m.name}: ${m.about}${m.stats ? `. Close on ${m.stats.asOf}.` : ''}`}
                    className="rounded-md border border-neutral-200 dark:border-neutral-800 px-2.5 py-2 hover:border-neutral-400 dark:hover:border-neutral-500"
                    style={rgb ? { backgroundColor: `rgb(${rgb} / ${a})` } : undefined}
                  >
                    <div className="text-xs font-medium leading-tight truncate">{m.name.replace('Dow Jones Industrial Average', 'Dow Jones')}</div>
                    <div className="text-sm font-semibold tabular-nums mt-0.5">{c === null ? 'n/a' : fmtPct(c)}</div>
                    <div className="text-[11px] text-neutral-700 dark:text-neutral-300 tabular-nums">week {fmtPct(m.stats?.change5d ?? null, 1)}</div>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const Bar: React.FC<{ s: ForwardStats | null }> = ({ s }) => {
  const { voice } = useVoice();
  if (!s) return <span className="text-neutral-400">n/a</span>;
  return (
    <div className="min-w-[150px]">
      <div className="flex items-center gap-2">
        <div className="relative h-2 w-20 rounded-full bg-neutral-200 dark:bg-neutral-700" aria-hidden>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.pctUp}%`, backgroundColor: `rgb(${s.pctUp >= 50 ? 'var(--gain)' : 'var(--loss)'})` }} />
          <div className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px bg-neutral-900 dark:bg-neutral-100" />
        </div>
        <span className="text-sm font-semibold tabular-nums">{Math.round(s.pctUp)}% up</span>
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400 tabular-nums mt-0.5">
        {voice === 'plain' ? `typical move ${fmtPct(s.median)}` : `median ${fmtPct(s.median)}, 10th to 90th percentile ${fmtPct(s.p10, 1)} to ${fmtPct(s.p90, 1)}`}
      </div>
    </div>
  );
};

/** What happened after similar days in each market's own history, for the next day and next week. */
export const Expectations: React.FC<{ market: MarketItem[] }> = ({ market }) => {
  const rows = market.filter((m) => m.kind === 'index' && m.analog && (m.analog.next1d || m.analog.next5d));
  if (rows.length === 0) return null;
  return (
    <section id="next" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 scroll-mt-28">
      <h2 className="text-xl font-semibold tracking-tight">What history says can happen next</h2>
      <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 mb-4 max-w-[75ch] space-y-1">
        <p>For each market we found past days that looked like its latest session (a move of similar size) and counted what happened afterwards. "62% up" means the market was higher afterwards in 62 of every 100 similar cases. The line in the middle of each bar is 50%, a coin flip.</p>
        <p className="font-medium text-neutral-800 dark:text-neutral-200">These are base rates from the past, not predictions. Treat anything near 50% as no clear signal.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-950 text-left text-xs text-neutral-600 dark:text-neutral-400">
            <tr><th className="px-3 py-2 font-medium">Market</th><th className="px-3 py-2 font-medium">Latest move</th><th className="px-3 py-2 font-medium">Next day</th><th className="px-3 py-2 font-medium">Next week</th><th className="px-3 py-2 font-medium text-right">Similar days found</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((m) => (
              <tr key={m.id} className="align-top">
                <td className="px-3 py-2.5 font-medium" title={m.analog!.condition}>{m.name}</td>
                <td className={`px-3 py-2.5 tabular-nums font-medium ${pctClass(m.stats?.change1d)}`}>{fmtPct(m.stats?.change1d)}</td>
                <td className="px-3 py-2.5"><Bar s={m.analog!.next1d} /></td>
                <td className="px-3 py-2.5"><Bar s={m.analog!.next5d} /></td>
                <td className="px-3 py-2.5 text-right text-xs text-neutral-500 tabular-nums">{m.analog!.next1d?.n ?? m.analog!.next5d?.n ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 mt-2">Hover a market name to see exactly which kind of past day was matched. With few similar days found, treat the result as weak.</p>
    </section>
  );
};
