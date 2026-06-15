package com.alienagentic.voicetranslator

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions

/**
 * Wraps on-device ML Kit translation for the Japanese <-> English pair plus a
 * language identifier so the translation direction can follow whatever language
 * was actually spoken. Models are downloaded once and then run fully offline.
 */
class TranslatorManager {

    private val jaToEn: Translator = Translation.getClient(
        TranslatorOptions.Builder()
            .setSourceLanguage(TranslateLanguage.JAPANESE)
            .setTargetLanguage(TranslateLanguage.ENGLISH)
            .build()
    )

    private val enToJa: Translator = Translation.getClient(
        TranslatorOptions.Builder()
            .setSourceLanguage(TranslateLanguage.ENGLISH)
            .setTargetLanguage(TranslateLanguage.JAPANESE)
            .build()
    )

    private val languageIdentifier = LanguageIdentification.getClient()

    /**
     * Ensures both translation models are present on the device.
     * [requireWifi] keeps the (one-time) download off metered connections.
     */
    fun prepareModels(
        requireWifi: Boolean,
        onReady: () -> Unit,
        onError: (Exception) -> Unit
    ) {
        val conditions = DownloadConditions.Builder().apply {
            if (requireWifi) requireWifi()
        }.build()

        jaToEn.downloadModelIfNeeded(conditions)
            .addOnSuccessListener {
                enToJa.downloadModelIfNeeded(conditions)
                    .addOnSuccessListener { onReady() }
                    .addOnFailureListener { e -> onError(e) }
            }
            .addOnFailureListener { e -> onError(e) }
    }

    /**
     * Identifies the language of [text] and translates it into the other half of
     * the Japanese/English pair. Anything that is not detected as Japanese is
     * treated as English so mixed or uncertain input still produces output.
     */
    fun translateAuto(
        text: String,
        onResult: (detectedJapanese: Boolean, translated: String) -> Unit,
        onError: (Exception) -> Unit
    ) {
        if (text.isBlank()) return

        languageIdentifier.identifyLanguage(text)
            .addOnSuccessListener { code ->
                val isJapanese = code == "ja"
                val translator = if (isJapanese) jaToEn else enToJa
                translator.translate(text)
                    .addOnSuccessListener { out -> onResult(isJapanese, out) }
                    .addOnFailureListener { e -> onError(e) }
            }
            .addOnFailureListener { e -> onError(e) }
    }

    /** Release native resources held by the translators. */
    fun close() {
        jaToEn.close()
        enToJa.close()
        languageIdentifier.close()
    }
}
