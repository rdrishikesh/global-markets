"""Screener.in: import a file YOU exported from your own logged-in Screener account.

Screener has no public API and its terms do not allow automated scraping, so this module never contacts
the site. Export a screen or watchlist to CSV in the browser, then pass the file here.
"""
from __future__ import annotations

import csv


def load_export(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    out = []
    for r in rows:
        clean = {}
        for k, v in r.items():
            if k is None:
                continue
            v = (v or "").strip()
            try:
                clean[k.strip()] = float(v.replace(",", ""))
            except ValueError:
                clean[k.strip()] = v
        out.append(clean)
    return out
