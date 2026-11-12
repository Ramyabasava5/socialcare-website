package com.socialcare.tracker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class UsageTrackingService : Service() {
    private val executor = Executors.newSingleThreadExecutor()
    private val prefs by lazy { getSharedPreferences("tracker", MODE_PRIVATE) }
    private var screenOn = false
    private var screenOnStartedAt = 0L
    private var sentMinutes = 0L
    private val apiUrl = "http://10.0.2.2:5000/api/mobile/device" // Android emulator -> computer localhost

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_ON -> startScreenSession()
                Intent.ACTION_SCREEN_OFF -> endScreenSession()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(1001, notification("SocialCare tracker is running"))
        val filter = IntentFilter().apply { addAction(Intent.ACTION_SCREEN_ON); addAction(Intent.ACTION_SCREEN_OFF) }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenReceiver, filter, RECEIVER_NOT_EXPORTED) else registerReceiver(screenReceiver, filter)
        screenOn = (getSystemService(POWER_SERVICE) as PowerManager).isInteractive
        if (screenOn) startScreenSession()
        Thread { while (!Thread.currentThread().isInterrupted) { Thread.sleep(60000); sendCurrentUsage() } }.start()
    }

    private fun startScreenSession() { if (!screenOn) { screenOn = true; screenOnStartedAt = System.currentTimeMillis() } else if (screenOnStartedAt == 0L) screenOnStartedAt = System.currentTimeMillis() }
    private fun endScreenSession() { if (screenOn && screenOnStartedAt > 0) { val extra = (System.currentTimeMillis() - screenOnStartedAt) / 60000; addMinutes(extra); screenOnStartedAt = 0L }; screenOn = false; sendCurrentUsage() }
    private fun addMinutes(extra: Long) { if (extra > 0) { val current = prefs.getLong("minutes_${day()}", 0); prefs.edit().putLong("minutes_${day()}", current + extra).apply() } }
    private fun currentMinutes(): Long { val stored = prefs.getLong("minutes_${day()}", 0); val live = if (screenOn && screenOnStartedAt > 0) (System.currentTimeMillis() - screenOnStartedAt) / 60000 else 0; return stored + live }
    private fun day() = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    private fun sendCurrentUsage() {
        val minutes = currentMinutes(); if (minutes == sentMinutes) return; sentMinutes = minutes
        executor.execute {
            try {
                val conn = (URL(apiUrl).openConnection() as HttpURLConnection).apply { requestMethod = "POST"; doOutput = true; setRequestProperty("Content-Type", "application/json") }
                conn.outputStream.use { it.write("{\"screenOnMinutes\":$minutes}".toByteArray()) }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) { /* Server may be offline; the local counter continues. */ }
        }
    }

    private fun createChannel() { if (Build.VERSION.SDK_INT >= 26) { val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager; nm.createNotificationChannel(NotificationChannel("socialcare_tracker", "SocialCare Tracker", NotificationManager.IMPORTANCE_LOW)) } }
    private fun notification(text: String): Notification = if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(this, "socialcare_tracker").setContentTitle("SocialCare").setContentText(text).setSmallIcon(android.R.drawable.ic_popup_sync).build() else android.app.Notification.Builder(this).setContentTitle("SocialCare").setContentText(text).setSmallIcon(android.R.drawable.ic_popup_sync).build()
    override fun onDestroy() { try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}; executor.shutdownNow(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
}
