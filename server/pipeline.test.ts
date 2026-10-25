import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unsupportedNumbers, validateReport } from './validate.js';
import { parseFeed, toHeadline, selectNotes, fetchHeadlines, tagItem, MAX_PER_PUBLISHER, type Headline, type Note } from './news.js';
import { SourceRegistry, tierOf } from './sources.js';
import type { ClaudeLike } from './synthesize.js';
import { generate, readJson } from '../scripts/generate-report.js';
import { CATALOG } from '../src/data/catalog.js';
import type { Snapshot } from '../src/types/report.js';

const NOW = Date.UTC(2026, 9, 20, 23, 15);
const URL_A = 'https://www.cnbc.com/story-a';
const URL_B = 'https://www.federalreserve.gov/b';

// ---------- number checking ----------
test('unsupportedNumbers accepts rounding and ignores years and small counts', () => {
  const ev = 'S&P 500: close 5912.40 on 2026-10-19; 1d -1.23%; RSI14 58.2; next day rose 58% of 212 times';
  assert.deepEqual(unsupportedNumbers('The index fell 1.2% to about 5,912 in 2026, a 3-day slide', ev), []);
  assert.deepEqual(unsupportedNumbers('It rose 58% of 212 times', ev), []);
  assert.deepEqual(unsupportedNumbers('It fell 4.7%', ev), ['4.7']);
  assert.deepEqual(unsupportedNumbers('Close was 5,990', ev), ['5,990']);
});

// ---------- feeds ----------
const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Nikkei slides 2% as yen jumps &amp; exporters sink]]></title><link>https://asia.nikkei.com/a1</link><pubDate>Tue, 20 Oct 2026 08:00:00 GMT</pubDate><description>&lt;p&gt;Tokyo shares fell.&lt;/p&gt;</description></item>
<item><title>No date here</title><link>https://www.cnbc.com/nodate</link></item>
<item><title>Blog post - Random Blog</title><link>https://news.google.com/rss/articles/xyz</link><pubDate>Tue, 20 Oct 2026 08:00:00 GMT</pubDate><source url="https://random-blog.example">Random Blog</source></item>
<item><title>Fed holds rates - Reuters</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Tue, 20 Oct 2026 09:00:00 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item>
</channel></rss>`;
const ATOM = `<feed><entry><title>ECB statement</title><link href="https://www.ecb.europa.eu/press/x"/><updated>2026-10-20T10:00:00Z</updated><summary>Rates unchanged</summary></entry></feed>`;

test('parseFeed handles RSS (CDATA, entities, html) and Atom', () => {
  const r = parseFeed(RSS);
  assert.equal(r.length, 4);
  assert.equal(r[0].title, 'Nikkei slides 2% as yen jumps & exporters sink');
  assert.equal(r[0].snippet, 'Tokyo shares fell.');
  assert.equal(parseFeed(ATOM)[0].url, 'https://www.ecb.europa.eu/press/x');
  assert.equal(parseFeed(ATOM)[0].snippet, 'Rates unchanged');
});

test('toHeadline drops undated and untrusted items and cleans aggregator titles', () => {
  const feed = { name: 'f', url: 'u' };
  const items = parseFeed(RSS).map((r) => toHeadline(r, feed));
  assert.equal(items[1], null); // no date
  assert.equal(items[2], null); // untrusted publisher
  assert.equal(items[3]!.title, 'Fed holds rates');
  assert.equal(items[3]!.publisher, 'Reuters');
  assert.equal(tierOf(items[3]!.tierUrl), 'press');
});

test('tagItem and selectNotes: dedupe, per-index coverage, ids', () => {
  const mk = (title: string, minsAgo: number, publisher = 'CNBC'): Headline => ({ title, snippet: '', url: `https://www.cnbc.com/${encodeURIComponent(title)}`, publisher, tierUrl: 'https://www.cnbc.com', published: NOW - minsAgo * 60000, feed: 'f' });
  assert.deepEqual(tagItem({ title: 'Nikkei and Hang Seng fall', snippet: '' }).sort(), ['hangseng', 'nikkei']);
  assert.deepEqual(tagItem({ title: 'Smith wins award', snippet: '' }), []);
  const many = Array.from({ length: 30 }, (_, i) => mk(`Wall Street story ${i}`, i));
  const hs = mk('Hang Seng drops on property worries', 600);
  const dup = mk('Wall Street story 1', 5, 'Mint');
  const notes = selectNotes([...many, hs, dup], 10, 2);
  assert.equal(notes.length, 10);
  assert.ok(notes.some((n) => /Hang Seng/.test(n.text)), 'older Hang Seng item kept for coverage');
  assert.equal(notes.filter((n) => /story 1 /.test(n.text + ' ')).length, 1, 'duplicate removed');
  assert.equal(notes[0].id, 'N1');
  assert.match(notes[0].text, /\(CNBC, 2026-10-20 \d\d:\d\d UTC\)/);
});

