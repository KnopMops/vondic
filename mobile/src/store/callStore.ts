import {create} from 'zustand';
import {CallManager, CallRecord, CallState} from '@/services/CallManager';
import {WebRTCService} from '@/services/WebRTCService';
import {socketService} from '@/services/SocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CallStore {
  isInitialized: boolean;
  isWebRTCSupported: boolean;
  localStream: any | null;
  remoteStreams: Map<string, any>;
  activeCalls: Map<string, CallState>;
  activeGroupCallId: string | null;
  incomingCall: CallState | null;
  isMuted: boolean;
  videoStream: any | null;
  isVideoActive: boolean;
  callHistory: CallRecord[];

  webRTCService: WebRTCService | null;
  callManager: CallManager | null;
  currentUserId: string | null;

  initializeWebRTC: (user: {id: string; name: string; avatar?: string}) => Promise<void>;
  cleanup: () => void;
  setLocalStream: (stream: any | null) => void;
  addActiveCall: (socketId: string, call: CallState) => void;
  removeActiveCall: (socketId: string) => void;
  updateActiveCall: (socketId: string, call: CallState) => void;
  setIncomingCall: (call: CallState | null) => void;
  clearIncomingCall: () => void;
  toggleMute: () => boolean;
  setMuted: (muted: boolean) => void;
  addToHistory: (record: CallRecord) => void;
  clearHistory: () => void;
  startVideo: () => Promise<void>;
  stopVideo: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  isVideoEnabled: () => boolean;

  initiateCall: (targetUserId: string, targetUserName: string) => Promise<void>;
  initiateGroupCall: (groupId: string) => Promise<void>;
  joinVoiceChannel: (channelId: string) => Promise<void>;
  leaveVoiceChannel: (channelId: string) => void;
  joinGroupCall: (callId: string) => Promise<void>;
  getActiveGroupCall: (groupId: string) => Promise<any>;
  leaveGroupCall: (callId: string) => void;
  acceptCall: (
    callerSocketId: string,
    callerInfo?: {userId: string; userName: string},
  ) => Promise<void>;
  rejectCall: (callerSocketId: string) => void;
  endCall: (targetSocketId: string) => void;
  endAllCalls: () => void;

  getCallBySocketId: (socketId: string) => CallState | undefined;
  getCallByUserId: (userId: string) => CallState | undefined;
  getActiveCallsCount: () => number;
  getTotalCallDuration: () => number;
}

