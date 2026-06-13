import { explainReport, answerQuestion } from '../engine';
import { SAMPLE_REPORT } from '../sample';
import type { LlmClient } from '../types';

const fakeLlm = (capture: { prompt?: string }): LlmClient => ({
  async init() {},
  async generate(prompt: string) { capture.prompt = prompt; return 'जवाब'; },
});

test('explainReport sends an explain prompt and returns text', async () => {
  const cap: { prompt?: string } = {};
  const ans = await explainReport(SAMPLE_REPORT, { llm: fakeLlm(cap), lang: 'hi' });
  expect(ans.text).toBe('जवाब');
  expect(cap.prompt).toContain('R1');
});

test('answerQuestion grounds when KB matches the question', async () => {
  const cap: { prompt?: string } = {};
  const ans = await answerQuestion('फॉस्फोरस ज़्यादा है क्या करूँ?', SAMPLE_REPORT, { llm: fakeLlm(cap), lang: 'hi' });
  expect(ans.grounded).toBe(true);
  expect(ans.usedChunks.length).toBeGreaterThan(0);
});

test('answerQuestion falls back to llm-only when no KB match', async () => {
  const cap: { prompt?: string } = {};
  const ans = await answerQuestion('आज मौसम कैसा है?', SAMPLE_REPORT, { llm: fakeLlm(cap), lang: 'hi' });
  expect(ans.grounded).toBe(false);
  expect(ans.usedChunks).toEqual([]);
});
