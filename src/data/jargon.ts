export interface JargonItem {
  term: string;
  category: 'Equities' | 'Bonds & Rates' | 'Currencies & Commodities' | 'General';
  definition: string;
  plainEnglishExample: string;
}

export const JARGON_DICTIONARY: Record<string, JargonItem> = {
  yield: {
    term: 'Yield (Bond Yield)',
    category: 'Bonds & Rates',
    definition:
      'The annual interest rate an investor earns for lending money to a government or company, expressed as a percentage of the bond’s price.',
    plainEnglishExample:
      'Illustration only, not a current figure: if a 10-year government bond yields 4%, lending $1,000 pays about $40 per year. When yields rise, borrowing gets more expensive for everyone.',
  },
  vix: {
    term: 'VIX (Fear Index)',
    category: 'Equities',
    definition:
      'The Cboe Volatility Index measures expected stock market volatility over the next 30 days based on S&P 500 option prices.',
    plainEnglishExample:
      'Below 20 means markets are calm and confident. Above 30 indicates heightened anxiety or turmoil.',
  },
  'risk-on': {
    term: 'Risk-On vs Risk-Off',
    category: 'General',
    definition:
      'A description of market mood. "Risk-on" means investors are optimistic and buying growth assets (like tech stocks). "Risk-off" means investors are nervous and fleeing to safer havens (like gold, cash, or sovereign bonds).',
    plainEnglishExample:
      'During risk-on days, tech stocks and emerging markets usually rally while gold and cash yields see lower demand.',
  },
  dxy: {
    term: 'US Dollar Index (DXY)',
    category: 'Currencies & Commodities',
    definition:
      'A measure of the value of the US dollar relative to a basket of six major foreign currencies (Euro, Yen, Pound, Canadian Dollar, Swedish Krona, Swiss Franc).',
    plainEnglishExample:
      'A rising DXY means the dollar is getting stronger, making US imports cheaper but hurting US multinational corporate earnings abroad.',
  },
  'basis points': {
    term: 'Basis Points (bps)',
    category: 'Bonds & Rates',
    definition:
      'A unit of measure equal to one-hundredth of a percentage point (0.01%). 100 basis points equals 1.00%.',
    plainEnglishExample:
      'If the Federal Reserve cuts rates by 25 basis points, interest rates drop from for example from 5.00% to 4.75% (illustration only).',
  },
  hawkish: {
    term: 'Hawkish vs Dovish',
    category: 'Bonds & Rates',
    definition:
      'Central bank stances. "Hawkish" means prioritizing fighting inflation by keeping interest rates high. "Dovish" means favoring lower interest rates to encourage economic growth and hiring.',
    plainEnglishExample:
      'A dovish central bank tends to lift stock prices because cheaper borrowing boosts business expansion.',
  },
  'brent vs wti': {
    term: 'Brent vs WTI Crude Oil',
    category: 'Currencies & Commodities',
    definition:
      'The two main global oil pricing benchmarks. Brent is extracted from the North Sea and sets prices for global international trade. WTI (West Texas Intermediate) is pumped in the US and sets North American pricing.',
    plainEnglishExample:
      'Brent typically trades at a slight $3-$5 premium over WTI due to sea shipping logistics.',
  },
  sparkline: {
    term: 'Sparkline',
    category: 'General',
    definition:
      'A small, word-sized trend chart without axes that shows the general shape and direction of a price move over recent days or weeks.',
    plainEnglishExample:
      'Green sparklines heading upward mean recent momentum has been positive; red sloping downward indicates recent selling pressure.',
  },
  'inverted yield curve': {
    term: 'Inverted Yield Curve',
    category: 'Bonds & Rates',
    definition:
      'An unusual situation where short-term bonds pay higher interest than long-term bonds, historically a reliable warning sign of an economic slowdown.',
    plainEnglishExample:
      'Normally, locking up money for 10 years pays more than 2 years. When 2-year pays more, it implies investors anticipate future economic weakness.',
  },
  'carry trade': {
    term: 'Carry Trade',
    category: 'Currencies & Commodities',
    definition:
      'A financial strategy where investors borrow money in a currency with near-zero interest rates (like the Japanese Yen) and invest it in higher-yielding assets elsewhere.',
    plainEnglishExample:
      'When the Yen rapidly strengthens, investors are forced to sell their foreign assets to repay their loans, causing sudden cross-market sell-offs.',
  },
};
