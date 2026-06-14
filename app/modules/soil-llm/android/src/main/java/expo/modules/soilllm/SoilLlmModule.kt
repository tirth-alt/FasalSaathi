package expo.modules.soilllm

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.mediapipe.tasks.genai.llminference.AudioModelOptions
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInference.LlmInferenceOptions
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession.LlmInferenceSessionOptions
import java.io.ByteArrayOutputStream

class SoilLlmModule : Module() {
  @Volatile private var llm: LlmInference? = null
  private val lock = Any()

  // --- audio recording state ---
  private val SAMPLE_RATE = 16000
  @Volatile private var recording = false
  private var recorder: AudioRecord? = null
  private var recordThread: Thread? = null
  private val pcm = ByteArrayOutputStream()

  override fun definition() = ModuleDefinition {
    Name("SoilLlm")

    AsyncFunction("init") { modelPath: String ->
      val ctx = appContext.reactContext ?: throw Exception("No context")
      val options = LlmInferenceOptions.builder()
        .setModelPath(modelPath)
        .setMaxTokens(1024)
        .setAudioModelOptions(AudioModelOptions.builder().build())
        .build()
      synchronized(lock) {
        llm?.close()
        llm = LlmInference.createFromOptions(ctx, options)
      }
      true
    }

    // Text generation (used by report explanation + typed questions).
    AsyncFunction("generate") { prompt: String ->
      val engine = synchronized(lock) { llm } ?: throw Exception("Model not initialized")
      engine.generateResponse(prompt)
    }

    // Begin capturing microphone audio (16 kHz mono PCM). Requires RECORD_AUDIO
    // to already be granted on the JS side.
    AsyncFunction("startAudio") {
      startRecording()
      true
    }

    // Stop capture, wrap the PCM as a mono .wav, and let Gemma 3n answer from the
    // audio in one on-device pass (it transcribes + reasons).
    AsyncFunction("stopAudioAndGenerate") { prompt: String ->
      val wav = stopRecording()
      val engine = synchronized(lock) { llm } ?: throw Exception("Model not initialized")
      val sessionOptions = LlmInferenceSessionOptions.builder()
        .setGraphOptions(GraphOptions.builder().setEnableAudioModality(true).build())
        .build()
      val session = LlmInferenceSession.createFromOptions(engine, sessionOptions)
      try {
        session.addQueryChunk(prompt)
        session.addAudio(wav)
        session.generateResponse()
      } finally {
        session.close()
      }
    }
  }

  @SuppressLint("MissingPermission")
  private fun startRecording() {
    synchronized(lock) {
      if (recording) return
      val minBuf = AudioRecord.getMinBufferSize(
        SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
      )
      val rec = AudioRecord(
        MediaRecorder.AudioSource.MIC, SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf,
      )
      pcm.reset()
      rec.startRecording()
      recorder = rec
      recording = true
      recordThread = Thread {
        val buf = ByteArray(minBuf)
        while (recording) {
          val n = rec.read(buf, 0, buf.size)
          if (n > 0) synchronized(pcm) { pcm.write(buf, 0, n) }
        }
      }.also { it.start() }
    }
  }

  private fun stopRecording(): ByteArray {
    recording = false
    recordThread?.join(2000)
    recordThread = null
    recorder?.let {
      try { it.stop() } catch (_: Exception) {}
      it.release()
    }
    recorder = null
    val pcmBytes = synchronized(pcm) { pcm.toByteArray() }
    return wavFromPcm(pcmBytes, SAMPLE_RATE)
  }

  /** Prepend a 44-byte WAV header to mono 16-bit PCM. */
  private fun wavFromPcm(pcmBytes: ByteArray, sampleRate: Int): ByteArray {
    val out = ByteArrayOutputStream()
    val byteRate = sampleRate * 2 // mono * 16-bit
    fun str(s: String) = out.write(s.toByteArray(Charsets.US_ASCII))
    fun int32(v: Int) {
      out.write(v and 0xff); out.write((v shr 8) and 0xff)
      out.write((v shr 16) and 0xff); out.write((v shr 24) and 0xff)
    }
    fun int16(v: Int) { out.write(v and 0xff); out.write((v shr 8) and 0xff) }
    str("RIFF"); int32(36 + pcmBytes.size); str("WAVE")
    str("fmt "); int32(16); int16(1); int16(1) // PCM, mono
    int32(sampleRate); int32(byteRate); int16(2); int16(16)
    str("data"); int32(pcmBytes.size); out.write(pcmBytes)
    return out.toByteArray()
  }
}
