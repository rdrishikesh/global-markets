import React from 'react';
import type { Source } from '../types/report.js';
import { TIER_NAMES } from './tiers.js';

/** Superscript footnote links like [3] that jump to the source list. */
export const Cites: React.FC<{ sources: number[] }> = ({ sources }) => (
  <span className="whitespace-nowrap">
    {sources.map((n) => (
      <a
        key={n}
        href={`#src-${n}`}
        className="ml-0.5 align-super text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
        title={`Source ${n}`}
      >
        [{n}]
      </a>
    ))}
  </span>
);

export const SourcesList: React.FC<{ sources: Source[] }> = ({ sources }) => (
  <section id="sources" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h2 className="text-lg font-bold mb-1">Sources ({sources.length})</h2>
    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
      Every source below is a headline that was read from the publisher's feed during the latest update and is cited by at least one statement on this page. Titles are the publisher's own headlines.
      Prices come from Yahoo Finance quote pages linked in each table row.
    </p>
    <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-xs">
        <thead className="bg-neutral-100 dark:bg-neutral-900 text-left text-neutral-600 dark:text-neutral-400">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Publisher</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Page date</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.n} id={`src-${s.n}`} className="border-t border-neutral-200 dark:border-neutral-800 target:bg-amber-50 dark:target:bg-amber-950/30">
              <td className="px-3 py-2 font-semibold">{s.n}</td>
              <td className="px-3 py-2">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-400 hover:underline break-words">
                  {s.title}
                </a>
              </td>
              <td className="px-3 py-2">{s.publisher}</td>
              <td className="px-3 py-2">{TIER_NAMES[s.tier]}</td>
              <td className="px-3 py-2">{s.pageAge ?? 'not given'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
