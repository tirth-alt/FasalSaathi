import { SAMPLE_REPORT } from '../sample';

test('sample report has the three demo samples with pH', () => {
  expect(SAMPLE_REPORT.samples.map((s) => s.id)).toEqual(['R1', 'R2', 'B1']);
  for (const s of SAMPLE_REPORT.samples) expect(typeof s.pH).toBe('number');
});
