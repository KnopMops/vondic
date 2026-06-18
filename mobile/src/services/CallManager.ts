import {socketService} from './SocketService';
import {WebRTCService, CallState} from './WebRTCService';
import {appLog} from '@/utils/appLogger';
import type {MediaStream} from 'react-native-webrtc';

export type {CallState} from './WebRTCService';

export interface CallRecord {
  id: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: number;
  startTime: Date;
  endTime: Date;
  status: 'completed' | 'missed' | 'rejected';
}

export class CallManager {
  public webRTCService: WebRTCService;
  private currentCalls: Map<string, CallState> = new Map();
  private callHistory: CallRecord[] = [];
  private incomingCall: CallState | null = null;
  private activeGroupCallId: string | null = null;
  private currentUser: {id: string; name: string; avatar?: string} | null = null;
  private listenersInitialized = false;

  public onIncomingCall?: (call: CallState) => void;
  public onCallAccepted?: (call: CallState, oldSocketId?: string) => void;
  public onCallRejected?: (call: CallState, reason?: string) => void;
  public onCallEnded?: (call: CallState) => void;
  public onCallFailed?: (call: CallState, error: string) => void;
  public onCallStateChange?: (socketId: string, state: CallState) => void;
  public onRemoteStream?: (socketId: string, stream: MediaStream) => void;
  public onGroupCallIdChange?: (groupId: string | null) => void;

  private static instance: CallManager | null = null;

  public static getInstance(webRTCService: WebRTCService): CallManager {
    if (!CallManager.instance) {
      CallManager.instance = new CallManager(webRTCService);
    }
    return CallManager.instance;
  }

  public static resetInstance(): void {
    CallManager.instance = null;
  }

  constructor(webRTCService: WebRTCService) {
    this.webRTCService = webRTCService;
    this.setupSocketListeners();
    this.setupWebRTCCallbacks();
  }

  public setCurrentUser(user: {id: string; name: string; avatar?: string}) {
    this.currentUser = user;
  }

  private setupWebRTCCallbacks(): void {
    this.webRTCService.onRemoteStream = (socketId, stream) => {
      const call = this.currentCalls.get(socketId);
      if (call && call.status !== 'ringing') {
        call.status = 'connected';
        call.startTime = new Date();
        this.updateCallState(socketId, call);
      }
      if (this.onRemoteStream) {
        this.onRemoteStream(socketId, stream);
      }
    };

    this.webRTCService.onConnectionStateChange = (socketId, state) => {
      const call = this.currentCalls.get(socketId);
      if (call) {
        if (state === 'connected') {
          if (call.status !== 'ringing') {
            call.status = 'connected';
            call.startTime = new Date();
            this.updateCallState(socketId, call);
          }
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.handleCallEnded(socketId);
        }
      }
    };

    this.webRTCService.onCallMigrated = (oldKey, newKey) => {
      const call = this.currentCalls.get(oldKey);
      if (call) {
        call.socketId = newKey;
        this.currentCalls.delete(oldKey);
        this.currentCalls.set(newKey, call);
        this.updateCallState(newKey, call);
      }
    };
  }

