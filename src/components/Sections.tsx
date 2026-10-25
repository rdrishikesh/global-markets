import React from 'react';
import type { MarketItem, Mood, Report, Snapshot } from '../types/report.js';
import { Cites } from './Cite.js';
import { InsightCard } from './InsightCard.js';
import { fmtPct, pctClass } from '../utils/format.js';

const Wrap: React.FC<{ title: string; blurb?: string; children?: React.ReactNode; id?: string }> = ({ title, blurb, children, id }) => (
  <section id={id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <h2 className="text-lg font-bold">{title}</h2>
    {blurb && <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">{blurb}</p>}
    {children}
  </section>
);

const MOOD_STYLE: Record<Mood['label'], string> = {
  'Risk-on': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  'Risk-off': 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  Mixed: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
};

export const Overview: React.FC<{ snap: Snapshot; onTerm: (t: string) => void }> = ({ snap, onTerm }) => {
  const r = snap.report;
  const head = r?.headline ?? r?.global?.status ?? null;
  const idx = snap.market.filter((m) => m.kind === 'index' && m.stats);
  const best = [...idx].sort((a, b) => b.stats!.change1d - a.stats!.change1d);
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${MOOD_STYLE[snap.mood.label]}`}>{snap.mood.label}</span>
        <button onClick={() => onTerm('risk-on')} className="text-xs text-blue-700 dark:text-blue-400 hover:underline">What does this mean?</button>
      </div>
      {head ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400 mb-1">In plain English</div>
            <p className="text-xl sm:text-2xl font-bold leading-snug">{head.layman}</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-neutral-500 mb-1">Technical</div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{head.technical}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">No sourced written summary is available in this update. The computed market data is below.</p>
      )}
      <div className="mt-4 grid sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
          <div className="font-semibold mb-1">How the mood label is computed</div>
          <ul className="space-y-0.5 text-neutral-600 dark:text-neutral-400">{snap.mood.basis.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
        {best.length > 0 && (
          <>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
              <div className="font-semibold mb-1">Strongest (latest session)</div>
              {best.slice(0, 3).map((m) => <div key={m.id} className="flex justify-between"><span>{m.name}</span><span className={`font-mono ${pctClass(m.stats!.change1d)}`}>{fmtPct(m.stats!.change1d)}</span></div>)}
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
              <div className="font-semibold mb-1">Weakest (latest session)</div>
              {best.slice(-3).reverse().map((m) => <div key={m.id} className="flex justify-between"><span>{m.name}</span><span className={`font-mono ${pctClass(m.stats!.change1d)}`}>{fmtPct(m.stats!.change1d)}</span></div>)}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export const Analysis: React.FC<{ report: Report; market: MarketItem[] }> = ({ report, market }) => {
  const by = Object.fromEntries(market.map((m) => [m.id, m]));
  return (
    <>
      {report.global && (
        <Wrap title="Global picture" blurb="Status, consequence, impact and outlook, each in plain English and in technical terms, with the data and sources behind it.">
          <InsightCard insight={report.global} market={by} />
        </Wrap>
      )}
      {report.regions.length > 0 && (
        <Wrap title="By region">
          <div className="space-y-4">{report.regions.map((i) => <InsightCard key={i.title} insight={i} market={by} />)}</div>
        </Wrap>
      )}
      {report.drivers.length > 0 && (
        <Wrap title="What is driving markets" blurb="Only drivers that the latest research supports with sources are listed.">
          <div className="space-y-4">{report.drivers.map((i) => <InsightCard key={i.title} insight={i} market={by} />)}</div>
        </Wrap>
      )}
    </>
  );
};

export const Events: React.FC<{ report: Report }> = ({ report }) =>
  report.events.length === 0 ? null : (
    <Wrap title="Coming up in the next 7 days" blurb="Scheduled events found in the research, with why they matter.">
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 dark:bg-neutral-950 text-xs text-neutral-600 dark:text-neutral-400"><tr><th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">Event</th><th className="px-3 py-2 text-left">Plain English</th><th className="px-3 py-2 text-left">Technical</th></tr></thead>
          <tbody>
            {report.events.map((e) => (
              <tr key={e.title + e.when} className="border-t border-neutral-200 dark:border-neutral-800 align-top">
                <td className="px-3 py-2 whitespace-nowrap font-medium">{e.when}</td>
                <td className="px-3 py-2 font-semibold">{e.title}</td>
                <td className="px-3 py-2">{e.layman}</td>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">{e.technical} <Cites sources={e.sources} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Wrap>
  );

const LOOKALIKE_IDS = ['sp500', 'nasdaq', 'nifty50', 'sensex', 'ftse100', 'dax', 'nikkei', 'hangseng'];

/** Look-alike days: computed by code from each index's own price history. */
export const History: React.FC<{ market: MarketItem[] }> = ({ market }) => {
  const rows = LOOKALIKE_IDS.map((id) => market.find((m) => m.id === id)).filter((m): m is MarketItem => !!m && m.episodes.length > 0);
  if (rows.length === 0) return null;
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return (
    <Wrap
      title="Similar situations in the past (computed)"
      blurb="For each index the model finds the 5 past days that looked most like the latest day (size of move, 5-day move, volatility, distance from the 1-year high) and shows what followed. Click an index above for the dates. Base rates, not predictions."
    >
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 dark:bg-neutral-950 text-xs text-neutral-600 dark:text-neutral-400">
            <tr><th className="px-3 py-2 text-left">Index</th><th className="px-3 py-2 text-right">Next 5 days: rose</th><th className="px-3 py-2 text-right">Median</th><th className="px-3 py-2 text-right">Next 21 days: rose</th><th className="px-3 py-2 text-right">Median</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2 font-semibold">{m.name}</td>
                <td className="px-3 py-2 text-right font-mono">{m.episodes.filter((e) => e.next5d > 0).length} of {m.episodes.length}</td>
                <td className={`px-3 py-2 text-right font-mono ${pctClass(med(m.episodes.map((e) => e.next5d)))}`}>{fmtPct(med(m.episodes.map((e) => e.next5d)))}</td>
                <td className="px-3 py-2 text-right font-mono">{m.episodes.filter((e) => e.next21d > 0).length} of {m.episodes.length}</td>
                <td className={`px-3 py-2 text-right font-mono ${pctClass(med(m.episodes.map((e) => e.next21d)))}`}>{fmtPct(med(m.episodes.map((e) => e.next21d)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Wrap>
  );
};

export const Methodology: React.FC<{ snap: Snapshot }> = ({ snap }) => (
  <Wrap id="method" title="How this page is made (and what it cannot do)">
    <div className="grid md:grid-cols-2 gap-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
      <div className="space-y-2">
        <p><strong>Numbers are computed, not written by AI.</strong> Prices come from Yahoo Finance daily closes. Changes, moving averages, RSI, volatility, drawdowns, correlations, the "what usually happened next" base rates and the look-alike-day model are calculated by code from about 5 years of those closes.</p>
        <p><strong>News is collected by code.</strong> Headlines and summaries are read from the RSS feeds of central banks, established news outlets and market sites (this run: {snap.usage.headlines} headlines from {snap.usage.feedsOk} feeds). Items from sites outside the trusted list are discarded.</p>
        <p><strong>Claude only analyses.</strong> {snap.models.synthesis} reads that evidence in one pass, without browsing, and writes status, consequence, impact and outlook in two voices. Code then drops any item that cites something that does not exist, or whose numbers cannot be found in its evidence. Where no reason for a move was found, the page says so.</p>
      </div>
      <div className="space-y-2">
        <p><strong>Outlooks are base rates, not predictions.</strong> They show how often, and by how much, this market moved after days that looked like the latest one. They describe the past and can fail.</p>
        <p><strong>Known limits.</strong> A headline is only what its publisher said; it may be wrong or incomplete, and feeds show only the headline and summary, not the whole article. Yahoo Finance is an unofficial free feed and can be delayed. 24-hour markets (oil, gold, Bitcoin, currencies) show the latest price at update time. Correlation is not cause. Valuation ratios (P/E) are not included because there is no reliable free feed.</p>
        <p><strong>This is information, not investment advice.</strong> Check key figures against an official source before acting. Last update: {new Date(snap.generatedAt).toUTCString()}.</p>
      </div>
    </div>
  </Wrap>
);
