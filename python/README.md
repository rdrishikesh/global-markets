# Python data collectors

No installs needed (standard library only, Python 3.9+).

```bash
python -m unittest discover -s tests          # offline self-checks
python -m markets_collect --out extra.json    # run from this folder
python -m markets_collect --only nse,news --screener my_screener_export.csv
```

| Source | What it pulls | How | Status |
|---|---|---|---|
| Yahoo Finance | 5 years of daily closes; market news RSS | Public chart endpoint and RSS (unofficial, personal use) | Same endpoint the website already uses |
| Investing.com | News headlines | Its public RSS feed | Headlines only |
| NASDAQ | Markets and stocks news | Its public RSS feeds | Headlines only |
| NSE India | Every NSE index: close, % change, **P/E, P/B, dividend yield** | The end-of-day index file NSE publishes for download | File layout not verified from here |
| BSE India | Top gainers and losers (liquid stocks) | The daily Bhavcopy file BSE publishes | File layout not verified from here |
| Screener.in | Your own exported watchlist or screen | You export a CSV from your logged-in account; the code only reads that local file | Never contacts the site |
| TradingView | Nothing | No public data API; scraping is against its terms. The website embeds its free widgets instead (`src/components/TradingViewWidgets.tsx`) | Not scraped |

Rules built in: every request is spaced at least 1 second apart, `robots.txt` is checked, and 401/403/404 responses are not retried. If a site blocks the request, that source is skipped and listed under `problems` in the output. Do not work around a block.
