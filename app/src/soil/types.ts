export type Lang = 'hi' | 'en';

export type SoilSample = {
  id: string;                          // e.g. "R1"
  pH?: number;
  cec?: number;                        // meq/100cm3
  baseSatPct?: number;                 // % base saturation (BS%)
  indices?: Record<string, number>;    // P-I, K-I, Mn-I, Zn-I, ...
  recommendations?: {
    limeTonsAcre?: number;
    N?: number; P2O5?: number; K2O?: number;  // lbs/acre
    [k: string]: number | undefined;
  };
};

export type SoilReport = {
  samples: SoilSample[];
  units: 'US' | 'metric';
  source: string;                      // human label of where it came from
};

export type KbChunk = {
  id: string;
  params: string[];                    // canonical params it covers: 'pH','P','K','lime',...
  keywords: string[];                  // free-text triggers (Hindi + English)
  text: string;                        // the advice, plain Hindi
};

export type RetrievalResult = { chunks: KbChunk[]; score: number };

export type Answer = { text: string; grounded: boolean; usedChunks: string[] };

export interface LlmClient {
  init(modelPath?: string): Promise<void>;
  generate(prompt: string, imageUri?: string): Promise<string>;
}
