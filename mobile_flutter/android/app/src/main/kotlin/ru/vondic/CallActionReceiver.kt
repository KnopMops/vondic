package ru.vondic

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.plugin.common.MethodChannel

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.getStringExtra("action") ?: return
        val callerUserId = intent.getStringExtra("callerUserId") ?: ""
        val callId = intent.getStringExtra("callId") ?: ""

        val engine = FlutterEngineCache.getInstance().get("main_engine")
        engine?.dartExecutor?.binaryMessenger?.let { messenger ->
            MethodChannel(messenger, "com.vondic/call_actions")
                .invokeMethod("onCallAction", mapOf(
                    "action" to action,
                    "callerUserId" to callerUserId,
                    "callId" to callId
                ))
        }
    }
}
