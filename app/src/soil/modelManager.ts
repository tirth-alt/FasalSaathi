import * as FileSystem from 'expo-file-system/legacy';

/** Where the Gemma 3n .task lives on the device. The app downloads it on first
 *  launch (APK can't bundle ~4.4 GB). Model artifact: `gemma-3n-E4B-it.task`
 *  from the gated HF repo https://huggingface.co/google/gemma-3n-E4B-it-litert-preview
 *  (requires HF auth). For the demo the reliable path is:
 *    adb push gemma-3n-E4B-it.task <modelPath() printed value>
 *  Replace MODEL_URL with a hosted URL once you have one. */
const MODEL_URL = 'https://REPLACE_WITH_YOUR_HOSTED_MODEL/gemma-3n-E4B-it.task';
const FILENAME = 'gemma-3n-E4B-it.task';

export function modelPath(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error('No document directory available on this platform');
  return dir + FILENAME;
}

export async function ensureModel(onProgress?: (pct: number) => void): Promise<string> {
  if (MODEL_URL.includes('REPLACE_WITH')) {
    throw new Error('MODEL_URL not configured. Host the Gemma 3n .task, or adb push it to: ' + modelPath());
  }
  const path = modelPath();
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) return path;
  const dl = FileSystem.createDownloadResumable(MODEL_URL, path, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite > 0)
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const result = await dl.downloadAsync();
  if (!result?.uri) throw new Error('Model download failed');
  return path;
}
