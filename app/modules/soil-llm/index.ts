import { requireOptionalNativeModule } from 'expo-modules-core';

// requireOptionalNativeModule returns null (instead of throwing at import time)
// when the running app has no SoilLlm native module — e.g. Expo Go, or a dev-client
// build made before this module was added. Using it here keeps a missing module from
// crashing the whole bundle at startup; the Soil screen surfaces a friendly message
// instead. The on-device model only exists in a dev-client build (eas build /
// expo run:android), never in Expo Go.
const SoilLlm = requireOptionalNativeModule('SoilLlm');

export const isSoilLlmAvailable = SoilLlm != null;

const UNAVAILABLE =
  'On-device model unavailable: this build has no SoilLlm native module. ' +
  'Run a dev-client build (eas build / expo run:android), not Expo Go.';

export function init(modelPath: string): Promise<boolean> {
  if (!SoilLlm) return Promise.reject(new Error(UNAVAILABLE));
  return SoilLlm.init(modelPath);
}
export function generate(prompt: string): Promise<string> {
  if (!SoilLlm) return Promise.reject(new Error(UNAVAILABLE));
  return SoilLlm.generate(prompt);
}
export function startAudio(): Promise<boolean> {
  if (!SoilLlm) return Promise.reject(new Error(UNAVAILABLE));
  return SoilLlm.startAudio();
}
export function stopAudioAndGenerate(prompt: string): Promise<string> {
  if (!SoilLlm) return Promise.reject(new Error(UNAVAILABLE));
  return SoilLlm.stopAudioAndGenerate(prompt);
}
