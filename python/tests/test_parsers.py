import json
import os
import sys
import tempfile
import unittest
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from markets_collect import bse, feeds, http, macro, nse, screener_import, yahoo  # noqa: E402

RSS = b"""\xef\xbb\xbf<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Nifty ends higher &amp; Sensex gains]]></title><link>https://www.investing.com/n1</link>
<pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate><description>&lt;p&gt;Indian shares rose.&lt;/p&gt;</description></item>
<item><title>Undated item</title><link>https://www.investing.com/n2</link></item></channel></rss>"""

NSE_CSV = """Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%),Volume,Turnover (Rs. Cr.),P/E,P/B,Div Yield
Nifty 50,23-10-2026,"24,000.10","24,200.00","23,900.00","24,150.55",150.45,0.63,250000000,"30,000.00",22.4,3.5,1.3
Broken Row,23-10-2026,,,,,,,,,,,
"""

BSE_CSV = """TradDt,TckrSymb,FinInstrmNm,ClsPric,PrvsClsgPric,TtlTradgVol
2026-10-23,AAA,AAA LTD,110,100,500000
2026-10-23,BBB,BBB LTD,90,100,400000
2026-10-23,CCC,CCC LTD,200,100,10
"""


class Parsers(unittest.TestCase):
    def test_feed_parsing_drops_undated_and_cleans_text(self):
        items = feeds.parse_feed(RSS, "Investing.com")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "Nifty ends higher & Sensex gains")
        self.assertEqual(items[0]["summary"], "Indian shares rose.")

    def test_nse_index_file(self):
        rows = nse.parse_index_close(NSE_CSV)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["close"], 24150.55)
        self.assertEqual((rows[0]["pe"], rows[0]["pb"], rows[0]["div_yield"]), (22.4, 3.5, 1.3))

    def test_bse_movers_ignore_illiquid(self):
        movers = bse.top_movers(bse.parse_bhavcopy(BSE_CSV), n=1)
        self.assertEqual(movers["gainers"][0]["symbol"], "AAA")
        self.assertEqual(movers["losers"][0]["symbol"], "BBB")

    def test_yahoo_chart(self):
        payload = {"chart": {"result": [{"timestamp": [1700000000, 1700086400, 1700172800], "meta": {"gmtoffset": 19800},
                   "indicators": {"quote": [{"close": [100.0, None, 102.5]}]}}]}}
        bars = yahoo.parse_chart(payload, "^NSEI")
        self.assertEqual([b["close"] for b in bars], [100.0, 102.5])
        with self.assertRaises(ValueError):
            yahoo.parse_chart({"chart": {"result": None, "error": "Not Found"}}, "X")

    def test_screener_import_reads_local_export_only(self):
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("Name,CMP Rs.,P/E\nTCS,\"3,900.5\",30.1\n")
        rows = screener_import.load_export(f.name)
        os.unlink(f.name)
        self.assertEqual(rows[0]["CMP Rs."], 3900.5)


