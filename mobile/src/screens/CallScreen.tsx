import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {useCallStore} from '@/store/callStore';
import {RTCView} from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/Ionicons';
import IncallManager from 'react-native-incall-manager';
import Video from 'react-native-video';

type RoutePropType = RouteProp<MainStackParamList, 'Call'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'Call'>;

export default function CallScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const {targetUserId, isIncoming, callerSocketId, isGroupCall, callId, groupId, groupName} = route.params || {};

  const {
    activeCalls,
    incomingCall,
    localStream,
    remoteStreams,
    isMuted,
    isVideoActive,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    webRTCService,
    activeGroupCallId,
  } = useCallStore();

  const [duration, setDuration] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [pingMs, setPingMs] = useState<number>(0);
  const [connState, setConnState] = useState<string>('');
  const [iceConnState, setIceConnState] = useState<string>('');

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    IncallManager.start({media: 'audio'});
    IncallManager.setForceSpeakerphoneOn(true);
    return () => {
      IncallManager.stop();
    };
  }, []);

  const isGroup = isGroupCall || !!activeGroupCallId || incomingCall?.isGroupCall;
  const activeGroupId = groupId || callId || incomingCall?.callId || incomingCall?.groupId || activeGroupCallId;

  const directCall =
    incomingCall ||
    (targetUserId
      ? Array.from(activeCalls.values()).find(
          c => (c.userId === targetUserId || c.socketId === targetUserId) && c.status === 'connected' && !c.isGroupCall,
        ) ||
        Array.from(activeCalls.values()).find(
          c => (c.userId === targetUserId || c.socketId === targetUserId) && !c.isGroupCall,
        )
      : undefined) ||
    Array.from(activeCalls.values()).find(c => c.status === 'connected' && !c.isGroupCall) ||
    Array.from(activeCalls.values()).find(c => !c.isGroupCall);

  const groupParticipants = Array.from(activeCalls.values()).filter(c => c.isGroupCall);
  const numParticipants = groupParticipants.length;

  // Synthesize call state for group compatibility
  const call = isGroup
    ? {
        status: activeGroupCallId ? 'connected' : incomingCall ? 'ringing' : 'calling',
        userName: groupName || incomingCall?.userName || 'Групповой звонок',
        avatarUrl: incomingCall?.avatarUrl || null,
        startTime: incomingCall?.startTime || new Date(),
        isGroupCall: true,
      }
    : directCall;

  const wasCallActive = useRef(false);
  if (isGroup ? (!!activeGroupCallId || !!incomingCall) : (!!directCall || !!incomingCall)) {
    wasCallActive.current = true;
  }

  useEffect(() => {
    if (call?.status === 'ringing') {
      console.log('[CallScreen] Playing custom ringtone');
      (IncallManager as any).startRingtone('_BUNDLE_');
    } else {
      IncallManager.stopRingtone();
    }

    if (call?.status === 'calling') {
      console.log('[CallScreen] Playing default ringback');
      (IncallManager as any).startRingback('_DEFAULT_');
    } else {
      IncallManager.stopRingback();
    }

    return () => {
      IncallManager.stopRingtone();
      IncallManager.stopRingback();
    };
  }, [call?.status]);

  // Handle call timer/duration
  useEffect(() => {
    if (call?.status === 'connected' && call?.startTime) {
      const getElapsed = () => Math.floor((Date.now() - new Date(call.startTime!).getTime()) / 1000);
      setDuration(Math.max(0, getElapsed()));

      const interval = setInterval(() => {
        setDuration(Math.max(0, getElapsed()));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setDuration(0);
    }
  }, [call?.status, call?.startTime]);

  // Handle pulsing animation when ringing/calling
  useEffect(() => {
    if (call?.status === 'ringing' || call?.status === 'calling') {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.4,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.0,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.4,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
      opacityAnim.setValue(0);
    }
  }, [call?.status, scaleAnim, opacityAnim]);

  // Handle WebRTC Peer Connection stats (RTT / ping, connection state, etc.)
  useEffect(() => {
    if (!directCall || directCall.status !== 'connected' || !webRTCService || isGroup) {
      setPingMs(0);
      setConnState('');
      setIceConnState('');
      return;
    }

    const timer = setInterval(async () => {
      const pc = webRTCService.getPeerConnection(directCall.socketId);
      if (pc) {
        setConnState(pc.connectionState || '');
        setIceConnState((pc as any).iceConnectionState || '');

        try {
          const stats = await pc.getStats();
          if (stats) {
            let selectedId = '';
            stats.forEach((r: any) => {
              if (r.type === 'transport' && r.selectedCandidatePairId) {
                selectedId = r.selectedCandidatePairId;
              }
            });
            let pair: any = null;
            stats.forEach((r: any) => {
              if (r.type === 'candidate-pair') {
                if (selectedId ? r.id === selectedId : r.selected) {
                  pair = r;
                }
              }
            });
            if (pair) {
              const rtt =
                typeof pair.currentRoundTripTime === 'number'
                  ? pair.currentRoundTripTime * 1000
                  : typeof pair.roundTripTime === 'number'
                  ? pair.roundTripTime * 1000
                  : 0;
              setPingMs(Math.max(0, Math.round(rtt)));
            }
          }
        } catch (e) {
          console.warn('[CallScreen] Failed to get peer connection stats:', e);
        }
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [directCall, webRTCService, isGroup]);

  // Navigation handlers
  useEffect(() => {
    const isOutgoing = targetUserId && !isIncoming;

    if (isGroup) {
      if (wasCallActive.current && !activeGroupCallId && !incomingCall) {
        console.log('[CallScreen] Group call ended, navigating back');
        navigation.goBack();
      }
    } else {
      if (isOutgoing) {
        if (wasCallActive.current && !directCall) {
          console.log('[CallScreen] Outgoing call ended, navigating back');
          navigation.goBack();
        }
      } else {
        if (!directCall && !incomingCall) {
          console.log('[CallScreen] Incoming call ended, navigating back');
          navigation.goBack();
        }
      }
    }
  }, [directCall, incomingCall, targetUserId, isIncoming, navigation, isGroup, activeGroupCallId]);

  useEffect(() => {
    if (targetUserId && !isIncoming && !directCall && !isGroup) {
      const timer = setTimeout(() => {
        if (!wasCallActive.current) {
          console.log('[CallScreen] Outgoing call initialization timed out');
          navigation.goBack();
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [directCall, targetUserId, isIncoming, navigation, isGroup]);

  const handleAccept = async () => {
    if (incomingCall?.isGroupCall && incomingCall?.callId) {
      await acceptCall(incomingCall.callId);
    } else if (callerSocketId) {
      await acceptCall(callerSocketId);
    }
  };

  const handleReject = () => {
    if (incomingCall?.isGroupCall && incomingCall?.callId) {
      rejectCall(incomingCall.callId);
    } else if (incomingCall?.socketId) {
      rejectCall(incomingCall.socketId);
    }
    navigation.goBack();
  };

  const handleEnd = () => {
    if (isGroup) {
      const activeId = activeGroupId || useCallStore.getState().activeGroupCallId;
      if (activeId) {
        useCallStore.getState().leaveGroupCall(activeId);
      }
    } else {
      if (directCall?.socketId) {
        endCall(directCall.socketId);
      }
    }
    navigation.goBack();
  };

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [
      h > 0 ? h : null,
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0'),
    ]
      .filter(x => x !== null)
      .join(':');
  };

  const remoteStream = directCall ? remoteStreams.get(directCall.socketId) : null;
  const showVideo = isVideoActive && remoteStream;

  const getTileStyle = (total: number): any => {
    if (total === 1) {
      return {
        width: '100%',
        height: '90%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1c1c1f',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        position: 'relative',
      };
    } else if (total === 2) {
      return {
        width: '100%',
        height: '47%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1c1c1f',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        position: 'relative',
      };
    } else {
      return {
        width: '48%',
        height: '47%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1c1c1f',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        position: 'relative',
      };
    }
  };

  const renderParticipant = (participant: any, index: number, total: number) => {
    const stream = remoteStreams.get(participant.socketId);
    const hasVideo = stream && stream.getVideoTracks && stream.getVideoTracks().length > 0;
    const tileStyle = getTileStyle(total);

    return (
      <View key={participant.socketId} style={tileStyle}>
        {hasVideo ? (
          <RTCView streamURL={stream.toURL()} style={styles.participantVideo} objectFit="cover" />
        ) : (
          <View style={styles.participantAvatarBg}>
            {participant.avatarUrl ? (
              <Image source={{uri: participant.avatarUrl}} style={styles.participantAvatar} />
            ) : (
              <View style={styles.participantAvatarPlaceholder}>
                <Text style={styles.participantInitials}>
                  {(participant.userName || 'У').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.participantOverlay}>
          <Text style={styles.participantName} numberOfLines={1}>
            {participant.userName || 'Участник'}
          </Text>
          <Text style={styles.participantStatus}>
            {participant.status === 'connected' ? 'В сети' : 'Подключение...'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {call?.status === 'ringing' && (
        <Video
          source={require('../../android/app/src/main/res/raw/rington.wav')}
          paused={false}
          repeat={true}
          style={{ width: 0, height: 0, position: 'absolute' }}
        />
      )}
      {showVideo ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <ImageBackground
          source={{uri: call?.avatarUrl || ''}}
          style={styles.background}
          blurRadius={25}>
          <View style={styles.overlay} />
        </ImageBackground>
      )}

      {/* Top Header Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Звонок Вондик</Text>
        {call?.status === 'connected' && !isGroup && (
          <TouchableOpacity style={styles.infoButton} onPress={() => setShowStats(!showStats)}>
            <Icon
              name={showStats ? 'information-circle' : 'information-circle-outline'}
              size={28}
              color="#fff"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Connection Stats Overlay Card */}
      {showStats && call?.status === 'connected' && !isGroup && (
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Информация о соединении</Text>
            <TouchableOpacity onPress={() => setShowStats(false)}>
              <Icon name="close-circle-outline" size={22} color="#aaa" />
            </TouchableOpacity>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Статус:</Text>
            <Text style={[styles.statsValue, {color: '#2ecc71'}]}>Разговор</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Пинг (RTT):</Text>
            <Text style={styles.statsValue}>{pingMs > 0 ? `${pingMs} мс` : 'N/A'}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Соединение:</Text>
            <Text style={styles.statsValue}>{connState || 'N/A'}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>ICE-статус:</Text>
            <Text style={styles.statsValue}>{iceConnState || 'N/A'}</Text>
          </View>
        </View>
      )}

      {/* Main Content Area */}
      <View style={styles.content}>
        {isGroup ? (
          <View style={{flex: 1, width: '100%', paddingVertical: 10}}>
            <Text style={styles.name} numberOfLines={1}>{call?.userName}</Text>
            <Text style={styles.status}>Групповой звонок</Text>
            {call?.status === 'connected' && duration > 0 && (
              <Text style={[styles.timer, {textAlign: 'center', marginBottom: 12}]}>{formatDuration(duration)}</Text>
            )}
            
            <View style={styles.groupCallContainer}>
              {numParticipants === 0 ? (
                <View style={styles.waitingContainer}>
                  {(call?.status === 'ringing' || call?.status === 'calling') && (
                    <Animated.View
                      style={[
                        styles.pulseRing,
                        {
                          transform: [{scale: scaleAnim}],
                          opacity: opacityAnim,
                        },
                      ]}
                    />
                  )}
                  <View style={styles.avatarPlaceholderLarge}>
                    <Icon name="people" size={60} color="#fff" />
                  </View>
                  <Text style={styles.waitingText}>Ожидание участников...</Text>
                  <Text style={styles.waitingSubtext}>Как только кто-то присоединится, вы увидите его</Text>
                </View>
              ) : (
                <View style={[
                  styles.participantsGrid,
                  numParticipants === 2 && styles.gridTwo,
                  numParticipants >= 3 && styles.gridMany
                ]}>
                  {groupParticipants.map((p, idx) => renderParticipant(p, idx, numParticipants))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <>
            {!showVideo ? (
              <View style={styles.avatarWrapper}>
                {(call?.status === 'ringing' || call?.status === 'calling') && (
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      {
                        transform: [{scale: scaleAnim}],
                        opacity: opacityAnim,
                      },
                    ]}
                  />
                )}
                <View style={styles.avatarContainer}>
                  {call?.avatarUrl ? (
                    <Image source={{uri: call.avatarUrl}} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>
                        {(call?.userName || 'Н').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            <Text style={styles.name} numberOfLines={1}>{call?.userName || 'Неизвестно'}</Text>
            
            <Text style={styles.status}>
              {call?.status === 'ringing'
                ? 'Входящий вызов...'
                : call?.status === 'calling'
                ? 'Вызов...'
                : call?.status === 'connected'
                ? 'Разговор'
                : 'Подключение...'}
            </Text>

            {call?.status === 'connected' && duration > 0 && (
              <Text style={styles.timer}>{formatDuration(duration)}</Text>
            )}
          </>
        )}

        {localStream && isVideoActive && (
          <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" />
        )}
      </View>

      {/* Controls Container */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}>
          <Icon name={isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isVideoActive && styles.controlButtonActive]}
          onPress={toggleVideo}>
          <Icon name={isVideoActive ? 'videocam' : 'videocam-off'} size={26} color="#fff" />
        </TouchableOpacity>

        {isIncoming && call?.status === 'ringing' ? (
          <>
            <TouchableOpacity style={[styles.controlButton, styles.acceptButton]} onPress={handleAccept}>
              <Icon name="call" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={handleReject}>
              <Icon name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={handleEnd}>
            <Icon name="call" size={26} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    height: Platform.OS === 'ios' ? 100 : 70,
    zIndex: 10,
  },
  headerTitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  infoButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statsCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(20, 20, 25, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 20,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  statsLabel: {
    color: '#aaa',
    fontSize: 13,
  },
  statsValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(108, 92, 231, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.5)',
  },
  avatarContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#1c1c1f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(108, 92, 231, 0.5)',
    shadowColor: '#6c5ce7',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3b3b4f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 54,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  status: {
    fontSize: 15,
    color: '#8e8e93',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  timer: {
    fontSize: 18,
    color: '#6c5ce7',
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  localVideo: {
    width: 100,
    height: 140,
    borderRadius: 12,
    position: 'absolute',
    top: 20,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    height: Platform.OS === 'ios' ? 140 : 100,
    gap: 16,
    zIndex: 10,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(108, 92, 231, 0.25)',
    borderColor: 'rgba(108, 92, 231, 0.4)',
  },
  acceptButton: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  endButton: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
    transform: [{rotate: '135deg'}],
  },
  groupCallContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  avatarPlaceholderLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3b3b4f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(108, 92, 231, 0.5)',
    zIndex: 2,
    marginBottom: 20,
  },
  waitingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
  },
  waitingSubtext: {
    color: '#8e8e93',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  participantsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'center',
    gap: 12,
  },
  participantVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  participantAvatarBg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c2c2f',
  },
  participantAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  participantAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantInitials: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  participantOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  participantName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  participantStatus: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 2,
  },
  gridTwo: {
    flexDirection: 'column',
  },
  gridMany: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