export const useCallStore = create<CallStore>((set, get) => ({
  isInitialized: false,
  isWebRTCSupported: true, // RN WebRTC is always supported when installed
  localStream: null,
  remoteStreams: new Map(),
  activeCalls: new Map(),
  activeGroupCallId: null,
  incomingCall: null,
  isMuted: false,
  videoStream: null,
  isVideoActive: false,
  callHistory: [],

  webRTCService: null,
  callManager: null,
  currentUserId: null,

  initializeWebRTC: async (user) => {
    const state = get();
    if (state.isInitialized || state.webRTCService || state.callManager) {
      console.warn('[CallStore] Already initialized, skipping');
      return;
    }

    try {
      const webRTCService = new WebRTCService(user.id);
      const callManager = CallManager.getInstance(webRTCService);
      callManager.setCurrentUser(user);

      try {
        const cached = await AsyncStorage.getItem(`call_history_${user.id}`);
        if (cached) {
          set({callHistory: JSON.parse(cached)});
        }
      } catch (err) {
        console.warn('[CallStore] Failed to load call history:', err);
      }

      webRTCService.onLocalStream = (stream: any) => {
        set({localStream: stream});
      };

      callManager.onRemoteStream = (socketId: string, stream: any) => {
        const {activeCalls, remoteStreams} = get();
        const newStreams = new Map(remoteStreams);
        newStreams.set(socketId, stream);
        const call = activeCalls.get(socketId);
        if (call && call.status !== 'ringing') {
          call.status = 'connected';
          const newCalls = new Map(activeCalls);
          newCalls.set(socketId, call);
          set({activeCalls: newCalls, remoteStreams: newStreams});
        } else {
          set({remoteStreams: newStreams});
        }
      };

      callManager.onIncomingCall = (call: CallState) => {
        set({incomingCall: call});
      };

      callManager.onCallAccepted = (call: CallState, oldSocketId?: string) => {
        const {activeCalls, remoteStreams} = get();
        const newCalls = new Map(activeCalls);
        const newStreams = new Map(remoteStreams);
        
        // Remove duplicate stale 'calling' entries
        for (const [key, existing] of newCalls.entries()) {
          if (existing.userId === call.userId && existing.status === 'calling') {
            newCalls.delete(key);
          }
        }

        if (oldSocketId) {
          newCalls.delete(oldSocketId);
          const stream = newStreams.get(oldSocketId);
          if (stream) {
            newStreams.delete(oldSocketId);
            newStreams.set(call.socketId, stream);
          }
        }
        newCalls.set(call.socketId, call);
        set({activeCalls: newCalls, remoteStreams: newStreams, incomingCall: null});
      };

      callManager.onCallRejected = (call: CallState) => {
        const {activeCalls} = get();
        const newCalls = new Map(activeCalls);
        newCalls.set(call.socketId, call);
        set({activeCalls: newCalls, incomingCall: null});
      };

      webRTCService.onCallMigrated = (oldKey: string, newKey: string) => {
        const {activeCalls, remoteStreams} = get();
        const newCalls = new Map(activeCalls);
        const newStreams = new Map(remoteStreams);
        const call = newCalls.get(oldKey);
        if (call) {
          newCalls.delete(oldKey);
          newCalls.set(newKey, {...call, socketId: newKey});
        }
        const stream = newStreams.get(oldKey);
        if (stream) {
          newStreams.delete(oldKey);
          newStreams.set(newKey, stream);
        }
        set({activeCalls: newCalls, remoteStreams: newStreams});
      };

      callManager.onCallEnded = (call: CallState) => {
        const {activeCalls, callHistory, remoteStreams} = get();
        const newCalls = new Map(activeCalls);
        newCalls.delete(call.socketId);
        const newStreams = new Map(remoteStreams);
        newStreams.delete(call.socketId);

        const isIncoming = Boolean(call.isIncoming);
        const historyRecord: CallRecord = {
          id: `${call.userId}-${Date.now()}`,
          callerId: isIncoming ? call.userId : user.id,
          callerName: isIncoming ? (call.userName || 'Неизвестно') : 'Я',
          receiverId: isIncoming ? user.id : call.userId,
          receiverName: isIncoming ? 'Я' : (call.userName || 'Неизвестно'),
          type: isIncoming 
            ? (call.status === 'connected' ? 'incoming' : 'missed') 
            : 'outgoing',
          duration: call.duration || 0,
          startTime: call.startTime || new Date(),
          endTime: new Date(),
          status: call.status === 'connected' ? 'completed' : 'missed',
        };
        const newHistory = [historyRecord, ...callHistory].slice(0, 100);
        AsyncStorage.setItem(`call_history_${user.id}`, JSON.stringify(newHistory)).catch(err => {
          console.error('[CallStore] Failed to save call history:', err);
        });

        set({
          activeCalls: newCalls,
          remoteStreams: newStreams,
          callHistory: newHistory,
        });
      };

      callManager.onCallFailed = (call: CallState, error: string) => {
        console.error('Call failed:', error);
        const {activeCalls} = get();
        const newCalls = new Map(activeCalls);
        if (call.socketId) {
          newCalls.set(call.socketId, {...call, status: 'failed'});
        }
        set({activeCalls: newCalls});
      };

      callManager.onCallStateChange = (socketId: string, state: CallState) => {
        const {activeCalls} = get();
        const newCalls = new Map(activeCalls);
        if (state.status === 'connected') {
          for (const [key, existing] of newCalls.entries()) {
            if (existing.userId === state.userId && existing.status === 'calling') {
              newCalls.delete(key);
            }
          }
        }
        newCalls.set(socketId, state);
        set({activeCalls: newCalls});
      };

      callManager.onGroupCallIdChange = (groupId: string | null) => {
        set({activeGroupCallId: groupId});
      };

      set({
        isInitialized: true,
        webRTCService,
        callManager,
        currentUserId: user.id,
      });
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      throw error;
    }
  },

  cleanup: () => {
    const {callManager, webRTCService} = get();
    if (callManager) callManager.cleanup();
    if (webRTCService) webRTCService.cleanup();
    CallManager.resetInstance();
    set({
      isInitialized: false,
      localStream: null,
      remoteStreams: new Map(),
      activeCalls: new Map(),
      activeGroupCallId: null,
      incomingCall: null,
      isMuted: false,
      videoStream: null,
      isVideoActive: false,
      webRTCService: null,
      callManager: null,
      currentUserId: null,
    });
  },

  setLocalStream: (stream) => set({localStream: stream}),

  addActiveCall: (socketId, call) => {
    const {activeCalls} = get();
    const newCalls = new Map(activeCalls);
    newCalls.set(socketId, call);
    set({activeCalls: newCalls});
  },

  removeActiveCall: (socketId) => {
    const {activeCalls} = get();
    const newCalls = new Map(activeCalls);
    newCalls.delete(socketId);
    set({activeCalls: newCalls});
  },

  updateActiveCall: (socketId, call) => {
    const {activeCalls} = get();
    const newCalls = new Map(activeCalls);
    newCalls.set(socketId, call);
    set({activeCalls: newCalls});
  },

  setIncomingCall: (call) => set({incomingCall: call}),
  clearIncomingCall: () => set({incomingCall: null}),

  toggleMute: () => {
    const {callManager, isMuted} = get();
    if (callManager) {
      const newMutedState = callManager.toggleMute();
      set({isMuted: newMutedState});
      return newMutedState;
    }
    return isMuted;
  },

  setMuted: (muted) => {
    const {callManager} = get();
    if (callManager) {
      const currentMuted = callManager.isMuted();
      if (currentMuted !== muted) callManager.toggleMute();
    }
    set({isMuted: muted});
  },

  addToHistory: (record) => {
    const {callHistory, currentUserId} = get();
    const newHistory = [record, ...callHistory].slice(0, 100);
    set({callHistory: newHistory});
    if (currentUserId) {
      AsyncStorage.setItem(`call_history_${currentUserId}`, JSON.stringify(newHistory)).catch(err => {
        console.error('[CallStore] Failed to save call history:', err);
      });
    }
  },

  clearHistory: () => {
    const {currentUserId} = get();
    set({callHistory: []});
    if (currentUserId) {
      AsyncStorage.removeItem(`call_history_${currentUserId}`).catch(err => {
        console.error('[CallStore] Failed to clear call history:', err);
      });
    }
  },

  startVideo: async () => {
    const {callManager} = get();
    if (!callManager) return;
    await callManager.startVideo();
    set({isVideoActive: true});
  },

  stopVideo: async () => {
    const {callManager} = get();
    if (!callManager) return;
    await callManager.stopVideo();
    set({isVideoActive: false});
  },

  toggleVideo: async () => {
    const {callManager, isVideoActive} = get();
    if (!callManager) return;
    await callManager.toggleVideo();
    set({isVideoActive: !isVideoActive});
  },

  isVideoEnabled: () => {
    const {callManager} = get();
    if (!callManager) return false;
    return callManager.isVideoEnabled();
  },

  initiateCall: async (targetUserId, targetUserName) => {
    const {callManager} = get();
    if (!callManager) throw new Error('CallManager not initialized');
    await callManager.initiateDirectCall(targetUserId, targetUserName);
  },

  initiateGroupCall: async (groupId) => {
    const {callManager} = get();
    if (!callManager) throw new Error('CallManager not initialized');
    await callManager.initiateGroupCall(groupId);
  },

  joinVoiceChannel: async (channelId) => {
    const {callManager} = get();
    if (!callManager) throw new Error('CallManager not initialized');
    await callManager.joinVoiceChannel(channelId);
  },

  leaveVoiceChannel: (channelId) => {
    const {callManager} = get();
    if (!callManager) return;
    callManager.leaveVoiceChannel(channelId);
  },

  joinGroupCall: async (callId) => {
    const {callManager} = get();
    if (!callManager) throw new Error('CallManager not initialized');
    await callManager.joinGroupCall(callId);
  },

  getActiveGroupCall: async (groupId) => {
    const {callManager} = get();
    if (!callManager) return null;
    return await callManager.getActiveGroupCall(groupId);
  },

  leaveGroupCall: (callId) => {
    const {callManager} = get();
    if (!callManager) return;
    callManager.leaveGroupCall(callId);
  },

  acceptCall: async (callerSocketId, callerInfo) => {
    const {callManager, incomingCall} = get();
    if (!callManager) throw new Error('CallManager not initialized');
    if (incomingCall?.isGroupCall && incomingCall.callId) {
      await callManager.joinGroupCall(incomingCall.callId);
    } else {
      await callManager.acceptIncomingCall(callerSocketId, callerInfo);
    }
    set({incomingCall: null});
  },

  rejectCall: (callerSocketId) => {
    const {callManager, incomingCall} = get();
    if (!callManager) return;
    if (incomingCall?.isGroupCall && incomingCall.callId) {
      callManager.rejectGroupCall(incomingCall.callId);
    } else {
      callManager.rejectIncomingCall(callerSocketId);
    }
    set({incomingCall: null});
  },

  endCall: (targetSocketId) => {
    const {callManager} = get();
    if (!callManager) return;
    callManager.endCall(targetSocketId);
  },

  endAllCalls: () => {
    const {callManager} = get();
    if (!callManager) return;
    callManager.endAllCalls();
  },

  getCallBySocketId: (socketId) => {
    return get().activeCalls.get(socketId);
  },

  getCallByUserId: (userId) => {
    for (const call of get().activeCalls.values()) {
      if (call.userId === userId) return call;
    }
    return undefined;
  },

  getActiveCallsCount: () => get().activeCalls.size,

  getTotalCallDuration: () => {
    let total = 0;
    for (const call of get().activeCalls.values()) {
      total += call.duration || 0;
    }
    return total;
  },
}));
