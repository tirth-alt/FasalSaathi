import type { LlmClient } from '../types';

/** PC-only client used to validate prompts/RAG before the native module exists.
 *  Defaults to a local Ollama gemma3n; set OPENROUTER_API_KEY to use OpenRouter. */
export class DevLlm implements LlmClient {
  async init() {}
  async generate(prompt: string): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    if (key) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'google/gemma-3n-e4b-it', messages: [{ role: 'user', content: prompt }] }),
      });
      const j = await res.json();
      return j.choices?.[0]?.message?.content ?? '';
    }
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemma3n:e4b', prompt, stream: false }),
    });
    const j = await res.json();
    return j.response ?? '';
  }
}
