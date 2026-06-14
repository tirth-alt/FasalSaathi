import type { LlmClient } from '../types';
import {
  init as nativeInit,
  generate as nativeGenerate,
  startAudio as nativeStartAudio,
  stopAudioAndGenerate as nativeStopAudioAndGenerate,
} from '../../../modules/soil-llm';
import { ensureModel } from '../modelManager';

export class NativeLlm implements LlmClient {
  private initPromise: Promise<void> | null = null;

  init(modelPath?: string): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const path = modelPath ?? (await ensureModel());
        await nativeInit(path);
      })().catch((e) => {
        this.initPromise = null; // allow a clean retry after a failed init
        throw e;
      });
    }
    return this.initPromise;
  }

  async generate(prompt: string): Promise<string> {
    await this.init();
    return nativeGenerate(prompt);
  }

  /** Begin on-device mic capture (model must be initialized first). */
  async startAudio(): Promise<void> {
    await this.init();
    await nativeStartAudio();
  }

  /** Stop capture and have Gemma 3n answer from the recorded audio on-device. */
  async stopAudioAndGenerate(prompt: string): Promise<string> {
    await this.init();
    return nativeStopAudioAndGenerate(prompt);
  }
}
