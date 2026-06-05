import {socketService} from './SocketService';
import {WebRTCService, CallState} from './WebRTCService';

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
  public onRemoteStream?: (socketId: string, stream: any) => void;
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
      if (this.onRemoteStream) this.onRemoteStream(socketId, stream);
      const call = this.currentCalls.get(socketId);
      if (call) {
        call.status = 'connected';
        this.currentCalls.set(socketId, call);
        if (this.onCallStateChange) this.onCallStateChange(socketId, call);
      }
    };

    this.webRTCService.onConnectionStateChange = (socketId, state) => {
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        const call = this.currentCalls.get(socketId);
        if (call && call.status === 'connected') {
          this.handleCallEnded(socketId);
        }
      }
    };
  }

  private setupSocketListeners(): void {
    if (this.listenersInitialized) return;
    this.listenersInitialized = true;

    // --- Group calls ---
    socketService.on('group_call_started', (data: any) => {
      this.activeGroupCallId = data.call_id;
      if (this.onGroupCallIdChange) this.onGroupCallIdChange(data.call_id);
      if (data.caller_participant) {
        const {user_id, socket_id, username, avatar_url} = data.caller_participant;
        if (socket_id !== socketService.getSocket()?.id) {
          const callState: CallState = {
            socketId: socket_id,
            userId: user_id,
            userName: username,
            avatarUrl: avatar_url,
            status: 'connected',
            startTime: new Date(),
            isGroupCall: true,
            callId: data.call_id,
          };
          this.currentCalls.set(socket_id, callState);
          if (this.onCallStateChange) this.onCallStateChange(socket_id, callState);
        }
      }
    });

    socketService.on('incoming_group_call', (data: any) => {
      const callState: CallState = {
        socketId: '',
        userId: data.group_id,
        userName: 'Групповой звонок',
        avatarUrl: data.caller_avatar_url,
        status: 'ringing',
        startTime: new Date(),
        isGroupCall: true,
        groupId: data.group_id,
        callId: data.call_id,
      };
      this.incomingCall = callState;
      if (this.onIncomingCall) this.onIncomingCall(callState);
    });

    socketService.on('group_call_participant_joined', async (data: any) => {
      const {call_id, user_id, socket_id, username, avatar_url} = data;
      if (!call_id || !socket_id) return;
      if (socket_id === socketService.getSocket()?.id) return;

      if (!this.activeGroupCallId && call_id) {
        this.activeGroupCallId = call_id;
        if (this.onGroupCallIdChange) this.onGroupCallIdChange(call_id);
      }
      if (this.activeGroupCallId !== call_id) return;

      const existingPc = this.webRTCService.peerConnections.get(socket_id);
      if (existingPc && existingPc.signalingState === 'stable') return;

      const pendingKey = `pending_${socket_id}`;
      if ((this as any)[pendingKey]) return;
      (this as any)[pendingKey] = true;

      try {
        if (!this.webRTCService.getLocalStream()) {
          await this.webRTCService.initializeLocalStream();
        }
        const mySocketId = socketService.getSocket()?.id;
        if (!mySocketId) return;
        const iCreateOffer = mySocketId < socket_id;

        if (iCreateOffer) {
          const pc = this.webRTCService.getPeerConnection(socket_id) || this.webRTCService.createPeerConnection(socket_id);
          const localStream = this.webRTCService.getLocalStream();
          if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
              const existingSender = pc.getSenders().find((s: any) => s.track?.kind === 'audio');
              if (!existingSender) {
                pc.addTrack(audioTrack, localStream);
              } else if (existingSender.track !== audioTrack) {
                await existingSender.replaceTrack(audioTrack);
              }
            }
          }
          const offer = await pc.createOffer({});
          await pc.setLocalDescription(offer);
          socketService.emit('offer', {
            target_socket_id: socket_id,
            offer,
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
          if (this.onCallStateChange) this.onCallStateChange(socket_id, callState);
        } else {
          const pc = this.webRTCService.getPeerConnection(socket_id) || this.webRTCService.createPeerConnection(socket_id);
          const localStream = this.webRTCService.getLocalStream();
          if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
              const existingSender = pc.getSenders().find((s: any) => s.track?.kind === 'audio');
              if (!existingSender) {
                pc.addTrack(audioTrack, localStream);
              } else if (existingSender.track !== audioTrack) {
                await existingSender.replaceTrack(audioTrack);
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
          if (this.onCallStateChange) this.onCallStateChange(socket_id, callState);
        }
      } finally {
        delete (this as any)[pendingKey];
      }
    });

    socketService.on('group_call_ended', (data: any) => {
      if (this.activeGroupCallId === data.call_id) {
        this.activeGroupCallId = null;
        if (this.onGroupCallIdChange) this.onGroupCallIdChange(null);
        this.webRTCService.peerConnections.forEach(pc => {
          try {
            pc.close();
          } catch {
            // ignore
          }
        });
        this.webRTCService.peerConnections.clear();
        this.currentCalls.clear();
        if (this.onCallEnded)
          this.onCallEnded({socketId: '', userId: '', status: 'ended', isGroupCall: true, callId: data.call_id});
      }
    });

    // --- Voice channels ---
    socketService.on('voice_channel_participant_joined', async (data: any) => {
      const {channel_id, user_id, socket_id, username, avatar_url} = data;
      if (!channel_id || !socket_id) return;
      if (socket_id === socketService.getSocket()?.id) return;

      const existingPc = this.webRTCService.peerConnections.get(socket_id);
      if (existingPc && existingPc.signalingState === 'stable') return;

      const mySocketId = socketService.getSocket()?.id;
      if (!mySocketId) return;
      const iCreateOffer = mySocketId < socket_id;

      if (!this.webRTCService.getLocalStream()) {
        try {
          await this.webRTCService.initializeLocalStream();
        } catch {
          return;
        }
      }

      if (iCreateOffer) {
        const pc = this.webRTCService.getPeerConnection(socket_id) || this.webRTCService.createPeerConnection(socket_id);
        const localStream = this.webRTCService.getLocalStream();
        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            const existingSender = pc.getSenders().find((s: any) => s.track?.kind === 'audio');
            if (!existingSender) {
              pc.addTrack(audioTrack, localStream);
            }
          }
        }
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        socketService.emit('offer', {
          target_socket_id: socket_id,
          offer,
          caller_user_id: this.currentUser?.id,
          caller_username: this.currentUser?.name,
          caller_avatar_url: this.currentUser?.avatar,
        });
        const callState: CallState = {
          socketId: socket_id,
          userId: user_id,
          userName: username,
          avatarUrl: avatar_url,
          status: 'connected',
          startTime: new Date(),
          isGroupCall: true,
          callId: channel_id,
        };
        this.currentCalls.set(socket_id, callState);
        if (this.onCallStateChange) this.onCallStateChange(socket_id, callState);
      } else {
        const pc = this.webRTCService.getPeerConnection(socket_id) || this.webRTCService.createPeerConnection(socket_id);
        const localStream = this.webRTCService.getLocalStream();
        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            const existingSender = pc.getSenders().find((s: any) => s.track?.kind === 'audio');
            if (!existingSender) {
              pc.addTrack(audioTrack, localStream);
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
          callId: channel_id,
        };
        this.currentCalls.set(socket_id, callState);
        if (this.onCallStateChange) this.onCallStateChange(socket_id, callState);
      }
    });

    socketService.on('voice_channel_participant_left', (data: any) => {
      const {socket_id} = data;
      if (socket_id) this.handleCallEnded(socket_id);
    });

    // --- Direct calls ---
    socketService.on('incoming_call', (...args: any[]) => {
      console.log('[CallManager] incoming_call raw:', JSON.stringify(args[0]));
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
        if (firstArg.offer) offer = firstArg.offer;
        else if (firstArg.offer_json) {
          try {
            offer = JSON.parse(firstArg.offer_json);
          } catch {
            /* ignore */
          }
        } else if (firstArg.sdp && firstArg.type) {
          offer = {sdp: firstArg.sdp, type: firstArg.type};
        }
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
        };
        this.incomingCall = callState;
        this.currentCalls.set(from_socket_id, callState);
        if (this.onIncomingCall) this.onIncomingCall(callState);
      }
    });

    socketService.on('call_accepted', (...args: any[]) => {
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

    // Server sends 'call_answer' for direct call responses (mobile was listening to wrong event)
    socketService.on('call_answer', (...args: any[]) => {
      console.log('[CallManager] call_answer raw:', JSON.stringify(args[0]));
      const firstArg = args[0];
      if (!firstArg || typeof firstArg !== 'object') return;
      const {socket_id, answer, target_user_id} = firstArg;
      console.log('[CallManager] call_answer parsed:', {socket_id, hasAnswer: !!answer, target_user_id});
      if (!socket_id || !answer) return;

      // Map the responder's socket_id to the target user_id so WebRTC can find the PC
      let userId: string | undefined = target_user_id;
      if (!userId) {
        // Find by looking for an outgoing call to any user
        for (const [key, call] of this.currentCalls.entries()) {
          if (call.status === 'calling') {
            userId = call.userId;
            break;
          }
        }
      }
      if (userId) {
        this.webRTCService.mapSocketIdToUserId(socket_id, userId);
      }

      this.webRTCService.handleAnswer({sender_socket_id: socket_id, answer});

      // Update call status
      const callKey = userId || socket_id;
      const call = this.currentCalls.get(callKey);
      if (call) {
        call.status = 'connected';
        call.socketId = socket_id;
        this.currentCalls.set(callKey, call);
        if (this.onCallStateChange) this.onCallStateChange(callKey, call);
        if (this.onCallAccepted) this.onCallAccepted(call, socket_id);
      } else {
        // Fallback: try updating any call with matching userId
        for (const [key, c] of this.currentCalls.entries()) {
          if (c.userId === userId || c.status === 'calling') {
            c.status = 'connected';
            c.socketId = socket_id;
            this.currentCalls.set(key, c);
            if (this.onCallStateChange) this.onCallStateChange(key, c);
            if (this.onCallAccepted) this.onCallAccepted(c, socket_id);
            break;
          }
        }
      }
    });

    socketService.on('answer', (...args: any[]) => {
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
      if (sender_socket_id && sender_socket_id === socketService.getSocket()?.id) {
        sender_socket_id = undefined;
      }
      if (sender_socket_id && answer) {
        // Map socket_id to user_id for outgoing calls so WebRTC can find the PC
        for (const [key, call] of this.currentCalls.entries()) {
          if (call.status === 'calling') {
            this.webRTCService.mapSocketIdToUserId(sender_socket_id, call.userId);
            break;
          }
        }
        this.webRTCService.handleAnswer({sender_socket_id, answer});
        this.handleCallAcceptedSignal(sender_socket_id);
      }
    });

    socketService.on('offer', async (...args: any[]) => {
      let from_socket_id: string | undefined;
      let offer: any | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        from_socket_id =
          firstArg.from_socket_id || firstArg.caller_socket_id || firstArg.sender_socket_id;
        if (firstArg.offer) offer = firstArg.offer;
        else if (firstArg.sdp && firstArg.type) offer = {sdp: firstArg.sdp, type: firstArg.type};
      }
      if (from_socket_id && offer) {
        await this.webRTCService.handleIncomingCall(from_socket_id, offer);
        const pc = this.webRTCService.getPeerConnection(from_socket_id);
        if (pc) {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketService.emit('answer', {target_socket_id: from_socket_id, answer});
        }
      }
    });

    socketService.on('ice_candidate', (...args: any[]) => {
      let sender_socket_id: string | undefined;
      let candidate: any | undefined;
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        sender_socket_id = firstArg.sender_socket_id || firstArg.from_socket_id;
        candidate = firstArg.candidate;
      }
      if (sender_socket_id && candidate) {
        this.webRTCService.handleIceCandidate({sender_socket_id, candidate});
      }
    });

    socketService.on('call_end', (data: any) => {
      this.handleCallEnded(data.target_socket_id || data.socket_id);
    });

    socketService.on('call_reject', (data: any) => {
      const socketId = data.target_socket_id || data.socket_id;
      const call = this.currentCalls.get(socketId);
      if (call) {
        call.status = 'rejected';
        if (this.onCallRejected) this.onCallRejected(call);
        this.currentCalls.delete(socketId);
      }
      if (this.incomingCall?.socketId === socketId) {
        this.incomingCall = null;
      }
    });

    socketService.on('video_state_changed', (data: any) => {
      // Mobile can handle this to show/hide remote video
      console.log('[CallManager] Video state changed:', data);
    });
  }

  private handleCallAcceptedSignal(responderSocketId: string): void {
    let call = this.currentCalls.get(responderSocketId);
    if (!call) {
      // Try finding by userId for outgoing calls (PC keyed by userId, not socketId)
      for (const [key, c] of this.currentCalls.entries()) {
        if (c.status === 'calling') {
          call = c;
          break;
        }
      }
    }
    if (call) {
      call.status = 'connected';
      call.startTime = new Date();
      call.socketId = responderSocketId;
      this.currentCalls.set(call.userId, call);
      if (this.onCallAccepted) this.onCallAccepted(call, responderSocketId);
      if (this.onCallStateChange) this.onCallStateChange(call.userId, call);
    }
  }

  private handleIncomingCall(
    fromSocketId: string,
    offer: any,
    callerInfo?: {userId?: string; userName?: string; avatarUrl?: string},
  ): void {
    this.webRTCService.handleIncomingCall(fromSocketId, offer);
    const callState: CallState = {
      socketId: fromSocketId,
      userId: callerInfo?.userId || fromSocketId,
      userName: callerInfo?.userName || 'Входящий звонок',
      avatarUrl: callerInfo?.avatarUrl,
      status: 'ringing',
      startTime: new Date(),
    };
    this.incomingCall = callState;
    this.currentCalls.set(fromSocketId, callState);
    if (this.onIncomingCall) this.onIncomingCall(callState);
  }

  public async initiateDirectCall(targetUserId: string, targetUserName: string): Promise<void> {
    await this.webRTCService.initiateCall(targetUserId, this.currentUser?.name);
    const callState: CallState = {
      socketId: targetUserId,
      userId: targetUserId,
      userName: targetUserName,
      status: 'calling',
      startTime: new Date(),
    };
    this.currentCalls.set(targetUserId, callState);
    if (this.onCallStateChange) this.onCallStateChange(targetUserId, callState);
  }

  public async initiateGroupCall(groupId: string): Promise<void> {
    if (!this.webRTCService.getLocalStream()) {
      await this.webRTCService.initializeLocalStream();
    }
    socketService.emit('call_group', {group_id: groupId});
    this.activeGroupCallId = groupId;
    if (this.onGroupCallIdChange) this.onGroupCallIdChange(groupId);
  }

  public async joinVoiceChannel(channelId: string): Promise<void> {
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
      } catch {
        // ignore
      }
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
  }

  public async acceptIncomingCall(
    callerSocketId: string,
    callerInfo?: {userId: string; userName: string},
  ): Promise<void> {
    await this.webRTCService.acceptCall(callerSocketId);
    const call = this.currentCalls.get(callerSocketId);
    if (call) {
      call.status = 'connected';
      call.startTime = new Date();
      this.currentCalls.set(callerSocketId, call);
      if (this.onCallAccepted) this.onCallAccepted(call);
    }
    this.incomingCall = null;
  }

  public rejectIncomingCall(callerSocketId: string): void {
    socketService.emit('call_reject', {target_socket_id: callerSocketId});
    const call = this.currentCalls.get(callerSocketId);
    if (call && this.onCallRejected) this.onCallRejected(call);
    this.currentCalls.delete(callerSocketId);
    this.incomingCall = null;
  }

  public rejectGroupCall(callId: string): void {
    socketService.emit('group_call_reject', {call_id: callId});
    this.incomingCall = null;
  }

  public endCall(targetSocketId: string): void {
    socketService.emit('call_end', {target_socket_id: targetSocketId});
    this.handleCallEnded(targetSocketId);
  }

  public endAllCalls(): void {
    this.currentCalls.forEach((_, socketId) => {
      this.endCall(socketId);
    });
  }

  private handleCallEnded(socketId: string): void {
    const call = this.currentCalls.get(socketId);
    if (call) {
      call.status = 'ended';
      call.duration = call.startTime
        ? Math.floor((Date.now() - call.startTime.getTime()) / 1000)
        : 0;
      if (this.onCallEnded) this.onCallEnded(call);
    }
    this.currentCalls.delete(socketId);

    const pc = this.webRTCService.peerConnections.get(socketId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      this.webRTCService.peerConnections.delete(socketId);
    }
    this.webRTCService.removeRemoteStream(socketId);
  }

  toggleMute(): boolean {
    return this.webRTCService.toggleMute();
  }

  isMuted(): boolean {
    return this.webRTCService.isMuted();
  }

  async startVideo(): Promise<void> {
    await this.webRTCService.startVideo();
  }

  async stopVideo(): Promise<void> {
    await this.webRTCService.stopVideo();
  }

  async toggleVideo(): Promise<void> {
    await this.webRTCService.toggleVideo();
  }

  isVideoEnabled(): boolean {
    return this.webRTCService.isVideoEnabled();
  }

  cleanup(): void {
    this.listenersInitialized = false;
    this.currentCalls.clear();
    this.incomingCall = null;
    this.activeGroupCallId = null;
  }
}