test('selectNotes keeps the source mix broad: one publisher cannot fill the list', () => {
  const mk = (title: string, minsAgo: number, publisher: string): Headline => ({ title, snippet: '', url: `https://www.cnbc.com/${publisher}/${encodeURIComponent(title)}`, publisher, tierUrl: 'https://www.cnbc.com', published: NOW - minsAgo * 60000, feed: 'f' });
  const cnbc = Array.from({ length: 40 }, (_, i) => mk(`CNBC item ${i}`, i, 'CNBC'));
  const others = ['Bloomberg', 'Financial Times', 'WSJ', 'Reuters'].flatMap((p) => Array.from({ length: 5 }, (_, i) => mk(`${p} item ${i}`, 100 + i, p)));
  const notes = selectNotes([...cnbc, ...others], 40);
  assert.ok(notes.filter((n) => /\(CNBC,/.test(n.text)).length <= MAX_PER_PUBLISHER);
  for (const p of ['Bloomberg', 'Financial Times', 'WSJ', 'Reuters']) assert.ok(notes.some((n) => n.text.includes(`(${p},`)), p);
});

test('fetchHeadlines tolerates failing feeds and old items', async () => {
  const feeds = [{ name: 'good', url: 'g' }, { name: 'bad', url: 'b' }, { name: 'empty', url: 'e' }];
  const f = async (u: string) => (u === 'g' ? { ok: true, status: 200, text: async () => ATOM.replace('2026-10-20', '2026-10-01') + '' } : u === 'b' ? { ok: false, status: 503, text: async () => '' } : { ok: true, status: 200, text: async () => '<rss></rss>' });
  const r = await fetchHeadlines(f as any, NOW, { feeds });
  assert.equal(r.ok, 1);
  assert.equal(r.failed.length, 2);
  assert.equal(r.items.length, 0); // 19 days old
});

// ---------- validation ----------
test('validateReport drops invented ids, invented numbers and uncited items', () => {
  const notes = new Map<string, Note>([
    ['N1', { id: 'N1', topic: 't', text: 'CNBC: the S&P 500 fell 1.23% on Monday as yields rose.', excerpts: [], urls: [URL_A] }],
    ['N2', { id: 'N2', topic: 't', text: 'The Fed said it would hold rates.', excerpts: [], urls: [URL_B] }],
    ['N3', { id: 'N3', topic: 't', text: 'Note pointing at a page never fetched', excerpts: [], urls: ['https://made-up.example/x'] }],
  ]);
  const registry = new SourceRegistry(new Map([[URL_A, { title: 'A', publisher: 'CNBC' }], [URL_B, { title: 'B' }]]));
  const marketText = new Map([['sp500', 'S&P 500: close 5912.40 on 2026-10-19; 1d -1.23%'], ['nikkei', 'Nikkei 225: close 39000.00; 1d -0.50%']]);
  const filler = (t: string) => ({ technical: `${t} technical text`, layman: `${t} plain text here` });
  const raw = {
    global: { title: 'g', status: { technical: 'The S&P 500 fell 1.23% on the day.', layman: 'US shares fell a little today.' }, consequence: filler('Conditional consequence'), impact: filler('Impact text'), outlook: filler('Outlook text'), notes: ['N1', 'N999', 'N3'], market: ['sp500', 'zzz'] },
    regions: [
      { title: 'bad number', status: { technical: 'The Nikkei fell 9.99% sharply.', layman: 'Japan dropped a lot today.' }, consequence: filler('c'), impact: filler('i'), outlook: filler('o'), notes: ['N1'], market: ['nikkei'] },
      { title: 'only-fake-page note', status: filler('Status'), consequence: filler('c'), impact: filler('i'), outlook: filler('o'), notes: ['N3'], market: ['sp500'] },
    ],
    indexNotes: [{ id: 'sp500', technical: 'Fell 1.23% on rising yields.', layman: 'Fell as yields rose.', notes: ['N1'] }, { id: 'dax', technical: 'Fell on tariffs here.', layman: 'Fell on tariffs here.', notes: ['N1'] }],
    events: [{ when: 'Oct 29', title: 'Fed', technical: 'The Fed said it would hold rates.', layman: 'The Fed plans no change.', notes: ['N2'] }],
  };
  const v = validateReport(raw, { notes, marketText, registry });
  assert.ok(v.report.global);
  assert.deepEqual(v.report.global!.quant, ['sp500']);
  assert.deepEqual(v.report.global!.sources, [1]);
  assert.equal(v.report.regions.length, 0);
  assert.equal(Object.keys(v.why).join(), 'sp500');
  assert.equal(v.report.events.length, 1);
  assert.ok(v.warnings.some((w) => /9\.99/.test(w)));
  assert.deepEqual(registry.list().map((s) => [s.url, s.publisher]), [[URL_A, 'CNBC'], [URL_B, 'www.federalreserve.gov'.replace('www.', '')]]);
});

test('source tiers', () => {
  assert.equal(tierOf('https://www.federalreserve.gov/x'), 'official');
  assert.equal(tierOf('https://www.reuters.com/x'), 'press');
  assert.equal(tierOf('https://www.screener.in/x'), 'data');
  assert.equal(tierOf('https://random.blog/x'), 'other');
});

// ---------- end to end with fakes ----------
function fakeYahoo(skip: string[] = []) {
  return async (url: string) => {
    const sym = decodeURIComponent(url.split('/chart/')[1].split('?')[0]);
    if (skip.includes(sym)) return { ok: false, status: 429, json: async () => ({}) };
    let seed = [...sym].reduce((a, c) => a + c.charCodeAt(0), 7);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
    const ts: number[] = [];
    const close: number[] = [];
    let p = 1000;
    const start = Date.UTC(2021, 0, 4) / 1000;
    for (let i = 0; i < 1300; i++) {
      ts.push(start + i * 86400);
      p *= 1 + rnd() / 40;
      close.push(p);
    }
    return { ok: true, status: 200, json: async () => ({ chart: { result: [{ timestamp: ts, meta: { gmtoffset: 0, currency: 'USD' }, indicators: { quote: [{ close }] } }] } }) };
  };
}

/** Every feed returns 3 unique, dated, trusted headlines; the first one is the "S&P 500 fell 1.23%" story. */
function fakeFeeds(opts: { down?: boolean; at?: number; salt?: string } = {}) {
  return async (url: string) => {
    if (opts.down) return { ok: false, status: 503, text: async () => '' };
    const tag = [...url].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100003, 7);
    const when = new Date((opts.at ?? NOW) - 3600_000).toUTCString();
    const items = [0, 1, 2]
      .map((i) => {
        const first = url.includes('cnbc.com/id/10000664') && i === 0;
        const title = first ? 'S&P 500 fell 1.23% as Treasury yields rose' : `Markets story ${tag}-${i}`;
        const hosts = ['cnbc.com', 'ft.com', 'wsj.com', 'bloomberg.com', 'bbc.com', 'livemint.com', 'scmp.com', 'dw.com'];
        const link = first ? URL_A : `https://www.${hosts[tag % hosts.length]}/story-${tag}-${i}${opts.salt ?? ''}`;
        return `<item><title>${title}</title><link>${link}</link><pubDate>${first ? new Date((opts.at ?? NOW) - 60_000).toUTCString() : when}</pubDate><description>Summary ${tag}-${i}</description></item>`;
      })
      .join('');
    return { ok: true, status: 200, text: async () => `<rss><channel>${items}</channel></rss>` };
  };
}

