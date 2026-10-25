import React from 'react';
import type { Insight, MarketItem } from '../types/report.js';
import { yahooQuoteUrl } from '../data/catalog.js';
import { Cites } from './Cite.js';
import { fmtPct, pctClass } from '../utils/format.js';

const ROWS: Array<{ key: 'status' | 'consequence' | 'impact' | 'outlook'; label: string; hint: string }> = [
  { key: 'status', label: 'Status', hint: 'What is happening now' },
  { key: 'consequence', label: 'Consequence', hint: 'What it can lead to' },
  { key: 'impact', label: 'Impact', hint: 'Who or what is affected' },
  { key: 'outlook', label: 'Outlook', hint: 'Next day and next week' },
];

/** Status, consequence, impact and outlook, each in plain English and in technical terms, with its evidence. */
export const InsightCard: React.FC<{ insight: Insight; market: Record<string, MarketItem> }> = ({ insight, market }) => (
  <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
    <header className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40">
      <h3 className="font-bold text-sm sm:text-base">{insight.title}</h3>
    </header>
    <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {ROWS.map((r) => (
        <div key={r.key} className="grid grid-cols-1 md:grid-cols-[110px_1fr_1fr] gap-x-4 gap-y-1 px-4 py-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{r.label}</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{r.hint}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400 mb-0.5">In plain English</div>
            <p className="text-sm leading-relaxed">{insight[r.key].layman}</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-400 mb-0.5">Technical</div>
            <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{insight[r.key].technical}</p>
          </div>
        </div>
      ))}
    </div>
    <footer className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/30 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-neutral-600 dark:text-neutral-400">Data behind this:</span>
        {insight.quant.map((id) => {
          if (id.startsWith('macro:') || id.startsWith('hw:')) {
            return <span key={id} className="rounded-full border border-neutral-300 dark:border-neutral-700 px-2 py-0.5">{id.startsWith('macro:') ? 'Macro data' : 'Largest companies'}</span>;
          }
          const m = market[id];
          if (!m?.stats) return null;
          return (
            <a
              key={id}
              href={yahooQuoteUrl(m.symbol)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title={`${m.name}, close on ${m.stats.asOf}. Computed from Yahoo Finance daily closes.`}
            >
              {m.name} <span className={pctClass(m.stats.change1d)}>{fmtPct(m.stats.change1d)}</span>
            </a>
          );
        })}
      </div>
      <div>
        <span className="font-semibold text-neutral-600 dark:text-neutral-400">Reported by:</span> <Cites sources={insight.sources} />
      </div>
    </footer>
  </article>
);
