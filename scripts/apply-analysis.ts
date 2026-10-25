/**
 * Used by the scheduled Claude task (no API key needed).
 *
 *   npx tsx scripts/apply-analysis.ts claude-project/evidence.json analysis.json [public/data]
 *
 * analysis.json is the report Claude wrote (the shape in evidence.json -> reportSchema). Nothing Claude wrote is
 * trusted: the same validation as the paid path runs here, and only items that pass are merged into snapshot.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SourceRegistry, type Retrieved } from '../server/sources.js';
import { validateReport } from '../server/validate.js';
import type { Note } from '../server/news.js';
import type { Snapshot } from '../src/types/report.js';
import { readJson, writeJsonAtomic } from './generate-report.js';

export interface Evidence {
  schemaVersion: number;
  snapshotGeneratedAt: string;
  inputHash: string;
  today: string;
  notes: Note[];
  marketLines: string[];
  retrieved: Array<[string, Retrieved]>;
}

export const MODEL_LABEL = 'Claude (scheduled task)';

export function applyAnalysis(evidencePath: string, analysisPath: string, dataDir: string, now = Date.now()): { kept: number; warnings: string[] } {
  const ev = readJson<Evidence>(evidencePath);
  const raw = readJson<any>(analysisPath);
  const file = path.join(dataDir, 'snapshot.json');
  const snap = readJson<Snapshot>(file);
  if (!ev || !raw || !snap) throw new Error('Missing evidence, analysis or snapshot file.');
  if (ev.snapshotGeneratedAt !== snap.generatedAt) throw new Error('The evidence belongs to a different data refresh than the current snapshot. Nothing changed.');

  const marketText = new Map<string, string>();
  for (const line of ev.marketLines) {
    const i = line.indexOf(' | ');
    if (i > 0) marketText.set(line.slice(0, i), line.slice(i + 3));
  }
  const registry = new SourceRegistry(new Map(ev.retrieved));
  const v = validateReport(raw, { notes: new Map(ev.notes.map((n) => [n.id, n])), marketText, registry });
  if (!v.report.global && v.report.regions.length === 0 && v.report.drivers.length === 0) {
    throw new Error(`Every analysis item failed source validation. ${v.warnings.slice(0, 5).join(' | ')}`);
  }

  snap.report = { generatedAt: new Date(now).toISOString(), ...v.report };
  snap.sources = registry.list();
  for (const m of snap.market) m.why = v.why[m.id] ?? null;
  snap.inputHash = ev.inputHash;
  snap.models = { synthesis: MODEL_LABEL };
  snap.warnings = [
    ...snap.warnings.filter((w) => !/^(Free mode|The written analysis|Today's analysis)/.test(w)),
    ...v.warnings,
  ];
  writeJsonAtomic(file, snap);
  return { kept: (v.report.global ? 1 : 0) + v.report.regions.length + v.report.drivers.length + v.report.events.length + v.report.companyEffects.length, warnings: v.warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [ev, an, dir] = process.argv.slice(2);
  try {
    const r = applyAnalysis(ev, an, dir ?? 'public/data');
    console.log(`Analysis merged: ${r.kept} items kept, ${r.warnings.length} dropped or flagged.`);
    for (const w of r.warnings) console.log(`- ${w}`);
  } catch (e) {
    console.error(`FAILED: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