function fakeClaude(opts: { fail?: boolean; badReport?: boolean } = {}): ClaudeLike & { calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    messages: {
      async create(params: any) {
        calls.push(params);
        if (opts.fail) throw new Error('credit balance is too low');
        const N1 = (String(params.messages[0].content).match(/(N\d+) \[[^\]]*\] S&P 500 fell 1\.23%/) ?? [])[1] ?? 'N0';
        const two = (t: string, l: string) => ({ technical: t, layman: l });
        const good = {
          title: 'US stocks and yields',
          status: two('The S&P 500 fell 1.23% on the day as CNBC reported yields rose.', 'US shares dropped a bit because borrowing costs went up.'),
          consequence: two('If yields stay elevated, valuation pressure may persist.', 'If rates stay high, share prices can stay under pressure.'),
          impact: two('Rate-sensitive growth stocks are most exposed.', 'Tech-heavy investments feel it most.'),
          outlook: two('Base rates only: not a prediction for the next session.', 'This is just how often things went up before, not a promise.'),
          notes: [N1, 'N999'],
          market: ['sp500', 'nope'],
        };
        const report = {
          headline: { technical: 'US equities fell 1.23% as yields rose.', layman: 'US shares fell as borrowing costs rose.', notes: [N1], market: ['sp500'] },
          global: good,
          regions: [{ ...good, title: 'Invented number', status: two('The Nikkei fell 9.99% in a day.', 'Japan crashed.'), notes: [N1], market: ['nikkei'] }],
          drivers: [{ ...good, title: 'No real sources', notes: ['N404'], market: ['sp500'] }],
          indexNotes: [
            { id: 'sp500', technical: 'Fell 1.23% on rising yields.', layman: 'Fell as yields rose.', notes: [N1] },
            { id: 'dax', technical: 'Fell on tariffs.', layman: 'Fell on tariffs.', notes: ['N9999'] },
          ],
          events: [],
        };
        return { stop_reason: 'tool_use', usage: { input_tokens: 500, output_tokens: 300 }, content: [{ type: 'tool_use', id: 't1', name: 'submit_report', input: opts.badReport ? { global: null } : report }] };
      },
    },
  };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gmi-'));
