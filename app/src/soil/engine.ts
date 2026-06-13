import type { Answer, LlmClient, Lang, SoilReport } from './types';
import { retrieve } from './retriever';
import { route } from './router';
import { composeExplain, composeAnswer } from './prompt';

export type EngineOpts = { llm: LlmClient; lang: Lang };

/** Canonical params present in a report, used to seed retrieval. */
function reportParams(report: SoilReport): string[] {
  const out = new Set<string>();
  for (const s of report.samples) {
    if (s.pH != null) out.add('pH');
    if (s.cec != null) out.add('cec');
    if (s.baseSatPct != null) out.add('baseSat');
    if (s.recommendations?.limeTonsAcre != null) out.add('lime');
    if (s.recommendations?.N != null) out.add('N');
    for (const k of Object.keys(s.indices ?? {})) out.add(k); // P, K, Mn, Zn...
  }
  return [...out];
}

export async function explainReport(report: SoilReport, opts: EngineOpts): Promise<Answer> {
  const text = await opts.llm.generate(composeExplain(report, opts.lang));
  return { text, grounded: false, usedChunks: [] };
}

export async function answerQuestion(question: string, report: SoilReport, opts: EngineOpts): Promise<Answer> {
  // Retrieve by question keywords only — param-seeding would match every question
  // against the report indiscriminately (e.g. weather questions would be "grounded").
  const result = retrieve(question, []);
  const mode = route(result);
  const chunks = mode === 'grounded' ? result.chunks.map((c) => c.text) : [];
  const text = await opts.llm.generate(composeAnswer(question, report, chunks, opts.lang));
  return { text, grounded: mode === 'grounded', usedChunks: result.chunks.map((c) => c.id) };
}
