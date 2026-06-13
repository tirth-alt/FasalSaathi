import type { LlmClient } from '../types';
import { init as nativeInit, generate as nativeGenerate } from '../../../modules/soil-llm';
import { ensureModel } from '../modelManager';

export class NativeLlm implements LlmClient {
  private ready = false;
  async init(modelPath?: string) {
    const path = modelPath ?? (await ensureModel());
    await nativeInit(path);
    this.ready = true;
  }
  async generate(prompt: string): Promise<string> {
    if (!this.ready) await this.init();
    return nativeGenerate(prompt);
  }
}
