import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import {launchCamera} from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import {apiClient} from '@/api/client';
import {Config} from '@/constants/config';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {useChat} from '@/hooks/useChat';
import {useAppSelector} from '@/store/hooks';
import {socketService} from '@/services/SocketService';
import {crashLogger} from '@/utils/crashLogger';
import {appLog} from '@/utils/appLogger';
import {ErrorBoundary} from '@/components/ErrorBoundary';
import {useCallStore} from '@/store/callStore';

interface ChatRouteParams {
  type: 'dm' | 'group' | 'channel';
  id: string;
  name: string;
  avatar?: string | null;
}

type RoutePropType = RouteProp<MainStackParamList, 'Chat'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'Chat'>;

function ChatScreenInner() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAppSelector(state => state.auth);
  const {initiateCall} = useCallStore();

  // Логируем параметры при монтировании
  useEffect(() => {
    appLog('ChatScreen', 'MOUNTED', {
      routeParams: route.params,
      userId: user?.id,
      userName: user?.username,
    });
  }, []);

  // Проверка параметров
  if (!route.params) {
    crashLogger.logCrash(
      new Error('[ChatScreen] MISSING route.params'),
      'ChatScreen',
      {routeKeys: Object.keys(route)},
    );
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка: нет параметров чата</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {type, id, name} = route.params as ChatRouteParams;
  appLog('ChatScreen', 'render start', {type, id, name});

  if (!id || !type) {
    crashLogger.logCrash(
      new Error('[ChatScreen] INVALID params'),
      'ChatScreen',
      {type, id, name, rawParams: route.params},
    );
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка: невалидные параметры чата</Text>
        <Text style={styles.errorDetail}>type={String(type)} id={String(id)}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const targetUserId = type === 'dm' ? id : undefined;
  const groupId = type === 'group' ? id : undefined;
  const channelId = type === 'channel' ? id : undefined;

  // useChat — оборачиваем в try-catch на случай если сам хук падает
  let chatHook: ReturnType<typeof useChat>;
  try {
    chatHook = useChat(targetUserId, channelId, groupId, false);
  } catch (hookErr: any) {
    crashLogger.logCrash(hookErr, 'ChatScreen_useChat', {
      targetUserId,
      channelId,
      groupId,
    });
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка инициализации чата</Text>
        <Text style={styles.errorDetail}>{hookErr?.message || 'Unknown'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {messages, isLoading, hasMore, isTyping, fetchHistory, sendMessage, sendTyping} = chatHook;

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);

  const touchStartPageX = useRef(0);
  const isHoldingRef = useRef(false);
  const isCancelledRef = useRef(false);
  const pressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recordingType, setRecordingType] = useState<'voice' | 'video_note'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');

  // Shared playback states
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [playPosition, setPlayPosition] = useState(0);
  const [playDuration, setPlayDuration] = useState(0);

  const recorderRef = useRef<AudioRecorderPlayer | null>(null);
  if (!recorderRef.current) {
    recorderRef.current = new AudioRecorderPlayer();
  }
  const recorder = recorderRef.current;

  const playerRef = useRef<AudioRecorderPlayer | null>(null);
  if (!playerRef.current) {
    playerRef.current = new AudioRecorderPlayer();
  }
  const player = playerRef.current;

  useEffect(() => {
    return () => {
      recorder.stopRecorder().catch(() => {});
      recorder.removeRecordBackListener();
      player.stopPlayer().catch(() => {});
      player.removePlayBackListener();
    };
  }, [recorder, player]);

  useEffect(() => {
    appLog('ChatScreen', 'useChat initialized', {
      msgCount: messages.length,
      isLoading,
      hasMore,
      isTyping,
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    appLog('ChatScreen', 'Connecting socket + fetching history', {
      targetUserId,
      channelId,
      groupId,
    });
    (async () => {
      try {
        await socketService.connect();
        if (mounted) await fetchHistory();
      } catch (err: any) {
        crashLogger.logCrash(err, 'ChatScreen_init', {targetUserId, channelId, groupId});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [targetUserId, groupId, channelId, fetchHistory]);

  // Логируем изменения messages
  useEffect(() => {
    appLog('ChatScreen', 'messages updated', {
      msgCount: messages.length,
      firstId: messages[0]?.id,
      lastId: messages[messages.length - 1]?.id,
    });
  }, [messages.length]);

  const uriToBase64 = async (uri: string): Promise<string> => {
    let cleanUri = uri;
    if (!cleanUri.startsWith('file://') && !cleanUri.startsWith('content://')) {
      cleanUri = 'file://' + cleanUri;
    }
    const response = await fetch(cleanUri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'android') {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        if (grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Доступ запрещен', 'Для записи голосовых сообщений требуется доступ к микрофону.');
          return;
        }
      }

      console.log('[ChatScreen] Starting voice recording...');
      const uri = await recorder.startRecorder(undefined);
      setIsRecording(true);
      setRecordTime('00:00');
      recorder.addRecordBackListener((e) => {
        const seconds = Math.floor(e.currentPosition / 1000);
        const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
        const ss = String(seconds % 60).padStart(2, '0');
        setRecordTime(`${mm}:${ss}`);
      });
    } catch (err) {
      console.error('[ChatScreen] startRecording failed:', err);
      Alert.alert('Ошибка', 'Не удалось начать запись');
    }
  };

  const stopRecording = async (shouldSend: boolean) => {
    try {
      console.log('[ChatScreen] Stopping recorder, shouldSend =', shouldSend);
      const uri = await recorder.stopRecorder();
      recorder.removeRecordBackListener();
      setIsRecording(false);

      if (!shouldSend) {
        console.log('[ChatScreen] Recording cancelled/discarded');
        return;
      }

      if (!uri) {
        console.warn('[ChatScreen] Recording uri is empty');
        return;
      }

      setSending(true);
      try {
        const base64Data = await uriToBase64(uri);
        const filename = `voice_${Date.now()}.m4a`;

        console.log('[ChatScreen] Uploading voice note...');
        const response = await apiClient.post<{ url: string }>('/upload/voice', {
          file: base64Data,
          filename,
        });

        if (response && response.url) {
          console.log('[ChatScreen] Voice message sent with URL:', response.url);
          await sendMessage(response.url, 'voice');
        } else {
          throw new Error('Upload response did not contain URL');
        }
      } catch (uploadErr: any) {
        console.error('[ChatScreen] Upload voice failed:', uploadErr);
        Alert.alert('Ошибка отправки', uploadErr?.message || 'Не удалось загрузить голосовое сообщение');
      } finally {
        setSending(false);
      }
    } catch (err) {
      console.error('[ChatScreen] stopRecording failed:', err);
      setIsRecording(false);
    }
  };

  const recordVideoNote = async () => {
    try {
      if (Platform.OS === 'android') {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        if (
          grants[PermissionsAndroid.PERMISSIONS.CAMERA] !== PermissionsAndroid.RESULTS.GRANTED ||
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          Alert.alert('Доступ запрещен', 'Для отправки кружочков требуется доступ к камере и микрофону.');
          return;
        }
      }

      console.log('[ChatScreen] Launching camera for video note...');
      launchCamera(
        {
          mediaType: 'video',
          videoQuality: 'low',
          durationLimit: 60,
        },
        async (response) => {
          if (response.didCancel) {
            console.log('[ChatScreen] Video note cancelled');
            return;
          }
          if (response.errorCode) {
            console.error('[ChatScreen] Image picker error:', response.errorMessage);
            Alert.alert('Ошибка записи', response.errorMessage || 'Не удалось записать видео');
            return;
          }

          const asset = response.assets?.[0];
          if (!asset || !asset.uri) {
            console.warn('[ChatScreen] No video asset uri');
            return;
          }

          setSending(true);
          try {
            console.log('[ChatScreen] Reading video note file as base64...');
            const base64Data = await uriToBase64(asset.uri);
            const filename = `video_note_${Date.now()}.mp4`;

            console.log('[ChatScreen] Uploading video note...');
            const uploadRes = await apiClient.post<{ url: string }>('/upload/video', {
              file: base64Data,
              filename,
            });

            if (uploadRes && uploadRes.url) {
              // Build absolute URL for consistent playback on both platforms
              let videoUrl = uploadRes.url;
              if (videoUrl.startsWith('/')) {
                videoUrl = `${Config.BACKEND_URL}${videoUrl}`;
              }
              console.log('[ChatScreen] Video note uploaded, url:', videoUrl);
              await sendMessage(videoUrl, 'video_note');
            } else {
              throw new Error('Upload response did not contain URL');
            }
          } catch (uploadErr: any) {
            console.error('[ChatScreen] Video note upload failed:', uploadErr);
            Alert.alert('Ошибка отправки', uploadErr?.message || 'Не удалось отправить кружочек');
          } finally {
            setSending(false);
          }
        }
      );
    } catch (err) {
      console.error('[ChatScreen] recordVideoNote failed:', err);
    }
  };

  const handlePressIn = () => {
    isCancelledRef.current = false;
    isHoldingRef.current = false;
    if (pressTimeoutRef.current) clearTimeout(pressTimeoutRef.current);
    pressTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      if (recordingType === 'voice') {
        startRecording();
      } else {
        recordVideoNote();
      }
    }, 350);
  };

  const handlePressOut = () => {
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
      pressTimeoutRef.current = null;
    }
    if (isCancelledRef.current) return;
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      if (recordingType === 'voice') {
        stopRecording(true);
      }
    } else {
      setRecordingType(prev => (prev === 'voice' ? 'video_note' : 'voice'));
    }
  };

  const handleTouchStart = (event: any) => {
    touchStartPageX.current = event.nativeEvent.pageX;
  };

  const handleTouchMove = (event: any) => {
    if (isHoldingRef.current && recordingType === 'voice' && !isCancelledRef.current) {
      const diffX = touchStartPageX.current - event.nativeEvent.pageX;
      if (Math.abs(diffX) > 80) {
        isCancelledRef.current = true;
        isHoldingRef.current = false;
        stopRecording(false);
        Alert.alert('Запись отменена', 'Голосовое сообщение удалено');
      }
    }
  };

  const handlePlayVoice = useCallback(async (msgId: string, url: string) => {
    try {
      let playUrl = url;
      if (playUrl && playUrl.startsWith('/')) {
        playUrl = `${Config.BACKEND_URL}${playUrl}`;
      }

      if (playingMsgId === msgId) {
        console.log('[ChatScreen] Stopping voice playback');
        await player.stopPlayer();
        player.removePlayBackListener();
        setPlayingMsgId(null);
      } else {
        if (playingMsgId) {
          console.log('[ChatScreen] Stopping previous voice playback');
          await player.stopPlayer();
          player.removePlayBackListener();
        }
        console.log('[ChatScreen] Starting voice playback for url:', playUrl);
        setPlayingMsgId(msgId);
        setPlayPosition(0);
        setPlayDuration(0);
        await player.startPlayer(playUrl);
        player.addPlayBackListener((e) => {
          setPlayPosition(e.currentPosition);
          setPlayDuration(e.duration);
          if (e.currentPosition >= e.duration) {
            setPlayingMsgId(null);
          }
        });
      }
    } catch (err) {
      console.error('[ChatScreen] Voice playback failed:', err);
      setPlayingMsgId(null);
    }
  }, [playingMsgId, player]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    appLog('ChatScreen', 'Sending message...', {textLen: inputText.length});
    setSending(true);
    try {
      await sendMessage(inputText.trim(), 'text');
      setInputText('');
    } catch (err: any) {
      crashLogger.logCrash(err, 'ChatScreen_sendMessage', {text: inputText});
      Alert.alert('Ошибка отправки', err?.message || 'Unknown');
    } finally {
      setSending(false);
    }
  }, [inputText, sendMessage]);

  const [activeGroupCall, setActiveGroupCall] = useState<any>(null);

  const checkActiveGroupCall = useCallback(async () => {
    if (type === 'group' && id) {
      try {
        const activeCall = await useCallStore.getState().getActiveGroupCall(id);
        setActiveGroupCall(activeCall);
      } catch (e) {
        console.error('[ChatScreen] checkActiveGroupCall error:', e);
      }
    }
  }, [type, id]);

  useEffect(() => {
    checkActiveGroupCall();
    const timer = setInterval(checkActiveGroupCall, 10000);
    return () => clearInterval(timer);
  }, [checkActiveGroupCall]);

  const handleGroupCallPress = useCallback(async () => {
    try {
      const activeCall = await useCallStore.getState().getActiveGroupCall(id);
      if (activeCall) {
        await useCallStore.getState().joinGroupCall(activeCall.call_id);
        navigation.navigate('Call', {
          targetUserId: id,
          isIncoming: false,
          callerSocketId: '',
          isGroupCall: true,
          callId: activeCall.call_id,
          groupId: id,
          groupName: name,
        });
      } else {
        await useCallStore.getState().initiateGroupCall(id);
        navigation.navigate('Call', {
          targetUserId: id,
          isIncoming: false,
          callerSocketId: '',
          isGroupCall: true,
          groupId: id,
          groupName: name,
        });
      }
    } catch (err: any) {
      crashLogger.logCrash(err, 'ChatScreen_groupCall', {id, name});
      Alert.alert('Ошибка', 'Не удалось начать/присоединиться к звонку');
    }
  }, [id, name, navigation]);



  const renderMessage = ({item, index}: {item: any; index: number}) => {
    try {
      if (!item || typeof item !== 'object') {
        crashLogger.logCrash(
          {message: `[ChatScreen] Invalid message at index ${index}`, name: 'Warn'},
          'ChatScreen',
          {index, itemType: typeof item},
        );
        return <View style={{height: 0}} />;
      }

      const isOwn = item.sender_id === user?.id;
      const timeStr = item.timestamp || item.created_at;
      let msgDate: Date | null = null;
      try {
        msgDate = timeStr ? new Date(timeStr) : null;
      } catch {
        msgDate = null;
      }
      const timeText = msgDate && !isNaN(msgDate.getTime())
        ? msgDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})
        : '';

      const senderName = item.sender_username || item.sender_name || (item.sender?.username) || 'Пользователь';
      const contentText = item.content ? String(item.content) : '';
      appLog('ChatScreen', 'renderMessage', {id: item.id, isOwn, contentPreview: contentText.slice(0, 30)});

      const msgType = item.type || 'text';

      if (msgType === 'voice') {
        const isPlaying = playingMsgId === item.id;
        const progress = isPlaying && playDuration > 0 ? playPosition / playDuration : 0;

        return (
          <View
            style={[
              styles.messageBubble,
              isOwn ? styles.ownBubble : styles.otherBubble,
              styles.voiceBubble,
            ]}>
            {!isOwn && type !== 'dm' && (
              <Text style={styles.senderName}>{senderName}</Text>
            )}
            <View style={styles.voicePlayerRow}>
              <TouchableOpacity
                onPress={() => handlePlayVoice(item.id, contentText)}
                style={styles.voicePlayButton}>
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={20}
                  color={isOwn ? '#fff' : '#6c5ce7'}
                />
              </TouchableOpacity>
              <View style={styles.voiceProgressContainer}>
                <View style={styles.voiceProgressBarBg}>
                  <View
                    style={[
                      styles.voiceProgressBarActive,
                      {
                        width: `${progress * 100}%`,
                        backgroundColor: isOwn ? '#fff' : '#6c5ce7',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.voiceDurationText, {color: isOwn ? 'rgba(255,255,255,0.7)' : '#888'}]}>
                  {isPlaying
                    ? `${formatTime(playPosition)} / ${formatTime(playDuration)}`
                    : 'Голосовое сообщение'}
                </Text>
              </View>
            </View>
            {timeText ? (
              <Text style={[styles.messageTime, {color: isOwn ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)'}]}>
                {timeText}
              </Text>
            ) : null}
          </View>
        );
      }

      if (msgType === 'video_note') {
        // Build absolute URL for playback
        let videoUrl = contentText;
        if (videoUrl && videoUrl.startsWith('/')) {
          videoUrl = `${Config.BACKEND_URL}${videoUrl}`;
        }
        return (
          <View
            style={[
              styles.messageBubble,
              isOwn ? styles.ownBubble : styles.otherBubble,
              styles.videoNoteBubble,
            ]}>
            {!isOwn && type !== 'dm' && (
              <Text style={styles.senderName}>{senderName}</Text>
            )}
            <View style={styles.videoNoteCircle}>
              {videoUrl ? (
                <Video
                  source={{uri: videoUrl}}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                  controls={true}
                  paused={true}
                  repeat={false}
                  ignoreSilentSwitch="ignore"
                  onError={(err) => {
                    console.error('[ChatScreen] Video playback error:', err);
                  }}
                />
              ) : (
                <View style={styles.videoNoteOverlay}>
                  <Text style={styles.videoNoteLabel}>Ошибка URL</Text>
                </View>
              )}
            </View>
            {timeText ? (
              <Text style={[styles.messageTime, {color: isOwn ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)'}]}>
                {timeText}
              </Text>
            ) : null}
          </View>
        );
      }

      if (msgType === 'call_invite') {
        return (
          <TouchableOpacity
            style={[
              styles.messageBubble,
              isOwn ? styles.ownBubble : styles.otherBubble,
              styles.callInviteBubble,
            ]}
            onPress={async () => {
              try {
                const activeCall = await useCallStore.getState().getActiveGroupCall(id);
                if (activeCall) {
                  await useCallStore.getState().joinGroupCall(activeCall.call_id);
                  navigation.navigate('Call', {
                    targetUserId: id,
                    isIncoming: false,
                    callerSocketId: '',
                    isGroupCall: true,
                    callId: activeCall.call_id,
                    groupId: id,
                    groupName: name,
                  });
                } else {
                  Alert.alert('Звонок завершен', 'Этот групповой звонок уже завершен.');
                }
              } catch (err) {
                console.error('[ChatScreen] Join group call from invite message failed:', err);
                Alert.alert('Ошибка', 'Не удалось присоединиться к звонку');
              }
            }}
          >
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
              <Icon name="call" size={24} color="#fff" />
              <View style={{flex: 1}}>
                {!isOwn && type !== 'dm' && (
                  <Text style={styles.senderName}>{senderName}</Text>
                )}
                <Text style={styles.messageText}>{contentText}</Text>
                <Text style={styles.callInviteActionText}>Нажмите, чтобы присоединиться</Text>
              </View>
            </View>
            {timeText ? <Text style={styles.messageTime}>{timeText}</Text> : null}
          </TouchableOpacity>
        );
      }

      return (
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.ownBubble : styles.otherBubble,
          ]}>
          {!isOwn && type !== 'dm' && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          {contentText ? <Text style={styles.messageText}>{contentText}</Text> : null}
          {timeText ? <Text style={styles.messageTime}>{timeText}</Text> : null}
        </View>
      );
    } catch (err: any) {
      crashLogger.logCrash(err, 'ChatScreen_renderMessage', {
        index,
        itemId: item?.id,
        itemKeys: item ? Object.keys(item) : null,
      });
      return (
        <View style={[styles.messageBubble, styles.otherBubble]}>
          <Text style={styles.messageText}>⚠️ Ошибка отображения</Text>
        </View>
      );
    }
  };

  if (renderError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка рендера</Text>
        <Text style={styles.errorDetail}>{renderError}</Text>
        <TouchableOpacity onPress={() => setRenderError(null)}>
          <Text style={styles.linkText}>Попробовать снова</Text>
        </TouchableOpacity>
      </View>
    );
  }

  try {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name || 'Чат'}
          </Text>
          {(type === 'dm' || type === 'group') && (
            <TouchableOpacity
              onPress={type === 'group' ? handleGroupCallPress : () => {
                try {
                  initiateCall(id, name || 'Пользователь');
                  navigation.navigate('Call', {targetUserId: id});
                } catch (err: any) {
                  crashLogger.logCrash(err, 'ChatScreen_call', {id, name});
                }
              }}>
              <Text style={styles.callButton}>📞</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              try {
                if (type === 'channel') navigation.navigate('ChannelSettings', {channelId: id});
                else if (type === 'group') navigation.navigate('GroupSettings', {groupId: id});
                else navigation.navigate('UserProfile', {userId: id});
              } catch (navErr: any) {
                crashLogger.logCrash(navErr, 'ChatScreen_navigate', {type, id});
              }
            }}>
            <Text style={styles.infoButton}>i</Text>
          </TouchableOpacity>
        </View>

        {/* Active group call banner */}
        {activeGroupCall && (
          <TouchableOpacity
            style={styles.activeCallBanner}
            onPress={async () => {
              try {
                await useCallStore.getState().joinGroupCall(activeGroupCall.call_id);
                navigation.navigate('Call', {
                  targetUserId: id,
                  isIncoming: false,
                  callerSocketId: '',
                  isGroupCall: true,
                  callId: activeGroupCall.call_id,
                  groupId: id,
                  groupName: name,
                });
              } catch (err) {
                Alert.alert('Ошибка', 'Не удалось присоединиться к звонку');
              }
            }}>
            <View style={styles.bannerRow}>
              <View style={styles.bannerLeft}>
                <View style={styles.bannerPulseDot} />
                <Text style={styles.activeCallBannerText}>Активный групповой звонок</Text>
              </View>
              <Text style={styles.activeCallJoinText}>Войти →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>печатает...</Text>
          </View>
        )}

        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={(item, index) => {
            try {
              return item?.id ? String(item.id) : `msg-${index}`;
            } catch {
              return `msg-${index}`;
            }
          }}
          renderItem={renderMessage}
          contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 8}}
          style={{flex: 1}}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({animated: false})}
          ListEmptyComponent={
            <View style={{paddingTop: 40, alignItems: 'center'}}>
              <Text style={{color: '#666'}}>Нет сообщений</Text>
            </View>
          }
        />

        {/* Input / Recording */}
        <View style={styles.inputContainer}>
          {isRecording ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => stopRecording(false)}
                style={{ marginRight: 8, padding: 4 }}
              >
                <Icon name="trash" size={22} color="#ff6b6b" />
              </TouchableOpacity>
              <Text style={styles.recordingDot}>🔴</Text>
              <Text style={styles.recordingTimer}>{recordTime}</Text>
              <Text style={styles.recordingLabel}>Запись...</Text>
              <Text style={{ color: '#888', fontSize: 12, marginLeft: 'auto', marginRight: 10 }}>
                Смахните для отмены
              </Text>
            </View>
          ) : (
            <TextInput
              style={styles.textInput}
              placeholder="Сообщение..."
              placeholderTextColor="#666"
              value={inputText}
              onChangeText={text => {
                setInputText(text);
                try {
                  sendTyping();
                } catch (e: any) {
                  crashLogger.logCrash(e, 'ChatScreen_sendTyping', {});
                }
              }}
              multiline
              maxLength={4000}
            />
          )}

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {(inputText.trim() || isRecording) && (
              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={() => {
                  if (isRecording) {
                    stopRecording(true);
                  } else {
                    handleSend();
                  }
                }}
                disabled={sending}
              >
                <Icon name="send" size={18} color="#fff" />
              </TouchableOpacity>
            )}

            {!inputText.trim() && (
              <View
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                style={{ marginLeft: 4 }}
              >
                <TouchableOpacity
                  style={[
                    styles.recordToggleButton,
                    isRecording && { backgroundColor: '#6c5ce7' }
                  ]}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                >
                  <Icon
                    name={recordingType === 'voice' ? 'mic' : 'videocam'}
                    size={22}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  } catch (renderErr: any) {
    crashLogger.logCrash(renderErr, 'ChatScreen_render', {type, id, name});
    setRenderError(renderErr?.message || 'Render error');
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка отрисовки чата</Text>
        <Text style={styles.errorDetail}>{renderErr?.message}</Text>
      </View>
    );
  }
}

