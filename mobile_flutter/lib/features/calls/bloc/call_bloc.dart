import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../../core/webrtc/call_manager.dart';
import '../../../core/webrtc/webrtc_service.dart';
import 'call_event.dart';
import 'call_state.dart';

class CallBloc extends Bloc<CallBlocEvent, CallBlocState> {
  final CallManager _callManager;
  final WebRTCService _webRTCService;

  StreamSubscription? _activeCallsSub;
  StreamSubscription? _incomingCallSub;

  CallBloc(this._callManager, this._webRTCService) : super(const CallBlocState()) {
    on<CallInitializeEvent>(_onInitialize);
    on<CallStartEvent>(_onStartCall);
    on<CallAcceptEvent>(_onAcceptCall);
    on<CallRejectEvent>(_onRejectCall);
    on<CallEndEvent>(_onEndCall);
    on<CallToggleMuteEvent>(_onToggleMute);
    on<CallToggleSpeakerEvent>(_onToggleSpeaker);
    on<CallToggleVideoEvent>(_onToggleVideo);
    on<CallUpdateActiveCallsEvent>(_onUpdateActiveCalls);
    on<CallUpdateIncomingEvent>(_onUpdateIncoming);
    on<CallUpdateLocalStreamEvent>(_onUpdateLocalStream);
    on<CallUpdateRemoteStreamEvent>(_onUpdateRemoteStream);

    _setupSubscriptions();
  }

  void _setupSubscriptions() {
    _activeCallsSub = _callManager.activeCallsStream.listen((calls) {
      add(CallUpdateActiveCallsEvent(calls));
    });

    _incomingCallSub = _callManager.incomingCallStream.listen((incoming) {
      add(CallUpdateIncomingEvent(incoming));
    });

    _webRTCService.onLocalStream = (stream) {
      add(CallUpdateLocalStreamEvent(stream));
    };

    _webRTCService.onRemoteStream = (socketId, stream) {
      add(CallUpdateRemoteStreamEvent(socketId, stream));
    };
  }

  void _onInitialize(CallInitializeEvent event, Emitter<CallBlocState> emit) {
    _callManager.setCurrentUser({
      'id': event.userId,
      'username': event.userName,
      'avatar_url': event.avatarUrl,
    });
    emit(state.copyWith(isInitialized: true));
  }

  Future<void> _onStartCall(CallStartEvent event, Emitter<CallBlocState> emit) async {
    await _callManager.initiateCall(
      event.targetUserId,
      event.targetUserName,
      avatarUrl: event.avatarUrl,
    );
  }

  Future<void> _onAcceptCall(CallAcceptEvent event, Emitter<CallBlocState> emit) async {
    await _callManager.acceptCall(event.socketId);
  }

  void _onRejectCall(CallRejectEvent event, Emitter<CallBlocState> emit) {
    _callManager.rejectCall(event.socketId);
  }

  void _onEndCall(CallEndEvent event, Emitter<CallBlocState> emit) {
    _callManager.endCall(event.socketId);
  }

  void _onToggleMute(CallToggleMuteEvent event, Emitter<CallBlocState> emit) {
    final nextMuted = !state.isMuted;
    if (_webRTCService.localStream != null) {
      for (final track in _webRTCService.localStream!.getAudioTracks()) {
        track.enabled = !nextMuted;
      }
    }
    emit(state.copyWith(isMuted: nextMuted));
  }

  void _onToggleSpeaker(CallToggleSpeakerEvent event, Emitter<CallBlocState> emit) {
    final nextSpeaker = !state.isSpeaker;
    Helper.setSpeakerphoneOn(nextSpeaker);
    emit(state.copyWith(isSpeaker: nextSpeaker));
  }

  Future<void> _onToggleVideo(CallToggleVideoEvent event, Emitter<CallBlocState> emit) async {
    final nextVideoActive = !state.isVideoActive;
    if (nextVideoActive) {
      await _webRTCService.startLocalVideo();
    } else {
      await _webRTCService.stopLocalVideo();
    }
    emit(state.copyWith(isVideoActive: nextVideoActive));
  }

  void _onUpdateActiveCalls(CallUpdateActiveCallsEvent event, Emitter<CallBlocState> emit) {
    emit(state.copyWith(activeCalls: event.activeCalls));
  }

  void _onUpdateIncoming(CallUpdateIncomingEvent event, Emitter<CallBlocState> emit) {
    emit(state.copyWith(incomingCall: event.incomingCall));
  }

  void _onUpdateLocalStream(CallUpdateLocalStreamEvent event, Emitter<CallBlocState> emit) {
    emit(state.copyWith(localStream: event.localStream));
  }

  void _onUpdateRemoteStream(CallUpdateRemoteStreamEvent event, Emitter<CallBlocState> emit) {
    final updatedStreams = Map<String, MediaStream>.from(state.remoteStreams);
    // Cleanup any obsolete streams that are no longer associated with active peer connections
    updatedStreams.removeWhere((k, _) => !_webRTCService.peerConnections.containsKey(k) && k != event.socketId);
    updatedStreams[event.socketId] = event.remoteStream;
    emit(state.copyWith(remoteStreams: updatedStreams));
  }

  @override
  Future<void> close() {
    _activeCallsSub?.cancel();
    _incomingCallSub?.cancel();
    _callManager.cleanup();
    return super.close();
  }
}
