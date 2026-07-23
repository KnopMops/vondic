import 'dart:convert';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:logger/logger.dart';
import '../config/config.dart';
import '../socket/socket_service.dart';

class WebRTCService {
  final String userId;
  final SocketService _socketService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));

  MediaStream? localStream;
  MediaStream? videoStream;
  final Map<String, MediaStream> remoteStreams = {};
  final Map<String, RTCPeerConnection> peerConnections = {};
  final Map<String, List<RTCIceCandidate>> _iceCandidateQueue = {};
  
  Function(MediaStream stream)? onLocalStream;
  Function(String socketId, MediaStream stream)? onRemoteStream;
  Function(String socketId, RTCPeerConnectionState state)? onConnectionStateChange;

  Map<String, dynamic> _iceConfiguration = {};

  WebRTCService(this.userId, this._socketService) {
    _compileIceConfiguration();
  }

  void _compileIceConfiguration() {
    final List<Map<String, dynamic>> iceServers = [
      {
        'urls': ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
      },
      {
        'urls': ['stun:${AppConfig.internalTurnHost}:3478']
      }
    ];

    if (AppConfig.turnUsername.isNotEmpty && AppConfig.turnPassword.isNotEmpty) {
      final List<String> urls = [];
      final rawUrls = AppConfig.turnUrls.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty);
      for (final rawUrl in rawUrls) {
        var u = rawUrl;
        if (u.startsWith('turn://')) {
          u = 'turn:' + u.substring(7);
        } else if (u.startsWith('turns://')) {
          u = 'turns:' + u.substring(8);
        }
        
        final hasTransport = RegExp(r'\?transport=(udp|tcp)$', caseSensitive: false).hasMatch(u);
        if (u.startsWith('turns:')) {
          urls.add(hasTransport ? u : '$u?transport=tcp');
        } else {
          if (hasTransport) {
            urls.add(u);
          } else {
            final base = u.replaceAll(RegExp(r'\?transport=(udp|tcp)$', caseSensitive: false), '');
            urls.add('$base?transport=udp');
            urls.add('$base?transport=tcp');
          }
        }
      }

      if (urls.isNotEmpty) {
        iceServers.add({
          'urls': urls,
          'username': AppConfig.turnUsername,
          'credential': AppConfig.turnPassword,
        });

        // Add internal TURN as fallback
        iceServers.add({
          'urls': [
            'turn:${AppConfig.internalTurnHost}:3478?transport=udp',
            'turn:${AppConfig.internalTurnHost}:3478?transport=tcp'
          ],
          'username': AppConfig.turnUsername,
          'credential': AppConfig.turnPassword,
        });
      }
    }

    _iceConfiguration = {
      'iceServers': iceServers,
      'sdpSemantics': 'unified-plan',
    };
    _logger.d('[WebRTC] Compiled ICE configuration: ${jsonEncode(_iceConfiguration)}');
  }

  Future<MediaStream> initializeLocalStream() async {
    _logger.d('[WebRTC] Initializing local stream...');
    try {
      final constraints = {
        'audio': {
          'echoCancellation': true,
          'noiseSuppression': true,
          'autoGainControl': true,
        },
        'video': false,
      };
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (onLocalStream != null) {
        onLocalStream!(localStream!);
      }
      return localStream!;
    } catch (e) {
      _logger.e('[WebRTC] Error accessing microphone: $e');
      throw Exception('Не удалось получить доступ к микрофону');
    }
  }

  Future<void> startLocalVideo() async {
    _logger.d('[WebRTC] Enabling local camera video...');
    try {
      final constraints = {
        'audio': false,
        'video': {
          'facingMode': 'user',
          'width': {'ideal': 640},
          'height': {'ideal': 480},
          'frameRate': {'ideal': 24},
        }
      };
      
      videoStream = await navigator.mediaDevices.getUserMedia(constraints);
      final videoTrack = videoStream!.getVideoTracks().firstOrNull;
      
      if (videoTrack != null) {
        if (localStream != null) {
          await localStream!.addTrack(videoTrack);
        }
        
        // Add video track and renegotiate on all active peer connections
        for (final entry in peerConnections.entries) {
          final targetSocketId = entry.key;
          final pc = entry.value;

          final transceivers = await pc.getTransceivers();
          RTCRtpTransceiver? videoTransceiver;
          for (final t in transceivers) {
            if (t.sender.track?.kind == 'video') {
              videoTransceiver = t;
              break;
            }
          }
          if (videoTransceiver != null) {
            await videoTransceiver.sender.replaceTrack(videoTrack);
          } else {
            await pc.addTrack(videoTrack, localStream!);
          }

          // Trigger WebRTC renegotiation offer
          final offer = await pc.createOffer({});
          await pc.setLocalDescription(offer);

          _socketService.emit('offer', {
            'target_socket_id': targetSocketId,
            'offer': {
              'sdp': offer.sdp,
              'type': offer.type,
            },
          });

          _socketService.emit('video_state_changed', {
            'sender_socket_id': targetSocketId,
            'has_video': true,
          });
          _logger.d('[WebRTC] Initiated video renegotiation with $targetSocketId');
        }
      }
    } catch (e) {
      _logger.e('[WebRTC] Error accessing camera: $e');
    }
  }

  Future<void> stopLocalVideo() async {
    _logger.d('[WebRTC] Disabling local camera video...');
    try {
      if (videoStream != null) {
        for (final track in videoStream!.getTracks()) {
          await track.stop();
          if (localStream != null) {
            await localStream!.removeTrack(track);
          }
        }
        videoStream = null;
      }
      
      // Remove video tracks and renegotiate on active connections
      for (final entry in peerConnections.entries) {
        final targetSocketId = entry.key;
        final pc = entry.value;

        final transceivers = await pc.getTransceivers();
        for (final t in transceivers) {
          if (t.sender.track?.kind == 'video') {
            await t.sender.replaceTrack(null);
          }
        }

        // Trigger WebRTC renegotiation offer
        final offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);

        _socketService.emit('offer', {
          'target_socket_id': targetSocketId,
          'offer': {
            'sdp': offer.sdp,
            'type': offer.type,
          },
        });

        _socketService.emit('video_state_changed', {
          'sender_socket_id': targetSocketId,
          'has_video': false,
        });
        _logger.d('[WebRTC] Initiated video stop renegotiation with $targetSocketId');
      }
    } catch (e) {
      _logger.e('[WebRTC] Error stopping video: $e');
    }
  }

  Future<RTCPeerConnection> establishPeerConnection(String targetSocketId) async {
    _logger.d('[WebRTC] Creating/retrieving RTCPeerConnection for: $targetSocketId');
    
    RTCPeerConnection pc;
    if (peerConnections.containsKey(targetSocketId)) {
      final existing = peerConnections[targetSocketId]!;
      final state = await existing.getConnectionState();
      if (state != RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
        pc = existing;
      } else {
        pc = await createPeerConnection(_iceConfiguration);
        peerConnections[targetSocketId] = pc;
      }
    } else {
      pc = await createPeerConnection(_iceConfiguration);
      peerConnections[targetSocketId] = pc;
    }

    // Add or verify local tracks
    if (localStream != null) {
      final senders = await pc.getSenders();
      for (final track in localStream!.getTracks()) {
        final hasTrack = senders.any((s) => s.track?.id == track.id || s.track?.kind == track.kind);
        if (!hasTrack) {
          _logger.d('[WebRTC] Adding local track ${track.kind} to peer connection for $targetSocketId');
          await pc.addTrack(track, localStream!);
        }
      }
    }

    // Set connection handlers
    pc.onIceCandidate = (candidate) {
      if (candidate.candidate != null) {
        _socketService.emit('ice_candidate', {
          'target_socket_id': targetSocketId,
          'candidate': {
            'candidate': candidate.candidate,
            'sdpMid': candidate.sdpMid,
            'sdpMLineIndex': candidate.sdpMLineIndex,
          }
        });
      }
    };

    pc.onTrack = (event) async {
      _logger.d('[WebRTC] Remote track added: ${event.track.kind} from $targetSocketId');
      
      var stream = remoteStreams[targetSocketId];
      if (stream == null) {
        if (event.streams.isNotEmpty) {
          stream = event.streams.first;
        } else {
          stream = await createLocalMediaStream('remote_stream_$targetSocketId');
        }
        remoteStreams[targetSocketId] = stream;
      }

      await stream.addTrack(event.track);
      if (onRemoteStream != null) {
        onRemoteStream!(targetSocketId, stream);
      }
    };

    pc.onConnectionState = (state) {
      _logger.d('[WebRTC] Connection state changed for $targetSocketId to: $state');
      if (onConnectionStateChange != null) {
        onConnectionStateChange!(targetSocketId, state);
      }
      
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
        _logger.w('[WebRTC] ICE restart needed for: $targetSocketId');
        // Simple ICE restart trigger
        pc.createOffer({'iceRestart': true}).then((offer) {
          pc.setLocalDescription(offer);
          _socketService.emit('offer', {
            'target_socket_id': targetSocketId,
            'offer': {'sdp': offer.sdp, 'type': offer.type},
          });
        });
      }
    };

    peerConnections[targetSocketId] = pc;
    return pc;
  }

  void migrateCall(String oldKey, String newKey) {
    _logger.d('[WebRTC] Migrating call connection from $oldKey to $newKey');
    final pc = peerConnections.remove(oldKey);
    if (pc != null) {
      peerConnections[newKey] = pc;
      
      // Migrate remote stream mapping if any exists
      final stream = remoteStreams.remove(oldKey);
      if (stream != null) {
        remoteStreams[newKey] = stream;
        if (onRemoteStream != null) {
          onRemoteStream!(newKey, stream);
        }
      }

      // Migrate candidates queue
      final queue = _iceCandidateQueue.remove(oldKey);
      if (queue != null) {
        _iceCandidateQueue[newKey] = queue;
      }
      
      // Re-bind callbacks to the new target/key
      pc.onIceCandidate = (candidate) {
        if (candidate.candidate != null) {
          _socketService.emit('ice_candidate', {
            'target_socket_id': newKey,
            'candidate': {
              'candidate': candidate.candidate,
              'sdpMid': candidate.sdpMid,
              'sdpMLineIndex': candidate.sdpMLineIndex,
            }
          });
        }
      };

      pc.onTrack = (event) async {
        _logger.d('[WebRTC] Remote track added: ${event.track.kind} from $newKey');
        var stream = remoteStreams[newKey];
        if (stream == null) {
          if (event.streams.isNotEmpty) {
            stream = event.streams.first;
          } else {
            stream = await createLocalMediaStream('remote_stream_$newKey');
          }
          remoteStreams[newKey] = stream;
        }
        await stream.addTrack(event.track);
        if (onRemoteStream != null) {
          onRemoteStream!(newKey, stream);
        }
      };

      pc.onConnectionState = (state) {
        _logger.d('[WebRTC] Connection state changed for $newKey to: $state');
        if (onConnectionStateChange != null) {
          onConnectionStateChange!(newKey, state);
        }
      };
    }

    final stream = remoteStreams.remove(oldKey);
    if (stream != null) {
      remoteStreams[newKey] = stream;
    }
  }

  void closePeerConnection(String socketId) {
    if (peerConnections.containsKey(socketId)) {
      final pc = peerConnections.remove(socketId);
      pc?.close();
    }
    remoteStreams.remove(socketId);
    _iceCandidateQueue.remove(socketId);
    _logger.d('[WebRTC] Closed peer connection for: $socketId');
  }

  void cleanup() {
    for (final pc in peerConnections.values) {
      pc.close();
    }
    peerConnections.clear();
    remoteStreams.clear();
    _iceCandidateQueue.clear();

    if (localStream != null) {
      for (final track in localStream!.getTracks()) {
        track.stop();
      }
      localStream = null;
    }
    if (videoStream != null) {
      for (final track in videoStream!.getTracks()) {
        track.stop();
      }
      videoStream = null;
    }
    _logger.d('[WebRTC] Cleaned up local resources');
  }
}
