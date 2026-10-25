"""Turns public/data/snapshot.json (+ extra.json) into one markdown file for a Claude Project.

python -m markets_collect.brief --snapshot ../public/data/snapshot.json --extra ../public/data/extra.json --out ../claude-project/market-brief.md

Nothing is invented here: every line is copied from the snapshot that the pipeline already built.
"""
from __future__ import annotations

import argparse
import json
import os


def _load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _pct(v):
    return "n/a" if v is None else f"{v:+.2f}%"


def build(snap: dict, extra: dict | None = None) -> str:
    out = [f"# Market brief (generated {snap.get('generatedAt', 'unknown')})", "",
           "Prices are Yahoo Finance daily closes; macro figures are official releases. Statistics are computed by code. Base rates describe the past and are not predictions.", ""]
    market = snap.get("market", [])
    out += ["## Indices", "", "| Index | Region | Last | 1d | 5d | 1m | YTD | vs 200d avg | RSI14 | Drawdown |", "|---|---|---|---|---|---|---|---|---|---|"]
    for m in market:
        s = m.get("stats")
        if m.get("kind") == "index" and s:
            out.append(f"| {m['name']} | {m.get('region', '')} | {s['last']:.2f} | {_pct(s['change1d'])} | {_pct(s.get('change5d'))} | {_pct(s.get('change1m'))} | {_pct(s.get('changeYtd'))} | {_pct(s.get('pctVsSma200'))} | {s.get('rsi14') if s.get('rsi14') is not None else 'n/a'} | {_pct(s.get('drawdown'))} |")
    out += ["", "## Factors (rates, dollar, oil, gold, volatility, FX, Bitcoin)", ""]
    for m in market:
        s = m.get("stats")
        if m.get("kind") == "factor" and s:
            out.append(f"- {m['name']}: {s['last']:.2f} (1d {_pct(s['change1d'])}, 1m {_pct(s.get('change1m'))}) as of {s['asOf']}")
    macro = snap.get("macro") or (extra or {}).get("macro") or []
    if macro:
        out += ["", "## Macro indicators (official sources)", ""]
        for x in macro:
            prev = f"; previous {x['previous']} ({x.get('previous_date')})" if x.get("previous") is not None else ""
            out.append(f"- {x['name']} ({x['region']}): {x['value']} {x['unit']} for {x['date']}{prev}. Source: {x['source']} {x['url']}")
    hw = sorted(snap.get("heavyweights") or [], key=lambda r: -abs(r["change1d"]))
    if hw:
        out += ["", "## Largest companies in the indices (hand-kept list, no weights), biggest movers first", ""]
        for r in hw[:25]:
            out.append(f"- {r['name']} ({', '.join(r['indices'])}): 1d {_pct(r['change1d'])}, 5d {_pct(r.get('change5d'))}")
    report = snap.get("report")
    if report:
        out += ["", "## Written analysis already produced (each item was checked against its sources)", ""]
        if report.get("headline"):
            out.append(f"**Headline:** {report['headline']['technical']}")
        for c in report.get("companyEffects", []):
            out.append(f"- Company effect, {c['company']} ({c['direction']} on {', '.join(c['indices'])}): {c['technical']}")
    out += ["", "## Headlines collected today", ""]
    for h in (snap.get("headlines") or [])[:60]:
        out.append(f"- {h.get('title', '')} ({h.get('publisher', '')}, {h.get('published', h.get('date', ''))}) {h.get('url', '')}")
    problems = [w for w in snap.get("warnings", [])]
    if problems:
        out += ["", "## Data warnings", ""] + [f"- {w}" for w in problems]
    out += ["", "## How to use this file", "",
            "Ask Claude to summarise what changed, which macro releases matter, and which companies are moving which indices. Use only figures in this file and say when it does not cover something."]
    return "\n".join(out) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", default="public/data/snapshot.json")
    ap.add_argument("--extra", default="public/data/extra.json")
    ap.add_argument("--out", default="claude-project/market-brief.md")
    a = ap.parse_args(argv)
    snap = _load(a.snapshot)
    if not snap:
        print("No snapshot found; nothing written.")
        return 1
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(build(snap, _load(a.extra)))
    print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
