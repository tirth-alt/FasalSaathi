import { KB_CHUNKS } from '../kb/chunks';

test('KB covers the demo parameters', () => {
  const params = new Set(KB_CHUNKS.flatMap((c) => c.params));
  for (const p of ['pH', 'lime', 'P', 'K', 'Mn', 'Zn', 'cec', 'baseSat', 'N'])
    expect(params.has(p)).toBe(true);
});

test('every chunk has id, params, keywords, non-empty text', () => {
  for (const c of KB_CHUNKS) {
    expect(c.id).toBeTruthy();
    expect(c.params.length).toBeGreaterThan(0);
    expect(c.keywords.length).toBeGreaterThan(0);
    expect(c.text.trim().length).toBeGreaterThan(20);
  }
});
