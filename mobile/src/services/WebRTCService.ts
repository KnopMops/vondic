import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import type {MediaStream} from 'react-native-webrtc';
import {socketService} from './SocketService';
import {Config} from '@/constants/config';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
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
  private useInternalTurnOnly: boolean = false;
  private internalTurnHostResolved: string = Config.INTERNAL_TURN_HOST;

  public onRemoteStream?: (socketId: string, stream: MediaStream) => void;
  public onConnectionStateChange?: (socketId: string, state: string) => void;
  public onLocalStream?: (stream: MediaStream) => void;
  public onCallMigrated?: (oldKey: string, newKey: string) => void;

  public removeRemoteStream(socketId: string) {
    this.remoteStreams.delete(socketId);
  }

  constructor(userId: string) {
    this.userId = userId;
    this.configuration = {
      iceServers: [{urls: `stun:${Config.INTERNAL_TURN_HOST}:3478`}],
    };

    try {
      console.log('[WebRTC] Loading TURN configuration...');
      const turnUrl = Config.TURN_URL;
      const turnUrlsEnv = Config.TURN_URLS;
      const turnUser = Config.TURN_USERNAME;
      const turnPass = Config.TURN_PASSWORD;

      this.internalTurnHostResolved = (Config.INTERNAL_TURN_HOST || '192.168.120.248').trim();
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

      // Add external TURN servers first, then internal fallback
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
          (this.configuration.iceServers as RTCIceServer[]).push({
            urls,
            username: turnUser,
            credential: turnPass,
          } as any);
          this.hasTurn = true;

          (this.configuration.iceServers as RTCIceServer[]).push({
            urls: internalTurnUrls,
            username: turnUser,
            credential: turnPass,
          } as any);

          console.log(
            `[WebRTC] External + internal TURN (${this.internalTurnHostResolved})`,
          );
        }
      } else if (turnUser && turnPass) {
        (this.configuration.iceServers as RTCIceServer[]).push({
          urls: internalTurnUrls,
          username: turnUser,
          credential: turnPass,
        } as any);
        this.hasTurn = true;
        console.log(`[WebRTC] Internal TURN only (${this.internalTurnHostResolved})`);
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
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };
      this.localStream = await mediaDevices.getUserMedia(constraints);

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

  createPeerConnection(targetSocketId: string): RTCPeerConnection {
    if (this.peerConnections.has(targetSocketId)) {
      const existing = this.peerConnections.get(targetSocketId)!;
      if (existing.connectionState !== 'closed' && existing.signalingState !== 'closed') {
        return existing;
      }
      try {
        existing.close();
      } catch {
        // ignore
      }
    }

    const pc = new RTCPeerConnection(this.configuration);
    this.peerConnections.set(targetSocketId, pc);
    this.iceCandidateQueue.set(targetSocketId, []);

    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        socketService.emit('ice_candidate', {
          target_socket_id: targetSocketId,
          target_user_id: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    (pc as any).ontrack = (event: any) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStreams.set(targetSocketId, stream);
        if (this.onRemoteStream) {
          this.onRemoteStream(targetSocketId, stream);
        }
      }
    };

    (pc as any).onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state for ${targetSocketId}:`, pc.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(targetSocketId, pc.connectionState);
      }
    };

    (pc as any).oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state for ${targetSocketId}:`, pc.iceConnectionState);
    };

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    return pc;
  }

  getPeerConnection(socketId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(socketId);
  }

  async initiateCall(targetUserId: string, callerName?: string): Promise<void> {
    if (!this.localStream) {
      await this.initializeLocalStream();
    }

    const offer = await this.createOffer(targetUserId);
    socketService.emit('call_user', {
      target_user_id: targetUserId,
      offer,
      caller_user_id: this.userId,
      caller_name: callerName || 'Пользователь',
    });
  }

  async createOffer(targetSocketId: string): Promise<RTCSessionDescription> {
    const pc = this.createPeerConnection(targetSocketId);
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleIncomingCall(
    callerSocketId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    const pc = this.createPeerConnection(callerSocketId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
  }

  async acceptCall(callerSocketId: string): Promise<void> {
    if (!this.localStream) {
      await this.initializeLocalStream();
    }

    const pc = this.peerConnections.get(callerSocketId);
    if (!pc) {
      throw new Error('No peer connection found for caller');
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketService.emit('call_answer', {
      target_socket_id: callerSocketId,
      answer,
    });
  }

  public mapSocketIdToUserId(socketId: string, userId: string): void {
    this.socketIdToUserId.set(socketId, userId);
  }

  private getPeerConnectionBySocketId(socketId: string): RTCPeerConnection | undefined {
    let pc = this.peerConnections.get(socketId);
    if (!pc) {
      const userId = this.socketIdToUserId.get(socketId);
      if (userId) pc = this.peerConnections.get(userId);
    }
    return pc;
  }

  async handleAnswer(data: {sender_socket_id: string; answer: RTCSessionDescriptionInit}): Promise<void> {
    const pc = this.getPeerConnectionBySocketId(data.sender_socket_id);
    if (!pc) {
      console.warn(`[WebRTC] handleAnswer: no PC for socket ${data.sender_socket_id}`);
      return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  async handleIceCandidate(data: {sender_socket_id: string; candidate: RTCIceCandidateInit}): Promise<void> {
    const pc = this.getPeerConnectionBySocketId(data.sender_socket_id);
    if (!pc) {
      // Queue candidate
      const queue = this.incomingIceQueue.get(data.sender_socket_id) || [];
      queue.push(data.candidate);
      this.incomingIceQueue.set(data.sender_socket_id, queue);
      return;
    }
    if (pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else {
      const queue = this.incomingIceQueue.get(data.sender_socket_id) || [];
      queue.push(data.candidate);
      this.incomingIceQueue.set(data.sender_socket_id, queue);
    }
  }

  async handleRenegotiationOffer(socketId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(socketId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketService.emit('answer', {
      target_socket_id: socketId,
      answer,
    });
  }

  public migrateCall(oldKey: string, newKey: string): void {
    const pc = this.peerConnections.get(oldKey);
    const stream = this.remoteStreams.get(oldKey);
    if (pc) {
      this.peerConnections.set(newKey, pc);
      this.peerConnections.delete(oldKey);
    }
    if (stream) {
      this.remoteStreams.set(newKey, stream);
      this.remoteStreams.delete(oldKey);
    }
    if (this.onCallMigrated) {
      this.onCallMigrated(oldKey, newKey);
    }
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
      const videoTrack = this.videoStream.getVideoTracks()[0];
      if (!videoTrack) return;

      for (const [socketId, pc] of this.peerConnections) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack, this.videoStream);
        }
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        socketService.emit('offer', {target_socket_id: socketId, offer});
      }

      socketService.emit('video_state_changed', {
        sender_socket_id: socketService.getSocket()?.id,
        is_enabled: true,
        user_id: this.userId,
      });
    } catch (error) {
      console.error('[WebRTC] Failed to start video:', error);
      throw error;
    }
  }

  async stopVideo(): Promise<void> {
    if (!this.videoStream) return;
    this.videoStream.getVideoTracks().forEach(t => t.stop());
    this.videoStream = null;

    for (const [socketId, pc] of this.peerConnections) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(null);
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        socketService.emit('offer', {target_socket_id: socketId, offer});
      }
    }

    socketService.emit('video_state_changed', {
      sender_socket_id: socketService.getSocket()?.id,
      is_enabled: false,
      user_id: this.userId,
    });
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

  cleanup(): void {
    this.peerConnections.forEach(pc => {
      try {
        pc.close();
      } catch {
        // ignore
      }
    });
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.iceCandidateQueue.clear();
    this.incomingIceQueue.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
  }
}