  private setupSocketListeners(): void {
    console.log(
      '[CallManager] setupSocketListeners called, initialized=',
      this.listenersInitialized,
    );
    if (this.listenersInitialized) return;
    this.listenersInitialized = true;
    console.log('[CallManager] Socket listeners registered');

    // Group / voice channel events are kept as minimal stubs.
    socketService.on('group_call_started', (data: any) => {
      console.log('Group call started:', data);
      this.activeGroupCallId = data?.call_id ?? null;
      if (this.onGroupCallIdChange) this.onGroupCallIdChange(this.activeGroupCallId);
    });

    socketService.on('incoming_group_call', (data: any) => {
      console.log('Incoming group call:', data);
      const callState: CallState = {
        socketId: '',
        userId: data?.group_id || '',
        userName: 'Групповой звонок',
        avatarUrl: data?.caller_avatar_url,
        status: 'ringing',
        startTime: new Date(),
        isGroupCall: true,
        groupId: data?.group_id,
        callId: data?.call_id,
      };
      this.incomingCall = callState;
      if (this.onIncomingCall) this.onIncomingCall(callState);
    });

    socketService.on('group_call_participant_joined', async (data: any) => {
      console.log('Participant joined group call:', data);
      const { call_id, user_id, socket_id, username, avatar_url } = data;

      if (!this.activeGroupCallId && call_id) {
        this.activeGroupCallId = call_id;
        if (this.onGroupCallIdChange) this.onGroupCallIdChange(call_id);
      }
      if (this.activeGroupCallId !== call_id) {
        console.log(`[GroupCall] Skipping - activeGroupCallId (${this.activeGroupCallId}) !== call_id (${call_id})`);
        return;
      }
      if (socket_id === socketService.getSocket()?.id) return;

      const existingPc = this.webRTCService.peerConnections.get(socket_id);
      if (existingPc && existingPc.signalingState === 'stable') {
        console.log(`Already connected to ${socket_id}, skipping`);
        return;
      }

      const pendingKey = `pending_${socket_id}`;
      if ((this as any)[pendingKey]) {
        console.log(`Already connecting to ${socket_id}, skipping duplicate event`);
        return;
      }
      (this as any)[pendingKey] = true;

      try {
        if (!this.webRTCService.getLocalStream()) {
          try {
            await this.webRTCService.initializeLocalStream();
          } catch (error) {
            console.error('Failed to initialize local stream:', error);
            return;
          }
        }

        const mySocketId = socketService.getSocket()?.id;
        if (!mySocketId) {
          console.error('Socket ID is not available');
          return;
        }
        const iCreateOffer = mySocketId < socket_id;

        if (iCreateOffer) {
          console.log(`I (${mySocketId}) am creating offer for ${socket_id}`);
          const pc = this.webRTCService.getPeerConnection(socket_id) || this.webRTCService.createPeerConnection(socket_id);

          if (pc.signalingState !== 'stable') {
            console.log(`Cannot create offer: PC state is ${pc.signalingState}`);
            return;
          }

          const localStream = this.webRTCService.getLocalStream();
          if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
              const senders = (pc as any).getSenders();
              const existingSender = senders.find((s: any) => s.track?.kind === 'audio');
              if (!existingSender) {
                pc.addTrack(audioTrack, localStream);
                console.log(`[GroupCall] Added audio track for ${socket_id}`);
              } else if (existingSender.track !== audioTrack) {
                await existingSender.replaceTrack(audioTrack);
                console.log(`[GroupCall] Replaced audio track for ${socket_id}`);
              }
            }
          }

          const offer = await pc.createOffer({});
          await pc.setLocalDescription(offer);

          socketService.emit('offer', {
            target_socket_id: socket_id,
            offer: {
              sdp: offer.sdp,
              type: offer.type,
            },
            caller_user_id: this.currentUser?.id,
            caller_username: this.currentUser?.name,
            caller_avatar_url: this.currentUser?.avatar,
          });

          const callState: CallState = {
            socketId: socket_id,
            userId: user_id,
            userName: username,
            avatarUrl: avatar_url,
            status: 'calling',
            startTime: new Date(),
            isGroupCall: true,
            callId: call_id,
          };
          this.currentCalls.set(socket_id, callState);
          this.updateCallState(socket_id, callState);
        } else {
          console.log(`I (${mySocketId}) am waiting for offer from ${socket_id} (mySocketId > theirSocketId)`);
          const pc = this.webRTCService.getPeerConnection(socket_id) || this.webRTCService.createPeerConnection(socket_id);

          const localStream = this.webRTCService.getLocalStream();
          if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
              const senders = (pc as any).getSenders();
              const existingSender = senders.find((s: any) => s.track?.kind === 'audio');
              if (!existingSender) {
                pc.addTrack(audioTrack, localStream);
                console.log(`[GroupCall] Added audio track for ${socket_id} (answerer)`);
              } else if (existingSender.track !== audioTrack) {
                await existingSender.replaceTrack(audioTrack);
                console.log(`[GroupCall] Replaced audio track for ${socket_id} (answerer)`);
              }
            }
          }

          const callState: CallState = {
            socketId: socket_id,
            userId: user_id,
            userName: username,
            avatarUrl: avatar_url,
            status: 'calling',
            startTime: new Date(),
            isGroupCall: true,
            callId: call_id,
          };
          this.currentCalls.set(socket_id, callState);
          this.updateCallState(socket_id, callState);
        }
      } finally {
        delete (this as any)[pendingKey];
      }
    });

    socketService.on('group_call_accepted', (data: any) => {
      console.log('Group call accepted:', data);
    });

    socketService.on('group_call_rejected', (data: any) => {
      console.log('Group call rejected:', data);
      if (data.call_id === this.activeGroupCallId) {
        this.leaveGroupCall(data.call_id);
      }
    });

    socketService.on('group_call_ended', (data: any) => {
      const callId = data?.call_id;
      if (this.activeGroupCallId === callId) {
        this.activeGroupCallId = null;
        if (this.onGroupCallIdChange) this.onGroupCallIdChange(null);
        this.webRTCService.peerConnections.forEach(pc => {
          try {
            pc.close();
          } catch {}
        });
        this.webRTCService.peerConnections.clear();
        this.currentCalls.clear();
        if (this.onCallEnded) {
          this.onCallEnded({
            socketId: '',
            userId: '',
            status: 'ended',
            isGroupCall: true,
            callId,
          });
        }
      }
    });

    socketService.on('voice_channel_participant_joined', async (data: any) => {
      console.log('Voice channel participant joined:', data);
      const { channel_id, user_id, socket_id, username, avatar_url } = data;
      if (!channel_id || !socket_id) return;
      if (socket_id === socketService.getSocket()?.id) return;

      const existingPc = this.webRTCService.peerConnections.get(socket_id);
      if (existingPc && existingPc.signalingState === 'stable') {
        console.log(`Already connected to ${socket_id}, skipping`);
        return;
      }

      const mySocketId = socketService.getSocket()?.id;
      if (!mySocketId) {
        console.error('Socket ID is not available');
        return;
      }
      const iCreateOffer = mySocketId < socket_id;

      if (!this.webRTCService.getLocalStream()) {
        try {
          await this.webRTCService.initializeLocalStream();
        } catch (error) {
          console.error('Failed to initialize local stream:', error);
          return;
        }
      }

      if (iCreateOffer) {
        console.log(`I (${mySocketId}) am creating offer for ${socket_id}`);
        const pc = this.webRTCService.getPeerConnection(socket_id) || this.webRTCService.createPeerConnection(socket_id);

        if (pc.signalingState !== 'stable') {
          console.log(`Cannot create offer: PC state is ${pc.signalingState}`);
          return;
        }

        const localStream = this.webRTCService.getLocalStream();
        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            const senders = (pc as any).getSenders();
            const existingSender = senders.find((s: any) => s.track?.kind === 'audio');
            if (!existingSender) {
              pc.addTrack(audioTrack, localStream);
              console.log(`[VoiceChannel] Added audio track for ${socket_id}`);
            } else if (existingSender.track !== audioTrack) {
              await existingSender.replaceTrack(audioTrack);
              console.log(`[VoiceChannel] Replaced audio track for ${socket_id}`);
            }
          }
        }

        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);

        socketService.emit('offer', {
          target_socket_id: socket_id,
          offer: {
            sdp: offer.sdp,
            type: offer.type,
          },
          caller_user_id: this.currentUser?.id,
          caller_username: this.currentUser?.name,
          caller_avatar_url: this.currentUser?.avatar,
        });

        const callState: CallState = {
          socketId: socket_id,
          userId: user_id,
          userName: username,
          avatarUrl: avatar_url,
          status: 'calling',
          startTime: new Date(),
          isGroupCall: true,
          groupId: channel_id,
        };
        this.currentCalls.set(socket_id, callState);
        this.updateCallState(socket_id, callState);
      } else {
        console.log(`I (${mySocketId}) am waiting for offer from ${socket_id} (mySocketId > theirSocketId)`);
        const pc = this.webRTCService.getPeerConnection(socket_id) || this.webRTCService.createPeerConnection(socket_id);

        const localStream = this.webRTCService.getLocalStream();
        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            const senders = (pc as any).getSenders();
            const existingSender = senders.find((s: any) => s.track?.kind === 'audio');
            if (!existingSender) {
              pc.addTrack(audioTrack, localStream);
              console.log(`[VoiceChannel] Added audio track for ${socket_id} (answerer)`);
            } else if (existingSender.track !== audioTrack) {
              await existingSender.replaceTrack(audioTrack);
              console.log(`[VoiceChannel] Replaced audio track for ${socket_id} (answerer)`);
            }
          }
        }

        const callState: CallState = {
          socketId: socket_id,
          userId: user_id,
          userName: username,
          avatarUrl: avatar_url,
          status: 'calling',
          startTime: new Date(),
          isGroupCall: true,
          groupId: channel_id,
        };
        this.currentCalls.set(socket_id, callState);
        this.updateCallState(socket_id, callState);
      }
    });

    socketService.on('voice_channel_participant_left', (data: any) => {
      const socketId = data?.socket_id;
      if (socketId) this.handleCallEnded(socketId);
    });

    // --- Direct calls (website logic) ---
    socketService.on('incoming_call', (...args: any[]) => {
      console.log(
        '[CallManager] incoming_call raw:',
        JSON.stringify(args[0]),
      );
      appLog('CallManager', 'incoming_call', args[0]);
      let from_socket_id: string | undefined;
      let offer: any | undefined;
      let caller_user_id: string | undefined;
      let caller_username: string | undefined;
      let caller_avatar_url: string | undefined;

      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        from_socket_id = firstArg.from_socket_id || firstArg.caller_socket_id;
        caller_user_id = firstArg.caller_user_id;
        caller_username = firstArg.caller_username;
        caller_avatar_url = firstArg.caller_avatar_url;

        if (firstArg.offer) {
          offer = firstArg.offer;
        } else if (firstArg.offer_json) {
          try {
            offer = JSON.parse(firstArg.offer_json);
          } catch {
            /* ignore */
          }
        } else if (firstArg.sdp && firstArg.type) {
          offer = {sdp: firstArg.sdp, type: firstArg.type};
        } else if (firstArg.payload?.offer) {
          offer = firstArg.payload.offer;
        } else if (firstArg.data?.offer) {
          offer = firstArg.data.offer;
        }
      } else if (args.length >= 2) {
        if (typeof args[0] === 'string') from_socket_id = args[0];
        if (typeof args[1] === 'object') offer = args[1];
        caller_user_id = firstArg?.caller_user_id;
        caller_username = firstArg?.caller_username;
        caller_avatar_url = firstArg?.caller_avatar_url;
      }

      if (from_socket_id && offer) {
        this.handleIncomingCall(from_socket_id, offer, {
          userId: caller_user_id,
          userName: caller_username,
          avatarUrl: caller_avatar_url,
        });
      } else if (from_socket_id) {
        const callState: CallState = {
          socketId: from_socket_id,
          userId: caller_user_id || from_socket_id,
          userName: caller_username || 'Неизвестный пользователь',
          avatarUrl: caller_avatar_url,
          status: 'ringing',
          startTime: new Date(),
          isIncoming: true,
        };
        this.incomingCall = callState;
        this.currentCalls.set(from_socket_id, callState);
        if (this.onIncomingCall) this.onIncomingCall(callState);

        socketService.emit('request_offer', {
          target_socket_id: from_socket_id,
        });
      }
    });

    socketService.on('call_accepted', (...args: any[]) => {
      appLog('CallManager', 'call_accepted', args[0]);
      let responder_socket_id: string | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        responder_socket_id = firstArg.responder_socket_id;
      } else if (typeof firstArg === 'string') {
        responder_socket_id = firstArg;
      }
      if (responder_socket_id) {
        this.handleCallAcceptedSignal(responder_socket_id);
      }
    });

    // Mobile-specific event that carries the SDP answer directly.
    socketService.on('call_answer', (...args: any[]) => {
      console.log('[CallManager] call_answer raw:', JSON.stringify(args[0]));
      appLog('CallManager', 'call_answer', args[0]);
      const firstArg = args[0];
      if (!firstArg || typeof firstArg !== 'object') return;
      const {socket_id, answer, target_user_id} = firstArg;
      console.log('[CallManager] call_answer parsed:', {
        socket_id,
        hasAnswer: !!answer,
        target_user_id,
      });
      if (!socket_id || !answer) return;

      let userId: string | undefined = target_user_id;
      if (!userId) {
        const callBySocket = this.currentCalls.get(socket_id);
        if (callBySocket && !callBySocket.isGroupCall) {
          userId = callBySocket.userId;
        } else {
          for (const [key, call] of this.currentCalls.entries()) {
            if (
              (call.status === 'calling' || call.status === 'connected') &&
              !call.isGroupCall
            ) {
              userId = call.userId;
              break;
            }
          }
        }
      }
      if (!userId) {
        console.warn('[CallManager] call_answer: no matching outgoing call');
        return;
      }

      this.webRTCService.mapSocketIdToUserId(socket_id, userId);
      this.webRTCService.handleAnswer({sender_socket_id: socket_id, answer});
      this.webRTCService.migrateCall(userId, socket_id);

      const call =
        this.currentCalls.get(userId) || this.currentCalls.get(socket_id);
      if (call) {
        call.status = 'connected';
        call.socketId = socket_id;
        if (!call.startTime) call.startTime = new Date();
        if (this.currentCalls.has(userId)) {
          this.currentCalls.delete(userId);
        }
        this.currentCalls.set(socket_id, call);
        if (this.onCallStateChange) this.onCallStateChange(socket_id, call);
        if (this.onCallAccepted) this.onCallAccepted(call, userId);
        appLog('CallManager', 'call_answer processed', {
          userId,
          socketId: socket_id,
          status: call.status,
        });
      }
    });

    socketService.on('answer', (...args: any[]) => {
      appLog('CallManager', 'answer', args[0]);
      let sender_socket_id: string | undefined;
      let answer: any | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        sender_socket_id =
          firstArg.sender_socket_id ||
          firstArg.from_socket_id ||
          firstArg.responder_socket_id ||
          firstArg.target_socket_id;
        answer = firstArg.answer;
      }
      if (
        sender_socket_id &&
        sender_socket_id === socketService.getSocket()?.id
      ) {
        sender_socket_id = undefined;
      }
      if (sender_socket_id && answer) {
        let userId: string | undefined;
        const callBySocket = this.currentCalls.get(sender_socket_id);
        if (callBySocket && !callBySocket.isGroupCall) {
          userId = callBySocket.userId;
        } else {
          for (const [key, call] of this.currentCalls.entries()) {
            if (
              (call.status === 'calling' || call.status === 'connected') &&
              !call.isGroupCall
            ) {
              userId = call.userId;
              break;
            }
          }
        }
        if (userId) {
          this.webRTCService.mapSocketIdToUserId(sender_socket_id, userId);
        }
        this.webRTCService.handleAnswer({
          sender_socket_id,
          answer,
        });
        this.handleCallAcceptedSignal(sender_socket_id);
      }
    });

    socketService.on('offer', async (...args: any[]) => {
      appLog('CallManager', 'offer', args[0]);
      let from_socket_id: string | undefined;
      let offer: any | undefined;
      let caller_user_id: string | undefined;
      let caller_username: string | undefined;
      let caller_avatar_url: string | undefined;

      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        from_socket_id =
          firstArg.from_socket_id ||
          firstArg.caller_socket_id ||
          firstArg.sender_socket_id;
        caller_user_id = firstArg.caller_user_id;
        caller_username = firstArg.caller_username;
        caller_avatar_url = firstArg.caller_avatar_url;

        if (firstArg.offer) {
          offer = firstArg.offer;
        } else if (firstArg.offer_json) {
          try {
            offer = JSON.parse(firstArg.offer_json);
          } catch {}
        } else if (firstArg.sdp && firstArg.type) {
          offer = {sdp: firstArg.sdp, type: firstArg.type};
        } else if (firstArg.payload?.offer) {
          offer = firstArg.payload.offer;
        } else if (firstArg.data?.offer) {
          offer = firstArg.data.offer;
        }
      } else if (args.length >= 2) {
        if (typeof args[0] === 'string') from_socket_id = args[0];
        if (typeof args[1] === 'object') offer = args[1];
      }

      if (!from_socket_id || !offer) return;

      const existingPc = this.webRTCService.peerConnections.get(from_socket_id);
      if (existingPc) {
        if (existingPc.signalingState === 'stable') {
          await this.webRTCService.handleRenegotiationOffer(from_socket_id, offer);
          const call = this.currentCalls.get(from_socket_id);
          if (call) {
            call.status = 'connected';
            this.updateCallState(from_socket_id, call);
          }
        } else if (existingPc.signalingState === 'have-local-offer') {
          const mySocketId = socketService.getSocket()?.id;
          if (mySocketId && mySocketId < from_socket_id) {
            console.log(
              `Glare: I (${mySocketId}) win, ignoring offer from ${from_socket_id}`,
            );
          } else {
            console.log(
              `Glare: They (${from_socket_id}) win, rolling back and accepting offer`,
            );
            try {
              await existingPc.setLocalDescription({type: 'rollback'} as any);
              await this.webRTCService.handleRenegotiationOffer(
                from_socket_id,
                offer,
              );
            } catch (e) {
              console.error('Glare resolution failed:', e);
            }
          }
        } else {
          console.log(`Skipping offer: PC state is ${existingPc.signalingState}`);
        }
      } else if (this.currentCalls.has(from_socket_id)) {
        await this.webRTCService
          .handleRenegotiationOffer(from_socket_id, offer)
          .catch(e => console.error('Renegotiation failed:', e));
      } else {
        this.handleIncomingCall(from_socket_id, offer, {
          userId: caller_user_id,
          userName: caller_username,
          avatarUrl: caller_avatar_url,
        });
      }
    });

    socketService.on('ice_candidate', (...args: any[]) => {
      appLog('CallManager', 'ice_candidate', args[0]);
      let from_socket_id: string | undefined;
      let candidate: any | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        from_socket_id =
          firstArg.from_socket_id ||
          firstArg.caller_socket_id ||
          firstArg.sender_socket_id;
        candidate = firstArg.candidate;
      } else if (args.length >= 2) {
        if (typeof args[0] === 'string') from_socket_id = args[0];
        if (typeof args[1] === 'object') candidate = args[1];
      }
      if (from_socket_id && candidate) {
        console.log('Received ICE candidate from:', from_socket_id);
        this.webRTCService.handleIceCandidate({
          sender_socket_id: from_socket_id,
          candidate,
        });
      }
    });

    socketService.on('call_end', (...args: any[]) => {
      console.log('DEBUG: call_end raw args:', JSON.stringify(args));
      let from_socket_id: string | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        from_socket_id =
          firstArg.from_socket_id ||
          firstArg.caller_socket_id ||
          firstArg.sender_socket_id ||
          firstArg.responder_socket_id ||
          firstArg.target_socket_id;
      } else if (typeof firstArg === 'string') {
        from_socket_id = firstArg;
      }
      if (from_socket_id) {
        this.handleCallEnded(from_socket_id);
      }
    });

    socketService.on('call_ended', (...args: any[]) => {
      console.log('DEBUG: call_ended raw args:', JSON.stringify(args));
      let from_socket_id: string | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        from_socket_id =
          firstArg.from_socket_id ||
          firstArg.caller_socket_id ||
          firstArg.sender_socket_id ||
          firstArg.responder_socket_id ||
          firstArg.target_socket_id;
      } else if (typeof firstArg === 'string') {
        from_socket_id = firstArg;
      }
      if (from_socket_id) {
        this.handleCallEnded(from_socket_id);
      }
    });

    socketService.on('call_reject', (...args: any[]) => {
      console.log('DEBUG: call_reject raw args:', JSON.stringify(args));
      let from_socket_id: string | undefined;
      let reason: string | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        from_socket_id =
          firstArg.from_socket_id ||
          firstArg.caller_socket_id ||
          firstArg.sender_socket_id ||
          firstArg.responder_socket_id ||
          firstArg.target_socket_id;
        reason = firstArg.reason;
      } else if (typeof firstArg === 'string') {
        from_socket_id = firstArg;
      }
      if (from_socket_id) {
        this.handleCallRejected(from_socket_id, reason);
      }
    });

    socketService.on('call_rejected', (...args: any[]) => {
      console.log('DEBUG: call_rejected raw args:', JSON.stringify(args));
      let from_socket_id: string | undefined;
      let reason: string | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        from_socket_id =
          firstArg.from_socket_id ||
          firstArg.caller_socket_id ||
          firstArg.sender_socket_id ||
          firstArg.responder_socket_id ||
          firstArg.target_socket_id;
        reason = firstArg.reason;
      } else if (typeof firstArg === 'string') {
        from_socket_id = firstArg;
      }
      if (from_socket_id) {
        this.handleCallRejected(from_socket_id, reason);
      }
    });

    socketService.on('error', (data: any) => {
      const message =
        typeof data?.message === 'string' ? data.message : String(data);
      const hasActiveCall =
        this.currentCalls.size > 0 ||
        !!this.incomingCall ||
        !!this.activeGroupCallId;
      if (!hasActiveCall) return;
      if (/attachments must be a list/i.test(message)) return;
      this.handleCallFailed(message || 'Unknown error');
    });

    socketService.on('call_failed', (data: any) => {
      const message =
        typeof data?.message === 'string' ? data.message : String(data);
      this.handleCallFailed(message || 'Unknown error');
    });

    socketService.on('video_state_changed', (data: any) => {
      console.log('[CallManager] Video state changed:', data);
      const from_socket_id =
        data?.from_socket_id || data?.sender_socket_id || data?.caller_socket_id;
      const currentStream = from_socket_id
        ? this.webRTCService.getRemoteStream(from_socket_id)
        : null;
      if (currentStream && this.onRemoteStream) {
        this.onRemoteStream(from_socket_id, currentStream);
      }
    });
  }

  private handleCallAcceptedSignal(responderSocketId: string): void {
    console.log(
      '[CallManager] handleCallAcceptedSignal responderSocketId=',
      responderSocketId,
    );
    appLog('CallManager', 'handleCallAcceptedSignal', {
      responderSocketId,
      currentCallsKeys: Array.from(this.currentCalls.keys()),
    });

    let call = this.currentCalls.get(responderSocketId);
    let oldKey: string | undefined;

    if (!call) {
      for (const [key, c] of this.currentCalls.entries()) {
        if (
          (c.status === 'calling' || c.status === 'connected') &&
          !c.isGroupCall
        ) {
          call = c;
          oldKey = key;
          console.log('[CallManager] Found calling/connected call by key=', key);
          break;
        }
      }
    }

    if (call) {
      call.status = 'connected';
      if (!call.startTime) call.startTime = new Date();
      call.socketId = responderSocketId;
      if (oldKey && oldKey !== responderSocketId) {
        this.webRTCService.migrateCall(oldKey, responderSocketId);
        this.currentCalls.delete(oldKey);
      }
      this.currentCalls.set(responderSocketId, call);
      console.log('[CallManager] Call accepted, userId=', call.userId);
      if (this.onCallAccepted) this.onCallAccepted(call, oldKey);
      if (this.onCallStateChange)
        this.onCallStateChange(responderSocketId, call);
      appLog('CallManager', 'handleCallAcceptedSignal success', {
        responderSocketId,
        userId: call.userId,
        status: call.status,
      });
    } else {
      console.warn('[CallManager] handleCallAcceptedSignal: no matching call found');
      appLog('CallManager', 'handleCallAcceptedSignal no call');
    }
  }

  private async handleIncomingCall(
    fromSocketId: string,
    offer: any,
    callerInfo?: {userId?: string; userName?: string; avatarUrl?: string},
  ): Promise<void> {
    try {
      console.log('Handling incoming call from socket:', fromSocketId);

      const callState: CallState = {
        socketId: fromSocketId,
        userId: callerInfo?.userId || fromSocketId,
        userName: callerInfo?.userName || 'Входящий звонок',
        avatarUrl: callerInfo?.avatarUrl,
        status: 'ringing',
        startTime: new Date(),
        isIncoming: true,
      };

      this.incomingCall = callState;
      this.currentCalls.set(fromSocketId, callState);
      console.log('Incoming call state set:', callState);

      if (this.onIncomingCall) {
        this.onIncomingCall(callState);
      }

      await this.webRTCService.handleIncomingCall(fromSocketId, offer);
    } catch (error) {
      console.error('Failed to handle incoming call:', error);
    }
  }

  private handleCallEnded(
    socketId: string,
    status: 'ended' | 'rejected' = 'ended',
  ): void {
    let call = this.currentCalls.get(socketId);
    let resourceKey = socketId;

    if (!call) {
      for (const [key, state] of this.currentCalls.entries()) {
        if (state.status === 'calling') {
          console.log(`Mapping call end/reject from ${key} to ${socketId}`);
          call = state;
          resourceKey = key;
          this.currentCalls.delete(key);
          this.currentCalls.set(socketId, call);
          call.socketId = socketId;
          break;
        }
      }
    }

    this.webRTCService.cleanupCall(resourceKey);
    if (resourceKey !== socketId) {
      this.webRTCService.cleanupCall(socketId);
    }

    if (call) {
      call.status = status;
      call.duration = call.startTime
        ? (new Date().getTime() - call.startTime.getTime()) / 1000
        : 0;
      this.currentCalls.delete(socketId);
      this.updateCallState(socketId, call);
      if (this.onCallEnded) {
        this.onCallEnded(call);
      }
    }

    if (this.incomingCall && this.incomingCall.socketId === socketId) {
      this.incomingCall = null;
    }
  }

  private handleCallRejected(responderSocketId: string, reason?: string): void {
    console.log(
      `Call rejected by ${responderSocketId}, reason: ${reason || 'unknown'}`,
    );
    this.handleCallEnded(responderSocketId, 'rejected');
  }

  private handleCallFailed(message: string): void {
    console.error('Call failed:', message);
    for (const [key, state] of this.currentCalls.entries()) {
      if (state.status === 'calling') {
        state.status = 'failed';
        this.updateCallState(key, state);
        if (this.onCallFailed) {
          this.onCallFailed(state, message);
        }
      }
    }
  }

  private updateCallState(socketId: string, state: CallState): void {
    if (this.onCallStateChange) {
      this.onCallStateChange(socketId, state);
    }
  }

  public async initiateDirectCall(
    targetUserId: string,
    targetUserName: string,
  ): Promise<void> {
    console.log('[CallManager] initiateDirectCall targetUserId=', targetUserId);
    appLog('CallManager', 'initiateDirectCall', {
      targetUserId,
      targetUserName,
    });
    try {
      if (!this.webRTCService.getLocalStream()) {
        await this.webRTCService.initializeLocalStream();
      }
      await this.webRTCService.initiateCall(
        targetUserId,
        this.currentUser?.name,
      );

      const callState: CallState = {
        socketId: targetUserId,
        userId: targetUserId,
        userName: targetUserName,
        status: 'calling',
        startTime: new Date(),
        isIncoming: false,
      };
      this.currentCalls.set(targetUserId, callState);
      this.updateCallState(targetUserId, callState);
    } catch (error) {
      console.error('Failed to initiate call:', error);
      const callState: CallState = {
        socketId: targetUserId,
        userId: targetUserId,
        userName: targetUserName,
        status: 'failed',
        startTime: new Date(),
      };
      this.updateCallState(targetUserId, callState);
      if (this.onCallFailed) {
        this.onCallFailed(
          callState,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    }
  }

  public async initiateGroupCall(groupId: string): Promise<void> {
    console.log('[CallManager] initiateGroupCall groupId=', groupId);
    if (!this.webRTCService.getLocalStream()) {
      await this.webRTCService.initializeLocalStream();
    }
    socketService.emit('call_group', {group_id: groupId});
    this.activeGroupCallId = groupId;
    if (this.onGroupCallIdChange) this.onGroupCallIdChange(groupId);
  }

  public async joinVoiceChannel(channelId: string): Promise<void> {
    console.log('[CallManager] joinVoiceChannel channelId=', channelId);
    if (!this.webRTCService.getLocalStream()) {
      await this.webRTCService.initializeLocalStream();
    }
    socketService.emit('join_voice_channel', {channel_id: channelId});
  }

  public leaveVoiceChannel(channelId: string): void {
    socketService.emit('leave_voice_channel', {channel_id: channelId});
    this.webRTCService.peerConnections.forEach(pc => {
      try {
        pc.close();
      } catch {}
    });
    this.webRTCService.peerConnections.clear();
    this.currentCalls.clear();
  }

  public joinGroupCall(callId: string): void {
    socketService.emit('group_call_answer', {call_id: callId});
  }

  public leaveGroupCall(callId: string): void {
    socketService.emit('group_call_end', {call_id: callId});
    if (this.activeGroupCallId === callId) {
      this.activeGroupCallId = null;
      if (this.onGroupCallIdChange) this.onGroupCallIdChange(null);
    }
    
    // Stop local video if enabled
    this.webRTCService.stopVideo().catch(() => {});
    
    // Close peer connections
    this.webRTCService.peerConnections.forEach(pc => {
      try {
        pc.close();
      } catch {}
    });
    this.webRTCService.peerConnections.clear();
    this.currentCalls.clear();
    
    if (this.onCallEnded) {
      this.onCallEnded({
        socketId: '',
        userId: '',
        status: 'ended',
        isGroupCall: true,
        callId: callId,
      });
    }
  }

  public rejectGroupCall(callId: string): void {
    socketService.emit('group_call_reject', {call_id: callId});
    if (this.incomingCall && this.incomingCall.callId === callId) {
      this.incomingCall = null;
    }
  }

  public async acceptIncomingCall(
    callerSocketId: string,
    callerInfo?: {userId: string; userName: string},
  ): Promise<void> {
    console.log('[CallManager] acceptIncomingCall callerSocketId=', callerSocketId);
    appLog('CallManager', 'acceptIncomingCall', {callerSocketId, callerInfo});
    try {
      if (!this.webRTCService.getLocalStream()) {
        await this.webRTCService.initializeLocalStream();
      }
      await this.webRTCService.acceptCall(callerSocketId);

      if (this.incomingCall && this.incomingCall.socketId === callerSocketId) {
        this.incomingCall = null;
      }

      const call = this.currentCalls.get(callerSocketId);
      if (call) {
        call.status = 'connected';
        call.startTime = new Date();
        if (callerInfo) {
          call.userId = callerInfo.userId;
          call.userName = callerInfo.userName;
        }
        this.updateCallState(callerSocketId, call);
      }
    } catch (error) {
      console.error('Failed to accept call:', error);
      throw error;
    }
  }

  public rejectIncomingCall(callerSocketId: string): void {
    this.webRTCService.rejectCall(callerSocketId);
    this.handleCallEnded(callerSocketId, 'rejected');
    this.incomingCall = null;
  }

  public endCall(targetSocketId: string): void {
    console.log('[CallManager] endCall targetSocketId=', targetSocketId);
    this.webRTCService.endCall(targetSocketId);
    this.handleCallEnded(targetSocketId);
  }

  public endAllCalls(): void {
    for (const socketId of this.currentCalls.keys()) {
      this.endCall(socketId);
    }
  }

  public getIncomingCall(): CallState | null {
    return this.incomingCall;
  }

  public toggleMute(): boolean {
    return this.webRTCService.toggleMute();
  }

  public isMuted(): boolean {
    return this.webRTCService.isMuted();
  }

  public async startVideo(): Promise<void> {
    await this.webRTCService.startVideo();
  }

  public async stopVideo(): Promise<void> {
    await this.webRTCService.stopVideo();
  }

  public async toggleVideo(): Promise<void> {
    await this.webRTCService.toggleVideo();
  }

  public isVideoEnabled(): boolean {
    return this.webRTCService.isVideoEnabled();
  }

  public getActiveGroupCall(groupId: string): Promise<any> {
    return new Promise((resolve) => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        resolve(null);
        return;
      }
      
      const onActiveGroupCall = (data: any) => {
        socket.off('active_group_call', onActiveGroupCall);
        resolve(data?.active_call || null);
      };
      
      socket.on('active_group_call', onActiveGroupCall);
      socket.emit('get_active_group_call', {group_id: groupId});
      
      // Safety timeout
      setTimeout(() => {
        socket.off('active_group_call', onActiveGroupCall);
        resolve(null);
      }, 3000);
    });
  }

  public cleanup(): void {
    this.webRTCService.cleanup();
    this.listenersInitialized = false;
    this.currentCalls.clear();
    this.incomingCall = null;
    this.activeGroupCallId = null;
  }
}
