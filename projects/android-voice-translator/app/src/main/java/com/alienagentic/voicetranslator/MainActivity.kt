package com.alienagentic.voicetranslator

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.alienagentic.voicetranslator.databinding.ActivityMainBinding
import com.alienagentic.voicetranslator.engine.SpeechEngine

/**
 * Real-time Japanese <-> English voice captioner.
 *
 * Pipeline: a pluggable [SpeechEngine] (on-device or cloud Whisper) produces a
 * transcript -> ML Kit language identification -> on-device translation -> on-
 * screen captions, optionally spoken aloud via [Speaker]. A floating overlay
 * mode is available through [CaptionOverlayService].
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var settings: AppSettings
    private val translator = TranslatorManager()
    private var speaker: Speaker? = null

    private var engine: SpeechEngine? = null
    private var isListening = false

    private val requestAudioPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startListening() else toast(getString(R.string.error_no_mic_permission))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        settings = AppSettings(this)
        speaker = Speaker(this)

        translator.setTarget(settings.targetLanguage)
        translator.setFallbackSource(settings.listenLocale)

        // Don't block usage on the model download — the mic works immediately and
        // the translation model is fetched on demand at the first utterance.
        binding.micButton.isEnabled = true
        binding.statusText.text = getString(R.string.status_ready)

        // Warm up the model in the background (best effort). Failure is fine:
        // translateAuto downloads on demand and will retry per utterance.
        translator.prepareModels(
            requireWifi = false,
            onReady = { },
            onError = { }
        )

        binding.micButton.setOnClickListener {
            if (isListening) stopListening() else ensurePermissionThenListen()
        }
        binding.langToggle.setOnClickListener { toggleListenLanguage() }
        binding.settingsButton.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        binding.overlayButton.setOnClickListener { launchOverlay() }
    }

    override fun onResume() {
        super.onResume()
        // Settings may have changed the target language while we were away.
        translator.setTarget(settings.targetLanguage)
        translator.setFallbackSource(settings.listenLocale)
        updateLangToggleLabel()
        updateModeLabel()
        updateOverlayButtonLabel()
    }

    private fun updateOverlayButtonLabel() {
        binding.overlayButton.text = if (CaptionOverlayService.isRunning) {
            getString(R.string.overlay_button_stop)
        } else {
            getString(R.string.overlay_button)
        }
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
        // Cycle through the languages the recognizer can listen for.
        settings.listenLocale = when (settings.listenLocale) {
            "ja-JP" -> "en-US"
            "en-US" -> "ko-KR"
            else -> "ja-JP"
        }
        updateLangToggleLabel()
        engine?.setLanguage(settings.listenLocale)
        translator.setFallbackSource(settings.listenLocale)
    }

    private fun updateLangToggleLabel() {
        binding.langToggle.text = when (settings.listenLocale) {
            "ja-JP" -> getString(R.string.listening_japanese)
            "en-US" -> getString(R.string.listening_english)
            else -> getString(R.string.listening_korean)
        }
    }

    private fun updateModeLabel() {
        binding.modeText.text = if (settings.cloudReady()) {
            getString(R.string.mode_cloud)
        } else {
            getString(R.string.mode_ondevice)
        }
    }

    private fun startListening() {
        val e = EngineFactory.create(this, settings)
        e.onPartial = { text -> runOnUiThread { binding.sourceText.text = text } }
        e.onFinal = { text ->
            runOnUiThread { binding.sourceText.text = text }
            translate(text)
        }
        e.onError = { msg -> runOnUiThread { toast(msg) } }
        engine = e

        isListening = true
        binding.micButton.text = getString(R.string.stop)
        binding.statusText.text = getString(R.string.status_listening)
        e.start()
    }

    private fun stopListening() {
        isListening = false
        binding.micButton.text = getString(R.string.start)
        binding.statusText.text = getString(R.string.status_ready)
        engine?.destroy()
        engine = null
        speaker?.stop()
    }

    private fun translate(text: String) {
        val targetCode = translator.targetCode()
        // First-time model download over a slow link can take a few seconds.
        binding.translatedText.text = getString(R.string.translating)
        translator.translateAuto(
            text = text,
            onResult = { sourceCode, translated ->
                runOnUiThread {
                    binding.translatedText.text = translated
                    binding.directionText.text =
                        "${sourceCode.uppercase()} → ${targetCode.uppercase()}"
                    binding.directionText.visibility = View.VISIBLE
                    if (settings.speakTranslation) speaker?.speak(translated, targetCode)
                }
            },
            onError = { e -> runOnUiThread { toast(getString(R.string.error_translate, e.message)) } }
        )
    }

    private fun launchOverlay() {
        if (CaptionOverlayService.isRunning) {
            CaptionOverlayService.stop(this)
            updateOverlayButtonLabel()
            toast(getString(R.string.overlay_stopped))
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            toast(getString(R.string.overlay_need_permission))
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
            )
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            requestAudioPermission.launch(Manifest.permission.RECORD_AUDIO)
            return
        }
        // Stop in-app listening so the two engines don't fight over the mic.
        if (isListening) stopListening()
        CaptionOverlayService.start(this)
        binding.overlayButton.text = getString(R.string.overlay_button_stop)
        toast(getString(R.string.overlay_started))
    }

    override fun onDestroy() {
        engine?.destroy()
        translator.close()
        speaker?.shutdown()
        super.onDestroy()
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
