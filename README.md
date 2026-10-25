# Global Markets Intelligence

A free static website showing the 25 major global stock indices and 11 macro factors. Every number is computed from price history; every written explanation is tied to cited web sources and shown in plain English and technical language. **Publishing guide: see START-HERE.md.**

## What each part does

| Layer | Who produces it | How it is kept honest |
|---|---|---|
| Prices, changes, trend, RSI, volatility, drawdown, correlations, base rates, look-alike-day model | Code (`server/stats.ts`) from ~5 years of Yahoo Finance daily closes | Deterministic and unit-tested; no AI |
| Headlines (news, central banks, scheduled events) | Code (`server/news.ts`): ~60 RSS/Atom feeds (Bloomberg, Financial Times, WSJ, Economist, CNBC, MarketWatch, BBC, central banks, Indian and Asian outlets) plus Google News queries restricted to reuters.com, bloomberg.com, ft.com, wsj.com, barrons.com, economist.com and morningstar.com | Dated, de-duplicated, trusted domains only; links and publishers come from the feed itself |
| Status / consequence / impact / outlook in two voices | **One** Claude call with no browsing (`server/synthesize.ts`) | `server/validate.ts` drops any item that cites unknown notes or series, or contains a number not found in its evidence |
| Mood label | Code, rule published on the page | Inputs shown |

```
GitHub Actions (weekdays x2) -> Yahoo closes -> stats + look-alike model -> RSS headlines
   -> 1 Claude call (analysis only) -> validation -> public/data/snapshot.json (atomic) -> build -> GitHub Pages
```

Cost controls: no web-search tool; input is capped at ~130 headlines; the call is skipped when inputs are unchanged or too few headlines arrive.
Failure behaviour: too few prices -> nothing published (quality gate); Claude fails -> fresh numbers plus the previous analysis with a visible "from <date>" banner; no previous analysis -> numbers only.

## Local use

```bash
npm install
cp .env.example .env     # add ANTHROPIC_API_KEY; never commit .env
npm test                 # offline: uses fake Claude and fake Yahoo responses
npm run generate         # creates public/data/snapshot.json (spends API credit)
npm run dev
```

## Files

| Path | Purpose |
|---|---|
| `src/data/catalog.ts` | The tracked indices and factors and their Yahoo symbols (no prices) |
| `server/yahoo.ts`, `server/stats.ts` | Price fetch and statistics |
| `server/news.ts` | Feed list, RSS parsing, headline selection |
| `server/synthesize.ts`, `server/validate.ts`, `server/sources.ts` | The Claude call, validation, trusted sources and numbering |
| `scripts/generate-report.ts` | Orchestrator with quality gate and atomic write |
| `src/` | The React site (reads `data/snapshot.json`) |
| `.github/workflows/deploy.yml` | Schedule, refresh, build, publish, live-link summary |

## Limits

- Claude sees headlines and short summaries, not full articles. Validation proves a cited item was fetched by the code and that numbers trace to the evidence; it cannot prove the publisher is right or that a headline supports every nuance of Claude's wording.
- Paywalled publishers (Bloomberg, FT, WSJ, Reuters) share only headlines and short summaries in their feeds; that is all the site shows and all Claude reads. No paywall is bypassed. No single publisher may supply more than 14 of the ~130 headlines Claude reads.
- Feed addresses change; the feed list is not guaranteed to work on day one. Broken feeds are reported and skipped.
- No valuation ratios (P/E, P/B): there is no reliable free feed, and scraping sites such as Screener or Morningstar may breach their terms.
- Yahoo Finance's chart endpoint is unofficial and may change or throttle GitHub runner IPs.
- The base rates describe this market's own past. They are not forecasts. Not investment advice.
