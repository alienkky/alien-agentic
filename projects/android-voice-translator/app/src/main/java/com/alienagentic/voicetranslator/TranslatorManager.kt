package com.alienagentic.voicetranslator

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions

/**
 * On-device translation that detects the spoken language and translates it into
 * a configurable *target* language (Korean / English / Japanese).
 *
 * Translators are created and cached per source→target pair, and their models
 * download once then run fully offline.
 */
class TranslatorManager {

    private val translators = HashMap<String, Translator>()
    // Source→target pairs whose model is confirmed downloaded.
    private val readyPairs = HashSet<String>()
    private val languageIdentifier = LanguageIdentification.getClient()

    @Volatile private var target: String = TranslateLanguage.KOREAN
    // Used when language identification is uncertain (e.g. short utterances).
    @Volatile private var fallbackSource: String = TranslateLanguage.JAPANESE

    /** @param tag a BCP-47 tag or short code, e.g. "ko", "en", "ja-JP". */
    fun setTarget(tag: String) {
        toTranslate(tag)?.let { target = it }
    }

    /** Source language assumed when detection fails. Follows the listen locale. */
    fun setFallbackSource(localeTag: String) {
        toTranslate(localeTag)?.let { fallbackSource = it }
    }

    /** Short code ("ja"/"en"/"ko") of the current target, for UI labels. */
    fun targetCode(): String = shortCode(target)

    /**
     * Ensures the most likely model (fallback source → target) is present.
     * If source and target are the same there is nothing to download.
     */
    fun prepareModels(
        requireWifi: Boolean,
        onReady: () -> Unit,
        onError: (Exception) -> Unit
    ) {
        if (fallbackSource == target) {
            onReady()
            return
        }
        val conditions = DownloadConditions.Builder().apply {
            if (requireWifi) requireWifi()
        }.build()
        getOrCreate(fallbackSource, target).downloadModelIfNeeded(conditions)
            .addOnSuccessListener {
                readyPairs.add("$fallbackSource->$target")
                onReady()
            }
            .addOnFailureListener { e -> onError(e) }
    }

    /**
     * Identifies [text]'s language and translates it into the current target.
     * Unrecognized input falls back to [fallbackSource]. If the source already
     * equals the target, the original text is passed through unchanged.
     *
     * @param onResult receives the detected source short code and the translation.
     */
    fun translateAuto(
        text: String,
        onResult: (sourceCode: String, translated: String) -> Unit,
        onError: (Exception) -> Unit
    ) {
        if (text.isBlank()) return

        languageIdentifier.identifyLanguage(text)
            .addOnSuccessListener { code ->
                val source = toTranslate(code) ?: fallbackSource
                runTranslation(source, text, onResult, onError)
            }
            .addOnFailureListener {
                // Identification failed — assume the configured source.
                runTranslation(fallbackSource, text, onResult, onError)
            }
    }

    private fun runTranslation(
        source: String,
        text: String,
        onResult: (String, String) -> Unit,
        onError: (Exception) -> Unit
    ) {
        if (source == target) {
            onResult(shortCode(source), text)
            return
        }
        val key = "$source->$target"
        val translator = getOrCreate(source, target)

        // Once a model is confirmed present, skip the download check on every
        // utterance and translate straight away — saves an async hop per phrase.
        if (key in readyPairs) {
            translator.translate(text)
                .addOnSuccessListener { out -> onResult(shortCode(source), out) }
                .addOnFailureListener { e -> onError(e) }
            return
        }

        val conditions = DownloadConditions.Builder().build()
        translator.downloadModelIfNeeded(conditions)
            .addOnSuccessListener {
                readyPairs.add(key)
                translator.translate(text)
                    .addOnSuccessListener { out -> onResult(shortCode(source), out) }
                    .addOnFailureListener { e -> onError(e) }
            }
            .addOnFailureListener { e -> onError(e) }
    }

    private fun getOrCreate(source: String, tgt: String): Translator {
        return translators.getOrPut("$source->$tgt") {
            Translation.getClient(
                TranslatorOptions.Builder()
                    .setSourceLanguage(source)
                    .setTargetLanguage(tgt)
                    .build()
            )
        }
    }

    private fun toTranslate(tag: String): String? = when {
        tag.startsWith("ja") -> TranslateLanguage.JAPANESE
        tag.startsWith("en") -> TranslateLanguage.ENGLISH
        tag.startsWith("ko") -> TranslateLanguage.KOREAN
        else -> null
    }

    private fun shortCode(translateLang: String): String = when (translateLang) {
        TranslateLanguage.JAPANESE -> "ja"
        TranslateLanguage.ENGLISH -> "en"
        TranslateLanguage.KOREAN -> "ko"
        else -> translateLang
    }

    fun close() {
        translators.values.forEach { it.close() }
        translators.clear()
        readyPairs.clear()
        languageIdentifier.close()
    }
}
