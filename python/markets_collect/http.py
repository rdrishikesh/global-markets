"""One shared, polite HTTP helper: identifies itself, honours robots.txt, spaces requests, retries."""
from __future__ import annotations

import time
import urllib.error
import urllib.request
import urllib.robotparser
from urllib.parse import urlparse

USER_AGENT = "Mozilla/5.0 (compatible; global-markets-intelligence personal-use; contact: owner)"
MIN_GAP_SECONDS = 1.0

_last_request = 0.0
_robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}


class Blocked(Exception):
    """The site's robots.txt asks automated clients not to fetch this URL."""


def robots_allows(url: str, opener=urllib.request.urlopen) -> bool:
    p = urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": USER_AGENT})
            with opener(req, timeout=10) as r:
                rp.parse(r.read().decode("utf-8", "replace").splitlines())
            _robots[base] = rp
        except Exception:
            _robots[base] = None  # robots.txt unreachable: proceed, but still rate-limited
    rp = _robots[base]
    return True if rp is None else rp.can_fetch(USER_AGENT, url)


def get(url: str, *, attempts: int = 3, timeout: int = 20, check_robots: bool = True, opener=urllib.request.urlopen) -> bytes:
    global _last_request
    if check_robots and not robots_allows(url, opener):
        raise Blocked(f"robots.txt disallows {url}")
    last: Exception | None = None
    for i in range(1, attempts + 1):
        wait = MIN_GAP_SECONDS - (time.time() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            with opener(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (401, 403, 404):  # will not get better by retrying
                break
        except Exception as e:  # network hiccup
            last = e
        time.sleep(2 * i)
    raise RuntimeError(f"{url}: {last}")
