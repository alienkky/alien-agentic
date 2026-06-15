package com.alienagentic.voicetranslator.engine

/**
 * A pluggable speech-to-text source. Two implementations exist:
 *
 *  - [OnDeviceSpeechEngine]: Android's built-in recognizer (offline, free).
 *  - [WhisperSpeechEngine]: a cloud Whisper-compatible API (higher accuracy,
 *    needs network + API key).
 *
 * Callbacks are always delivered on the main thread so listeners can touch UI
 * directly.
 */
interface SpeechEngine {

    /** Live, not-yet-final transcript. May fire many times per utterance. */
    var onPartial: (String) -> Unit

    /** A finalized utterance, ready to translate. */
    var onFinal: (String) -> Unit

    /** Human-readable error message. The engine keeps running where it can. */
    var onError: (String) -> Unit

    /** BCP-47 hint for the spoken language, e.g. "ja-JP" or "en-US". */
    fun setLanguage(localeTag: String)

    /** Begin continuous listening. Safe to call again after [stop]. */
    fun start()

    /** Pause listening. */
    fun stop()

    /** Release all native resources. The engine is unusable afterwards. */
    fun destroy()
}
