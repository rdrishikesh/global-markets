import React, { useCallback, useEffect, useState } from 'react';
import type { Snapshot } from './types/report.js';
import { Overview, Analysis, Events, History, Methodology } from './components/Sections.js';
import { MarketTable } from './components/MarketTable.js';
import { SourcesList } from './components/Cite.js';
import { JargonModal } from './components/JargonModal.js';
import { ageText, fmtWhen } from './utils/format.js';
import { AlertTriangle, BookOpen, Globe, Moon, RefreshCw, Sun } from 'lucide-react';

const DARK_KEY = 'gmi_dark';
/** Updates run on weekdays, so a Friday snapshot is legitimately ~3 days old on Monday morning. */
const STALE_AFTER_MS = 96 * 60 * 60 * 1000;

function initialDark(): boolean {
  try {
    const v = localStorage.getItem(DARK_KEY);
    if (v !== null) return v === 'true';
  } catch {
    /* storage unavailable */
  }
  return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

async function loadSnapshot(): Promise<Snapshot> {
  const url = new URL('data/snapshot.json', document.baseURI);
  url.searchParams.set('v', String(Math.floor(Date.now() / 60000)));
  const res = await fetch(url.toString(), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const s = (await res.json()) as Snapshot;
  if (s?.schemaVersion !== 2 || !Array.isArray(s.market)) throw new Error('unexpected data format');
  return s;
}

const Banner: React.FC<{ tone: 'warn' | 'info'; children?: React.ReactNode }> = ({ tone, children }) => (
  <div role="status" className={`border-b text-xs ${tone === 'warn' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200'}`}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex gap-2 items-start">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  </div>
);

export default function App() {
  const [dark, setDark] = useState<boolean>(initialDark);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jargon, setJargon] = useState<{ open: boolean; term?: string }>({ open: false });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(DARK_KEY, String(dark));
    } catch {
      /* ignore */
    }
  }, [dark]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnap(await loadSnapshot());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const stale = snap ? Date.now() - new Date(snap.generatedAt).getTime() > STALE_AFTER_MS : false;
  const reportOld = snap?.report ? new Date(snap.generatedAt).getTime() - new Date(snap.report.generatedAt).getTime() > 3600_000 : false;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-600 text-white"><Globe className="w-5 h-5" /></div>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg leading-tight truncate">Global Markets Intelligence</h1>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                {snap ? `Updated ${fmtWhen(snap.generatedAt)} (${ageText(snap.generatedAt)}) - every claim linked to a source` : 'Facts, sources and plain-English explanations'}
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1.5 text-xs">
            <a href="#sources" className="hidden sm:inline px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">Sources</a>
            <a href="#method" className="hidden sm:inline px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">Method</a>
            <button onClick={() => setJargon({ open: true })} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"><BookOpen className="w-3.5 h-3.5" />Glossary</button>
            <button onClick={() => void load()} disabled={loading} aria-label="Check for newer data" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Reload</span></button>
            <button onClick={() => setDark(!dark)} aria-label="Toggle dark mode" className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">{dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          </nav>
        </div>
      </header>

      {stale && snap && <Banner tone="warn"><strong>This data is {ageText(snap.generatedAt).replace(' ago', '')} old.</strong> Scheduled updates may have stopped; figures may be out of date.</Banner>}
      {reportOld && snap?.report && <Banner tone="warn">Today's written analysis could not be produced, so the explanations below are from {fmtWhen(snap.report.generatedAt)}. The numbers in the tables are current.</Banner>}
      {snap && snap.warnings.length > 0 && (
        <Banner tone="info">
          <details>
            <summary className="cursor-pointer font-semibold">{snap.warnings.length} note(s) about this update (items that were left out, and why)</summary>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">{snap.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        </Banner>
      )}

      {!snap && !loading && (
        <main className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
          <h2 className="text-xl font-bold">No market data has been published yet</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">The first scheduled update has not completed ({error}). If you own this site: open the <strong>Actions</strong> tab on GitHub, choose <strong>Update market data and deploy</strong> and press <strong>Run workflow</strong>. See START-HERE.md for the 15-minute setup.</p>
        </main>
      )}
      {!snap && loading && <main className="py-24 text-center text-sm text-neutral-500">Loading the latest published data...</main>}

      {snap && (
        <main>
          <Overview snap={snap} onTerm={(t) => setJargon({ open: true, term: t })} />
          {snap.report && <Analysis report={snap.report} market={snap.market} />}
          <MarketTable
            title="25 global indices"
            blurb="Latest close, changes over several periods and a 60-day trend line. Prices: Yahoo Finance daily closes."
            items={snap.market.filter((m) => m.kind === 'index')}
            all={snap.market}
            groupByRegion
          />
          <MarketTable
            title="Factors that move markets"
            blurb="Rates, the dollar, oil, gold, volatility, currencies and Bitcoin. 24-hour markets show the latest price at update time."
            items={snap.market.filter((m) => m.kind === 'factor')}
            all={snap.market}
          />
          {snap.report && <Events report={snap.report} />}
          <History market={snap.market} />
          {snap.sources.length > 0 && <SourcesList sources={snap.sources} />}
          <Methodology snap={snap} />
        </main>
      )}

      <footer className="border-t border-neutral-200 dark:border-neutral-800 mt-8 py-6 text-center text-[11px] text-neutral-500 px-4">
        Information only, not investment advice. Data may be delayed or incomplete; check official sources before acting.
      </footer>
      <JargonModal isOpen={jargon.open} onClose={() => setJargon({ open: false })} initialTerm={jargon.term} />
    </div>
  );
}
