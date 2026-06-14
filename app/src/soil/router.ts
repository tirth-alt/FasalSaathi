import type { RetrievalResult } from './types';

const THRESHOLD = 1; // at least one real signal grounds the answer

export function route(result: RetrievalResult): 'grounded' | 'llm-only' {
  return result.chunks.length > 0 && result.score >= THRESHOLD ? 'grounded' : 'llm-only';
}
