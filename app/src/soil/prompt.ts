import type { SoilReport, Lang } from './types';

const SYSTEM =
  'You are an experienced agricultural advisor speaking to a small, low-literacy farmer in very simple, plain English. ' +
  'Rules:\n' +
  '1) Translate every technical or chemical code into plain words and the common fertilizer name — ' +
  'e.g. N = nitrogen = urea; P2O5 = phosphorus = DAP/SSP; K2O = potash = MOP; ' +
  'Zn = zinc = zinc sulphate; high/low pH = sweet/sour soil; lime for acidity. Never just give the code.\n' +
  '2) Give direct, actionable steps: which fertilizer to apply, roughly how much (bags/kg per acre) and when; ' +
  'and which fertilizer to STOP using (to save money).\n' +
  '3) Keep it short — 4-6 simple sentences or bullet points.\n' +
  '4) End by asking the farmer one easy question about whether they have already used that fertilizer/chemical ' +
  '(e.g. "Have you already applied urea or DAP in this field?"), so the next advice is more precise.';

function langRule(lang: Lang): string {
  return lang === 'hi' ? 'Reply only in simple Hindi.' : 'Reply only in simple English.';
}

export function composeExplain(report: SoilReport, lang: Lang): string {
  return [
    SYSTEM,
    langRule(lang),
    'The soil report is given as JSON below:',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    'Explain this report to the farmer: what it means, which fertilizer to apply, and which to stop.',
  ].join('\n');
}

export function composeAnswer(
  question: string,
  report: SoilReport,
  kbChunks: string[],
  lang: Lang,
): string {
  const grounding = kbChunks.length
    ? ['Trusted facts (base your answer on these):', ...kbChunks.map((c) => `- ${c}`)].join('\n')
    : 'No stored facts matched — answer from your own farming knowledge.';
  return [
    SYSTEM,
    langRule(lang),
    grounding,
    'Report:',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    `Farmer's question: ${question}`,
  ].join('\n');
}
