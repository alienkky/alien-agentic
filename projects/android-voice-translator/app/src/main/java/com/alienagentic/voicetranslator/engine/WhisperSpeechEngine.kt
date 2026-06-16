package com.alienagentic.voicetranslator.engine

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.abs

/**
 * Cloud speech recognition via a Whisper-compatible transcription API
 * (OpenAI `/v1/audio/transcriptions` shape).
 *
 * Records 16 kHz mono PCM, uses a simple energy-based voice-activity detector to
 * cut utterances at pauses, wraps each utterance as a WAV, and POSTs it. Higher
 * accuracy than the on-device engine but needs network and an API key.
 *
 * The audio can come from the microphone or, via [CaptureSource.Internal], from
 * the phone's own playback (other apps' sound) using AudioPlaybackCapture.
 */
class WhisperSpeechEngine(
    private val baseUrl: String,
    private val apiKey: String,
    private val model: String,
    private val source: CaptureSource = CaptureSource.Microphone
) : SpeechEngine {

    override var onPartial: (String) -> Unit = {}
    override var onFinal: (String) -> Unit = {}
    override var onError: (String) -> Unit = {}

    private val mainHandler = Handler(Looper.getMainLooper())
    // Single worker so network round-trips never block audio capture, while
    // keeping transcription results in spoken order.
    private val httpExecutor = Executors.newSingleThreadExecutor()

    @Volatile private var running = false
    private var captureThread: Thread? = null
    private var languageHint: String? = "ja"

    companion object {
        private const val SAMPLE_RATE = 16_000
        private const val FRAME_SAMPLES = 1_600          // 100 ms frames
        private const val VOICE_AMPLITUDE = 1_500         // |sample| above this = voiced
        private const val SILENCE_FRAMES_TO_CUT = 5       // ~500 ms pause ends an utterance
        private const val MIN_UTTERANCE_FRAMES = 3        // ignore <300 ms blips
        private const val MAX_UTTERANCE_FRAMES = 60       // force-cut long speech every ~6 s
        private const val CHUNK_FRAMES = 40               // internal audio: send every ~4 s
        private const val INTERNAL_SOUND_FLOOR = 250      // skip near-silent chunks
    }

    @SuppressLint("MissingPermission", "NewApi") // RECORD_AUDIO checked by caller; Internal gated to API 29+.
    private fun buildRecorder(bufferSize: Int): AudioRecord = when (val s = source) {
        is CaptureSource.Internal -> {
            val format = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                .build()
            val config = AudioPlaybackCaptureConfiguration.Builder(s.projection)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()
            AudioRecord.Builder()
                .setAudioFormat(format)
                .setBufferSizeInBytes(bufferSize)
                .setAudioPlaybackCaptureConfig(config)
                .build()
        }
        CaptureSource.Microphone -> AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            bufferSize
        )
    }

    override fun setLanguage(localeTag: String) {
        languageHint = when {
            localeTag.startsWith("ja") -> "ja"
            localeTag.startsWith("en") -> "en"
            else -> null
        }
    }

    @SuppressLint("MissingPermission") // RECORD_AUDIO is checked by the caller before start().
    override fun start() {
        if (running) return
        running = true
        captureThread = Thread { captureLoop() }.apply { start() }
    }

    override fun stop() {
        running = false
        captureThread?.join(1_000)
        captureThread = null
    }

    override fun destroy() {
        stop()
        httpExecutor.shutdown()
    }

    @SuppressLint("MissingPermission")
    private fun captureLoop() {
        val minBuffer = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBuffer <= 0) {
            postError("오디오 입력을 초기화할 수 없습니다")
            return
        }

        val recorder = try {
            buildRecorder(maxOf(minBuffer, FRAME_SAMPLES * 2 * 4))
        } catch (e: Exception) {
            postError("오디오 캡처 초기화 실패: ${e.message}")
            return
        }
        if (recorder.state != AudioRecord.STATE_INITIALIZED) {
            recorder.release()
            postError("오디오 입력을 열 수 없습니다")
            return
        }

        try {
            recorder.startRecording()
            if (source is CaptureSource.Internal) {
                // Media/internal audio rarely has clean pauses → fixed-interval send.
                chunkedCaptureLoop(recorder)
            } else {
                vadCaptureLoop(recorder)
            }
        } catch (e: Exception) {
            postError("녹음 오류: ${e.message}")
        } finally {
            try {
                recorder.stop()
            } catch (_: Exception) {
            }
            recorder.release()
        }
    }

    /** Speech from the mic: cut utterances at ~0.5 s pauses. */
    private fun vadCaptureLoop(recorder: AudioRecord) {
        val frame = ShortArray(FRAME_SAMPLES)
        val utterance = ByteArrayOutputStream()
        var voicedFrames = 0
        var silenceFrames = 0
        while (running) {
            val read = recorder.read(frame, 0, frame.size)
            if (read <= 0) continue

            val voiced = isVoiced(frame, read)
            if (voiced) {
                silenceFrames = 0
                voicedFrames++
                appendPcm(utterance, frame, read)
                if (voicedFrames >= MAX_UTTERANCE_FRAMES) {
                    flush(utterance.toByteArray())
                    utterance.reset()
                    voicedFrames = 0
                    silenceFrames = 0
                }
            } else if (voicedFrames > 0) {
                silenceFrames++
                appendPcm(utterance, frame, read)
                if (silenceFrames >= SILENCE_FRAMES_TO_CUT) {
                    if (voicedFrames >= MIN_UTTERANCE_FRAMES) {
                        flush(utterance.toByteArray())
                    }
                    utterance.reset()
                    voicedFrames = 0
                    silenceFrames = 0
                }
            }
        }
    }

    /**
     * Internal/media audio: accumulate and flush every [CHUNK_FRAMES] (~4 s),
     * skipping only chunks that are essentially silent. This guarantees regular
     * transcription even when there are no clear speech pauses (BGM, etc.).
     */
    private fun chunkedCaptureLoop(recorder: AudioRecord) {
        val frame = ShortArray(FRAME_SAMPLES)
        val chunk = ByteArrayOutputStream()
        var frames = 0
        var hasSound = false
        while (running) {
            val read = recorder.read(frame, 0, frame.size)
            if (read <= 0) continue
            appendPcm(chunk, frame, read)
            frames++
            if (peakAmplitude(frame, read) >= INTERNAL_SOUND_FLOOR) hasSound = true
            if (frames >= CHUNK_FRAMES) {
                if (hasSound) flush(chunk.toByteArray())
                chunk.reset()
                frames = 0
                hasSound = false
            }
        }
    }

    private fun isVoiced(frame: ShortArray, count: Int): Boolean =
        peakAmplitude(frame, count) >= VOICE_AMPLITUDE

    private fun peakAmplitude(frame: ShortArray, count: Int): Int {
        var peak = 0
        for (i in 0 until count) {
            val a = abs(frame[i].toInt())
            if (a > peak) peak = a
        }
        return peak
    }

    private fun appendPcm(out: ByteArrayOutputStream, frame: ShortArray, count: Int) {
        for (i in 0 until count) {
            val s = frame[i].toInt()
            out.write(s and 0xFF)
            out.write((s shr 8) and 0xFF)
        }
    }

    /**
     * Queues one utterance for transcription on the worker thread so the capture
     * loop keeps reading the mic during the network round-trip (no dropped audio).
     */
    private fun flush(pcm: ByteArray) {
        if (httpExecutor.isShutdown) return
        httpExecutor.execute {
            val wav = wrapWav(pcm)
            try {
                val text = transcribe(wav)
                if (text.isNotBlank()) mainHandler.post { onFinal(text) }
            } catch (e: Exception) {
                postError("전사 실패: ${e.message}")
            }
        }
    }

    private fun transcribe(wav: ByteArray): String {
        val endpoint = baseUrl.trimEnd('/') + "/audio/transcriptions"
        val boundary = "----vtBoundary" + System.currentTimeMillis()
        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 15_000
            readTimeout = 30_000
            setRequestProperty("Authorization", "Bearer $apiKey")
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
        }

        DataOutputStream(conn.outputStream).use { out ->
            writeField(out, boundary, "model", model)
            languageHint?.let { writeField(out, boundary, "language", it) }
            writeField(out, boundary, "response_format", "json")
            writeFilePart(out, boundary, "file", "audio.wav", "audio/wav", wav)
            out.writeBytes("--$boundary--\r\n")
            out.flush()
        }

        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
        conn.disconnect()

        if (code !in 200..299) {
            throw RuntimeException("HTTP $code: ${body.take(200)}")
        }
        return JSONObject(body).optString("text").trim()
    }

    private fun writeField(out: DataOutputStream, boundary: String, name: String, value: String) {
        out.writeBytes("--$boundary\r\n")
        out.writeBytes("Content-Disposition: form-data; name=\"$name\"\r\n\r\n")
        out.write(value.toByteArray(Charsets.UTF_8))
        out.writeBytes("\r\n")
    }

    private fun writeFilePart(
        out: DataOutputStream,
        boundary: String,
        name: String,
        filename: String,
        contentType: String,
        bytes: ByteArray
    ) {
        out.writeBytes("--$boundary\r\n")
        out.writeBytes("Content-Disposition: form-data; name=\"$name\"; filename=\"$filename\"\r\n")
        out.writeBytes("Content-Type: $contentType\r\n\r\n")
        out.write(bytes)
        out.writeBytes("\r\n")
    }

    /** Prepend a 44-byte PCM WAV header (16 kHz, mono, 16-bit) to raw samples. */
    private fun wrapWav(pcm: ByteArray): ByteArray {
        val channels = 1
        val bitsPerSample = 16
        val byteRate = SAMPLE_RATE * channels * bitsPerSample / 8
        val dataLen = pcm.size
        val totalLen = dataLen + 36

        val header = ByteArrayOutputStream(44)
        fun str(s: String) = header.write(s.toByteArray(Charsets.US_ASCII))
        fun le32(v: Int) {
            header.write(v and 0xFF)
            header.write((v shr 8) and 0xFF)
            header.write((v shr 16) and 0xFF)
            header.write((v shr 24) and 0xFF)
        }
        fun le16(v: Int) {
            header.write(v and 0xFF)
            header.write((v shr 8) and 0xFF)
        }

        str("RIFF"); le32(totalLen); str("WAVE")
        str("fmt "); le32(16); le16(1); le16(channels)
        le32(SAMPLE_RATE); le32(byteRate)
        le16(channels * bitsPerSample / 8); le16(bitsPerSample)
        str("data"); le32(dataLen)

        return header.toByteArray() + pcm
    }

    private fun postError(msg: String) {
        mainHandler.post { onError(msg) }
    }
}
