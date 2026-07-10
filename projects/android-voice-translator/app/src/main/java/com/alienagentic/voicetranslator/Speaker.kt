package com.alienagentic.voicetranslator

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Thin wrapper over [TextToSpeech] that reads the translated caption aloud in
 * the chosen target language.
 */
class Speaker(context: Context) {

    private var ready = false
    private var tts: TextToSpeech? = null

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
        }
    }

    /**
     * @param text the translated text to speak
     * @param targetCode short language code of the text ("ko"/"en"/"ja")
     */
    fun speak(text: String, targetCode: String) {
        val engine = tts ?: return
        if (!ready || text.isBlank()) return
        val locale = when {
            targetCode.startsWith("ko") -> Locale.KOREAN
            targetCode.startsWith("ja") -> Locale.JAPANESE
            else -> Locale.ENGLISH
        }
        val result = engine.setLanguage(locale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            return
        }
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "vt-utterance")
    }

    fun stop() {
        tts?.stop()
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        ready = false
    }
}
