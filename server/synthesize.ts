/**
 * Step 2: Claude turns the cited NOTES plus the code-computed MARKET DATA into the two-voice report.
 * No tools are enabled in this step, so it cannot add outside facts. Its output is untrusted and is
 * checked by validate.ts before anything is published.
 */
import type { Note } from './news.js';

export interface ClaudeLike {
  messages: { create(params: any): Promise<any> };
}

const text = (d: string, max: number) => ({ type: 'string', description: `${d} (max ${max} characters)` });
const ids = (d: string) => ({ type: 'array', items: { type: 'string' }, description: d });
const twoVoice = (d: string) => ({
  type: 'object',
  properties: { technical: text(`${d} - for a finance professional`, 420), layman: text(`${d} - for a smart non-expert, no jargon`, 320) },
  required: ['technical', 'layman'],
});
const insight = {
  type: 'object',
  properties: {
    title: text('Short title', 70),
    status: twoVoice('STATUS: what is happening now (facts only)'),
    consequence: twoVoice('CONSEQUENCE: what this leads to, stated conditionally and backed by the notes'),
    impact: twoVoice('IMPACT: who or what is affected (sectors, other markets, ordinary savers)'),
    outlook: twoVoice('OUTLOOK for next day and next week, using the historical base rates in MARKET DATA; say these are base rates, not predictions'),
    notes: ids('Note ids (like N12) that support the qualitative claims'),
    market: ids('Market item ids (like sp500, vix) whose numbers back the quantitative claims'),
  },
  required: ['title', 'status', 'consequence', 'impact', 'outlook', 'notes', 'market'],
};

export const REPORT_TOOL = {
  name: 'submit_report',
  description: 'Submit the finished markets report.',
  input_schema: {
    type: 'object',
    properties: {
      headline: {
        type: 'object',
        properties: { technical: text('One-sentence summary for professionals', 300), layman: text('One-sentence summary for everyone', 240), notes: ids('Note ids'), market: ids('Market ids') },
        required: ['technical', 'layman', 'notes', 'market'],
      },
      global: insight,
      regions: { type: 'array', items: insight, description: 'Up to 3: Americas, Europe, Asia-Pacific' },
      drivers: { type: 'array', items: insight, description: 'Up to 5 macro drivers (rates, dollar, oil, geopolitics, earnings ...) that the notes support' },
      companyEffects: {
        type: 'array',
        description: 'Companies that the notes say are moving one or more indices (earnings, guidance, big deals, regulatory news). Only what the notes state.',
        items: {
          type: 'object',
          properties: {
            company: text('Company name', 60),
            indices: ids('Index ids from MARKET DATA that the company affects'),
            direction: { type: 'string', enum: ['up', 'down', 'mixed'], description: 'Direction of its effect on those indices' },
            technical: text('What happened and how it feeds into the index, professionals', 300),
            layman: text('Same, in plain words', 260),
            notes: ids('Note ids'),
          },
          required: ['company', 'indices', 'direction', 'technical', 'layman', 'notes'],
        },
      },
      indexNotes: {
        type: 'array',
        description: 'One entry per index for which the notes give a reason for its latest move. Omit indices without a sourced reason.',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, technical: text('Why it moved', 260), layman: text('Why it moved, plain words', 220), notes: ids('Note ids') },
          required: ['id', 'technical', 'layman', 'notes'],
        },
      },
      events: {
        type: 'array',
        description: 'Scheduled events in the next 7 days that are mentioned in the notes',
        items: {
          type: 'object',
          properties: { when: text('Date as given in the note', 40), title: text('Event', 90), technical: text('Why it matters, professionals', 260), layman: text('Why it matters, plain words', 220), notes: ids('Note ids') },
          required: ['when', 'title', 'technical', 'layman', 'notes'],
        },
      },
    },
    required: ['headline', 'global', 'regions', 'drivers', 'indexNotes', 'events', 'companyEffects'],
  },
};

const SYSTEM = `You write a markets dashboard for two audiences at once: finance professionals ("technical") and ordinary people ("layman").
You receive (A) NOTES: headlines and summaries collected from news and official feeds, each with an id like N12 and its publisher and time, and (B) MARKET DATA: numbers computed from price history, each with an id like sp500.
Strict rules:
1. Use ONLY information in A and B. No outside knowledge. If the notes do not explain something, leave that item out; never guess a reason.
2. Do not calculate anything. Quote numbers exactly as they appear in A or B (same value, same unit). Any number you write that is not in the cited notes or market data will cause the item to be deleted.
2b. A headline is a claim by its publisher: attribute it ("Reuters reported ..."), and treat several publishers saying the same thing as stronger than one.
3. Every item must list the note ids and market ids it relies on. Cite a note only if it really supports the claim.
4. Keep observation and interpretation apart. STATUS = facts now. CONSEQUENCE and OUTLOOK are conditional ("if ... then ...", "historically ...") and must rest on notes or on the "History after ..." and "Look-alike days" base rates. Never promise a direction; say base rates are not predictions.
5. When a note attributes a forecast or opinion to someone, attribute it the same way.
6. Technical voice: precise, uses terms like basis points, RSI, volatility percentile. Layman voice: short sentences, no jargon, explain any term you must use, an everyday analogy is welcome.
7. IMPACT should say who is affected and how, as supported by the notes. Say plainly when evidence is thin.
8. MARKET DATA also contains official macro statistics (ids starting macro:, e.g. inflation, policy rates, unemployment) and the day's moves of each index's largest companies (ids starting hw:, a hand-kept list without weights). Use macro:* ids to ground statements about the economy and rates; use hw:* ids when the notes name a company. Never state a company's weight or contribution to an index, because those figures are not provided.
9. Index ids for indexNotes must be exactly the ids in MARKET DATA.
Call submit_report exactly once.`;

export function buildSynthesisPrompt(notes: Note[], marketLines: string[], today: string): string {
  const n = notes.map((x) => `${x.id} [${x.topic}] ${x.text}${x.excerpts.length ? `  (source excerpt: "${x.excerpts[0]}")` : ''}`).join('\n');
  return `Today is ${today}.\n\n(A) NOTES\n${n}\n\n(B) MARKET DATA (computed from daily closes; "History after ..." and "Look-alike days" lines are historical base rates)\n${marketLines.join('\n')}\n\nWrite the report now.`;
}

export interface SynthesisResult {
  raw: any;
  inputTokens: number;
  outputTokens: number;
}

export async function runSynthesis(
  client: ClaudeLike,
  opts: { model: string; notes: Note[]; marketLines: string[]; today: string; maxTokens?: number }
): Promise<SynthesisResult> {
  const resp = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 20000,
    system: SYSTEM,
    tools: [REPORT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_report' },
    messages: [{ role: 'user', content: buildSynthesisPrompt(opts.notes, opts.marketLines, opts.today) }],
  });
  if (resp.stop_reason === 'max_tokens') throw new Error('The report was cut off (max tokens). Previous data kept.');
  const call = (resp.content ?? []).find((b: any) => b.type === 'tool_use' && b.name === 'submit_report');
  if (!call) throw new Error('Claude did not return a report.');
  return { raw: call.input, inputTokens: resp.usage?.input_tokens ?? 0, outputTokens: resp.usage?.output_tokens ?? 0 };
}
