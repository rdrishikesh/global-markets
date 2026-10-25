/**
 * The fixed list of things this site tracks. It contains NO prices: every number on the site is
 * fetched from Yahoo Finance at update time (see server/yahoo.ts) and links back to its quote page.
 */
export type Region = 'Americas' | 'Europe' | 'Asia-Pacific' | 'Global';
export type ItemKind = 'index' | 'factor';

export interface CatalogItem {
  id: string;
  kind: ItemKind;
  name: string;
  country: string;
  region: Region;
  /** Yahoo Finance symbol. */
  symbol: string;
  /** Plain-English description, shown in tooltips and used in prompts. */
  about: string;
  /** For factors: the unit the quote is in. */
  unit?: string;
}

export const INDICES: CatalogItem[] = [
  { id: 'sp500', kind: 'index', name: 'S&P 500', country: 'United States', region: 'Americas', symbol: '^GSPC', about: '500 large US companies' },
  { id: 'dow', kind: 'index', name: 'Dow Jones Industrial Average', country: 'United States', region: 'Americas', symbol: '^DJI', about: '30 large US blue-chip companies' },
  { id: 'nasdaq', kind: 'index', name: 'Nasdaq Composite', country: 'United States', region: 'Americas', symbol: '^IXIC', about: 'US technology-heavy stock market' },
  { id: 'russell2000', kind: 'index', name: 'Russell 2000', country: 'United States', region: 'Americas', symbol: '^RUT', about: '2,000 smaller US companies' },
  { id: 'tsx', kind: 'index', name: 'S&P/TSX Composite', country: 'Canada', region: 'Americas', symbol: '^GSPTSE', about: 'Canadian stocks, heavy in banks and energy' },
  { id: 'bovespa', kind: 'index', name: 'Bovespa', country: 'Brazil', region: 'Americas', symbol: '^BVSP', about: 'Brazilian stocks, heavy in commodities and banks' },
  { id: 'ipc', kind: 'index', name: 'S&P/BMV IPC', country: 'Mexico', region: 'Americas', symbol: '^MXX', about: 'Mexican large companies' },
  { id: 'ftse100', kind: 'index', name: 'FTSE 100', country: 'United Kingdom', region: 'Europe', symbol: '^FTSE', about: '100 large UK companies, global earners' },
  { id: 'dax', kind: 'index', name: 'DAX', country: 'Germany', region: 'Europe', symbol: '^GDAXI', about: '40 large German companies, export and industry heavy' },
  { id: 'cac40', kind: 'index', name: 'CAC 40', country: 'France', region: 'Europe', symbol: '^FCHI', about: '40 large French companies, luxury heavy' },
  { id: 'eurostoxx50', kind: 'index', name: 'Euro Stoxx 50', country: 'Eurozone', region: 'Europe', symbol: '^STOXX50E', about: '50 blue-chip companies across the euro area' },
  { id: 'ibex35', kind: 'index', name: 'IBEX 35', country: 'Spain', region: 'Europe', symbol: '^IBEX', about: 'Spanish large companies, banks heavy' },
  { id: 'ftsemib', kind: 'index', name: 'FTSE MIB', country: 'Italy', region: 'Europe', symbol: 'FTSEMIB.MI', about: 'Italian large companies, banks and energy' },
  { id: 'smi', kind: 'index', name: 'Swiss Market Index', country: 'Switzerland', region: 'Europe', symbol: '^SSMI', about: 'Swiss large companies, defensive sectors' },
  { id: 'aex', kind: 'index', name: 'AEX', country: 'Netherlands', region: 'Europe', symbol: '^AEX', about: 'Dutch large companies, chips and consumer' },
  { id: 'nikkei', kind: 'index', name: 'Nikkei 225', country: 'Japan', region: 'Asia-Pacific', symbol: '^N225', about: '225 large Japanese companies, sensitive to the yen' },
  { id: 'hangseng', kind: 'index', name: 'Hang Seng', country: 'Hong Kong', region: 'Asia-Pacific', symbol: '^HSI', about: 'Hong Kong market, China tech and financials' },
  { id: 'shanghai', kind: 'index', name: 'Shanghai Composite', country: 'China', region: 'Asia-Pacific', symbol: '000001.SS', about: 'All stocks on the Shanghai exchange' },
  { id: 'shenzhen', kind: 'index', name: 'Shenzhen Component', country: 'China', region: 'Asia-Pacific', symbol: '399001.SZ', about: '500 Shenzhen stocks, tech and growth heavy' },
  { id: 'nifty50', kind: 'index', name: 'Nifty 50', country: 'India', region: 'Asia-Pacific', symbol: '^NSEI', about: '50 large Indian companies on the NSE' },
  { id: 'sensex', kind: 'index', name: 'BSE Sensex', country: 'India', region: 'Asia-Pacific', symbol: '^BSESN', about: '30 large Indian companies on the BSE' },
  { id: 'kospi', kind: 'index', name: 'KOSPI', country: 'South Korea', region: 'Asia-Pacific', symbol: '^KS11', about: 'South Korean stocks, memory chips and autos' },
  { id: 'asx200', kind: 'index', name: 'S&P/ASX 200', country: 'Australia', region: 'Asia-Pacific', symbol: '^AXJO', about: 'Australian stocks, banks and miners' },
  { id: 'taiex', kind: 'index', name: 'TAIEX', country: 'Taiwan', region: 'Asia-Pacific', symbol: '^TWII', about: 'Taiwan market, dominated by chip makers' },
  { id: 'straitstimes', kind: 'index', name: 'Straits Times Index', country: 'Singapore', region: 'Asia-Pacific', symbol: '^STI', about: '30 Singapore companies, banks and property' },
];

