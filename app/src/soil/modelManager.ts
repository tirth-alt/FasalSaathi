import * as FileSystem from 'expo-file-system/legacy';

/**
 * Downloads the Gemma 3n model into the app's own internal storage on first use.
 * This needs NO adb and NO developer access — works on any phone where the app is
 * installed. MediaPipe's setModelPath then loads it from the returned bare path.
 *
 * Set MODEL_URL to a DIRECT download link for the .task file:
 *   - Gated Hugging Face repo: use the resolve URL and set MODEL_AUTH to
 *     'Bearer hf_xxx' (create a read token at huggingface.co/settings/tokens after
 *     accepting the Gemma license on the repo page). Example URL:
 *     https://huggingface.co/google/gemma-3n-E4B-it-litert-preview/resolve/main/gemma-3n-E4B-it.task
 *   - Public link (Google Drive direct-download, your own bucket, etc.): leave
 *     MODEL_AUTH empty.
 * The file is ~4 GB, so the first launch download takes a few minutes on Wi-Fi;
 * after that it's cached on the device.
 */
const FILENAME = 'gemma-3n-E4B-it-int4.task';
const MODEL_URL =
  'https://huggingface.co/google/gemma-3n-E4B-it-litert-preview/resolve/main/gemma-3n-E4B-it-int4.task';
// REQUIRED for this gated repo: paste your HF read token here as 'Bearer hf_xxxxx'
// (accept the license on the repo page first). Keep it private; don't commit it.
const MODEL_AUTH = '';
const MIN_VALID_BYTES = 100 * 1024 * 1024; // a real model is >100 MB; smaller = bad/partial file

/** file:// URI used by expo-file-system APIs. */
function modelUri(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error('No document directory available on this platform');
  return dir + FILENAME;
}

/** Bare POSIX path handed to MediaPipe setModelPath (no file:// scheme). */
export function modelPath(): string {
  return modelUri().replace(/^file:\/\//, '');
}

export async function ensureModel(onProgress?: (pct: number) => void): Promise<string> {
  const uri = modelUri();
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && (info.size ?? 0) > MIN_VALID_BYTES) {
    return uri.replace(/^file:\/\//, '');
  }
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true }); // partial/corrupt — re-download
  }
  if (MODEL_URL.includes('PASTE_')) {
    throw new Error(
      'मॉडल लिंक सेट नहीं है / Model URL not set. Paste the .task download link in modelManager.ts (MODEL_URL).',
    );
  }
  const options = MODEL_AUTH ? { headers: { Authorization: MODEL_AUTH } } : {};
  const dl = FileSystem.createDownloadResumable(MODEL_URL, uri, options, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite > 0) {
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const result = await dl.downloadAsync();
  if (!result?.uri) throw new Error('Model download failed');
  return result.uri.replace(/^file:\/\//, '');
}
