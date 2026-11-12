package com.socialcare.tracker

import android.Manifest
import android.app.Activity
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(40,40,40,40) }
        val title = TextView(this).apply { text = "🌍 SocialCare Device Tracker\n\nTracks screen-ON time across the whole phone. It keeps running even when the web dashboard is closed."; textSize = 20f; gravity = Gravity.CENTER }
        val access = Button(this).apply { text = "1. Grant Usage Access"; setOnClickListener { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) } }
        val start = Button(this).apply { text = "2. Start Background Tracking"; setOnClickListener { startTracker() } }
        layout.addView(title); layout.addView(access); layout.addView(start); setContentView(layout)
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 10)
    }
    private fun hasUsageAccess(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        return appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), packageName) == AppOpsManager.MODE_ALLOWED
    }
    private fun startTracker() {
        if (!hasUsageAccess()) { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)); return }
        val intent = Intent(this, UsageTrackingService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent)
    }
}
