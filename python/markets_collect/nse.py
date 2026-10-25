"""NSE India: the end-of-day index file that NSE publishes for download.

The file also carries P/E, P/B and dividend yield per index, which free news feeds do not.
The live NSE website API is deliberately not used: it needs browser cookies and NSE's terms restrict it.
"""
from __future__ import annotations

import csv
import io
from datetime import date, timedelta

from . import http

URL = "https://nsearchives.nseindia.com/content/indices/ind_close_all_{d}.csv"


def _num(s):
    s = (s or "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def _key(h: str) -> str:
    return "".join(ch for ch in h.lower() if ch.isalnum())


def parse_index_close(text: str) -> list[dict]:
    rows = []
    for r in csv.DictReader(io.StringIO(text.lstrip("﻿"))):
        k = {_key(h): v for h, v in r.items() if h}
        name = (k.get("indexname") or "").strip()
        close = _num(k.get("closingindexvalue"))
        if not name or close is None:
            continue
        rows.append({
            "index": name,
            "date": (k.get("indexdate") or "").strip(),
            "close": close,
            "change_pct": _num(k.get("changepercent") or k.get("change")),
            "pe": _num(k.get("pe")),
            "pb": _num(k.get("pb")),
            "div_yield": _num(k.get("divyield")),
            "source": "NSE India end-of-day index file",
        })
    return rows


def latest(today: date | None = None, lookback_days: int = 7) -> list[dict]:
    """Walks back from today to find the most recent trading day's file."""
    d = today or date.today()
    last = None
    for i in range(lookback_days + 1):
        day = d - timedelta(days=i)
        if day.weekday() >= 5:
            continue
        url = URL.format(d=day.strftime("%d%m%Y"))
        try:
            rows = parse_index_close(http.get(url, attempts=1).decode("utf-8", "replace"))
            if rows:
                return rows
        except Exception as e:
            last = e
    raise RuntimeError(f"no NSE index file found in the last {lookback_days} days ({last})")
