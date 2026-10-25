"""BSE India: the daily equity Bhavcopy that BSE publishes for download; reports top movers."""
from __future__ import annotations

import csv
import io
from datetime import date, timedelta

from . import http, nse

URL = "https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{d}_F_0000.CSV"


def parse_bhavcopy(text: str) -> list[dict]:
    rows = []
    for r in csv.DictReader(io.StringIO(text.lstrip("﻿"))):
        k = {nse._key(h): v for h, v in r.items() if h}
        close, prev = nse._num(k.get("clspric")), nse._num(k.get("prvsclsgpric"))
        symbol = (k.get("tckrsymb") or "").strip()
        if not symbol or not close or not prev:
            continue
        rows.append({
            "symbol": symbol,
            "name": (k.get("fininstrmnm") or symbol).strip(),
            "close": close,
            "prev_close": prev,
            "change_pct": round((close - prev) / prev * 100, 2),
            "volume": nse._num(k.get("ttltradgvol")),
        })
    return rows


def top_movers(rows: list[dict], n: int = 10, min_volume: float = 100_000) -> dict:
    liquid = [r for r in rows if (r["volume"] or 0) >= min_volume]
    s = sorted(liquid, key=lambda r: r["change_pct"])
    return {"gainers": s[::-1][:n], "losers": s[:n], "source": "BSE Bhavcopy"}


def latest(today: date | None = None, lookback_days: int = 7) -> dict:
    d = today or date.today()
    last = None
    for i in range(lookback_days + 1):
        day = d - timedelta(days=i)
        if day.weekday() >= 5:
            continue
        try:
            rows = parse_bhavcopy(http.get(URL.format(d=day.strftime("%Y%m%d")), attempts=1).decode("utf-8", "replace"))
            if rows:
                return {"date": day.isoformat(), **top_movers(rows)}
        except Exception as e:
            last = e
    raise RuntimeError(f"no BSE bhavcopy found in the last {lookback_days} days ({last})")
