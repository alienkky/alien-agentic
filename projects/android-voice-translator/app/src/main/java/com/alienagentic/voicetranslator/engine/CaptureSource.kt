package com.alienagentic.voicetranslator.engine

import android.media.projection.MediaProjection

/** Where [WhisperSpeechEngine] reads audio from. */
sealed class CaptureSource {
    /** The device microphone. */
    object Microphone : CaptureSource()

    /**
     * The phone's own playback audio (other apps' sound) via AudioPlaybackCapture.
     * Requires Android 10+ and a user-granted [MediaProjection]. Note that apps
     * can opt out of capture (many DRM/streaming apps do).
     */
    class Internal(val projection: MediaProjection) : CaptureSource()
}
