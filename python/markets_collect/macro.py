"""Macro indicators from official, free statistical sources.

  FRED (St. Louis Fed)  US rates, inflation, jobs, growth, credit spreads. Needs a FREE key: FRED_API_KEY.
  ECB Data Portal       euro-area policy rates and inflation. No key.
  World Bank API        yearly GDP growth, inflation, unemployment for major economies. No key (annual, lagged).

Every item keeps its source name, link and observation date. Nothing is estimated.
"""
from __future__ import annotations

import json
import os
from urllib.parse import quote

from . import http

FRED_SERIES = [
    # id, label, unit, transform
    ("FEDFUNDS", "US federal funds rate (effective)", "%", "level"),
    ("CPIAUCSL", "US consumer price inflation (YoY)", "%", "yoy12"),
    ("UNRATE", "US unemployment rate", "%", "level"),
    ("PAYEMS", "US nonfarm payrolls, monthly change", "thousand jobs", "diff"),
    ("GDPC1", "US real GDP growth (YoY)", "%", "yoy4"),
    ("INDPRO", "US industrial production (YoY)", "%", "yoy12"),
    ("T10Y2Y", "US 10-year minus 2-year Treasury yield", "pct points", "level"),
    ("BAMLH0A0HYM2", "US high-yield credit spread", "%", "level"),
    ("UMCSENT", "US consumer sentiment (Michigan)", "index", "level"),
]
ECB_SERIES = [
    ("FM", "B.U2.EUR.4F.KR.MRR_FR.LEV", "ecb_refi", "ECB main refinancing rate", "%"),
    ("FM", "B.U2.EUR.4F.KR.DFR.LEV", "ecb_deposit", "ECB deposit facility rate", "%"),
    ("ICP", "M.U2.N.000000.4.ANR", "ea_hicp", "Euro area inflation (HICP, YoY)", "%"),
]
WB_COUNTRIES = {"USA": "United States", "CHN": "China", "JPN": "Japan", "DEU": "Germany", "GBR": "United Kingdom", "FRA": "France",
                "IND": "India", "BRA": "Brazil", "KOR": "South Korea", "AUS": "Australia", "CAN": "Canada", "MEX": "Mexico"}
WB_INDICATORS = [("NY.GDP.MKTP.KD.ZG", "gdp", "real GDP growth"), ("FP.CPI.TOTL.ZG", "cpi", "inflation"), ("SL.UEM.TOTL.ZS", "unemp", "unemployment")]


def _round(v, d=2):
    return None if v is None else round(v, d)


def fred_item(series_id: str, label: str, unit: str, transform: str, payload: dict) -> dict | None:
    obs = [(o["date"], float(o["value"])) for o in payload.get("observations", []) if o.get("value") not in (None, ".", "")]
    obs.sort()  # oldest -> newest
    if not obs:
        return None

    def value_at(end: int):
        """Value of the transformed series using observations up to index `end` (inclusive)."""
        if transform == "level":
            return obs[end][1]
        if transform == "diff":
            return obs[end][1] - obs[end - 1][1] if end >= 1 else None
        lag = 12 if transform == "yoy12" else 4
        return (obs[end][1] / obs[end - lag][1] - 1) * 100 if end >= lag else None

    last = len(obs) - 1
    v = value_at(last)
    if v is None:
        return None
    prev = value_at(last - 1) if last >= 1 else None
    return {
        "id": f"macro:{series_id.lower()}", "name": label, "region": "United States", "value": _round(v), "unit": unit, "date": obs[last][0],
        "previous": _round(prev), "previous_date": obs[last - 1][0] if last >= 1 and prev is not None else None,
        "source": "FRED, Federal Reserve Bank of St. Louis", "url": f"https://fred.stlouisfed.org/series/{series_id}",
    }


def fetch_fred(api_key: str) -> list[dict]:
    items = []
    for sid, label, unit, tf in FRED_SERIES:
        limit = 16 if tf != "level" else 3
        url = f"https://api.stlouisfed.org/fred/series/observations?series_id={sid}&api_key={quote(api_key)}&file_type=json&sort_order=desc&limit={limit}"
        try:
            it = fred_item(sid, label, unit, tf, json.loads(http.get(url, check_robots=False)))
            if it:
                items.append(it)
        except Exception as e:
            print(f"WARNING FRED {sid}: {str(e).replace(api_key, '***')}")
    return items


def ecb_item(item_id: str, label: str, unit: str, flow: str, key: str, payload: dict) -> dict | None:
    series = payload["dataSets"][0]["series"]
    s = next(iter(series.values()))
    periods = payload["structure"]["dimensions"]["observation"][0]["values"]
    obs = sorted((int(i), v[0]) for i, v in s["observations"].items() if v and v[0] is not None)
    if not obs:
        return None
    i, v = obs[-1]
    prev = obs[-2] if len(obs) > 1 else None
    return {
        "id": f"macro:{item_id}", "name": label, "region": "Euro area", "value": _round(v), "unit": unit, "date": periods[i]["id"],
        "previous": _round(prev[1]) if prev else None, "previous_date": periods[prev[0]]["id"] if prev else None,
        "source": "ECB Data Portal", "url": f"https://data.ecb.europa.eu/data/datasets/{flow}/{flow}.{key}",
    }


def fetch_ecb() -> list[dict]:
    items = []
    for flow, key, item_id, label, unit in ECB_SERIES:
        url = f"https://data-api.ecb.europa.eu/service/data/{flow}/{key}?lastNObservations=2&format=jsondata"
        try:
            it = ecb_item(item_id, label, unit, flow, key, json.loads(http.get(url, check_robots=False)))
            if it:
                items.append(it)
        except Exception as e:
            print(f"WARNING ECB {item_id}: {e}")
    return items


def worldbank_items(indicator: str, short: str, noun: str, payload: list) -> list[dict]:
    rows = payload[1] if isinstance(payload, list) and len(payload) > 1 and payload[1] else []
    out = []
    for r in rows:
        iso = r.get("countryiso3code")
        if iso not in WB_COUNTRIES or r.get("value") is None:
            continue
        out.append({
            "id": f"macro:wb_{iso.lower()}_{short}", "name": f"{WB_COUNTRIES[iso]} {noun} (annual)", "region": WB_COUNTRIES[iso],
            "value": _round(float(r["value"])), "unit": "%", "date": str(r.get("date")), "previous": None, "previous_date": None,
            "source": "World Bank", "url": f"https://data.worldbank.org/indicator/{indicator}?locations={iso[:2]}",
        })
    return out


def fetch_worldbank() -> list[dict]:
    items = []
    countries = ";".join(WB_COUNTRIES)
    for ind, short, noun in WB_INDICATORS:
        url = f"https://api.worldbank.org/v2/country/{countries}/indicator/{ind}?format=json&mrnev=1&per_page=200"
        try:
            items += worldbank_items(ind, short, noun, json.loads(http.get(url, check_robots=False)))
        except Exception as e:
            print(f"WARNING World Bank {ind}: {e}")
    return items


def collect() -> list[dict]:
    items: list[dict] = []
    key = os.environ.get("FRED_API_KEY", "").strip()
    if key:
        items += fetch_fred(key)
    else:
        print("NOTE FRED_API_KEY not set: US macro series skipped (free key at fred.stlouisfed.org)")
    items += fetch_ecb()
    items += fetch_worldbank()
    if not items:
        raise RuntimeError("no macro indicator could be fetched")
    return items