export const FACTORS: CatalogItem[] = [
  { id: 'vix', kind: 'factor', name: 'VIX (volatility)', country: 'United States', region: 'Global', symbol: '^VIX', unit: 'pts', about: 'Expected 30-day swings in the S&P 500; the "fear gauge"' },
  { id: 'us10y', kind: 'factor', name: 'US 10-year Treasury yield', country: 'United States', region: 'Global', symbol: '^TNX', unit: '%', about: 'Benchmark borrowing cost; drives valuations everywhere' },
  { id: 'dxy', kind: 'factor', name: 'US Dollar Index', country: 'United States', region: 'Global', symbol: 'DX-Y.NYB', unit: 'pts', about: 'Dollar against a basket of major currencies' },
  { id: 'eurusd', kind: 'factor', name: 'EUR/USD', country: 'Eurozone', region: 'Global', symbol: 'EURUSD=X', unit: 'USD', about: 'Dollars per euro' },
  { id: 'usdinr', kind: 'factor', name: 'USD/INR', country: 'India', region: 'Global', symbol: 'USDINR=X', unit: 'INR', about: 'Rupees per dollar' },
  { id: 'usdjpy', kind: 'factor', name: 'USD/JPY', country: 'Japan', region: 'Global', symbol: 'USDJPY=X', unit: 'JPY', about: 'Yen per dollar' },
  { id: 'brent', kind: 'factor', name: 'Brent crude oil', country: 'Global', region: 'Global', symbol: 'BZ=F', unit: 'USD/bbl', about: 'International oil benchmark' },
  { id: 'wti', kind: 'factor', name: 'WTI crude oil', country: 'United States', region: 'Global', symbol: 'CL=F', unit: 'USD/bbl', about: 'US oil benchmark' },
  { id: 'gold', kind: 'factor', name: 'Gold', country: 'Global', region: 'Global', symbol: 'GC=F', unit: 'USD/oz', about: 'Classic safe-haven asset' },
  { id: 'copper', kind: 'factor', name: 'Copper', country: 'Global', region: 'Global', symbol: 'HG=F', unit: 'USD/lb', about: 'Industrial metal; a read on global growth' },
  { id: 'bitcoin', kind: 'factor', name: 'Bitcoin', country: 'Global', region: 'Global', symbol: 'BTC-USD', unit: 'USD', about: 'Risk-appetite gauge' },
];

export const CATALOG: CatalogItem[] = [...INDICES, ...FACTORS];
export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

export const yahooQuoteUrl = (symbol: string) => `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;

/** Factors that the statistics engine tests each index against. */
export const DRIVER_FACTOR_IDS = ['vix', 'us10y', 'dxy', 'brent', 'gold', 'usdinr', 'usdjpy', 'copper'];
