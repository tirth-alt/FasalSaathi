import { composeExplain, composeAnswer } from '../prompt';
import { SAMPLE_REPORT } from '../sample';

test('explain prompt embeds report JSON and demands Hindi + stop-list', () => {
  const p = composeExplain(SAMPLE_REPORT, 'hi');
  expect(p).toContain('R1');
  expect(p).toContain('हिंदी');
  expect(p.toLowerCase()).toContain('json');
});

test('answer prompt includes the question and grounding chunks', () => {
  const p = composeAnswer('फॉस्फोरस ज़्यादा है क्या करूँ?', SAMPLE_REPORT, ['ज़्यादा फॉस्फोरस से ज़िंक'], 'hi');
  expect(p).toContain('फॉस्फोरस ज़्यादा है क्या करूँ?');
  expect(p).toContain('ज़्यादा फॉस्फोरस से ज़िंक');
});
