package com.alienagentic.voicetranslator

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Thin wrapper over [TextToSpeech] that speaks the translated caption aloud.
 * The spoken language is the *target* of the translation: Japanese speech is
 * read back in English, English speech in Japanese.
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
     * @param translatedText the text to speak
     * @param detectedJapanese true if the *source* was Japanese (so we speak English)
     */
    fun speak(translatedText: String, detectedJapanese: Boolean) {
        val engine = tts ?: return
        if (!ready || translatedText.isBlank()) return
        val target = if (detectedJapanese) Locale.ENGLISH else Locale.JAPANESE
        val result = engine.setLanguage(target)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            return
        }
        engine.speak(translatedText, TextToSpeech.QUEUE_FLUSH, null, "vt-utterance")
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
