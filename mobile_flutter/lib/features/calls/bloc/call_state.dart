import 'package:equatable/equatable.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../../core/webrtc/call_state.dart';

class CallBlocState extends Equatable {
  final bool isInitialized;
  final Map<String, CallState> activeCalls;
  final CallState? incomingCall;
  final String? activeGroupCallId;
  final bool isMuted;
  final bool isSpeaker;
  final bool isVideoActive;
  final MediaStream? localStream;
  final Map<String, MediaStream> remoteStreams;

  const CallBlocState({
    this.isInitialized = false,
    this.activeCalls = const {},
    this.incomingCall,
    this.activeGroupCallId,
    this.isMuted = false,
    this.isSpeaker = false,
    this.isVideoActive = false,
    this.localStream,
    this.remoteStreams = const {},
  });

  CallBlocState copyWith({
    bool? isInitialized,
    Map<String, CallState>? activeCalls,
    CallState? incomingCall,
    String? activeGroupCallId,
    bool? isMuted,
    bool? isSpeaker,
    bool? isVideoActive,
    MediaStream? localStream,
    Map<String, MediaStream>? remoteStreams,
  }) {
    return CallBlocState(
      isInitialized: isInitialized ?? this.isInitialized,
      activeCalls: activeCalls ?? this.activeCalls,
      incomingCall: incomingCall, // Allow clearing by setting null if copied explicitly
      activeGroupCallId: activeGroupCallId ?? this.activeGroupCallId,
      isMuted: isMuted ?? this.isMuted,
      isSpeaker: isSpeaker ?? this.isSpeaker,
      isVideoActive: isVideoActive ?? this.isVideoActive,
      localStream: localStream ?? this.localStream,
      remoteStreams: remoteStreams ?? this.remoteStreams,
    );
  }

  @override
  List<Object?> get props => [
        isInitialized,
        activeCalls,
        incomingCall,
        activeGroupCallId,
        isMuted,
        isSpeaker,
        isVideoActive,
        localStream,
        remoteStreams,
      ];
}