class Macro(unittest.TestCase):
    def test_fred_yoy_and_missing_values(self):
        # 14 monthly index values: 100 ... then a "." that must be ignored
        vals = [100 + i for i in range(14)]
        obs = [{"date": f"2025-{m:02d}-01", "value": str(v)} for m, v in zip(range(1, 13), vals[:12])]
        obs += [{"date": "2026-01-01", "value": str(vals[12])}, {"date": "2026-02-01", "value": str(vals[13])}, {"date": "2026-03-01", "value": "."}]
        obs.reverse()  # API returns newest first when sort_order=desc
        it = macro.fred_item("CPIAUCSL", "US CPI YoY", "%", "yoy12", {"observations": obs})
        self.assertEqual(it["date"], "2026-02-01")
        self.assertEqual(it["value"], round((113 / 101 - 1) * 100, 2))  # 13th obs vs 1st... index 13 vs index 1
        self.assertEqual(it["previous_date"], "2026-01-01")
        self.assertTrue(it["url"].endswith("CPIAUCSL"))

    def test_fred_payroll_change_and_level(self):
        payload = {"observations": [{"date": "2026-02-01", "value": "159500"}, {"date": "2026-01-01", "value": "159300"}]}
        self.assertEqual(macro.fred_item("PAYEMS", "x", "k", "diff", payload)["value"], 200.0)
        self.assertEqual(macro.fred_item("UNRATE", "x", "%", "level", {"observations": [{"date": "2026-02-01", "value": "4.1"}]})["value"], 4.1)
        self.assertIsNone(macro.fred_item("UNRATE", "x", "%", "level", {"observations": [{"date": "2026-02-01", "value": "."}]}))

    def test_ecb_sdmx_json(self):
        payload = {"dataSets": [{"series": {"0:0:0:0:0:0:0": {"observations": {"0": [2.15], "1": [2.0]}}}}],
                   "structure": {"dimensions": {"observation": [{"values": [{"id": "2026-08"}, {"id": "2026-09"}]}]}}}
        it = macro.ecb_item("ea_hicp", "Euro area inflation", "%", "ICP", "M.U2.N.000000.4.ANR", payload)
        self.assertEqual((it["value"], it["date"], it["previous"], it["previous_date"]), (2.0, "2026-09", 2.15, "2026-08"))

    def test_worldbank_most_recent_value(self):
        payload = [{"page": 1}, [
            {"countryiso3code": "IND", "date": "2024", "value": 6.5},
            {"countryiso3code": "XXX", "date": "2024", "value": 1.0},
            {"countryiso3code": "CHN", "date": "2024", "value": None},
        ]]
        items = macro.worldbank_items("NY.GDP.MKTP.KD.ZG", "gdp", "real GDP growth", payload)
        self.assertEqual(len(items), 1)
        self.assertEqual((items[0]["id"], items[0]["value"], items[0]["date"]), ("macro:wb_ind_gdp", 6.5, "2024"))


class Http(unittest.TestCase):
    def setUp(self):
        http._robots.clear()
        http.MIN_GAP_SECONDS = 0

    def test_robots_disallow_is_respected(self):
        class R:
            def __init__(self, b): self.b = b
            def read(self): return self.b
            def __enter__(self): return self
            def __exit__(self, *a): return False
        def opener(req, timeout=0):
            url = req.full_url if hasattr(req, "full_url") else req
            if url.endswith("robots.txt"):
                return R(b"User-agent: *\nDisallow: /private")
            return R(b"ok")
        self.assertEqual(http.get("https://example.com/public", opener=opener), b"ok")
        with self.assertRaises(http.Blocked):
            http.get("https://example.com/private/x", opener=opener)

    def test_404_is_not_retried(self):
        calls = []
        def opener(req, timeout=0):
            calls.append(1)
            raise urllib.error.HTTPError("u", 404, "nf", {}, None)
        with self.assertRaises(RuntimeError):
            http.get("https://example.com/x", opener=opener, check_robots=False)
        self.assertEqual(len(calls), 1)



class BriefTests(unittest.TestCase):
    def test_brief_lists_macro_and_movers(self):
        from markets_collect import brief
        snap = {
            "generatedAt": "2026-10-26T00:00:00Z",
            "market": [{"id": "sp500", "name": "S&P 500", "kind": "index", "region": "Americas",
                        "stats": {"last": 5000.0, "change1d": 1.2, "asOf": "2026-10-23"}}],
            "macro": [{"id": "macro:cpi", "name": "CPI", "region": "US", "value": 3.1, "unit": "%", "date": "2026-09",
                       "previous": 3.0, "previous_date": "2026-08", "source": "FRED", "url": "https://fred.stlouisfed.org"}],
            "heavyweights": [{"name": "Apple", "indices": ["sp500"], "change1d": -2.5, "change5d": None}],
            "headlines": [], "warnings": [],
        }
        text = brief.build(snap)
        self.assertIn("S&P 500", text)
        self.assertIn("CPI (US): 3.1 %", text)
        self.assertIn("Apple", text)
        self.assertIn("5d n/a", text)


if __name__ == "__main__":
    unittest.main()
