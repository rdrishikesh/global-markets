"""Daily closes from Yahoo Finance's public chart endpoint (unofficial; personal use)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from . import http


def parse_chart(payload: dict, symbol: str) -> list[dict]:
    result = (payload.get("chart") or {}).get("result")
    if not result:
        raise ValueError((payload.get("chart") or {}).get("error") or f"no data for {symbol}")
    r = result[0]
    offset = (r.get("meta") or {}).get("gmtoffset", 0)
    closes = r["indicators"]["quote"][0]["close"]
    bars: list[dict] = []
    for ts, c in zip(r.get("timestamp", []), closes):
        if c is None or c <= 0:
            continue
        day = (datetime.fromtimestamp(ts + offset, tz=timezone.utc)).strftime("%Y-%m-%d")
        if bars and bars[-1]["date"] == day:
            bars[-1]["close"] = c
        else:
            bars.append({"date": day, "close": c})
    return bars


def daily_closes(symbol: str, years: int = 5) -> list[dict]:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol)}?range={years}y&interval=1d"
    return parse_chart(json.loads(http.get(url, check_robots=False)), symbol)
