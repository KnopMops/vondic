import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import {socketService} from './SocketService';
import {Config} from '@/constants/config';
import {appLog} from '@/utils/appLogger';

export interface WebRTCConfig {
  iceServers: any[];
}

export interface CallState {
  socketId: string;
  userId: string;
  userName?: string;
  avatarUrl?: string;
  status: 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'failed';
  startTime?: Date;
  duration?: number;
  isGroupCall?: boolean;
  groupId?: string;
  callId?: string;
  isIncoming?: boolean;
}

export interface RTCSessionDescriptionInit {
  type: RTCSdpType;
  sdp?: string;
}

export type RTCSdpType = 'offer' | 'answer' | 'pranswer' | 'rollback';

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export class WebRTCService {
  private userId: string;
  private localStream: MediaStream | null = null;
  private videoStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  public peerConnections: Map<string, RTCPeerConnection> = new Map();
  private iceCandidateQueue: Map<string, RTCIceCandidate[]> = new Map();
  private incomingIceQueue: Map<string, RTCIceCandidateInit[]> = new Map();
  private socketIdToUserId: Map<string, string> = new Map();
  private configuration: WebRTCConfig;
  private hasTurn: boolean = false;
  private forceRelay: boolean = false;
  private turnTested: boolean = false;
  private useInternalTurnOnly: boolean = false;
  private internalTurnHostResolved: string = Config.INTERNAL_TURN_HOST;
  private iceDisconnectTimeouts: Map<string, ReturnType<typeof setTimeout>> =
    new Map();

  public onRemoteStream?: (socketId: string, stream: MediaStream) => void;
  public onConnectionStateChange?: (socketId: string, state: string) => void;
  public onLocalStream?: (stream: MediaStream) => void;
  public onCallMigrated?: (oldKey: string, newKey: string) => void;

  constructor(userId: string) {
    this.userId = userId;
    this.configuration = {
      iceServers: [
        {urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']},
        {urls: `stun:${Config.INTERNAL_TURN_HOST}:3478`},
      ],
    };
    console.log(
      '[WebRTC] CONSTRUCTOR userId=',
      userId,
      'config=',
      JSON.stringify(this.configuration),
    );

    try {
      console.log('[WebRTC] Loading TURN configuration...');
      const turnUrl = Config.TURN_URL;
      const turnUrlsEnv = Config.TURN_URLS;
      const turnUser = Config.TURN_USERNAME;
      const turnPass = Config.TURN_PASSWORD;

      this.internalTurnHostResolved = (
        Config.INTERNAL_TURN_HOST || '192.168.120.248'
      ).trim();
      const internalTurnUrls = [
        `turn:${this.internalTurnHostResolved}:3478?transport=udp`,
        `turn:${this.internalTurnHostResolved}:3478?transport=tcp`,
      ];

      const turnRawList: string[] = [];
      if (turnUrl) turnRawList.push(turnUrl);
      if (turnUrlsEnv) {
        turnRawList.push(
          ...turnUrlsEnv
            .split(/[,\s]+/)
            .map(s => s.trim())
            .filter(Boolean),
        );
      }

      if (turnRawList.length && turnUser && turnPass) {
        const urls: string[] = [];
        for (let u of turnRawList) {
          u = u.trim();
          if (!u) continue;
          if (u.startsWith('turn://')) u = 'turn:' + u.slice(7);
          else if (u.startsWith('turns://')) u = 'turns:' + u.slice(8);
          const hasTransport = /\?transport=(udp|tcp)$/i.test(u);
          if (u.startsWith('turns:')) {
            urls.push(hasTransport ? u : `${u}?transport=tcp`);
          } else {
            if (hasTransport) {
              urls.push(u);
            } else {
              const base = u.replace(/\?transport=(udp|tcp)$/i, '');
              urls.push(`${base}?transport=udp`, `${base}?transport=tcp`);
            }
          }
        }
        if (urls.length) {
          (this.configuration.iceServers as any[]).push({
            urls,
            username: turnUser,
            credential: turnPass,
          });
          this.hasTurn = true;

          (this.configuration.iceServers as any[]).push({
            urls: internalTurnUrls,
            username: turnUser,
            credential: turnPass,
          });

          console.log(
            `[WebRTC] External + internal TURN (${this.internalTurnHostResolved})`,
          );
        }
      } else if (turnUser && turnPass) {
        (this.configuration.iceServers as any[]).push({
          urls: internalTurnUrls,
          username: turnUser,
          credential: turnPass,
        });
        this.hasTurn = true;
        console.log(`[WebRTC] Internal TURN only (${this.internalTurnHostResolved})`);
      }

      const useExternalTurn = turnRawList.length > 0 && Boolean(turnUser) && Boolean(turnPass);
      if (useExternalTurn && this.hasTurn) {
        Promise.resolve().then(() => {
          void this.testTurnAndFallback().then(() => {
            if (this.useInternalTurnOnly) {
              console.log(
                `[WebRTC] Switched to internal TURN (${this.internalTurnHostResolved})`,
              );
            }
          });
        });
      }

      this.forceRelay = Config.FORCE_RELAY;
      if (this.forceRelay && !this.hasTurn) {
        console.warn(
          '[WebRTC] FORCE_RELAY enabled but no TURN credentials provided; ICE may stay in "new"',
        );
      }
    } catch {
      // ignore
    }
  }

  async initializeLocalStream(): Promise<MediaStream> {
    console.log('[WebRTC] initializeLocalStream START');
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };
      console.log('[WebRTC] getUserMedia constraints:', JSON.stringify(constraints));
      this.localStream = await mediaDevices.getUserMedia(constraints);
      console.log(
        '[WebRTC] getUserMedia SUCCESS, tracks:',
        this.localStream.getTracks().map(t => `${t.kind}:${t.readyState}`),
      );

      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }
      return this.localStream;
    } catch (error: any) {
      console.error('[WebRTC] Error accessing microphone:', error);
      throw new Error('Не удалось получить доступ к микрофону');
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  private isSocketKey(key: string): boolean {
    if (!key) return false;
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(key)) {
      return false;
    }
    if (key.length < 10) {
      return false;
    }
    return /^[A-Za-z0-9_-]{10,45}$/.test(key);
  }

  private async applyBitrateConstraints(
    sender: any,
    track: any,
  ): Promise<void> {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      if (track.kind === 'video') {
        params.encodings[0].maxBitrate = 1_000_000;
        params.encodings[0].degradationPreference = 'balanced';
        console.log('[WebRTC] Applied camera bitrate limit: 1 Mbps');
      } else if (track.kind === 'audio') {
        params.encodings[0].maxBitrate = 64_000;
        console.log('[WebRTC] Applied audio bitrate limit: 64 kbps');
      }
      await sender.setParameters(params);
    } catch (e) {
      console.warn('[WebRTC] Failed to apply bitrate constraints:', e);
    }
  }

  private setupPeerConnectionHandlers(
    pc: RTCPeerConnection,
    targetSocketId: string,
  ): void {
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        const isLikelySocketId = this.isSocketKey(targetSocketId);
        if (isLikelySocketId) {
          socketService.emit('ice_candidate', {
            target_socket_id: targetSocketId,
            candidate: event.candidate,
          });
        } else {
          const queue = this.iceCandidateQueue.get(targetSocketId) || [];
          queue.push(event.candidate);
          this.iceCandidateQueue.set(targetSocketId, queue);
        }
      }
    };

    (pc as any).ontrack = (event: any) => {
      console.log(
        `[WebRTC] ontrack for ${targetSocketId}: kind=${event.track?.kind}, state=${event.track?.readyState}, muted=${event.track?.muted}`,
      );

      let stream = this.remoteStreams.get(targetSocketId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(targetSocketId, stream);
      }

      if (event.track && !stream.getTracks().includes(event.track)) {
        try {
          stream.addTrack(event.track);
          console.log(
            `[WebRTC] Added ${event.track.kind} track to stream for ${targetSocketId}`,
          );
        } catch (e) {
          console.error('[WebRTC] Could not add track to stream:', e);
        }
      }

      const now = Date.now();
      const lastUpdate =
        ((this as any)._lastStreamUpdate?.get(targetSocketId) as number) || 0;
      if (now - lastUpdate < 100) {
        return;
      }
      (this as any)._lastStreamUpdate =
        (this as any)._lastStreamUpdate || new Map();
      (this as any)._lastStreamUpdate.set(targetSocketId, now);

      const assign = () => {
        console.log(
          `[WebRTC] Assigning remote stream for ${targetSocketId}, tracks: ${stream?.getTracks().length}`,
        );
        if (this.onRemoteStream) {
          this.onRemoteStream(targetSocketId, stream!);
        }
      };

      try {
        const track = event.track;
        if (track) {
          let trackEndTimeout: ReturnType<typeof setTimeout> | null = null;
          track.onended = () => {
            console.log(
              `[WebRTC] Remote ${track.kind} track ended for ${targetSocketId}, waiting 2s before removal...`,
            );
            trackEndTimeout = setTimeout(() => {
              if (track.readyState === 'ended') {
                try {
                  if (stream && stream.getTracks().includes(track)) {
                    stream.removeTrack(track);
                    console.log(
                      `[WebRTC] Removed ${track.kind} track from stream for ${targetSocketId}`,
                    );
                  }
                } catch (e) {
                  console.error('[WebRTC] Could not remove ended track:', e);
                }
                assign();
              }
            }, 2000);
          };

          let muteDebounceTimer: ReturnType<typeof setTimeout> | null = null;
          if (typeof (track as any).onunmute !== 'undefined') {
            (track as any).onunmute = () => {
              if (trackEndTimeout) {
                clearTimeout(trackEndTimeout);
                trackEndTimeout = null;
              }
              if (muteDebounceTimer) clearTimeout(muteDebounceTimer);
              muteDebounceTimer = setTimeout(assign, 100);
            };
            (track as any).onmute = () => {
              if (muteDebounceTimer) clearTimeout(muteDebounceTimer);
              muteDebounceTimer = setTimeout(assign, 100);
            };
          }
        }
      } catch {}
      assign();
    };

    (pc as any).onconnectionstatechange = () => {
      console.log(
        `[WebRTC] Connection state changed for ${targetSocketId}: ${pc.connectionState}`,
      );
      console.log(
        `[WebRTC] ICE state: ${(pc as any).iceConnectionState}, Signaling: ${pc.signalingState}`,
      );

      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(targetSocketId, pc.connectionState);
      }

      if (pc.connectionState === 'connected') {
        console.log(`[WebRTC] Connection ESTABLISHED for ${targetSocketId}`);
        this.syncRemoteStreamTracks(targetSocketId);
      } else if (pc.connectionState === 'failed') {
        console.error(`[WebRTC] Connection FAILED for ${targetSocketId}`);
        this.attemptIceRestart(targetSocketId).catch(e =>
          console.error('[WebRTC] ICE restart failed:', e),
        );
      } else if (pc.connectionState === 'disconnected') {
        console.warn(
          `[WebRTC] Connection DISCONNECTED for ${targetSocketId}. Will attempt reconnect...`,
        );
      }
    };

    (pc as any).onsignalingstatechange = () => {
      console.log(
        `[WebRTC] Signaling state changed for ${targetSocketId}: ${pc.signalingState}`,
      );
      if (pc.signalingState === 'stable' && pc.connectionState === 'connected') {
        this.syncRemoteStreamTracks(targetSocketId);
      }
    };

    try {
      (pc as any).oniceconnectionstatechange = () => {
        const iceState = (pc as any).iceConnectionState;
        console.log(
          `[WebRTC] ICE connection state changed for ${targetSocketId}: ${iceState}`,
        );
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(targetSocketId, pc.connectionState);
        }

        const existingTimeout = this.iceDisconnectTimeouts.get(targetSocketId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          this.iceDisconnectTimeouts.delete(targetSocketId);
        }

        if (iceState === 'failed') {
          console.log(
            `[WebRTC] ICE failed for ${targetSocketId}, attempting ICE restart`,
          );
          this.attemptIceRestart(targetSocketId).catch(e =>
            console.error('ICE restart failed:', e),
          );
        }

        if (iceState === 'disconnected') {
          const timeout = setTimeout(() => {
            const currentPc = this.peerConnections.get(targetSocketId);
            if (
              currentPc &&
              ((currentPc as any).iceConnectionState === 'disconnected' ||
                (currentPc as any).iceConnectionState === 'failed')
            ) {
              console.log(
                `[WebRTC] ICE still disconnected for ${targetSocketId}, attempting ICE restart`,
              );
              this.attemptIceRestart(targetSocketId).catch(e =>
                console.error('ICE restart failed:', e),
              );
            }
          }, 3000);
          this.iceDisconnectTimeouts.set(targetSocketId, timeout);
        }
      };
    } catch {}
  }

  private createPeerConnectionWithPolicy(
    targetSocketId: string,
    policy: 'all' | 'relay' = 'all',
  ): RTCPeerConnection {
    let iceServers = this.configuration.iceServers;

    if (this.useInternalTurnOnly) {
      iceServers = this.configuration.iceServers.filter((server: any) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url: any) =>
          String(url).includes(this.internalTurnHostResolved),
        );
      });
      console.log(
        `[WebRTC] Using only internal TURN (${this.internalTurnHostResolved})`,
      );
    }

    const baseConfig: any = {iceServers};
    if (policy === 'relay') baseConfig.iceTransportPolicy = 'relay';
    const pc = new RTCPeerConnection(baseConfig);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, this.localStream!);
        void this.applyBitrateConstraints(sender, track);
      });
      console.log(`[WebRTC] Added local audio track to new PC for ${targetSocketId}`);
    }

    if (this.videoStream) {
      const videoTrack = this.videoStream.getVideoTracks()[0];
      if (videoTrack) {
        const sender = pc.addTrack(videoTrack, this.videoStream);
        void this.applyBitrateConstraints(sender, videoTrack);
        console.log(`[WebRTC] Added camera video track to new PC for ${targetSocketId}`);
      }
    }

    this.setupPeerConnectionHandlers(pc, targetSocketId);
    this.peerConnections.set(targetSocketId, pc);
    return pc;
  }

  createPeerConnection(targetSocketId: string): RTCPeerConnection {
    console.log(
      '[WebRTC] createPeerConnection targetSocketId=',
      targetSocketId,
      'existing=',
      this.peerConnections.has(targetSocketId),
    );
    if (this.peerConnections.has(targetSocketId)) {
      const existing = this.peerConnections.get(targetSocketId)!;
      if (
        existing.connectionState !== 'closed' &&
        existing.signalingState !== 'closed'
      ) {
        console.log(
          '[WebRTC] Reusing existing PC state=',
          existing.connectionState,
        );
        return existing;
      }
      try {
        existing.close();
      } catch {
        // ignore
      }
    }
    return this.createPeerConnectionWithPolicy(
      targetSocketId,
      this.forceRelay ? 'relay' : 'all',
    );
  }

  ensurePeerConnection(targetSocketId: string): RTCPeerConnection {
    if (this.peerConnections.has(targetSocketId)) {
      return this.peerConnections.get(targetSocketId)!;
    }
    return this.createPeerConnection(targetSocketId);
  }

  async ensureLocalAudioSender(targetSocketId: string): Promise<RTCPeerConnection> {
    if (!this.localStream) {
      await this.initializeLocalStream();
    }
    const pc = this.ensurePeerConnection(targetSocketId);
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          audioTrack.enabled = true;
        } catch {}
        const senders = (pc as any).getSenders();
        const audioSender = senders.find(
          (s: any) => s.track && s.track.kind === 'audio',
        );
        if (!audioSender) {
          pc.addTrack(audioTrack, this.localStream);
        } else if (audioSender.track !== audioTrack) {
          try {
            await audioSender.replaceTrack(audioTrack);
          } catch {}
        }
      }
    }
    return pc;
  }

  getPeerConnection(socketId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(socketId);
  }

  async initiateCall(targetUserId: string, callerName?: string): Promise<void> {
    console.log('[WebRTC] initiateCall targetUserId=', targetUserId);
    appLog('WebRTC', 'initiateCall', {targetUserId, callerName});
    try {
      if (!this.localStream) {
        this.localStream = await mediaDevices.getUserMedia({audio: true, video: false});
        if (this.onLocalStream) {
          this.onLocalStream(this.localStream);
        }
      }

      const pc = this.createPeerConnection(targetUserId);
      const hasAudioSender = (pc as any)
        .getSenders()
        .some((s: any) => s.track && s.track.kind === 'audio');
      if (this.localStream && !hasAudioSender) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
          pc.addTrack(audioTrack, this.localStream);
        }
      }

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      console.log('[WebRTC] Offer created, emitting call_user');

      socketService.emit('call_user', {
        target_user_id: targetUserId,
        offer: {
          sdp: offer.sdp,
          type: offer.type,
        },
        caller_user_id: this.userId,
        caller_name: callerName || 'Пользователь',
      });
    } catch (error) {
      console.error('[WebRTC] Failed to initiate call:', error);
      throw error;
    }
  }

  async createOffer(targetSocketId: string): Promise<RTCSessionDescription> {
    console.log('[WebRTC] createOffer targetSocketId=', targetSocketId);
    const pc = this.createPeerConnection(targetSocketId);
    const offer = await pc.createOffer({});
    console.log('[WebRTC] Offer SDP length=', offer.sdp?.length);
    await pc.setLocalDescription(offer);
    console.log('[WebRTC] setLocalDescription OK');
    return offer;
  }

  async handleIncomingCall(
    callerSocketId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    console.log('[WebRTC] handleIncomingCall callerSocketId=', callerSocketId);
    const existingPc = this.peerConnections.get(callerSocketId);
    if (existingPc) {
      if (existingPc.signalingState === 'stable') {
        console.log(
          `[WebRTC] Existing PC in stable state for ${callerSocketId}, handling as renegotiation`,
        );
        return this.handleRenegotiationOffer(callerSocketId, offer);
      }
      if (existingPc.signalingState === 'have-remote-offer') {
        console.log(`[WebRTC] Already have remote offer for ${callerSocketId}, skipping duplicate`);
        return;
      }
      console.log(
        `[WebRTC] Cannot handle incoming call: existing PC state is ${existingPc.signalingState}`,
      );
      return;
    }

    const pc = this.createPeerConnection(callerSocketId);

    if (pc.signalingState !== 'stable') {
      console.log(`Cannot handle incoming call: PC state is ${pc.signalingState}`);
      return;
    }

    if (!this.localStream) {
      await this.initializeLocalStream();
    }

    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        const existingSender = (pc as any)
          .getSenders()
          .find((s: any) => s.track?.kind === 'audio');
        if (!existingSender) {
          try {
            pc.addTrack(audioTrack, this.localStream);
          } catch (e) {
            console.error('[WebRTC] Failed to add audio track to incoming call PC:', e);
          }
        }
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer as any));
    console.log('[WebRTC] setRemoteDescription OK for incoming call');
    this.processBufferedCandidates(callerSocketId);
  }

  async acceptCall(callerSocketId: string): Promise<void> {
    console.log('[WebRTC] acceptCall callerSocketId=', callerSocketId);
    try {
      const pc = await this.ensureLocalAudioSender(callerSocketId);

      if (pc.signalingState !== 'have-remote-offer') {
        throw new Error(
          `Cannot accept call: PC state is ${pc.signalingState}, expected 'have-remote-offer'`,
        );
      }

      const answer = await pc.createAnswer();
      if (pc.signalingState !== 'have-remote-offer') {
        throw new Error(
          `State changed during answer creation for ${callerSocketId}: ${pc.signalingState}`,
        );
      }
      await pc.setLocalDescription(answer);
      console.log('[WebRTC] Answer created and set as local description');

      socketService.emit('call_answer', {caller_socket_id: callerSocketId});

      socketService.emit('answer', {
        target_socket_id: callerSocketId,
        answer: {
          sdp: answer.sdp,
          type: answer.type,
        },
      });
    } catch (error) {
      console.error('[WebRTC] Failed to accept call:', error);
      if (this.hasTurn) {
        console.log(
          `[WebRTC] Accept call failed, switching to internal TURN (${this.internalTurnHostResolved}) for ${callerSocketId}`,
        );
        this.useInternalTurnOnly = true;
        this.renegotiateWithRelay(callerSocketId).catch(err =>
          console.error('Relay fallback failed:', err),
        );
      }
      throw error;
    }
  }

  public mapSocketIdToUserId(socketId: string, userId: string): void {
    this.socketIdToUserId.set(socketId, userId);
  }

  private getPeerConnectionBySocketId(
    socketId: string,
  ): RTCPeerConnection | undefined {
    let pc = this.peerConnections.get(socketId);
    if (!pc) {
      const userId = this.socketIdToUserId.get(socketId);
      if (userId) pc = this.peerConnections.get(userId);
    }
    return pc;
  }

  async handleAnswer(data: {
    sender_socket_id: string;
    answer: RTCSessionDescriptionInit;
  }): Promise<void> {
    console.log(
      '[WebRTC] handleAnswer sender_socket_id=',
      data.sender_socket_id,
      'hasAnswer=',
      !!data.answer,
    );
    appLog('WebRTC', 'handleAnswer', {
      senderSocketId: data.sender_socket_id,
      hasAnswer: !!data.answer,
      pcKeys: Array.from(this.peerConnections.keys()),
    });

    let pc = this.peerConnections.get(data.sender_socket_id);

    if (!pc) {
      console.log(
        `[WebRTC] PC not found for ${data.sender_socket_id}, checking for outgoing calls in 'have-local-offer' state`,
      );
      for (const [key, connection] of this.peerConnections.entries()) {
        if (connection.signalingState === 'have-local-offer') {
          console.log(
            `[WebRTC] Found matching PC keyed by ${key}, migrating to ${data.sender_socket_id}`,
          );
          this.migrateCall(key, data.sender_socket_id);
          pc = this.peerConnections.get(data.sender_socket_id);
          break;
        }
      }
    }

    if (!pc) {
      console.warn(
        `[WebRTC] handleAnswer: no PC for socket ${data.sender_socket_id}`,
      );
      return;
    }

    const currentState = pc.signalingState;
    if (currentState !== 'have-local-offer' && currentState !== 'stable') {
      console.log(
        `[WebRTC] Skipping answer from ${data.sender_socket_id}: connection state is ${currentState}`,
      );
      return;
    }
    if (currentState === 'stable') {
      console.log(
        `[WebRTC] PC is in stable state, renegotiating for ${data.sender_socket_id}`,
      );
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer as any));
      console.log('[WebRTC] handleAnswer setRemoteDescription OK');
      appLog('WebRTC', 'handleAnswer OK', {senderSocketId: data.sender_socket_id});
      this.processBufferedCandidates(data.sender_socket_id);

      if (this.hasTurn) {
        setTimeout(() => {
          const current = this.peerConnections.get(data.sender_socket_id);
          if (current && current.connectionState === 'failed') {
            console.log(
              `[WebRTC] Connection failed, attempting TURN relay fallback for ${data.sender_socket_id}`,
            );
            this.useInternalTurnOnly = true;
            this.renegotiateWithRelay(data.sender_socket_id).catch(err =>
              console.error('Relay fallback failed:', err),
            );
          }
        }, 8000);
      }
    } catch (err: any) {
      if (err.message?.includes('wrong state') || err.message?.includes('stable')) {
        console.log(
          `[WebRTC] Ignoring answer for ${data.sender_socket_id} - state race condition`,
        );
      } else {
        console.error('[WebRTC] Error setting remote description:', err);
      }
    }
  }

  async handleIceCandidate(data: {
    sender_socket_id: string;
    candidate: RTCIceCandidateInit;
  }): Promise<void> {
    console.log(
      '[WebRTC] handleIceCandidate sender=',
      data.sender_socket_id,
      'candidate=',
      JSON.stringify(data.candidate).slice(0, 100),
    );
    const pc = this.getPeerConnectionBySocketId(data.sender_socket_id);
    if (!pc) {
      console.log('[WebRTC] handleIceCandidate: no PC, queuing candidate');
      const queue = this.incomingIceQueue.get(data.sender_socket_id) || [];
      queue.push(data.candidate);
      this.incomingIceQueue.set(data.sender_socket_id, queue);
      return;
    }

    if (pc.remoteDescription && pc.remoteDescription.type) {
      const state = pc.signalingState;
      if (
        state === 'stable' ||
        state === 'have-remote-offer' ||
        state === 'have-local-pranswer'
      ) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate as any));
          console.log('[WebRTC] handleIceCandidate: addIceCandidate OK');
        } catch (e: any) {
          if (e.message?.includes('ufrag') || e.message?.includes('Unknown')) {
            console.log(`Ignoring stale ICE candidate from ${data.sender_socket_id}`);
          } else {
            console.error('Error adding ICE candidate:', e);
          }
        }
      } else {
        console.log(
          `Buffering ICE candidate for ${data.sender_socket_id} - PC state is ${state}`,
        );
        const queue = this.incomingIceQueue.get(data.sender_socket_id) || [];
        queue.push(data.candidate);
        this.incomingIceQueue.set(data.sender_socket_id, queue);
      }
    } else {
      console.log(
        `Buffering incoming ICE candidate from ${data.sender_socket_id} (remote description not set)`,
      );
      const queue = this.incomingIceQueue.get(data.sender_socket_id) || [];
      queue.push(data.candidate);
      this.incomingIceQueue.set(data.sender_socket_id, queue);
    }
  }

  async handleRenegotiationOffer(
    socketId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    const pc = this.ensurePeerConnection(socketId);
    if (pc.signalingState !== 'stable') {
      console.log(
        `Skipping renegotiation offer from ${socketId}: state is ${pc.signalingState}`,
      );
      return;
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer as any));
      this.processBufferedCandidates(socketId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketService.emit('answer', {
        target_socket_id: socketId,
        answer: {
          sdp: answer.sdp,
          type: answer.type,
        },
      });
    } catch (e: any) {
      if (e.message?.includes('wrong state') || e.message?.includes('stable')) {
        console.log(`Ignoring renegotiation offer race condition for ${socketId}`);
      } else {
        console.error('Error handling renegotiation offer:', e);
      }
    }
  }

  public migrateCall(oldKey: string, newKey: string): void {
    appLog('WebRTC', 'migrateCall', {oldKey, newKey});
    const pc = this.peerConnections.get(oldKey);
    if (pc) {
      console.log(`Migrating peer connection from ${oldKey} to ${newKey}`);
      this.peerConnections.delete(oldKey);
      this.peerConnections.set(newKey, pc);
      this.setupPeerConnectionHandlers(pc, newKey);

      const stream = this.remoteStreams.get(oldKey);
      if (stream) {
        this.remoteStreams.delete(oldKey);
        this.remoteStreams.set(newKey, stream);
      }

      if (this.localStream) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
          const existingSender = (pc as any)
            .getSenders()
            .find((s: any) => s.track?.kind === 'audio');
          if (!existingSender) {
            try {
              pc.addTrack(audioTrack, this.localStream);
            } catch (e) {
              console.error('[WebRTC] Failed to add audio track after migration:', e);
            }
          } else if (existingSender.track !== audioTrack) {
            try {
              existingSender.replaceTrack(audioTrack);
            } catch (e) {
              console.error('[WebRTC] Failed to replace audio track after migration:', e);
            }
          }
        }
      }

      if (this.iceCandidateQueue.has(oldKey)) {
        const queue = this.iceCandidateQueue.get(oldKey);
        if (queue) {
          console.log(`Flushing ${queue.length} ICE candidates to ${newKey}`);
          queue.forEach(candidate => {
            socketService.emit('ice_candidate', {
              target_socket_id: newKey,
              candidate,
            });
          });
          this.iceCandidateQueue.delete(oldKey);
        }
      }

      if (this.onCallMigrated) {
        try {
          this.onCallMigrated(oldKey, newKey);
        } catch {}
      }
    }
  }

  private async renegotiateWithRelay(targetSocketId: string): Promise<void> {
    this.cleanupCall(targetSocketId);
    const pc = this.createPeerConnectionWithPolicy(targetSocketId, 'relay');
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    socketService.emit('offer', {
      target_socket_id: targetSocketId,
      offer: {
        sdp: offer.sdp,
        type: offer.type,
      },
    });
  }

  private async attemptIceRestart(targetSocketId: string): Promise<void> {
    const pc = this.peerConnections.get(targetSocketId);
    if (!pc) {
      console.log(`[WebRTC] No PC for ${targetSocketId}, cannot restart ICE`);
      return;
    }
    if (
      pc.signalingState === 'stable' ||
      pc.signalingState === 'have-local-offer'
    ) {
      console.log(`[WebRTC] Restarting ICE for ${targetSocketId}`);
      try {
        const offer = await pc.createOffer({iceRestart: true});
        await pc.setLocalDescription(offer);
        socketService.emit('offer', {
          target_socket_id: targetSocketId,
          offer: {
            sdp: offer.sdp,
            type: offer.type,
          },
        });
        console.log(`[WebRTC] ICE restart offer sent to ${targetSocketId}`);
      } catch (e: any) {
        console.error('[WebRTC] ICE restart failed:', e);
        if (this.hasTurn) {
          this.useInternalTurnOnly = true;
          await this.renegotiateWithRelay(targetSocketId);
        }
      }
    } else {
      console.log(
        `[WebRTC] Cannot restart ICE in signaling state: ${pc.signalingState}`,
      );
    }
  }

  private syncRemoteStreamTracks(targetSocketId: string): void {
    const pc = this.peerConnections.get(targetSocketId);
    if (!pc) return;

    let stream = this.remoteStreams.get(targetSocketId);
    if (!stream) {
      stream = new MediaStream();
      this.remoteStreams.set(targetSocketId, stream);
    }

    try {
      const receivers = (pc as any).getReceivers() || [];
      const existingTracks = stream.getTracks();

      receivers.forEach((receiver: any) => {
        if (receiver.track) {
          const trackExists = existingTracks.some(
            (t: any) =>
              t.id === receiver.track.id &&
              t.kind === receiver.track.kind &&
              t.readyState === receiver.track.readyState,
          );
          if (!trackExists) {
            console.log(
              `[WebRTC] Adding ${receiver.track.kind} track to remote stream for ${targetSocketId}`,
            );
            stream!.addTrack(receiver.track);
          }
        }
      });

      if (this.onRemoteStream) {
        this.onRemoteStream(targetSocketId, stream);
      }
    } catch (e) {
      console.error('[WebRTC] Error syncing remote stream tracks:', e);
    }
  }

  private async processBufferedCandidates(socketId: string): Promise<void> {
    const queue = this.incomingIceQueue.get(socketId);
    if (queue && queue.length > 0) {
      console.log(`Processing ${queue.length} buffered ICE candidates for ${socketId}`);
      const pc = this.peerConnections.get(socketId);
      if (pc) {
        const state = pc.signalingState;
        if (
          pc.remoteDescription &&
          pc.remoteDescription.type &&
          (state === 'stable' ||
            state === 'have-remote-offer' ||
            state === 'have-local-pranswer')
        ) {
          for (const candidate of queue) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate as any));
            } catch (e) {
              console.error('Error adding buffered ICE candidate:', e);
            }
          }
        } else {
          console.log(
            `Cannot process buffered candidates for ${socketId} - PC state is ${state}`,
          );
          return;
        }
        this.incomingIceQueue.delete(socketId);
      }
    }
  }

  async testTurnAndFallback(): Promise<void> {
    if (this.turnTested) return;
    this.turnTested = true;

    if (!this.hasTurn || this.useInternalTurnOnly) return;

    console.log('[WebRTC] Testing external TURN (relay)...');

    const testPc = new RTCPeerConnection({
      iceServers: this.configuration.iceServers,
      iceTransportPolicy: 'relay',
    } as any);

    return new Promise(resolve => {
      let resolved = false;
      let relayGathered = false;

      const cleanup = () => {
        resolved = true;
        (testPc as any).onicecandidate = null;
        testPc.close();
      };

      (testPc as any).onicecandidate = (event: any) => {
        if (resolved) return;
        if (event.candidate) {
          console.log('[WebRTC] TURN candidate gathered:', event.candidate.candidate);
          if (event.candidate.candidate.includes('typ relay')) {
            relayGathered = true;
            cleanup();
            console.log('[WebRTC] External TURN available (gathered relay candidate)');
            resolve();
          }
        } else {
          // End of candidate gathering
          if (!relayGathered && !resolved) {
            cleanup();
            console.warn(
              `[WebRTC] External TURN unavailable (no relay candidates), switching to internal (${this.internalTurnHostResolved})`,
            );
            this.useInternalTurnOnly = true;
            resolve();
          }
        }
      };

      // Add dummy track and create offer to trigger ICE candidate gathering
      try {
        (testPc as any).addTransceiver('audio', {});
        testPc.createOffer({})
          .then(offer => testPc.setLocalDescription(offer))
          .catch(err => {
            console.error('[WebRTC] Error during TURN test offer:', err);
          });
      } catch (e) {
        console.error('[WebRTC] Error starting ICE test:', e);
      }

      // If no relay candidate after 3 seconds, fallback to internal TURN
      setTimeout(() => {
        if (!resolved) {
          cleanup();
          console.warn(
            `[WebRTC] TURN timeout (3s), switching to internal (${this.internalTurnHostResolved})`,
          );
          this.useInternalTurnOnly = true;
          resolve();
        }
      }, 3000);
    });
  }

  forceInternalTurn(): void {
    this.useInternalTurnOnly = true;
    console.log(`[WebRTC] Forced internal TURN (${this.internalTurnHostResolved})`);
    const oldConnections = Array.from(this.peerConnections.entries());
    oldConnections.forEach(([socketId, oldPc]) => {
      oldPc.close();
      this.peerConnections.delete(socketId);
      this.createPeerConnection(socketId);
    });
  }

  isUsingInternalTurn(): boolean {
    return this.useInternalTurnOnly;
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled;
    }
    return false;
  }

  isMuted(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    return audioTrack ? !audioTrack.enabled : false;
  }

  async startVideo(): Promise<void> {
    try {
      if (!this.videoStream) {
        this.videoStream = await mediaDevices.getUserMedia({
          audio: false,
          video: {facingMode: 'user', width: 1280, height: 720, frameRate: 30},
        });
      }
      const track = this.videoStream.getVideoTracks()[0];
      if (!track) return;

      for (const [socketId, pc] of this.peerConnections.entries()) {
        if (!this.isSocketKey(socketId)) continue;
        if (pc.signalingState !== 'stable') {
          console.log(
            `[WebRTC] Cannot start video: PC for ${socketId} is in ${pc.signalingState}`,
          );
          continue;
        }

        let sender = (pc as any).getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          try {
            await sender.replaceTrack(track);
          } catch (e) {
            console.error(`[WebRTC] Failed to replace video track for ${socketId}:`, e);
          }
        } else {
          try {
            sender = pc.addTrack(track, this.videoStream);
          } catch (e) {
            console.error(`[WebRTC] Failed to add video track for ${socketId}:`, e);
          }
        }
        if (sender) {
          void this.applyBitrateConstraints(sender, track);
        }

        try {
          if (pc.signalingState !== 'stable') continue;
          const offer = await pc.createOffer({});
          if (pc.signalingState !== 'stable') continue;
          await pc.setLocalDescription(offer);
          socketService.emit('offer', {
            target_socket_id: socketId,
            offer: {
              sdp: offer.sdp,
              type: offer.type,
            },
            caller_user_id: this.userId,
          });
        } catch (e) {
          console.error(`[WebRTC] Video offer failed for ${socketId}:`, e);
        }
      }

      socketService.emit('video_state_changed', {
        sender_socket_id: socketService.getSocket()?.id,
        has_video: true,
        user_id: this.userId,
      });
      console.log('[WebRTC] Video started');
    } catch (error) {
      console.error('[WebRTC] Failed to start video:', error);
      throw error;
    }
  }

  async stopVideo(): Promise<void> {
    if (!this.videoStream) return;
    this.videoStream.getVideoTracks().forEach(t => t.stop());
    this.videoStream = null;

    for (const [socketId, pc] of this.peerConnections.entries()) {
      if (!this.isSocketKey(socketId)) continue;
      if (pc.signalingState !== 'stable') {
        console.log(
          `[WebRTC] Cannot stop video: PC for ${socketId} is in ${pc.signalingState}`,
        );
        continue;
      }

      const sender = (pc as any).getSenders().find((s: any) => s.track?.kind === 'video');
      if (sender) {
        try {
          await sender.replaceTrack(null);
        } catch (e) {
          console.error(
            `[WebRTC] Failed to replace video track with null for ${socketId}:`,
            e,
          );
        }
        try {
          if (pc.signalingState !== 'stable') continue;
          const offer = await pc.createOffer({});
          if (pc.signalingState !== 'stable') continue;
          await pc.setLocalDescription(offer);
          socketService.emit('offer', {
            target_socket_id: socketId,
            offer: {
              sdp: offer.sdp,
              type: offer.type,
            },
            caller_user_id: this.userId,
          });
        } catch (e) {
          console.error(`[WebRTC] Stop video offer failed for ${socketId}:`, e);
        }
      }
    }

    socketService.emit('video_state_changed', {
      sender_socket_id: socketService.getSocket()?.id,
      has_video: false,
      user_id: this.userId,
    });
    console.log('[WebRTC] Video stopped');
  }

  async toggleVideo(): Promise<void> {
    if (this.videoStream) {
      await this.stopVideo();
    } else {
      await this.startVideo();
    }
  }

  isVideoEnabled(): boolean {
    return !!this.videoStream;
  }

  getVideoStream(): MediaStream | null {
    return this.videoStream;
  }

  getRemoteStream(socketId: string): MediaStream | null {
    return this.remoteStreams.get(socketId) || null;
  }

  getAllRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  getAllPeerConnections(): Map<string, RTCPeerConnection> {
    return new Map(this.peerConnections);
  }

  public removeRemoteStream(socketId: string): void {
    this.remoteStreams.delete(socketId);
  }

  rejectCall(callerSocketId: string): void {
    socketService.emit('call_reject', {caller_socket_id: callerSocketId});
    this.cleanupCall(callerSocketId);
  }

  endCall(targetSocketId: string): void {
    socketService.emit('call_end', {target_socket_id: targetSocketId});
    this.stopVideo().catch(() => {});
    this.cleanupCall(targetSocketId);
  }

  endAllCalls(): void {
    for (const socketId of this.peerConnections.keys()) {
      socketService.emit('call_end', {target_socket_id: socketId});
      this.cleanupCall(socketId);
    }
  }

  public cleanupCall(socketId: string): void {
    const existingTimeout = this.iceDisconnectTimeouts.get(socketId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.iceDisconnectTimeouts.delete(socketId);
    }

    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
    }

    const remoteStream = this.remoteStreams.get(socketId);
    if (remoteStream) {
      remoteStream.getTracks().forEach((track: any) => track.stop());
      this.remoteStreams.delete(socketId);
    }

    if (this.peerConnections.size === 0) {
      this.stopVideo().catch(() => {});
    }
  }

  cleanup(): void {
    this.endAllCalls();

    this.iceDisconnectTimeouts.forEach(timeout => clearTimeout(timeout));
    this.iceDisconnectTimeouts.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    this.remoteStreams.clear();
    this.iceCandidateQueue.clear();
    this.incomingIceQueue.clear();
    this.socketIdToUserId.clear();
  }
}
