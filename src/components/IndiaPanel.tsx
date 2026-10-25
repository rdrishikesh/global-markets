import React from 'react';
import type { Extra } from '../types/report.js';
import { fmtNum, fmtPct, pctClass } from '../utils/format.js';

const KEY = ['nifty 50', 'nifty next 50', 'nifty 100', 'nifty 500', 'nifty bank', 'nifty it', 'nifty midcap 100', 'nifty smallcap 100', 'nifty financial services', 'nifty auto', 'nifty pharma', 'nifty fmcg', 'nifty metal', 'nifty energy', 'india vix'];

/** Official exchange data collected by the Python step. Shown only if that step produced something. */
export const IndiaPanel: React.FC<{ extra: Extra | null }> = ({ extra }) => {
  const nse = extra?.nse_indices ?? [];
  const bse = extra?.bse_movers;
  if (!extra || (nse.length === 0 && !bse)) return null;
  const key = KEY.map((k) => nse.find((r) => r.index.toLowerCase() === k)).filter((r): r is NonNullable<typeof r> => !!r);
  const Row = ({ r }: { r: (typeof nse)[number] }) => (
    <tr className="border-t border-neutral-200 dark:border-neutral-800">
      <td className="px-3 py-2 font-semibold">{r.index}</td>
      <td className="px-3 py-2 text-right font-mono">{fmtNum(r.close)}</td>
      <td className={`px-3 py-2 text-right font-mono ${pctClass(r.change_pct)}`}>{fmtPct(r.change_pct)}</td>
      <td className="px-3 py-2 text-right font-mono">{r.pe === null ? 'n/a' : r.pe.toFixed(2)}</td>
      <td className="px-3 py-2 text-right font-mono">{r.pb === null ? 'n/a' : r.pb.toFixed(2)}</td>
      <td className="px-3 py-2 text-right font-mono">{r.div_yield === null ? 'n/a' : `${r.div_yield.toFixed(2)}%`}</td>
    </tr>
  );
  const head = (
    <thead className="bg-neutral-100 dark:bg-neutral-950 text-xs text-neutral-600 dark:text-neutral-400">
      <tr><th className="px-3 py-2 text-left">Index</th><th className="px-3 py-2 text-right">Close</th><th className="px-3 py-2 text-right">Change</th><th className="px-3 py-2 text-right" title="Price divided by earnings: how many rupees you pay for one rupee of yearly profit">P/E</th><th className="px-3 py-2 text-right" title="Price divided by book value">P/B</th><th className="px-3 py-2 text-right" title="Yearly dividend as a share of the price">Div. yield</th></tr>
    </thead>
  );
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h2 className="text-lg font-bold">India: official exchange data</h2>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        Straight from the end-of-day files that NSE and BSE publish for download. P/E, P/B and dividend yield are NSE's own figures, shown as published, not recomputed here.
      </p>
      {nse.length > 0 && (
        <div className="mb-4">
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="w-full text-sm">{head}<tbody>{(key.length ? key : nse.slice(0, 15)).map((r) => <Row key={r.index} r={r} />)}</tbody></table>
          </div>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-blue-700 dark:text-blue-400">All {nse.length} NSE indices (as of {nse[0].date})</summary>
            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mt-2">
              <table className="w-full text-sm">{head}<tbody>{nse.map((r) => <Row key={r.index} r={r} />)}</tbody></table>
            </div>
          </details>
          <p className="text-[11px] text-neutral-500 mt-1">Source: {nse[0].source}.</p>
        </div>
      )}
      {bse && (
        <div className="grid md:grid-cols-2 gap-4">
          {([['Top gainers', bse.gainers], ['Top losers', bse.losers]] as const).map(([title, rows]) => (
            <div key={title} className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="px-3 py-2 text-xs font-bold bg-neutral-100 dark:bg-neutral-950">BSE {title.toLowerCase()} ({bse.date}, liquid stocks only)</div>
              <table className="w-full text-sm"><tbody>
                {rows.map((m) => (
                  <tr key={m.symbol} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-1.5">{m.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtNum(m.close)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold ${pctClass(m.change_pct)}`}>{fmtPct(m.change_pct)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-neutral-500 mt-1.5">Source: {bse?.source ?? 'NSE'}. Collected {new Date(extra.generatedAt).toUTCString()}.</p>
    </section>
  );
};
