import { composeExplain, composeAnswer } from '../prompt';
import { SAMPLE_REPORT } from '../sample';

test('explain prompt embeds report JSON and demands English + stop-list', () => {
  const p = composeExplain(SAMPLE_REPORT, 'en');
  expect(p).toContain('R1');
  expect(p.toLowerCase()).toContain('english');
  expect(p.toLowerCase()).toContain('json');
  expect(p.toLowerCase()).toContain('stop');
});

test('answer prompt includes the question and grounding chunks', () => {
  const p = composeAnswer('my phosphorus is high, what to do?', SAMPLE_REPORT, ['Excess phosphorus causes zinc deficiency'], 'en');
  expect(p).toContain('my phosphorus is high, what to do?');
  expect(p).toContain('Excess phosphorus causes zinc deficiency');
});
