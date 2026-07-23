import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/call_bloc.dart';
import '../bloc/call_event.dart';
import '../bloc/call_state.dart';

class CallScreen extends StatefulWidget {
  const CallScreen({super.key});

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  Timer? _durationTimer;
  int _callDuration = 0;

  @override
  void initState() {
    super.initState();
    _initRenderers();
    _startDurationCounter();
  }

  Future<void> _initRenderers() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
  }

  void _startDurationCounter() {
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      final activeCalls = context.read<CallBloc>().state.activeCalls;
      final activeCall = activeCalls.values.firstOrNull;
      if (activeCall != null && activeCall.status == 'connected') {
        setState(() {
          _callDuration++;
        });
      }
    });
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  String _formatDuration(int seconds) {
    final int minutes = seconds ~/ 60;
    final int remainingSeconds = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainingSeconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CallBloc, CallBlocState>(
      listener: (context, state) {
        // If there are no active calls and no incoming calls left, pop the screen
        if (state.activeCalls.isEmpty && state.incomingCall == null) {
          context.pop();
        }

        // Bind streams to renderers
        if (state.localStream != null && _localRenderer.srcObject != state.localStream) {
          setState(() {
            _localRenderer.srcObject = state.localStream;
          });
        }

        final remoteStream = state.remoteStreams.values.firstOrNull;
        if (remoteStream != null && _remoteRenderer.srcObject != remoteStream) {
          setState(() {
            _remoteRenderer.srcObject = remoteStream;
          });
        }
      },
      builder: (context, state) {
        final incoming = state.incomingCall;
        final activeCall = state.activeCalls.values.firstOrNull;

        if (incoming != null) {
          return _buildIncomingCallUI(context, incoming);
        }

        if (activeCall != null) {
          return _buildActiveCallUI(context, state, activeCall);
        }

        return const Scaffold(
          body: Center(
            child: CircularProgressIndicator(color: Color(0xFF6C5CE7)),
          ),
        );
      },
    );
  }

  Widget _buildIncomingCallUI(BuildContext context, dynamic incoming) {
    return Scaffold(
      body: Container(
        color: const Color(0xFF0F0F0F),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 60,
                backgroundColor: const Color(0xFF6C5CE7).withOpacity(0.2),
                 backgroundImage: _getAbsoluteAvatarUrl(incoming.avatarUrl) != null 
                     ? NetworkImage(_getAbsoluteAvatarUrl(incoming.avatarUrl)!) 
                     : null,
                 child: _getAbsoluteAvatarUrl(incoming.avatarUrl) == null
                     ? const Icon(Icons.person, size: 60, color: Color(0xFF6C5CE7))
                     : null,
              ),
              const SizedBox(height: 24),
              Text(
                incoming.userName ?? 'Неизвестный абонент',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 8),
              const Text(
                'Входящий звонок Vondic...',
                style: TextStyle(fontSize: 16, color: Colors.white38),
              ),
              const SizedBox(height: 100),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  FloatingActionButton(
                    heroTag: 'decline_btn',
                    onPressed: () {
                      context.read<CallBloc>().add(CallRejectEvent(incoming.socketId));
                    },
                    backgroundColor: Colors.redAccent,
                    child: const Icon(Icons.call_end, color: Colors.white),
                  ),
                  FloatingActionButton(
                    heroTag: 'accept_btn',
                    onPressed: () {
                      context.read<CallBloc>().add(CallAcceptEvent(incoming.socketId));
                    },
                    backgroundColor: Colors.greenAccent,
                    child: const Icon(Icons.call, color: Colors.white),
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActiveCallUI(BuildContext context, CallBlocState state, dynamic call) {
    final isConnected = call.status == 'connected';
    final remoteStream = state.remoteStreams.values.firstOrNull;
    final hasRemoteVideo = remoteStream != null && remoteStream.getVideoTracks().isNotEmpty;

    return Scaffold(
      body: Stack(
        children: [
          // Remote Video Stream (Full Screen if active)
          if (hasRemoteVideo && _remoteRenderer.srcObject != null)
            Positioned.fill(
              child: RTCVideoView(_remoteRenderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
            )
          else
            // Audio-call background
            Container(
              color: const Color(0xFF0F0F0F),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircleAvatar(
                      radius: 60,
                      backgroundColor: const Color(0xFF6C5CE7).withOpacity(0.2),
                       backgroundImage: _getAbsoluteAvatarUrl(call.avatarUrl) != null 
                           ? NetworkImage(_getAbsoluteAvatarUrl(call.avatarUrl)!) 
                           : null,
                       child: _getAbsoluteAvatarUrl(call.avatarUrl) == null
                           ? const Icon(Icons.person, size: 60, color: Color(0xFF6C5CE7))
                           : null,
                    ),
                    const SizedBox(height: 24),
                    Text(
                      call.userName ?? 'Пользователь',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isConnected ? _formatDuration(_callDuration) : 'Установка соединения...',
                      style: const TextStyle(fontSize: 16, color: Colors.white38),
                    ),
                  ],
                ),
              ),
            ),

          // Local Video Stream (Picture-in-picture)
          if (state.isVideoActive && _localRenderer.srcObject != null)
            Positioned(
              right: 16,
              top: 48,
              width: 110,
              height: 150,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: RTCVideoView(
                  _localRenderer,
                  mirror: true,
                  objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                ),
              ),
            ),

          // Action Controls Overlay
          Positioned(
            left: 0,
            right: 0,
            bottom: 48,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // Mute mic button
                FloatingActionButton(
                  heroTag: 'mute_btn',
                  onPressed: () {
                    context.read<CallBloc>().add(CallToggleMuteEvent());
                  },
                  backgroundColor: state.isMuted ? Colors.white : Colors.white10,
                  child: Icon(
                    state.isMuted ? Icons.mic_off : Icons.mic,
                    color: state.isMuted ? Colors.black : Colors.white,
                  ),
                ),
                // Toggle video button
                FloatingActionButton(
                  heroTag: 'video_btn',
                  onPressed: () {
                    context.read<CallBloc>().add(CallToggleVideoEvent());
                  },
                  backgroundColor: state.isVideoActive ? Colors.white : Colors.white10,
                  child: Icon(
                    state.isVideoActive ? Icons.videocam : Icons.videocam_off,
                    color: state.isVideoActive ? Colors.black : Colors.white,
                  ),
                ),
                // Toggle speaker button
                FloatingActionButton(
                  heroTag: 'speaker_btn',
                  onPressed: () {
                    context.read<CallBloc>().add(CallToggleSpeakerEvent());
                  },
                  backgroundColor: state.isSpeaker ? Colors.white : Colors.white10,
                  child: Icon(
                    state.isSpeaker ? Icons.volume_up : Icons.volume_down,
                    color: state.isSpeaker ? Colors.black : Colors.white,
                  ),
                ),
                // Hang up button
                FloatingActionButton(
                  heroTag: 'hangup_btn',
                  onPressed: () {
                    context.read<CallBloc>().add(CallEndEvent(call.socketId));
                  },
                  backgroundColor: Colors.redAccent,
                  child: const Icon(Icons.call_end, color: Colors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String? _getAbsoluteAvatarUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('http')) return url;
    return 'https://vondic.ru$url';
  }
}