export default function ChatScreen() {
  return (
    <ErrorBoundary screenName="ChatScreen">
      <ChatScreenInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  errorDetail: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
  linkText: {
    color: '#6c5ce7',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0f0f0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  infoButton: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  callButton: {
    color: '#fff',
    fontSize: 18,
    paddingHorizontal: 8,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  ownBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6c5ce7',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  voiceBubble: {
    minWidth: 200,
  },
  voicePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  voicePlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  voiceProgressContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  voiceProgressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  voiceProgressBarActive: {
    height: '100%',
    borderRadius: 2,
  },
  voiceDurationText: {
    fontSize: 11,
  },
  videoNoteBubble: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  videoNoteCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6c5ce7',
  },
  videoNoteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoNoteLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 20,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    justifyContent: 'space-between',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    fontSize: 14,
    marginRight: 6,
  },
  recordingTimer: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 10,
  },
  recordingLabel: {
    color: '#aaa',
    fontSize: 14,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelRecordButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelRecordText: {
    color: '#ff6b6b',
    fontSize: 15,
    fontWeight: '600',
  },
  sendRecordButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  sendRecordText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  recordToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  callInviteBubble: {
    backgroundColor: '#6c5ce7',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  callInviteActionText: {
    color: '#a29bfe',
    fontSize: 12,
    marginTop: 6,
    fontWeight: 'bold',
  },
  activeCallBanner: {
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(108, 92, 231, 0.3)',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ecc71',
  },
  activeCallBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  activeCallJoinText: {
    color: '#6c5ce7',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
