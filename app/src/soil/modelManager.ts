import * as FileSystem from 'expo-file-system/legacy';

/** Where the Gemma 3n .task lives on the device. The app downloads it on first
 *  launch (APK can't bundle 3.7 GB). Replace MODEL_URL with your hosted file,
 *  OR side-load once with: adb push gemma-3n-E4B-it.task <printed localPath>. */
const MODEL_URL = 'https://REPLACE_WITH_YOUR_HOSTED_MODEL/gemma-3n-E4B-it.task';
const FILENAME = 'gemma-3n-E4B-it.task';

export function modelPath(): string {
  return FileSystem.documentDirectory + FILENAME;
}

export async function ensureModel(onProgress?: (pct: number) => void): Promise<string> {
  const path = modelPath();
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) return path;
  const dl = FileSystem.createDownloadResumable(MODEL_URL, path, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite > 0)
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  await dl.downloadAsync();
  return path;
}
