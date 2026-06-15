package com.alienagentic.voicetranslator

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.alienagentic.voicetranslator.databinding.ActivityMainBinding

/**
 * Real-time Japanese <-> English voice captioner.
 *
 * Pipeline: continuous on-device speech recognition -> live partial transcript
 * -> ML Kit language identification -> on-device translation -> on-screen
 * captions. Everything runs offline once the translation models are downloaded.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val translator = TranslatorManager()
    private val mainHandler = Handler(Looper.getMainLooper())

    private var recognizer: SpeechRecognizer? = null
    private var isListening = false
    private var modelsReady = false

    // Language the recognizer listens for. Translation direction is still auto.
    private var listenLocale = "ja-JP"

    private val requestAudioPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startListening() else {
            toast(getString(R.string.error_no_mic_permission))
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.statusText.text = getString(R.string.status_preparing)
        binding.micButton.isEnabled = false

        translator.prepareModels(
            requireWifi = false,
            onReady = {
                runOnUiThread {
                    modelsReady = true
                    binding.micButton.isEnabled = true
                    binding.statusText.text = getString(R.string.status_ready)
                }
            },
            onError = { e ->
                runOnUiThread {
                    binding.statusText.text = getString(R.string.error_model_download, e.message)
                    binding.micButton.isEnabled = true
                }
            }
        )

        binding.micButton.setOnClickListener {
            if (isListening) stopListening() else ensurePermissionThenListen()
        }

        binding.langToggle.setOnClickListener { toggleListenLanguage() }
        updateLangToggleLabel()
    }

    private fun ensurePermissionThenListen() {
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) startListening() else {
            requestAudioPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun toggleListenLanguage() {
        listenLocale = if (listenLocale == "ja-JP") "en-US" else "ja-JP"
        updateLangToggleLabel()
        if (isListening) {
            // Restart so the new recognition language takes effect immediately.
            restartRecognizer()
        }
    }

    private fun updateLangToggleLabel() {
        val label = if (listenLocale == "ja-JP") {
            getString(R.string.listening_japanese)
        } else {
            getString(R.string.listening_english)
        }
        binding.langToggle.text = label
    }

    private fun startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            toast(getString(R.string.error_no_recognizer))
            return
        }
        isListening = true
        binding.micButton.text = getString(R.string.stop)
        binding.statusText.text = getString(R.string.status_listening)
        createAndStartRecognizer()
    }

    private fun stopListening() {
        isListening = false
        binding.micButton.text = getString(R.string.start)
        binding.statusText.text = getString(R.string.status_ready)
        destroyRecognizer()
    }

    private fun restartRecognizer() {
        destroyRecognizer()
        // A tiny delay avoids ERROR_RECOGNIZER_BUSY on rapid re-create.
        mainHandler.postDelayed({ if (isListening) createAndStartRecognizer() }, 250)
    }

    private fun createAndStartRecognizer() {
        destroyRecognizer()
        val sr = SpeechRecognizer.createSpeechRecognizer(this)
        sr.setRecognitionListener(recognitionListener)
        recognizer = sr
        sr.startListening(buildRecognizerIntent())
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

    private fun buildRecognizerIntent() = android.content.Intent(
        RecognizerIntent.ACTION_RECOGNIZE_SPEECH
    ).apply {
        putExtra(
            RecognizerIntent.EXTRA_LANGUAGE_MODEL,
            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
        )
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, listenLocale)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, listenLocale)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
        // Prefer offline recognition so captions keep working without a network.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
        }
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}

        override fun onPartialResults(partialResults: Bundle?) {
            val text = firstResult(partialResults) ?: return
            if (text.isNotBlank()) binding.sourceText.text = text
        }

        override fun onResults(results: Bundle?) {
            val text = firstResult(results)
            if (!text.isNullOrBlank()) {
                binding.sourceText.text = text
                translate(text)
            }
            // SpeechRecognizer ends after each utterance; loop while active.
            if (isListening) restartRecognizer()
        }

        override fun onError(error: Int) {
            // ERROR_NO_MATCH / ERROR_SPEECH_TIMEOUT are normal in quiet gaps;
            // just keep listening. Other errors also recover via restart.
            if (isListening) restartRecognizer()
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    private fun firstResult(bundle: Bundle?): String? {
        val list = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        return list?.firstOrNull()
    }

    private fun translate(text: String) {
        if (!modelsReady) return
        translator.translateAuto(
            text = text,
            onResult = { detectedJapanese, translated ->
                runOnUiThread {
                    binding.translatedText.text = translated
                    val dir = if (detectedJapanese) "JA → EN" else "EN → JA"
                    binding.directionText.text = dir
                    binding.directionText.visibility = View.VISIBLE
                }
            },
            onError = { e ->
                runOnUiThread { toast(getString(R.string.error_translate, e.message)) }
            }
        )
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    override fun onDestroy() {
        destroyRecognizer()
        translator.close()
        mainHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
