package com.alienagentic.voicetranslator

import android.os.Bundle
import android.widget.SeekBar
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

        when (settings.targetLanguage) {
            "en" -> binding.targetEn.isChecked = true
            "ja" -> binding.targetJa.isChecked = true
            else -> binding.targetKo.isChecked = true
        }
        binding.cloudSwitch.isChecked = settings.useCloud
        binding.speakSwitch.isChecked = settings.speakTranslation
        binding.baseUrlInput.setText(settings.whisperBaseUrl)
        binding.apiKeyInput.setText(settings.whisperApiKey)
        binding.modelInput.setText(settings.whisperModel)
        updateCloudFieldsEnabled(settings.useCloud)

        binding.cloudSwitch.setOnCheckedChangeListener { _, checked ->
            updateCloudFieldsEnabled(checked)
        }

        // Font size slider (sp), mapped onto a 0-based SeekBar.
        binding.fontSeek.max = AppSettings.MAX_FONT - AppSettings.MIN_FONT
        binding.fontSeek.progress = settings.overlayFontSize - AppSettings.MIN_FONT
        updateFontLabel(settings.overlayFontSize)
        binding.fontSeek.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar?, p: Int, fromUser: Boolean) {
                updateFontLabel(AppSettings.MIN_FONT + p)
            }
            override fun onStartTrackingTouch(sb: SeekBar?) {}
            override fun onStopTrackingTouch(sb: SeekBar?) {}
        })

        // Background opacity slider (%), mapped onto a 0-based SeekBar.
        binding.opacitySeek.max = AppSettings.MAX_OPACITY - AppSettings.MIN_OPACITY
        binding.opacitySeek.progress = settings.overlayOpacity - AppSettings.MIN_OPACITY
        updateOpacityLabel(settings.overlayOpacity)
        binding.opacitySeek.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar?, p: Int, fromUser: Boolean) {
                updateOpacityLabel(AppSettings.MIN_OPACITY + p)
            }
            override fun onStartTrackingTouch(sb: SeekBar?) {}
            override fun onStopTrackingTouch(sb: SeekBar?) {}
        })

        binding.saveButton.setOnClickListener {
            settings.targetLanguage = when (binding.targetGroup.checkedRadioButtonId) {
                R.id.targetEn -> "en"
                R.id.targetJa -> "ja"
                else -> "ko"
            }
            settings.useCloud = binding.cloudSwitch.isChecked
            settings.speakTranslation = binding.speakSwitch.isChecked
            settings.whisperBaseUrl = binding.baseUrlInput.text.toString().trim()
                .ifBlank { AppSettings.DEFAULT_BASE_URL }
            settings.whisperApiKey = binding.apiKeyInput.text.toString().trim()
            settings.whisperModel = binding.modelInput.text.toString().trim()
                .ifBlank { AppSettings.DEFAULT_MODEL }
            settings.overlayFontSize = AppSettings.MIN_FONT + binding.fontSeek.progress
            settings.overlayOpacity = AppSettings.MIN_OPACITY + binding.opacitySeek.progress
            finish()
        }
    }

    private fun updateFontLabel(size: Int) {
        binding.fontValue.text = getString(R.string.settings_font_value, size)
    }

    private fun updateOpacityLabel(opacity: Int) {
        binding.opacityValue.text = getString(R.string.settings_opacity_value, opacity)
    }

    private fun updateCloudFieldsEnabled(enabled: Boolean) {
        binding.baseUrlInput.isEnabled = enabled
        binding.apiKeyInput.isEnabled = enabled
        binding.modelInput.isEnabled = enabled
    }
}
