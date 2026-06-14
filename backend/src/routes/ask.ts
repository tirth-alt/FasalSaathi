import { Hono } from 'hono';
import type { AppBindings } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';
import { askBodySchema, type AskBody } from '@/routes/ask.schema.ts';

/**
 * POST /ask — F3 "Jaaniye" ask-a-question endpoint. PUBLIC (no auth): it needs no
 * farmer data, just a question (+ optional lab-report photo).
 *
 * This is a STUB: it echoes the question with a friendly "coming soon" message.
 * The real LLM + vision provider plugs in behind this same handler later —
 * `composeAnswer` is the ONLY spot to swap, so the route, schema, and contract
 * (request/response shape) stay fixed when the provider lands.
 */
export interface AskDeps {
  // Intentionally empty for the stub. The real provider (LLM + vision client)
  // will be injected here, consumed only by composeAnswer — no route changes.
}

export function createAskRoutes(_deps: AskDeps = {}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // POST /ask
  app.post('/ask', async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return jsonError(c, 400, 'invalid_json', 'Request body must be valid JSON');
    }

    const parsed = askBodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid ask payload', parsed.error.flatten());
    }

    const { lang, image_base64 } = parsed.data;
    const hasImage = image_base64 !== undefined;

    return c.json({
      answer: composeAnswer(parsed.data),
      has_image: hasImage,
      disclaimer: DISCLAIMER[lang],
      stub: true as const,
    });
  });

  return app;
}

/**
 * Compose the placeholder answer. ISOLATED so the real LLM/vision call replaces
 * exactly this function. Echoes the question in the requested language and notes
 * a lab-report analysis is coming when an image is attached.
 */
function composeAnswer(body: AskBody): string {
  const { question, lang } = body;
  const hasImage = body.image_base64 !== undefined;

  if (lang === 'en') {
    let answer = `You asked: "${question}". This feature is coming soon — our AI advisor is being connected.`;
    if (hasImage) {
      answer += ' Lab-report photo analysis is also on its way.';
    }
    return answer;
  }

  // hi (default)
  let answer = `आपने पूछा: "${question}". यह सुविधा जल्द ही उपलब्ध होगी — हमारा AI सलाहकार अभी जुड़ रहा है।`;
  if (hasImage) {
    answer += ' लैब-रिपोर्ट फोटो का विश्लेषण भी जल्द ही आ रहा है।';
  }
  return answer;
}

/** Short demo-placeholder disclaimer per language. */
const DISCLAIMER: Record<'hi' | 'en', string> = {
  hi: 'यह एक डेमो प्लेसहोल्डर है, असली कृषि सलाह नहीं।',
  en: 'This is a demo placeholder, not real agronomic advice.',
};
