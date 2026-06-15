package com.alienagentic.voicetranslator

import android.content.Context
import com.alienagentic.voicetranslator.engine.OnDeviceSpeechEngine
import com.alienagentic.voicetranslator.engine.SpeechEngine
import com.alienagentic.voicetranslator.engine.WhisperSpeechEngine

/** Builds the speech engine selected in [AppSettings]. */
object EngineFactory {
    fun create(context: Context, settings: AppSettings): SpeechEngine {
        val engine: SpeechEngine = if (settings.cloudReady()) {
            WhisperSpeechEngine(
                baseUrl = settings.whisperBaseUrl,
                apiKey = settings.whisperApiKey,
                model = settings.whisperModel
            )
        } else {
            OnDeviceSpeechEngine(context)
        }
        engine.setLanguage(settings.listenLocale)
        return engine
    }
}
