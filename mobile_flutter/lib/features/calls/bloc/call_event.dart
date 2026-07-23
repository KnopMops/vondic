import 'package:equatable/equatable.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../../core/webrtc/call_state.dart';

abstract class CallBlocEvent extends Equatable {
  const CallBlocEvent();

  @override
  List<Object?> get props => [];
}

class CallInitializeEvent extends CallBlocEvent {
  final String userId;
  final String userName;
  final String? avatarUrl;

  const CallInitializeEvent({
    required this.userId,
    required this.userName,
    this.avatarUrl,
  });

  @override
  List<Object?> get props => [userId, userName, avatarUrl];
}

class CallStartEvent extends CallBlocEvent {
  final String targetUserId;
  final String targetUserName;
  final String? avatarUrl;

  const CallStartEvent({
    required this.targetUserId,
    required this.targetUserName,
    this.avatarUrl,
  });

  @override
  List<Object?> get props => [targetUserId, targetUserName, avatarUrl];
}

class CallAcceptEvent extends CallBlocEvent {
  final String socketId;
  const CallAcceptEvent(this.socketId);

  @override
  List<Object?> get props => [socketId];
}

class CallRejectEvent extends CallBlocEvent {
  final String socketId;
  const CallRejectEvent(this.socketId);

  @override
  List<Object?> get props => [socketId];
}

class CallEndEvent extends CallBlocEvent {
  final String socketId;
  const CallEndEvent(this.socketId);

  @override
  List<Object?> get props => [socketId];
}

class CallToggleMuteEvent extends CallBlocEvent {}

class CallToggleSpeakerEvent extends CallBlocEvent {}

class CallToggleVideoEvent extends CallBlocEvent {}

class CallUpdateActiveCallsEvent extends CallBlocEvent {
  final Map<String, CallState> activeCalls;
  const CallUpdateActiveCallsEvent(this.activeCalls);

  @override
  List<Object?> get props => [activeCalls];
}

class CallUpdateIncomingEvent extends CallBlocEvent {
  final CallState? incomingCall;
  const CallUpdateIncomingEvent(this.incomingCall);

  @override
  List<Object?> get props => [incomingCall];
}

class CallUpdateLocalStreamEvent extends CallBlocEvent {
  final MediaStream localStream;
  const CallUpdateLocalStreamEvent(this.localStream);

  @override
  List<Object?> get props => [localStream];
}

class CallUpdateRemoteStreamEvent extends CallBlocEvent {
  final String socketId;
  final MediaStream remoteStream;
  const CallUpdateRemoteStreamEvent(this.socketId, this.remoteStream);

  @override
  List<Object?> get props => [socketId, remoteStream];
}
