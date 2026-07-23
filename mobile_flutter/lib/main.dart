import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'app.dart';
import 'core/network/api_client.dart';
import 'core/socket/socket_service.dart';
import 'core/utils/push_service.dart';
import 'core/utils/storage_service.dart';
import 'core/webrtc/call_manager.dart';
import 'core/webrtc/webrtc_service.dart';
import 'crypto/key_sync_service.dart';

void main() async {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Initialize Firebase in a safe try-catch wrapper
    // since custom firebase credentials might not be present during first build
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    } catch (e) {
      debugPrint('[Firebase] Safe-initialization failed: $e');
    }

    // Initialize local storage service
    final storageService = StorageService();
    await storageService.init();

    // Core services instantiations
    final apiClient = ApiClient(storageService);
    final keySyncService = KeySyncService(apiClient, storageService);
    final socketService = SocketService(storageService);
    
    // Resolve user ID for WebRTC (will re-instantiated or updated on login)
    final webRTCService = WebRTCService('user_temp', socketService);
    final pushService = PushService(apiClient, storageService);
    final callManager = CallManager(socketService, webRTCService, pushService, storageService);

    runApp(
      VondicApp(
        storageService: storageService,
        apiClient: apiClient,
        keySyncService: keySyncService,
        socketService: socketService,
        webRTCService: webRTCService,
        callManager: callManager,
        pushService: pushService,
      ),
    );
  }, (error, stack) {
    debugPrint('[Error] Global unhandled crash: $error | Stack: $stack');
  });
}
