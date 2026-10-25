"""python -m markets_collect --out extra.json [--screener export.csv] [--only yahoo,news,nse,bse,macro]"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone

from . import bse, feeds, macro, nse, screener_import, yahoo

SYMBOLS = {"S&P 500": "^GSPC", "Nasdaq Composite": "^IXIC", "Nifty 50": "^NSEI", "BSE Sensex": "^BSESN", "Nikkei 225": "^N225", "FTSE 100": "^FTSE"}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="extra.json")
    ap.add_argument("--only", default="yahoo,news,nse,bse,macro")
    ap.add_argument("--screener", help="CSV you exported from your own Screener.in account")
    a = ap.parse_args(argv)
    want = set(a.only.split(","))
    out: dict = {"generatedAt": datetime.now(timezone.utc).isoformat(), "problems": []}

    def step(name, fn):
        try:
            out[name] = fn()
        except Exception as e:
            out["problems"].append(f"{name}: {e}")
            print(f"WARNING {name}: {e}", file=sys.stderr)

    if "yahoo" in want:
        step("yahoo", lambda: {n: yahoo.daily_closes(s)[-30:] for n, s in SYMBOLS.items()})
    if "news" in want:
        def news():
            items, problems = feeds.collect()
            out["problems"].extend(problems)
            return items[:100]
        step("news", news)
    if "nse" in want:
        step("nse_indices", nse.latest)
    if "macro" in want:
        step("macro", macro.collect)
    if "bse" in want:
        step("bse_movers", bse.latest)
    if a.screener:
        step("screener_export", lambda: screener_import.load_export(a.screener))
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(f"wrote {a.out}; {len(out['problems'])} problem(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
