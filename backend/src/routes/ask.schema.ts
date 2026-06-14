import { z } from 'zod';

/**
 * Body for POST /ask (F3 "Jaaniye" — ask-a-question). PUBLIC: no farmer data is
 * read, so no auth. `image_base64` is an optional lab-report photo (vision lands
 * with the real provider later).
 */
export const askBodySchema = z.object({
  question: z.string().trim().min(1, 'question is required'),
  lang: z.enum(['hi', 'en']).default('hi'),
  /** Optional base64 lab-report photo. Not parsed in the stub. */
  image_base64: z.string().min(1).optional(),
});

export type AskBody = z.infer<typeof askBodySchema>;
