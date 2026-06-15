package com.alienagentic.voicetranslator.engine

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Continuous speech recognition built on Android's [SpeechRecognizer].
 *
 * [SpeechRecognizer] ends after each utterance, so we re-arm it on every result
 * or error while [listening] is true to keep a seamless stream. All recognizer
 * calls happen on the main thread, which the framework requires.
 */
class OnDeviceSpeechEngine(private val context: Context) : SpeechEngine {

    override var onPartial: (String) -> Unit = {}
    override var onFinal: (String) -> Unit = {}
    override var onError: (String) -> Unit = {}

    private val mainHandler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var localeTag = "ja-JP"

    override fun setLanguage(localeTag: String) {
        this.localeTag = localeTag
        if (listening) restart()
    }

    override fun start() {
        if (listening) return
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onError("이 기기에서 음성 인식을 사용할 수 없습니다")
            return
        }
        listening = true
        createAndStart()
    }

    override fun stop() {
        listening = false
        destroyRecognizer()
    }

    override fun destroy() {
        listening = false
        destroyRecognizer()
        mainHandler.removeCallbacksAndMessages(null)
    }

    private fun restart() {
        destroyRecognizer()
        // A tiny delay avoids ERROR_RECOGNIZER_BUSY on rapid re-create.
        mainHandler.postDelayed({ if (listening) createAndStart() }, 250)
    }

    private fun createAndStart() {
        destroyRecognizer()
        val sr = SpeechRecognizer.createSpeechRecognizer(context)
        sr.setRecognitionListener(listener)
        recognizer = sr
        sr.startListening(buildIntent())
    }

    private fun destroyRecognizer() {
        recognizer?.let {
            it.setRecognitionListener(null)
            try {
                it.stopListening()
            } catch (_: Exception) {
            }
            it.destroy()
        }
        recognizer = null
    }

    private fun buildIntent() = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, localeTag)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, localeTag)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
        }
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}

        override fun onPartialResults(partialResults: Bundle?) {
            firstResult(partialResults)?.takeIf { it.isNotBlank() }?.let { onPartial(it) }
        }

        override fun onResults(results: Bundle?) {
            firstResult(results)?.takeIf { it.isNotBlank() }?.let { onFinal(it) }
            if (listening) restart()
        }

        override fun onError(error: Int) {
            // ERROR_NO_MATCH / ERROR_SPEECH_TIMEOUT are normal in quiet gaps.
            if (listening) restart()
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    private fun firstResult(bundle: Bundle?): String? =
        bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
}
