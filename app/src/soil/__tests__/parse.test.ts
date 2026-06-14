import { parseReportText } from '../parse';

test('pulls pH and a sample id out of OCR-like text', () => {
  const ocr = 'Sample ID: R1  pH 6.5  CEC 6.5  Lime 0.0 N 120 P2O5 0 K2O 200';
  const report = parseReportText(ocr);
  expect(report.samples[0].id).toBe('R1');
  expect(report.samples[0].pH).toBe(6.5);
  expect(report.samples[0].recommendations?.N).toBe(120);
});

test('no recognizable fields -> empty samples', () => {
  expect(parseReportText('garbage').samples).toEqual([]);
});
