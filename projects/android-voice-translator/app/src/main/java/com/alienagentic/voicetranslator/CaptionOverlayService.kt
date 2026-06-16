package com.alienagentic.voicetranslator

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.content.IntentCompat
import com.alienagentic.voicetranslator.engine.CaptureSource
import com.alienagentic.voicetranslator.engine.SpeechEngine
import com.alienagentic.voicetranslator.engine.WhisperSpeechEngine

/**
 * Foreground service that shows live translation captions floating on top of
 * other apps. Reuses the same [SpeechEngine] + [TranslatorManager] pipeline as
 * the main screen. The caption bubble is draggable.
 */
class CaptionOverlayService : Service() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val translator = TranslatorManager()
    private val settings by lazy { AppSettings(this) }
    private var speaker: Speaker? = null
    private var engine: SpeechEngine? = null

    private var windowManager: WindowManager? = null
    private var overlay: View? = null
    private var sourceView: TextView? = null
    private var translatedView: TextView? = null
    private var mediaProjection: MediaProjection? = null

    companion object {
        private const val CHANNEL_ID = "vt_overlay"
        private const val NOTIFICATION_ID = 42
        private const val ACTION_STOP = "com.alienagentic.voicetranslator.STOP_OVERLAY"
        private const val EXTRA_RESULT_CODE = "result_code"
        private const val EXTRA_DATA = "result_data"

        /** True while the overlay is showing, so the UI can offer a stop toggle. */
        @Volatile
        var isRunning = false
            private set

        /** Mic-based overlay captions. */
        fun start(context: Context) {
            launch(context, Intent(context, CaptionOverlayService::class.java))
        }

        /** Internal-audio (phone playback) captions via a granted MediaProjection. */
        fun startInternal(context: Context, resultCode: Int, data: Intent) {
            val intent = Intent(context, CaptionOverlayService::class.java)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_DATA, data)
            launch(context, intent)
        }

        private fun launch(context: Context, intent: Intent) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.startService(
                Intent(context, CaptionOverlayService::class.java).setAction(ACTION_STOP)
            )
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
        val data = intent?.let { IntentCompat.getParcelableExtra(it, EXTRA_DATA, Intent::class.java) }
        val internal = resultCode != 0 && data != null &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

        if (internal && settings.whisperApiKey.isBlank()) {
            Toast.makeText(this, getString(R.string.internal_needs_cloud), Toast.LENGTH_LONG).show()
            stopSelf()
            return START_NOT_STICKY
        }

        val fgType = if (internal) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        } else {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        }
        startInForeground(fgType)

        if (internal) {
            val mpm = getSystemService(MediaProjectionManager::class.java)
            mediaProjection = mpm.getMediaProjection(resultCode, data!!)
            if (mediaProjection == null) {
                Toast.makeText(this, getString(R.string.internal_failed), Toast.LENGTH_LONG).show()
                stopSelf()
                return START_NOT_STICKY
            }
            mediaProjection!!.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() = stopSelf()
            }, mainHandler)
        }

        addOverlay()
        speaker = Speaker(this)
        prepareAndListen(internal)
        isRunning = true
        // Don't resurrect the overlay if the system kills the service.
        return START_NOT_STICKY
    }

    /** Called when the user swipes the app away from recents — stop everything. */
    override fun onTaskRemoved(rootIntent: Intent?) {
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    private fun startInForeground(foregroundType: Int) {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.overlay_channel_name),
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(channel)
        }

        val stopIntent = PendingIntent.getService(
            this, 0,
            Intent(this, CaptionOverlayService::class.java).setAction(ACTION_STOP),
            pendingFlags()
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.overlay_notification_title))
            .setContentText(getString(R.string.overlay_notification_text))
            .setSmallIcon(R.drawable.ic_launcher)
            .addAction(0, getString(R.string.stop), stopIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, foregroundType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun pendingFlags(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
    }

    private fun makeHeaderButton(label: String, onClick: () -> Unit): TextView =
        TextView(this).apply {
            text = label
            setTextColor(Color.parseColor("#5BC8FF"))
            textSize = 16f
            setPadding(24, 8, 24, 16)
            isClickable = true
            setOnClickListener { onClick() }
        }

    /** Dark caption background with the configured opacity (20–100%). */
    private fun backgroundColorFor(opacityPercent: Int): Int {
        val alpha = opacityPercent.coerceIn(0, 100) * 255 / 100
        return Color.argb(alpha, 0x0B, 0x0E, 0x14)
    }

    private fun sourceSizeFor(font: Int): Float = (font * 0.62f).coerceAtLeast(12f)

    /** Live-adjust caption font size and persist it. */
    private fun adjustFontSize(delta: Int) {
        val newSize = (settings.overlayFontSize + delta)
            .coerceIn(AppSettings.MIN_FONT, AppSettings.MAX_FONT)
        settings.overlayFontSize = newSize
        translatedView?.textSize = newSize.toFloat()
        sourceView?.textSize = sourceSizeFor(newSize)
    }

    private fun addOverlay() {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager = wm

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(backgroundColorFor(settings.overlayOpacity))
            setPadding(36, 12, 36, 28)
        }

        // Header row: A- / A+ live-resize the caption; ✕ closes the overlay.
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(makeHeaderButton("A−") { adjustFontSize(-2) })
        header.addView(makeHeaderButton("A+") { adjustFontSize(+2) })
        header.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f)) // spacer
        header.addView(makeHeaderButton(getString(R.string.overlay_close)) { stopSelf() })
        container.addView(
            header,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val font = settings.overlayFontSize
        val src = TextView(this).apply {
            setTextColor(Color.parseColor("#8B93A7"))
            textSize = sourceSizeFor(font)
            text = getString(R.string.hint_source)
        }
        val dst = TextView(this).apply {
            setTextColor(Color.parseColor("#F2F5FA"))
            textSize = font.toFloat()
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            text = getString(R.string.hint_translated)
        }
        container.addView(src)
        container.addView(dst)
        sourceView = src
        translatedView = dst

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = 120
        }

        enableDrag(container, params, wm)
        wm.addView(container, params)
        overlay = container
    }

    private var touchStartX = 0f
    private var touchStartY = 0f
    private var viewStartY = 0

    private fun enableDrag(
        view: View,
        params: WindowManager.LayoutParams,
        wm: WindowManager
    ) {
        view.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    touchStartX = event.rawX
                    touchStartY = event.rawY
                    viewStartY = params.y
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.y = viewStartY + (event.rawY - touchStartY).toInt()
                    wm.updateViewLayout(view, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    v.performClick()
                    true
                }
                else -> false
            }
        }
    }

    private fun prepareAndListen(internal: Boolean) {
        translator.setTarget(settings.targetLanguage)
        translator.setFallbackSource(settings.listenLocale)
        // Start listening immediately; the translation model is fetched on demand.
        startEngine(internal)
        translator.prepareModels(requireWifi = false, onReady = { }, onError = { })
    }

    private fun startEngine(internal: Boolean) {
        val projection = mediaProjection
        val e = if (internal && projection != null) {
            WhisperSpeechEngine(
                baseUrl = settings.whisperBaseUrl,
                apiKey = settings.whisperApiKey,
                model = settings.whisperModel,
                source = CaptureSource.Internal(projection)
            ).also { it.setLanguage(settings.listenLocale) }
        } else {
            EngineFactory.create(this, settings)
        }
        if (internal) {
            mainHandler.post { sourceView?.text = getString(R.string.internal_listening) }
        }
        e.onPartial = { text -> mainHandler.post { sourceView?.text = text } }
        e.onFinal = { text ->
            mainHandler.post { sourceView?.text = text }
            translate(text)
        }
        // Surface errors on-screen so problems (e.g. bad API key, blocked
        // capture) are visible instead of failing silently.
        e.onError = { msg -> mainHandler.post { translatedView?.text = msg } }
        engine = e
        e.start()
    }

    private fun translate(text: String) {
        val targetCode = translator.targetCode()
        translator.translateAuto(
            text = text,
            onResult = { _, translated ->
                mainHandler.post {
                    translatedView?.text = translated
                    if (settings.speakTranslation) speaker?.speak(translated, targetCode)
                }
            },
            onError = { e -> mainHandler.post { translatedView?.text = "번역 오류: ${e.message}" } }
        )
    }

    override fun onDestroy() {
        isRunning = false
        engine?.destroy()
        translator.close()
        speaker?.shutdown()
        mediaProjection?.stop()
        mediaProjection = null
        overlay?.let { windowManager?.removeView(it) }
        overlay = null
        super.onDestroy()
    }
}