const base = (over: any = {}) => ({ fetchFn: fakeYahoo() as any, textFetch: fakeFeeds({ at: (over.now ?? (() => NOW))(), salt: over.salt }) as any, claude: fakeClaude(), dataDir: tmp(), now: () => NOW, yahooDelayMs: 0, ...over });

test('generate: one Claude call, no tools besides the report form, validated output', async () => {
  const claude = fakeClaude();
  const deps = base({ claude });
  const snap = await generate(deps);
  assert.equal(claude.calls.length, 1);
  assert.deepEqual(claude.calls[0].tools.map((t: any) => t.name), ['submit_report']);
  assert.ok(!JSON.stringify(claude.calls[0]).includes('web_search'));
  assert.ok(snap.usage.headlines >= 20 && snap.usage.feedsOk > 20);
  assert.equal(snap.market.length, CATALOG.length);
  assert.ok(snap.market.every((m) => m.stats && m.episodes.length === 5));
  assert.ok(snap.report?.global);
  assert.equal(snap.report!.regions.length, 0);
  assert.equal(snap.market.find((m) => m.id === 'sp500')!.why!.sources.length, 1);
  assert.equal(snap.market.find((m) => m.id === 'dax')!.why, null);
  assert.equal(snap.sources.length, 1);
  assert.equal(snap.sources[0].url, URL_A);
  assert.deepEqual(readJson<Snapshot>(path.join(deps.dataDir, 'snapshot.json'))!.generatedAt, snap.generatedAt);
  assert.ok(!fs.existsSync(path.join(deps.dataDir, 'snapshot.json.tmp')));
  // the prompt really contains the evidence
  const prompt = claude.calls[0].messages[0].content as string;
  assert.match(prompt, /N1 \[/);
  assert.match(prompt, /Look-alike days/);
});

test('generate: unchanged inputs reuse the analysis without calling Claude', async () => {
  const dir = tmp();
  await generate(base({ dataDir: dir }));
  const claude = fakeClaude();
  const snap = await generate(base({ dataDir: dir, claude, now: () => NOW + 60_000 }));
  assert.equal(claude.calls.length, 0);
  assert.ok(snap.report?.global);
  assert.ok(snap.warnings.some((w) => /unchanged/.test(w)));
});

test('generate: quality gate refuses to publish when too many prices are missing and keeps old file', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'snapshot.json'), '{"keep":"me"}');
  const skip = CATALOG.filter((c) => c.kind === 'index').slice(0, 10).map((c) => c.symbol);
  await assert.rejects(generate(base({ dataDir: dir, fetchFn: fakeYahoo(skip) })), /Quality gate/);
  assert.equal(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8'), '{"keep":"me"}');
});

test('generate: feeds down -> Claude is not called (no cost), numbers still published', async () => {
  const claude = fakeClaude();
  const snap = await generate(base({ textFetch: fakeFeeds({ down: true }), claude }));
  assert.equal(claude.calls.length, 0);
  assert.equal(snap.report, null);
  assert.ok(snap.warnings.some((w) => /fresh headlines/.test(w)));
});

test('generate: if Claude fails, fresh numbers are published and the previous analysis is carried with a warning', async () => {
  const dir = tmp();
  await generate(base({ dataDir: dir, now: () => NOW - 86400_000 }));
  const snap = await generate(base({ dataDir: dir, claude: fakeClaude({ fail: true }), now: () => NOW, salt: 'b' }));
  assert.equal(snap.report!.generatedAt.slice(0, 10), '2026-10-19');
  assert.ok(snap.generatedAt.startsWith('2026-10-20'));
  assert.ok(snap.warnings.some((w) => /from 2026-10-19/.test(w)));
  assert.equal(snap.sources.length, 1);
  assert.ok(snap.market.find((m) => m.id === 'sp500')!.why);
});

test('generate: a report whose items all fail validation is not published as analysis', async () => {
  const snap = await generate(base({ claude: fakeClaude({ badReport: true }) }));
  assert.equal(snap.report, null);
});

test('generate: free mode (no Claude) publishes numbers, look-alikes and headlines at zero AI cost', async () => {
  const snap = await generate(base({ claude: null }));
  assert.equal(snap.report, null);
  assert.ok(snap.market.every((m) => m.stats));
  assert.ok(snap.headlines.length >= 20);
  assert.ok(snap.headlines.every((h) => /^https?:/.test(h.url) && h.publisher));
  assert.ok(snap.warnings.some((w) => /Free mode/.test(w)));
});
