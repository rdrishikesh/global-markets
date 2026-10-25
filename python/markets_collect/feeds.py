"""News from RSS/Atom feeds (Yahoo Finance, Investing.com, Nasdaq ...)."""
from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from . import http

FEEDS = {
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
    "Investing.com": "https://www.investing.com/rss/news.rss",
    "Nasdaq markets": "https://www.nasdaq.com/feed/rssoutbound?category=Markets",
    "Nasdaq stocks": "https://www.nasdaq.com/feed/rssoutbound?category=Stocks",
}


def _text(el, *names):
    for n in names:
        for child in el:
            if child.tag.split("}")[-1] == n and (child.text or "").strip():
                return child.text.strip()
    return ""


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", html.unescape(html.unescape(s)))).strip()


def _when(s: str):
    if not s:
        return None
    try:
        d = parsedate_to_datetime(s)
    except Exception:
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def parse_feed(xml_bytes: bytes, publisher: str) -> list[dict]:
    root = ET.fromstring(xml_bytes.lstrip(b"\xef\xbb\xbf"))
    items = []
    for el in root.iter():
        if el.tag.split("}")[-1] not in ("item", "entry"):
            continue
        link = _text(el, "link")
        if not link:
            for child in el:
                if child.tag.split("}")[-1] == "link" and child.get("href"):
                    link = child.get("href")
        when = _when(_text(el, "pubDate", "published", "updated", "date"))
        title = _clean(_text(el, "title"))
        if not title or not link.startswith("http") or when is None:
            continue  # undated items cannot be checked for freshness
        items.append({
            "title": title,
            "summary": _clean(_text(el, "description", "summary"))[:300],
            "url": link,
            "publisher": publisher,
            "published": when.astimezone(timezone.utc).isoformat(),
        })
    return items


def collect(feeds: dict[str, str] | None = None, max_age_hours: int = 72) -> tuple[list[dict], list[str]]:
    items, problems = [], []
    now = datetime.now(timezone.utc)
    for name, url in (feeds or FEEDS).items():
        try:
            for it in parse_feed(http.get(url), name):
                age = (now - datetime.fromisoformat(it["published"])).total_seconds() / 3600
                if -1 <= age <= max_age_hours:
                    items.append(it)
        except Exception as e:
            problems.append(f"{name}: {e}")
    items.sort(key=lambda i: i["published"], reverse=True)
    return items, problems
