package com.alienagentic.voicetranslator

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.alienagentic.voicetranslator.databinding.ActivitySettingsBinding

/**
 * Lets the user pick the recognition engine (offline on-device vs cloud
 * Whisper), enter Whisper API details, and toggle spoken translation.
 * Everything persists via [AppSettings].
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var settings: AppSettings

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        settings = AppSettings(this)

        binding.cloudSwitch.isChecked = settings.useCloud
        binding.speakSwitch.isChecked = settings.speakTranslation
        binding.baseUrlInput.setText(settings.whisperBaseUrl)
        binding.apiKeyInput.setText(settings.whisperApiKey)
        binding.modelInput.setText(settings.whisperModel)
        updateCloudFieldsEnabled(settings.useCloud)

        binding.cloudSwitch.setOnCheckedChangeListener { _, checked ->
            updateCloudFieldsEnabled(checked)
        }

        binding.saveButton.setOnClickListener {
            settings.useCloud = binding.cloudSwitch.isChecked
            settings.speakTranslation = binding.speakSwitch.isChecked
            settings.whisperBaseUrl = binding.baseUrlInput.text.toString().trim()
                .ifBlank { AppSettings.DEFAULT_BASE_URL }
            settings.whisperApiKey = binding.apiKeyInput.text.toString().trim()
            settings.whisperModel = binding.modelInput.text.toString().trim()
                .ifBlank { AppSettings.DEFAULT_MODEL }
            finish()
        }
    }

    private fun updateCloudFieldsEnabled(enabled: Boolean) {
        binding.baseUrlInput.isEnabled = enabled
        binding.apiKeyInput.isEnabled = enabled
        binding.modelInput.isEnabled = enabled
    }
}
