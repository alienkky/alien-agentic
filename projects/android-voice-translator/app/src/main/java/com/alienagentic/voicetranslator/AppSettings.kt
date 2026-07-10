package com.alienagentic.voicetranslator

import android.content.Context

/** Simple SharedPreferences-backed settings shared by the activity and the overlay service. */
class AppSettings(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences("vt_prefs", Context.MODE_PRIVATE)

    /** false = on-device recognizer (offline), true = cloud Whisper. */
    var useCloud: Boolean
        get() = prefs.getBoolean(KEY_USE_CLOUD, false)
        set(v) = prefs.edit().putBoolean(KEY_USE_CLOUD, v).apply()

    var whisperBaseUrl: String
        get() = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(v) = prefs.edit().putString(KEY_BASE_URL, v).apply()

    var whisperApiKey: String
        get() = prefs.getString(KEY_API_KEY, "") ?: ""
        set(v) = prefs.edit().putString(KEY_API_KEY, v).apply()

    var whisperModel: String
        get() = prefs.getString(KEY_MODEL, DEFAULT_MODEL) ?: DEFAULT_MODEL
        set(v) = prefs.edit().putString(KEY_MODEL, v).apply()

    /** Speak the translated text aloud via TTS. */
    var speakTranslation: Boolean
        get() = prefs.getBoolean(KEY_SPEAK, false)
        set(v) = prefs.edit().putBoolean(KEY_SPEAK, v).apply()

    /** BCP-47 tag of the language the recognizer listens for. */
    var listenLocale: String
        get() = prefs.getString(KEY_LOCALE, "ja-JP") ?: "ja-JP"
        set(v) = prefs.edit().putString(KEY_LOCALE, v).apply()

    /** Short code of the language to translate into ("ko"/"en"/"ja"). */
    var targetLanguage: String
        get() = prefs.getString(KEY_TARGET, "ko") ?: "ko"
        set(v) = prefs.edit().putString(KEY_TARGET, v).apply()

    /** Overlay translated-caption font size in sp. */
    var overlayFontSize: Int
        get() = prefs.getInt(KEY_FONT, DEFAULT_FONT).coerceIn(MIN_FONT, MAX_FONT)
        set(v) = prefs.edit().putInt(KEY_FONT, v.coerceIn(MIN_FONT, MAX_FONT)).apply()

    /** Overlay background opacity, 20–100 (%). */
    var overlayOpacity: Int
        get() = prefs.getInt(KEY_OPACITY, DEFAULT_OPACITY).coerceIn(MIN_OPACITY, MAX_OPACITY)
        set(v) = prefs.edit().putInt(KEY_OPACITY, v.coerceIn(MIN_OPACITY, MAX_OPACITY)).apply()

    /** True only if cloud mode is selected AND a key is present. */
    fun cloudReady(): Boolean = useCloud && whisperApiKey.isNotBlank()

    companion object {
        const val DEFAULT_BASE_URL = "https://api.openai.com/v1"
        const val DEFAULT_MODEL = "whisper-1"

        const val MIN_FONT = 16
        const val MAX_FONT = 48
        const val DEFAULT_FONT = 26
        const val MIN_OPACITY = 20
        const val MAX_OPACITY = 100
        const val DEFAULT_OPACITY = 80

        private const val KEY_USE_CLOUD = "use_cloud"
        private const val KEY_BASE_URL = "whisper_base_url"
        private const val KEY_API_KEY = "whisper_api_key"
        private const val KEY_MODEL = "whisper_model"
        private const val KEY_SPEAK = "speak_translation"
        private const val KEY_LOCALE = "listen_locale"
        private const val KEY_TARGET = "target_language"
        private const val KEY_FONT = "overlay_font_size"
        private const val KEY_OPACITY = "overlay_opacity"
    }
}
