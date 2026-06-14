import { retrieve } from '../retriever';

test('matches by explicit param', () => {
  const r = retrieve('', ['lime']);
  expect(r.score).toBeGreaterThan(0);
  expect(r.chunks.some((c) => c.params.includes('lime'))).toBe(true);
});

test('matches by keyword in the query', () => {
  const r = retrieve('my soil has high phosphorus', []);
  expect(r.chunks.some((c) => c.params.includes('P'))).toBe(true);
});

test('no signal -> score 0, empty chunks', () => {
  const r = retrieve('hello there', []);
  expect(r.score).toBe(0);
  expect(r.chunks).toEqual([]);
});
