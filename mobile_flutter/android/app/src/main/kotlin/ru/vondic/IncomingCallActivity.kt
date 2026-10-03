package ru.vondic

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

class IncomingCallActivity : Activity() {

    private var vibrator: Vibrator? = null
    private var ringtone: Ringtone? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_incoming_call)

        val callerName = intent.getStringExtra("callerName") ?: "Неизвестный"
        val callerUserId = intent.getStringExtra("callerUserId") ?: ""
        val callId = intent.getStringExtra("callId") ?: ""

        findViewById<TextView>(R.id.callerName).text = callerName

        startRingtone()
        startVibration()

        findViewById<Button>(R.id.btnAccept).setOnClickListener {
            stopRingtone()
            stopVibration()
            sendResult("ACCEPT_CALL", callerUserId, callId)
            finish()
        }

        findViewById<Button>(R.id.btnReject).setOnClickListener {
            stopRingtone()
            stopVibration()
            sendResult("REJECT_CALL", callerUserId, callId)
            finish()
        }
    }

    private fun startRingtone() {
        try {
            val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(applicationContext, ringtoneUri)
            ringtone?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    it.audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                }
                it.isLooping = true
                it.play()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startVibration() {
        try {
            val pattern = longArrayOf(0, 500, 500, 500)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibrator = vibratorManager.defaultVibrator
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                @Suppress("DEPRECATION")
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopRingtone() {
        ringtone?.stop()
        ringtone = null
    }

    private fun stopVibration() {
        vibrator?.cancel()
        vibrator = null
    }

    private fun sendResult(action: String, callerUserId: String, callId: String) {
        val intent = Intent("com.vondic.CALL_ACTION").apply {
            putExtra("action", action)
            putExtra("callerUserId", callerUserId)
            putExtra("callId", callId)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        stopRingtone()
        stopVibration()
    }
}
