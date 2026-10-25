import React, { useEffect, useRef, useState } from 'react';

/**
 * TradingView's free embeddable widgets. TradingView supplies and displays the data (we do not scrape it);
 * it is shown in the visitor's browser, which therefore contacts TradingView. The widget carries its own
 * "TradingView" attribution link; keep it.
 */
const BASE = 'https://s3.tradingview.com/external-embedding/';

const Widget: React.FC<{ script: string; config: Record<string, unknown>; height: number; dark: boolean }> = ({ script, config, height, dark }) => {
  const host = useRef<any>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    el.appendChild(inner);
    const s = document.createElement('script');
    s.src = BASE + script;
    s.async = true;
    s.type = 'text/javascript';
    s.innerHTML = JSON.stringify({ ...config, colorTheme: dark ? 'dark' : 'light', isTransparent: true, locale: 'en', width: '100%', height: '100%' });
    el.appendChild(s);
    return () => {
      el.innerHTML = '';
    };
  }, [script, dark]);
  return <div ref={host} className="tradingview-widget-container" style={{ height, width: '100%' }} />;
};

const TAPE = [
  { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
  { proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq 100' },
  { proName: 'NSE:NIFTY', title: 'Nifty 50' },
  { proName: 'BSE:SENSEX', title: 'Sensex' },
  { proName: 'TVC:NI225', title: 'Nikkei 225' },
  { proName: 'TVC:HSI', title: 'Hang Seng' },
  { proName: 'TVC:UKX', title: 'FTSE 100' },
  { proName: 'XETR:DAX', title: 'DAX' },
  { proName: 'TVC:DXY', title: 'Dollar index' },
  { proName: 'TVC:GOLD', title: 'Gold' },
  { proName: 'TVC:USOIL', title: 'WTI oil' },
  { proName: 'FX_IDC:USDINR', title: 'USD/INR' },
];

export const TickerTape: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
    <Widget script="embed-widget-ticker-tape.js" height={76} dark={dark} config={{ symbols: TAPE, showSymbolLogo: false, displayMode: 'adaptive' }} />
  </div>
);

export const LiveCharts: React.FC<{ dark: boolean }> = ({ dark }) => {
  const [open, setOpen] = useState(false);
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h2 className="text-lg font-bold">Live charts (by TradingView)</h2>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        These charts are TradingView's own free widgets, loaded from TradingView when you open them. They show TradingView's data and are separate from the sourced numbers and analysis above.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700">Load live charts</button>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <Widget
              script="embed-widget-market-overview.js"
              height={500}
              dark={dark}
              config={{
                showFloatingTooltip: true,
                tabs: [
                  { title: 'Indices', symbols: [{ s: 'FOREXCOM:SPXUSD', d: 'S&P 500' }, { s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100' }, { s: 'NSE:NIFTY', d: 'Nifty 50' }, { s: 'BSE:SENSEX', d: 'Sensex' }, { s: 'TVC:NI225', d: 'Nikkei 225' }, { s: 'TVC:HSI', d: 'Hang Seng' }, { s: 'TVC:UKX', d: 'FTSE 100' }, { s: 'XETR:DAX', d: 'DAX' }] },
                  { title: 'Commodities & FX', symbols: [{ s: 'TVC:GOLD', d: 'Gold' }, { s: 'TVC:USOIL', d: 'WTI oil' }, { s: 'TVC:UKOIL', d: 'Brent oil' }, { s: 'TVC:DXY', d: 'Dollar index' }, { s: 'FX_IDC:USDINR', d: 'USD/INR' }, { s: 'FX_IDC:EURUSD', d: 'EUR/USD' }] },
                ],
              }}
            />
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <Widget script="embed-widget-advanced-chart.js" height={500} dark={dark} config={{ symbol: 'NSE:NIFTY', interval: 'D', timezone: 'Asia/Kolkata', style: '1', allow_symbol_change: true, hide_side_toolbar: true }} />
          </div>
        </div>
      )}
    </section>
  );
};
