package ru.vondic

import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.vondic/call_actions"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        FlutterEngineCache.getInstance().put("main_engine", flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "showIncomingCall") {
                val callerName = call.argument<String>("callerName") ?: "Входящий звонок"
                val callerUserId = call.argument<String>("callerUserId") ?: ""
                val callId = call.argument<String>("callId") ?: ""

                val intent = Intent(this, IncomingCallActivity::class.java).apply {
                    putExtra("callerName", callerName)
                    putExtra("callerUserId", callerUserId)
                    putExtra("callId", callId)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                startActivity(intent)
                result.success(true)
            } else {
                result.notImplemented()
            }
        }
    }
}
