import 'dart:convert';
import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_callkit_incoming/entities/android_params.dart';
import 'package:flutter_callkit_incoming/entities/call_event.dart';
import 'package:flutter_callkit_incoming/entities/call_kit_params.dart';
import 'package:flutter_callkit_incoming/entities/ios_params.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'package:logger/logger.dart';
import '../network/api_client.dart';
import 'storage_service.dart';

// Top-level background message handler for FCM
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  final logger = Logger(printer: SimplePrinter(colors: true));
  logger.d('[PushService] Background message received: ${message.data}');
  
  final data = message.data;
  final type = data['type'] as String?;
  if (type == 'incoming_call') {
    final callerId = data['caller_user_id'] ?? data['caller_id'] ?? 'unknown';
    final callerName = data['caller_username'] ?? data['caller_name'] ?? 'Входящий звонок';
    final callId = data['call_id'] ?? '';
    final avatarUrl = data['caller_avatar_url'] ?? '';

    final params = CallKitParams(
      id: 'vondic-call-$callerId-${DateTime.now().millisecondsSinceEpoch}',
      nameCaller: callerName,
      appName: 'Вондик',
      avatar: avatarUrl,
      handle: callerId.toString(),
      type: 0, // audio call
      duration: 30000,
      extra: {'callId': callId, 'callerSocketId': data['caller_socket_id']},
      android: const AndroidParams(
        isCustomNotification: true,
        isShowLogo: false,
        ringtonePath: 'rington',
        backgroundColor: '#0f0f0f',
        actionColor: '#6c5ce7',
      ),
      ios: const IOSParams(
        iconName: 'AppIcon',
        handleType: 'generic',
        supportsVideo: true,
        maximumCallGroups: 1,
        maximumCallsPerCallGroup: 1,
        ringtonePath: 'rington.wav',
      ),
    );
    await FlutterCallkitIncoming.showCallkitIncoming(params);
  }
}

