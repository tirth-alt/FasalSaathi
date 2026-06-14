import { route } from '../router';

test('confident retrieval -> grounded', () => {
  expect(route({ chunks: [{ id: 'x', params: ['pH'], keywords: ['ph'], text: 'a'.repeat(30) }], score: 2 })).toBe('grounded');
});

test('empty retrieval -> llm-only', () => {
  expect(route({ chunks: [], score: 0 })).toBe('llm-only');
});

test('result at exact threshold -> grounded', () => {
  expect(route({ chunks: [{ id: 'x', params: ['pH'], keywords: ['ph'], text: 'a'.repeat(30) }], score: 1 })).toBe('grounded');
});
