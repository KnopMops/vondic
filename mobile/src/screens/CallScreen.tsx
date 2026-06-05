import React, {useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ImageBackground} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {useCallStore} from '@/store/callStore';
import {RTCView} from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/Ionicons';
import IncallManager from 'react-native-incall-manager';

type RoutePropType = RouteProp<MainStackParamList, 'Call'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'Call'>;

export default function CallScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const {targetUserId, isIncoming, callerSocketId} = route.params || {};

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
  } = useCallStore();

  useEffect(() => {
    IncallManager.start({media: 'audio'});
    IncallManager.setForceSpeakerphoneOn(true);
    return () => {
      IncallManager.stop();
    };
  }, []);

  const call = incomingCall || (targetUserId ? activeCalls.get(targetUserId) : undefined);

  const handleAccept = async () => {
    if (callerSocketId) {
      await acceptCall(callerSocketId);
    }
  };

  const handleReject = () => {
    if (incomingCall?.socketId) {
      rejectCall(incomingCall.socketId);
    }
    navigation.goBack();
  };

  const handleEnd = () => {
    if (call?.socketId) {
      endCall(call.socketId);
    }
    navigation.goBack();
  };

  const remoteStream = call ? remoteStreams.get(call.socketId) : null;

  return (
    <View style={styles.container}>
      {isVideoActive && remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <ImageBackground
          source={{uri: call?.avatarUrl || ''}}
          style={styles.background}
          blurRadius={20}>
          <View style={styles.overlay} />
        </ImageBackground>
      )}

      <View style={styles.content}>
        <Text style={styles.name}>{call?.userName || 'Неизвестно'}</Text>
        <Text style={styles.status}>
          {call?.status === 'ringing'
            ? 'Входящий звонок...'
            : call?.status === 'calling'
            ? 'Звонок...'
            : call?.status === 'connected'
            ? 'Разговор'
            : ''}
        </Text>

        {localStream && isVideoActive && (
          <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" />
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
          <Icon name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={toggleVideo}>
          <Icon name={isVideoActive ? 'videocam' : 'videocam-off'} size={28} color="#fff" />
        </TouchableOpacity>

        {isIncoming && call?.status === 'ringing' ? (
          <>
            <TouchableOpacity style={[styles.controlButton, styles.acceptButton]} onPress={handleAccept}>
              <Icon name="call" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={handleReject}>
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={handleEnd}>
            <Icon name="call" size={28} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  status: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 8,
  },
  localVideo: {
    width: 120,
    height: 160,
    borderRadius: 12,
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: '#1a1a1a',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
    gap: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#2ecc71',
  },
  endButton: {
    backgroundColor: '#e74c3c',
    transform: [{rotate: '135deg'}],
  },
});
