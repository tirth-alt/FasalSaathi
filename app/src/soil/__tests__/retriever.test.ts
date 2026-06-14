import { retrieve } from '../retriever';

test('matches by explicit param', () => {
  const r = retrieve('', ['lime']);
  expect(r.score).toBeGreaterThan(0);
  expect(r.chunks.some((c) => c.params.includes('lime'))).toBe(true);
});

test('matches by Hindi keyword in the query', () => {
  const r = retrieve('मेरी मिट्टी में फॉस्फोरस ज़्यादा है', []);
  expect(r.chunks.some((c) => c.params.includes('P'))).toBe(true);
});

test('no signal -> score 0, empty chunks', () => {
  const r = retrieve('namaste', []);
  expect(r.score).toBe(0);
  expect(r.chunks).toEqual([]);
});
