package expo.modules.soilllm

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInference.LlmInferenceOptions

class SoilLlmModule : Module() {
  @Volatile private var llm: LlmInference? = null

  override fun definition() = ModuleDefinition {
    Name("SoilLlm")

    AsyncFunction("init") { modelPath: String ->
      val ctx = appContext.reactContext ?: throw Exception("No context")
      val options = LlmInferenceOptions.builder()
        .setModelPath(modelPath)
        .setMaxTokens(1024)
        .build()
      llm?.close()
      llm = LlmInference.createFromOptions(ctx, options)
      true
    }

    AsyncFunction("generate") { prompt: String ->
      val engine = llm ?: throw Exception("Model not initialized")
      engine.generateResponse(prompt)
    }
  }
}
