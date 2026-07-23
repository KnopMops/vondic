import 'dart:async';
import 'dart:convert';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:logger/logger.dart';
import '../socket/socket_service.dart';
import '../utils/push_service.dart';
import '../utils/storage_service.dart';
import 'call_state.dart';
import 'webrtc_service.dart';

class CallManager {
  final SocketService _socketService;
  final WebRTCService _webRTCService;
  final PushService _pushService;
  final StorageService _storageService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));

  final Map<String, CallState> _activeCalls = {};
  CallState? _incomingCall;
  String? _activeGroupCallId;
  Map<String, dynamic>? _currentUser;

  // Stream of active calls changes
  final _callsController = StreamController<Map<String, CallState>>.broadcast();
  Stream<Map<String, CallState>> get activeCallsStream => _callsController.stream;

  final _incomingCallController = StreamController<CallState?>.broadcast();
  Stream<CallState?> get incomingCallStream => _incomingCallController.stream;

  final _groupCallIdController = StreamController<String?>.broadcast();
  Stream<String?> get groupCallIdStream => _groupCallIdController.stream;

  CallManager(this._socketService, this._webRTCService, this._pushService, this._storageService) {
    _setupSocketListeners();
    _setupWebRTCCallbacks();
    _setupPushCallbacks();
  }

  void setCurrentUser(Map<String, dynamic> user) {
    _currentUser = user;
  }

  void _setupPushCallbacks() {
    _pushService.onCallKitEvent = (callerSocketId, accepted) {
      if (accepted) {
        acceptCall(callerSocketId);
      } else {
        rejectCall(callerSocketId);
      }
    };
  }

  void _setupWebRTCCallbacks() {
    _webRTCService.onRemoteStream = (socketId, stream) {
      _logger.d('[CallManager] Remote stream added for: $socketId');
      final call = _activeCalls[socketId];
      if (call != null && call.status != 'ringing') {
        _activeCalls[socketId] = call.copyWith(
          status: 'connected',
          startTime: call.startTime ?? DateTime.now(),
        );
        _callsController.add(Map.from(_activeCalls));
      }
    };

    _webRTCService.onConnectionStateChange = (socketId, state) {
      _logger.d('[CallManager] Connection state change for $socketId to: $state');
      final call = _activeCalls[socketId];
      if (call != null) {
        if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
          if (call.status != 'ringing') {
            _activeCalls[socketId] = call.copyWith(
              status: 'connected',
              startTime: call.startTime ?? DateTime.now(),
            );
            _callsController.add(Map.from(_activeCalls));
          }
        } else if (state == RTCPeerConnectionState.RTCPeerConnectionStateDisconnected ||
            state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
            state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
          _handleCallEnded(socketId);
        }
      }
    };
  }

  void _setupSocketListeners() {
    _socketService.on('group_call_started', (data) {
      _logger.d('[CallManager] group_call_started: $data');
      _activeGroupCallId = data?['call_id']?.toString();
      _groupCallIdController.add(_activeGroupCallId);
    });

    _socketService.on('incoming_group_call', (data) {
      _logger.d('[CallManager] incoming_group_call: $data');
      final callState = CallState(
        socketId: '',
        userId: data?['group_id']?.toString() ?? '',
        userName: 'Групповой звонок',
        avatarUrl: data?['caller_avatar_url']?.toString(),
        status: 'ringing',
        startTime: DateTime.now(),
        isGroupCall: true,
        groupId: data?['group_id']?.toString(),
        callId: data?['call_id']?.toString(),
        isIncoming: true,
      );
      _incomingCall = callState;
      _incomingCallController.add(_incomingCall);
    });

    _socketService.on('incoming_call', (data) async {
      _logger.d('[CallManager] incoming_call socket event: $data');
      if (data is! Map) return;

      final callerSocketId = (data['from_socket_id'] ?? data['caller_socket_id'])?.toString() ?? '';
      final callerUserId = data['caller_user_id']?.toString() ?? callerSocketId;
      final callerUsername = data['caller_username']?.toString() ?? 'Неизвестный пользователь';
      final callerAvatarUrl = data['caller_avatar_url']?.toString();
      final isGroup = data['is_group_call'] == true || data['group_id'] != null;

      Map? offerData;
      if (data['offer'] is Map) {
        offerData = data['offer'] as Map;
      } else if (data['offer_json'] != null) {
        try {
          offerData = jsonDecode(data['offer_json'].toString()) as Map;
        } catch (_) {}
      } else if (data['sdp'] != null && data['type'] != null) {
        offerData = {'sdp': data['sdp'], 'type': data['type']};
      }

      final callState = CallState(
        socketId: callerSocketId,
        userId: callerUserId,
        userName: callerUsername,
        avatarUrl: callerAvatarUrl,
        status: 'ringing',
        isGroupCall: isGroup,
        groupId: data['group_id']?.toString(),
        callId: data['call_id']?.toString(),
        isIncoming: true,
      );

      _incomingCall = callState;
      _incomingCallController.add(_incomingCall);

      if (offerData != null && callerSocketId.isNotEmpty) {
        final pc = await _webRTCService.establishPeerConnection(callerSocketId);
        final offerSdp = offerData['sdp']?.toString() ?? '';
        final offerType = offerData['type']?.toString() ?? 'offer';
        await pc.setRemoteDescription(RTCSessionDescription(offerSdp, offerType));
      }
    });

    _socketService.on('offer', (data) async {
      _logger.d('[CallManager] offer received: $data');
      if (data is! Map) return;
      final callerSocketId = data['caller_socket_id']?.toString() ?? '';
      
      if (callerSocketId.isEmpty) return;

      final isActiveCall = _activeCalls.containsKey(callerSocketId);

      if (!isActiveCall) {
        final callerUserId = data['caller_user_id']?.toString() ?? '';
        final callerUsername = data['caller_username']?.toString() ?? 'Пользователь';
        final callerAvatarUrl = data['caller_avatar_url']?.toString();
        final isGroup = data['is_group_call'] == true || data['group_id'] != null;

        final callState = CallState(
          socketId: callerSocketId,
          userId: callerUserId,
          userName: callerUsername,
          avatarUrl: callerAvatarUrl,
          status: 'ringing',
          isGroupCall: isGroup,
          groupId: data['group_id']?.toString(),
          callId: data['call_id']?.toString(),
          isIncoming: true,
        );

        _incomingCall = callState;
        _incomingCallController.add(_incomingCall);

        // Initialize peer connection in advance
        final pc = await _webRTCService.establishPeerConnection(callerSocketId);
        final offerSdp = data['offer']['sdp']?.toString() ?? '';
        await pc.setRemoteDescription(RTCSessionDescription(offerSdp, 'offer'));
      } else {
        // Active call renegotiation (e.g. video toggled on by remote)
        final pc = _webRTCService.peerConnections[callerSocketId];
        if (pc != null) {
          final offerSdp = data['offer']['sdp']?.toString() ?? '';
          await pc.setRemoteDescription(RTCSessionDescription(offerSdp, 'offer'));
          
          final answer = await pc.createAnswer({});
          await pc.setLocalDescription(answer);

          _socketService.emit('answer', {
            'target_socket_id': callerSocketId,
            'answer': {
              'sdp': answer.sdp,
              'type': answer.type,
            }
          });
          _logger.d('[CallManager] Sent renegotiation answer to $callerSocketId');
        }
      }
    });

    _socketService.on('answer', (data) async {
      _logger.d('[CallManager] answer received: $data');
      if (data is! Map) return;

      final targetSocketId = (data['from_socket_id'] ?? data['responder_socket_id'] ?? data['target_socket_id'] ?? '').toString();
      if (targetSocketId.isEmpty) return;

      var pc = _webRTCService.peerConnections[targetSocketId];
      var keyToMigrate = '';

      if (pc == null) {
        for (final entry in _webRTCService.peerConnections.entries) {
          final connection = entry.value;
          final sigState = connection.signalingState;
          if (sigState == RTCSignalingState.RTCSignalingStateHaveLocalOffer) {
            pc = connection;
            keyToMigrate = entry.key;
            break;
          }
        }
      }

      if (pc != null) {
        if (keyToMigrate.isNotEmpty) {
          _logger.d('[CallManager] Migrating call from temporary key $keyToMigrate to $targetSocketId');
          _webRTCService.migrateCall(keyToMigrate, targetSocketId);

          // Update active calls list
          final call = _activeCalls.remove(keyToMigrate);
          if (call != null) {
            _activeCalls[targetSocketId] = call.copyWith(
              socketId: targetSocketId,
              status: 'connected',
              startTime: DateTime.now(),
            );
            _callsController.add(Map.from(_activeCalls));
          }
        }

        final answerData = data['answer'];
        if (answerData is Map) {
          final answerSdp = answerData['sdp']?.toString() ?? '';
          final answerType = answerData['type']?.toString() ?? 'answer';
          await pc.setRemoteDescription(RTCSessionDescription(answerSdp, answerType));
        }
      }
    });

    _socketService.on('call_answer', (data) async {
      _logger.d('[CallManager] call_answer received: $data');
      if (data is! Map) return;

      final targetSocketId = (data['socket_id'] ?? data['sender_socket_id'] ?? '').toString();
      if (targetSocketId.isEmpty) return;

      var pc = _webRTCService.peerConnections[targetSocketId];
      var keyToMigrate = '';

      if (pc == null) {
        for (final entry in _webRTCService.peerConnections.entries) {
          final connection = entry.value;
          final sigState = connection.signalingState;
          if (sigState == RTCSignalingState.RTCSignalingStateHaveLocalOffer) {
            pc = connection;
            keyToMigrate = entry.key;
            break;
          }
        }
      }

      if (pc != null) {
        if (keyToMigrate.isNotEmpty) {
          _logger.d('[CallManager] Migrating call from temporary key $keyToMigrate to $targetSocketId');
          _webRTCService.migrateCall(keyToMigrate, targetSocketId);

          // Update active calls list
          final call = _activeCalls.remove(keyToMigrate);
          if (call != null) {
            _activeCalls[targetSocketId] = call.copyWith(
              socketId: targetSocketId,
              status: 'connected',
              startTime: DateTime.now(),
            );
            _callsController.add(Map.from(_activeCalls));
          }
        }

        final answerData = data['answer'];
        if (answerData is Map) {
          final answerSdp = answerData['sdp']?.toString() ?? '';
          final answerType = answerData['type']?.toString() ?? 'answer';
          await pc.setRemoteDescription(RTCSessionDescription(answerSdp, answerType));
        }
      }
    });

    _socketService.on('call_accepted', (data) async {
      _logger.d('[CallManager] call_accepted received: $data');
      if (data is! Map) return;

      final targetSocketId = (data['responder_socket_id'] ?? data['target_socket_id'] ?? '').toString();
      if (targetSocketId.isEmpty) return;

      var pc = _webRTCService.peerConnections[targetSocketId];
      var keyToMigrate = '';

      if (pc == null) {
        for (final entry in _webRTCService.peerConnections.entries) {
          final connection = entry.value;
          final sigState = connection.signalingState;
          if (sigState == RTCSignalingState.RTCSignalingStateHaveLocalOffer) {
            pc = connection;
            keyToMigrate = entry.key;
            break;
          }
        }
      }

      if (pc != null && keyToMigrate.isNotEmpty) {
        _logger.d('[CallManager] Migrating call on call_accepted from temporary key $keyToMigrate to $targetSocketId');
        _webRTCService.migrateCall(keyToMigrate, targetSocketId);

        final call = _activeCalls.remove(keyToMigrate);
        if (call != null) {
          _activeCalls[targetSocketId] = call.copyWith(
            socketId: targetSocketId,
            status: 'connected',
            startTime: DateTime.now(),
          );
          _callsController.add(Map.from(_activeCalls));
        }
      }
    });

    _socketService.on('ice_candidate', (data) async {
      _logger.d('[CallManager] ice_candidate received: $data');
      if (data is! Map) return;

      final socketId = (data['sender_socket_id'] ?? data['target_socket_id'] ?? '').toString();
      if (socketId.isEmpty) return;

      final pc = _webRTCService.peerConnections[socketId];
      if (pc != null) {
        final candidateData = data['candidate'];
        if (candidateData is Map) {
          final candidate = RTCIceCandidate(
            candidateData['candidate']?.toString() ?? '',
            candidateData['sdpMid']?.toString() ?? '',
            candidateData['sdpMLineIndex'] as int? ?? 0,
          );
          await pc.addCandidate(candidate);
        }
      }
    });

    _socketService.on('call_rejected', (data) {
      _logger.d('[CallManager] call_rejected: $data');
      if (data is! Map) return;
      final socketId = (data['responder_socket_id'] ?? data['target_socket_id'] ?? data['sender_socket_id'] ?? '').toString();
      if (socketId.isNotEmpty) {
        _handleCallEnded(socketId);
      }
    });

    _socketService.on('call_ended', (data) {
      _logger.d('[CallManager] call_ended: $data');
      if (data is! Map) return;
      final socketId = (data['sender_socket_id'] ?? data['responder_socket_id'] ?? data['target_socket_id'] ?? '').toString();
      if (socketId.isNotEmpty) {
        _handleCallEnded(socketId);
      }
    });
  }

  // --- Actions ---

  Future<void> initiateCall(String targetUserId, String targetUserName, {String? avatarUrl}) async {
    _logger.d('[CallManager] Initiating call to: $targetUserId');
    
    // 1. Resolve local audio stream
    await _webRTCService.initializeLocalStream();

    // 2. Create peer connection
    final socketId = 'calling_${DateTime.now().millisecondsSinceEpoch}';
    final pc = await _webRTCService.establishPeerConnection(socketId);

    // 3. Create offer
    final offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);

    final callState = CallState(
      socketId: socketId,
      userId: targetUserId,
      userName: targetUserName,
      avatarUrl: avatarUrl,
      status: 'calling',
      isIncoming: false,
    );

    _activeCalls[socketId] = callState;
    _callsController.add(Map.from(_activeCalls));

    // Emit offer to server
    _socketService.emit('call_user', {
      'target_user_id': targetUserId,
      'offer': {
        'sdp': offer.sdp,
        'type': offer.type,
      },
      'caller_username': _currentUser?['username'] ?? 'Пользователь',
      'caller_avatar_url': _currentUser?['avatar_url'],
    });
  }

  Future<void> acceptCall(String callerSocketId) async {
    _logger.d('[CallManager] Accepting call from: $callerSocketId');
    if (_incomingCall == null) return;

    final incoming = _incomingCall!;

    // 1. Add call to active list as connecting immediately to prevent premature screen pop race condition
    _activeCalls[callerSocketId] = incoming.copyWith(
      status: 'connecting',
      startTime: DateTime.now(),
    );
    _callsController.add(Map.from(_activeCalls));

    // 2. Clear incoming call state
    _incomingCall = null;
    _incomingCallController.add(null);

    // 3. Resolve local audio stream
    await _webRTCService.initializeLocalStream();

    // 4. Get existing peer connection (initialized when offer was received)
    final pc = await _webRTCService.establishPeerConnection(callerSocketId);

    // 5. Create answer
    final answer = await pc.createAnswer({});
    await pc.setLocalDescription(answer);

    // 6. Update call status to connected
    _activeCalls[callerSocketId] = incoming.copyWith(
      status: 'connected',
      startTime: DateTime.now(),
    );
    _callsController.add(Map.from(_activeCalls));

    // 7. Emit answer & call_answer to sender/server
    _socketService.emit('call_answer', {
      'caller_socket_id': callerSocketId,
      'answer': {
        'sdp': answer.sdp,
        'type': answer.type,
      }
    });

    _socketService.emit('answer', {
      'target_socket_id': callerSocketId,
      'answer': {
        'sdp': answer.sdp,
        'type': answer.type,
      }
    });
  }

  void rejectCall(String callerSocketId) {
    _logger.d('[CallManager] Rejecting call from: $callerSocketId');
    _incomingCall = null;
    _incomingCallController.add(null);
    
    _socketService.emit('call_reject', {
      'caller_socket_id': callerSocketId,
    });
    _socketService.emit('reject_call', {'target_socket_id': callerSocketId});
    _webRTCService.closePeerConnection(callerSocketId);
  }

  void endCall(String socketId) {
    _logger.d('[CallManager] Ending call: $socketId');
    _socketService.emit('call_end', {
      'target_socket_id': socketId,
    });
    _socketService.emit('end_call', {'target_socket_id': socketId});
    _handleCallEnded(socketId);
  }

  void _handleCallEnded(String socketId) {
    final call = _activeCalls.remove(socketId);
    if (call != null) {
      final duration = call.startTime != null 
          ? DateTime.now().difference(call.startTime!).inSeconds 
          : 0;
      _saveCallToHistory(call, duration);
    }
    _webRTCService.closePeerConnection(socketId);
    
    _callsController.add(Map.from(_activeCalls));
    
    if (_incomingCall?.socketId == socketId) {
      _incomingCall = null;
      _incomingCallController.add(null);
    }
    
    _logger.d('[CallManager] Call ended for socket: $socketId');
  }

  void _saveCallToHistory(CallState call, int duration) {
    try {
      final historyStr = _storageService.readString('call_history') ?? '[]';
      final List<dynamic> history = json.decode(historyStr);
      
      final record = {
        'id': 'call_${DateTime.now().millisecondsSinceEpoch}',
        'callerName': call.isIncoming ? call.userName : 'Вы',
        'receiverName': call.isIncoming ? 'Вы' : call.userName,
        'type': call.isIncoming ? 'incoming' : 'outgoing',
        'status': duration > 0 ? 'completed' : 'missed',
        'startTime': (call.startTime ?? DateTime.now()).toIso8601String(),
        'duration': duration,
      };
      
      history.insert(0, record);
      if (history.length > 50) history.removeLast(); // keep last 50
      
      _storageService.writeString('call_history', json.encode(history));
      _logger.d('[CallManager] Call history updated with record: $record');
    } catch (e) {
      _logger.e('[CallManager] Failed to save call to history: $e');
    }
  }

  void cleanup() {
    _incomingCall = null;
    _incomingCallController.add(null);
    _activeCalls.clear();
    _callsController.add({});
    _webRTCService.cleanup();
  }
}
