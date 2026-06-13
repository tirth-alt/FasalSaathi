import * as FileSystem from 'expo-file-system/legacy';

/**
 * The Gemma 3n model is placed on the device via `adb push` into this app's
 * external files directory — readable by the app without storage permissions and
 * writable by adb without root (unlike internal storage). MediaPipe's setModelPath
 * loads this absolute path directly.
 *
 * Put the file there with:
 *   adb push <your-model-file> /storage/emulated/0/Android/data/com.fasalsaathi.app/files/gemma-3n-E4B-it.task
 *
 * FILENAME must match exactly what you push (rename on push if your file differs,
 * e.g. a .litertlm artifact). Model source: the Gemma 3n E4B LiteRT artifact
 * (e.g. https://huggingface.co/google/gemma-3n-E4B-it-litert-preview), or pull the
 * copy AI Edge Gallery already downloaded if it lives under /sdcard/Android/data/.
 */
const FILENAME = 'gemma-3n-E4B-it.task';
const MODEL_DIR = '/storage/emulated/0/Android/data/com.fasalsaathi.app/files';
const MODEL_PATH = `${MODEL_DIR}/${FILENAME}`;

export function modelPath(): string {
  return MODEL_PATH;
}

/** Returns the on-device model path, or throws an actionable adb-push message if
 *  the file isn't there yet. Falls through to the native loader if the path can't
 *  be stat'd from JS (it can still be readable by the native MediaPipe loader). */
export async function ensureModel(): Promise<string> {
  let exists: boolean;
  try {
    exists = (await FileSystem.getInfoAsync('file://' + MODEL_PATH)).exists;
  } catch {
    // expo-file-system couldn't stat the external path — let the native loader try.
    return MODEL_PATH;
  }
  if (!exists) {
    throw new Error(
      `मॉडल फ़ाइल नहीं मिली / Model not found. Push it with:\n` +
        `adb push ${FILENAME} ${MODEL_DIR}/`,
    );
  }
  return MODEL_PATH;
}
