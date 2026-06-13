import { KB_CHUNKS } from './kb/chunks';
import type { KbChunk, RetrievalResult } from './types';

const TOP_K = 3;

function norm(s: string): string {
  return s.toLowerCase().replace(/[।.,!?\-\/]/g, ' ');
}

/** Returns true if keyword kw appears as a whole token in query q.
 *  Whole-token: surrounded by word-separator characters (spaces, punctuation,
 *  or string boundaries). This prevents 'n' matching inside 'namaste'. */
function kwMatch(q: string, kw: string): boolean {
  const nkw = norm(kw);
  const nq = norm(q);
  // Wrap query in spaces so we can do simple boundary check without regex
  const padded = ' ' + nq + ' ';
  return padded.includes(' ' + nkw + ' ');
}

/** Score = 2*paramMatches + keywordMatches. Params are exact tokens the caller
 *  already knows about the report; keywords are fuzzy hits in the query text. */
export function retrieve(query: string, params: string[]): RetrievalResult {
  const paramSet = new Set(params);

  const scored = KB_CHUNKS.map((c: KbChunk) => {
    const paramHits = c.params.filter((p) => paramSet.has(p)).length;
    const kwHits = c.keywords.filter((k) => kwMatch(query, k)).length;
    return { chunk: c, score: 2 * paramHits + kwHits };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    chunks: scored.slice(0, TOP_K).map((x) => x.chunk),
    score: scored.length ? scored[0].score : 0,
  };
}
