import '@/utils/polyfills';
import 'react-native-gesture-handler';
import React, {useEffect, useRef, useState} from 'react';
import {StatusBar, Animated, View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {store} from '@/store';
import {fetchUser} from '@/store/authSlice';
import {useAppSelector} from '@/store/hooks';
import RootNavigator from '@/navigation';
import type {MainStackParamList} from '@/navigation/MainStack';
import {useDeepLinks} from '@/hooks/useDeepLinks';
import {crashLogger} from '@/utils/crashLogger';
import DebugLogPanel from '@/components/DebugLogPanel';
import {socketService} from '@/services/SocketService';
import {useCallStore} from '@/store/callStore';
import {pushService} from '@/services/PushService';
import {appLog} from '@/utils/appLogger';
import Icon from 'react-native-vector-icons/Ionicons';
import {requestAllAppPermissions} from '@/utils/permissions';
import Video from 'react-native-video';

// Verify the secure RNG is wired up before any crypto-dependent screen mounts.
try {
  const arr = new Uint8Array(4);
  global.crypto.getRandomValues(arr);
  appLog('App', 'RNG smoke test ok', {bytes: Array.from(arr)});
} catch (e) {
  appLog('App', 'RNG smoke test failed', String(e));
}

appLog('App', 'Application module loaded');

crashLogger.setupGlobalHandler();
import {navigationRef} from '@/navigation/navigationRef';

function IncomingCallListener(): React.JSX.Element | null {
  const incomingCall = useCallStore(state => state.incomingCall);
  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    appLog('IncomingCallListener', 'incomingCall changed', {
      socketId: incomingCall?.socketId,
      userId: incomingCall?.userId,
      status: incomingCall?.status,
      isGroupCall: incomingCall?.isGroupCall,
      callId: incomingCall?.callId,
    });
    if (!incomingCall) return;

    const callIdentifier = incomingCall.isGroupCall ? incomingCall.callId : incomingCall.socketId;
    if (!callIdentifier) return;
    if (lastHandledRef.current === callIdentifier) return;
    lastHandledRef.current = callIdentifier;

    if (!navigationRef.isReady()) {
      appLog('IncomingCallListener', 'navigation ref not ready');
      return;
    }
    const currentRoute = navigationRef.getCurrentRoute()?.name;
    appLog('IncomingCallListener', 'navigating to Call', {currentRoute});
    if (currentRoute === 'Call') return;

    try {
      navigationRef.navigate('Call', {
        targetUserId: incomingCall.isGroupCall ? incomingCall.groupId : incomingCall.userId,
        isIncoming: true,
        callerSocketId: incomingCall.socketId || '',
        isGroupCall: incomingCall.isGroupCall,
        callId: incomingCall.callId,
        groupId: incomingCall.groupId,
      });
      appLog('IncomingCallListener', 'navigated to Call');
    } catch (e) {
      appLog('IncomingCallListener', 'navigation failed', String(e));
      console.error('[IncomingCallListener] navigation failed:', e);
    }
  }, [incomingCall]);

  return null;
}

function AppInitializer(): React.JSX.Element | null {
  const {user} = useAppSelector(state => state.auth);

  useEffect(() => {
    appLog('AppInitializer', 'mount');
    store.dispatch(fetchUser());
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    appLog('AppInitializer', 'user initialized', {userId: user.id});

    // Запрашиваем все системные разрешения (уведомления, микрофон, камера)
    requestAllAppPermissions().catch(err => {
      appLog('AppInitializer', 'Ошибка запроса системных разрешений', err);
    });

    // Инициализируем Push-уведомления независимо от состояния сокета/WebRTC
    pushService.initialize(user.id).catch(err => {
      console.error('[PushService] initialize failed:', err);
    });

    let mounted = true;

    (async () => {
      try {
        // Подготавливаем WebRTC/CallManager до подключения сокета,
        // чтобы слушатели звонков были зарегистрированы заранее.
        await useCallStore.getState().initializeWebRTC({
          id: user.id,
          name: user.username || user.displayName || 'Пользователь',
          avatar: user.avatar_url || undefined,
        });

        if (!mounted) {
          return;
        }

        await socketService.connect();
      } catch (err: any) {
        console.error('[AppInitializer] failed to initialize realtime:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return null;
}

function GlobalNotificationBanner(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState<any>(null);
  const [playAudio, setPlayAudio] = useState(false);
  const translateY = useRef(new Animated.Value(-150)).current;
  const timeoutRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  useEffect(() => {
    const handleReceiveMessage = (msg: any) => {
      // Don't show if the user is in the corresponding chat
      if (!navigationRef.isReady()) return;
      const currentRoute = navigationRef.getCurrentRoute();
      if (currentRoute?.name === 'Chat') {
        const params = currentRoute.params as any;
        if (params?.id === msg.sender_id || params?.id === msg.group_id || params?.id === msg.channel_id) {
          return;
        }
      }

      setNotification(msg);
      setVisible(true);
      setPlayAudio(true);

      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(dismiss, 4000);
    };

    socketService.on('receive_message', handleReceiveMessage);

    return () => {
      socketService.off('receive_message', handleReceiveMessage);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handlePress = () => {
    if (!notification) return;
    dismiss();
    const type = notification.group_id ? 'group' : notification.channel_id ? 'channel' : 'dm';
    const id = notification.group_id || notification.channel_id || notification.sender_id;
    const name = notification.sender_name || 'Чат';
    navigationRef.navigate('Chat', {
      type,
      id,
      name,
    });
  };

  if (!visible || !notification) return null;

  const title = notification.group_id
    ? `Группа: ${notification.group_name || 'Чат'}`
    : notification.channel_id
    ? `Канал: ${notification.channel_name || 'Канал'}`
    : notification.sender_name || 'Новое сообщение';

  const body = notification.content?.startsWith('e2e:')
    ? 'Зашифрованное сообщение'
    : notification.content || 'Файл/Изображение';

  return (
    <>
      {playAudio && (
        <Video
          source={require('./android/app/src/main/res/raw/message.mp3')}
          paused={false}
          onEnd={() => setPlayAudio(false)}
          style={{ width: 0, height: 0, position: 'absolute' }}
        />
      )}
      <Animated.View style={[styles.bannerContainer, { top: (insets.top || 16) + 8, transform: [{ translateY }] }]}>
        <TouchableOpacity activeOpacity={0.9} style={styles.banner} onPress={handlePress}>
          <View style={styles.iconContainer}>
            <Icon name="mail" size={24} color="#fff" />
          </View>
          <View style={styles.content}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.bannerBody} numberOfLines={1}>
              {body}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
            <Icon name="close" size={20} color="#888" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

function App(): React.JSX.Element {
  useDeepLinks();

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <Provider store={store}>
          <NavigationContainer ref={navigationRef}>
            <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
            <AppInitializer />
            <IncomingCallListener />
            <RootNavigator />
            <GlobalNotificationBanner />
            <DebugLogPanel />
          </NavigationContainer>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerBody: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
});

export default App;
