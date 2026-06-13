import { requireNativeModule } from 'expo-modules-core';

const SoilLlm = requireNativeModule('SoilLlm');

export function init(modelPath: string): Promise<boolean> {
  return SoilLlm.init(modelPath);
}
export function generate(prompt: string): Promise<string> {
  return SoilLlm.generate(prompt);
}
