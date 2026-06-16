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
import androidx.core.app.NotificationCompat
import com.alienagentic.voicetranslator.engine.SpeechEngine

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

    private var modelsReady = false

    companion object {
        private const val CHANNEL_ID = "vt_overlay"
        private const val NOTIFICATION_ID = 42
        private const val ACTION_STOP = "com.alienagentic.voicetranslator.STOP_OVERLAY"

        fun start(context: Context) {
            val intent = Intent(context, CaptionOverlayService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        startInForeground()
        addOverlay()
        speaker = Speaker(this)
        prepareAndListen()
        return START_STICKY
    }

    private fun startInForeground() {
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
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
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

    private fun addOverlay() {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager = wm

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#CC0B0E14"))
            setPadding(36, 28, 36, 28)
        }
        val src = TextView(this).apply {
            setTextColor(Color.parseColor("#8B93A7"))
            textSize = 16f
            text = getString(R.string.hint_source)
        }
        val dst = TextView(this).apply {
            setTextColor(Color.parseColor("#F2F5FA"))
            textSize = 26f
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

    private fun prepareAndListen() {
        translator.setTarget(settings.targetLanguage)
        translator.setFallbackSource(settings.listenLocale)
        translator.prepareModels(
            requireWifi = false,
            onReady = {
                modelsReady = true
                startEngine()
            },
            onError = { startEngine() } // recognition can still run; translation may fail gracefully
        )
    }

    private fun startEngine() {
        val e = EngineFactory.create(this, settings)
        e.onPartial = { text -> mainHandler.post { sourceView?.text = text } }
        e.onFinal = { text ->
            mainHandler.post { sourceView?.text = text }
            translate(text)
        }
        e.onError = { /* keep captions running; transient errors self-recover */ }
        engine = e
        e.start()
    }

    private fun translate(text: String) {
        if (!modelsReady) return
        val targetCode = translator.targetCode()
        translator.translateAuto(
            text = text,
            onResult = { _, translated ->
                mainHandler.post {
                    translatedView?.text = translated
                    if (settings.speakTranslation) speaker?.speak(translated, targetCode)
                }
            },
            onError = { }
        )
    }

    override fun onDestroy() {
        engine?.destroy()
        translator.close()
        speaker?.shutdown()
        overlay?.let { windowManager?.removeView(it) }
        overlay = null
        super.onDestroy()
    }
}