class PushService {
  final ApiClient _apiClient;
  final StorageService _storageService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));

  String? _pushToken;
  bool _initialized = false;
  String? _currentUserId;

  // Callback to trigger call accept/decline inside CallStore/CallManager
  Function(String callerSocketId, bool accepted)? onCallKitEvent;
  // Callback to navigate to a screen
  Function(String screen, Map<String, dynamic> params)? onNavigate;

  PushService(this._apiClient, this._storageService);

  Future<void> initialize(String userId) async {
    if (userId.isEmpty) {
      _logger.w('[PushService] Cannot initialize without userId');
      return;
    }

    if (_initialized && _currentUserId == userId) {
      if (_pushToken != null) {
        await _registerDeviceOnBackend(userId, _pushToken!);
      }
      return;
    }

    _initialized = true;
    _currentUserId = userId;

    await _requestPushPermission();
    await _setupFirebaseMessaging(userId);
    await _setupCallKit();
  }

  Future<bool> _requestPushPermission() async {
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );
      final granted = settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
      _logger.d('[PushService] Permission status: ${settings.authorizationStatus} | Granted: $granted');
      return granted;
    } catch (e) {
      _logger.e('[PushService] Error requesting permission: $e');
      return false;
    }
  }

  Future<void> _setupFirebaseMessaging(String userId) async {
    try {
      final messaging = FirebaseMessaging.instance;
      
      // 1. Get token
      final token = await messaging.getToken();
      if (token != null) {
        _pushToken = token;
        await _registerDeviceOnBackend(userId, token);
      }

      // 2. Listen to token refresh
      messaging.onTokenRefresh.listen((newToken) async {
        _logger.d('[PushService] Token refreshed');
        _pushToken = newToken;
        await _registerDeviceOnBackend(userId, newToken);
      });

      // 3. Foreground message listener
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        _logger.d('[PushService] Message received in foreground: ${message.data}');
        _handleIncomingNotification(message);
      });

      // 4. Notification opened from background listener
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        _logger.d('[PushService] Message opened from background: ${message.data}');
        _handleNotificationOpen(message);
      });

      // 5. Check if app launched from terminated state via push
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        _logger.d('[PushService] App opened from quit state via notification: ${initialMessage.data}');
        Future.delayed(const Duration(seconds: 1), () {
          _handleNotificationOpen(initialMessage);
        });
      }
    } catch (e) {
      _logger.e('[PushService] Error setting up FCM listeners: $e');
    }
  }

  Future<void> _registerDeviceOnBackend(String userId, String token) async {
    try {
      _logger.d('[PushService] Registering device on backend...');
      final response = await _apiClient.post('/devices/register', data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
        'device_type': 'mobile',
      });
      
      final data = response.data;
      if (response.statusCode == 200 && (data['success'] == true || data['ok'] == true)) {
        _logger.d('[PushService] Device successfully registered on backend');
      } else {
        _logger.e('[PushService] Backend failed to register device: $data');
      }
    } catch (e) {
      _logger.e('[PushService] Exception registering device: $e');
    }
  }

  Future<void> _setupCallKit() async {
    try {
      FlutterCallkitIncoming.onEvent.listen((CallEvent? event) {
        if (event == null) return;
        
        if (event is CallEventActionCallAccept) {
          final extra = event.callKitParams.extra;
          final callerSocketId = extra?['callerSocketId'] as String? ?? '';
          _logger.d('[CallKit] Answered call from socket: $callerSocketId');
          if (onCallKitEvent != null && callerSocketId.isNotEmpty) {
            onCallKitEvent!(callerSocketId, true);
          }
        } else if (event is CallEventActionCallDecline) {
          final extra = event.callKitParams.extra;
          final callerSocketId = extra?['callerSocketId'] as String? ?? '';
          _logger.d('[CallKit] Declined call from socket: $callerSocketId');
          if (onCallKitEvent != null && callerSocketId.isNotEmpty) {
            onCallKitEvent!(callerSocketId, false);
          }
        }
      });
    } catch (e) {
      _logger.e('[PushService] Setup CallKit failed: $e');
    }
  }

  void _handleIncomingNotification(RemoteMessage message) {
    final data = message.data;
    final type = data['type'] as String?;

    if (type == 'incoming_call') {
      _showIncomingCallNotification(data);
    }
  }

  void _handleNotificationOpen(RemoteMessage message) {
    final data = message.data;
    if (data.isEmpty) return;

    if (data['type'] == 'incoming_call') {
      final callerId = data['caller_user_id'] ?? data['caller_id'];
      if (onNavigate != null) {
        onNavigate!('Call', {
          'targetUserId': data['group_id'] != null ? data['group_id'] : callerId,
          'isIncoming': true,
          'callerSocketId': data['caller_socket_id'] ?? callerId,
          'isGroupCall': data['is_group'] == 'true' || data['group_id'] != null,
          'callId': data['call_id'],
          'groupId': data['group_id'],
        });
      }
      return;
    }

    final groupId = data['group_id'] as String?;
    final channelId = data['channel_id'] as String?;
    final senderId = data['sender_id'] ?? data['sender_user_id'];

    if (groupId != null || channelId != null || senderId != null) {
      final type = groupId != null ? 'group' : channelId != null ? 'channel' : 'dm';
      final id = groupId ?? channelId ?? senderId.toString();
      final title = message.notification?.title ?? 'Сообщение';

      if (onNavigate != null) {
        onNavigate!('Chat', {
          'type': type,
          'id': id,
          'name': title,
        });
      }
    }
  }

  Future<void> _showIncomingCallNotification(Map<String, dynamic> data) async {
    final callerId = data['caller_user_id'] ?? data['caller_id'] ?? 'unknown';
    final callerName = data['caller_username'] ?? data['caller_name'] ?? 'Входящий звонок';
    final callId = data['call_id'] ?? '';
    final avatarUrl = data['caller_avatar_url'] ?? '';

    final callUUID = 'vondic-call-$callerId-${DateTime.now().millisecondsSinceEpoch}';
    final params = CallKitParams(
      id: callUUID,
      nameCaller: callerName,
      appName: 'Вондик',
      avatar: avatarUrl,
      handle: callerId.toString(),
      type: 0, // audio call
      duration: 30000,
      extra: {'callId': callId, 'callerSocketId': data['caller_socket_id']},
      android: const AndroidParams(
        isCustomNotification: true,
        isShowLogo: false,
        ringtonePath: 'rington',
        backgroundColor: '#0f0f0f',
        actionColor: '#6c5ce7',
      ),
      ios: const IOSParams(
        iconName: 'AppIcon',
        handleType: 'generic',
        supportsVideo: true,
        maximumCallGroups: 1,
        maximumCallsPerCallGroup: 1,
        ringtonePath: 'rington.wav',
      ),
    );
    await FlutterCallkitIncoming.showCallkitIncoming(params);
  }
}
