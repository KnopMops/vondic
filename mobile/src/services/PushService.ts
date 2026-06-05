/**
 * Push Notification Service
 *
 * Stack:
 * - @react-native-firebase/messaging (FCM / APNs)
 * - react-native-callkeep (CallKit iOS / ConnectionService Android)
 * - react-native-incall-manager (audio routing)
 */

import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import RNCallKeep from 'react-native-callkeep';
import {apiClient} from '@/api/client';
import {socketService} from './SocketService';
import {useCallStore} from '@/store/callStore';
import {store} from '@/store';
import {setUser} from '@/store/authSlice';
import {handleOAuthCallback} from '@/hooks/useDeepLinks';

const CALL_CHANNEL_ID = 'vondic_calls';
const MSG_CHANNEL_ID = 'vondic_messages';

class PushService {
  private fcmToken: string | null = null;
  private callkeepConfigured = false;

  async initialize(): Promise<void> {
    await this.requestPermission();
    await this.setupMessaging();
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await this.setupCallKeep();
    }
  }

  private async requestPermission(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    console.log('[Push] Permission:', enabled);
    return enabled;
  }

  private async setupMessaging(): Promise<void> {
    // Get and register token
    const token = await messaging().getToken();
    await this.registerToken(token);

    // Listen for token refresh
    messaging().onTokenRefresh(async newToken => {
      await this.registerToken(newToken);
    });

    // Foreground messages
    messaging().onMessage(async remoteMessage => {
      this.handleForegroundMessage(remoteMessage);
    });

    // Background / quit-state handler
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      this.handleBackgroundMessage(remoteMessage);
    });

    // Check if app was opened from a notification (cold start)
    const initialNotification = await messaging().getInitialNotification();
    if (initialNotification) {
      this.handleNotificationOpen(initialNotification);
    }

    // Listen for notification-open events
    messaging().onNotificationOpenedApp(remoteMessage => {
      this.handleNotificationOpen(remoteMessage);
    });
  }

  private async registerToken(token: string): Promise<void> {
    this.fcmToken = token;
    try {
      await apiClient.post('/devices/register', {
        token,
        platform: Platform.OS,
        device_type: 'mobile',
      });
      console.log('[Push] Token registered:', token.slice(0, 20) + '...');
    } catch (error) {
      console.error('[Push] Failed to register token:', error);
    }
  }

  private async setupCallKeep(): Promise<void> {
    const options = {
      ios: {
        appName: 'Вондик',
        includesCallsInRecents: false,
        supportsVideo: true,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
      },
      android: {
        alertTitle: 'Требуются разрешения',
        alertDescription: 'Приложению необходим доступ к учётным записям телефона',
        cancelButton: 'Отмена',
        okButton: 'ОК',
        additionalPermissions: [],
        foregroundService: {
          channelId: CALL_CHANNEL_ID,
          channelName: 'Звонки Вондик',
          notificationTitle: 'Идёт звонок Вондик',
          notificationIcon: 'ic_launcher',
        },
      },
    };

    try {
      RNCallKeep.setup(options);
      RNCallKeep.setAvailable(true);
      this.callkeepConfigured = true;

      RNCallKeep.addEventListener('answerCall', ({callUUID}) => {
        console.log('[CallKeep] answerCall', callUUID);
        const state = useCallStore.getState();
        if (state.incomingCall) {
          state.acceptCall(state.incomingCall.socketId);
        }
        RNCallKeep.setCurrentCallActive(callUUID);
      });

      RNCallKeep.addEventListener('endCall', ({callUUID}) => {
        console.log('[CallKeep] endCall', callUUID);
        const state = useCallStore.getState();
        if (state.incomingCall) {
          state.rejectCall(state.incomingCall.socketId);
        }
        RNCallKeep.endCall(callUUID);
      });

      RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({muted}) => {
        const state = useCallStore.getState();
        state.setMuted(muted);
      });
    } catch (error) {
      console.error('[CallKeep] Setup failed:', error);
    }
  }

  private handleForegroundMessage(message: FirebaseMessagingTypes.RemoteMessage): void {
    const data = message.data || {};
    const type = data.type as string;

    if (type === 'incoming_call') {
      this.showIncomingCallNotification(data);
    } else if (type === 'new_message') {
      // Foreground message — app is active, show in-app toast or ignore
      console.log('[Push] New message foreground:', data);
    }
  }

  private handleBackgroundMessage(message: FirebaseMessagingTypes.RemoteMessage): void {
    const data = message.data || {};
    const type = data.type as string;

    if (type === 'incoming_call') {
      // Show native incoming call UI even if app is killed
      this.showIncomingCallNotification(data);
    }
  }

  private handleNotificationOpen(message: FirebaseMessagingTypes.RemoteMessage): void {
    const data = message.data || {};
    if (data.deeplink) {
      handleOAuthCallback(data.deeplink as string).catch(() => {});
    }
  }

  private showIncomingCallNotification(data: Record<string, any>): void {
    if (!this.callkeepConfigured) return;

    const callerId = data.caller_id || 'unknown';
    const callerName = data.caller_name || 'Unknown';
    const callUUID = `vondic-call-${callerId}-${Date.now()}`;

    if (Platform.OS === 'ios') {
      RNCallKeep.displayIncomingCall(callUUID, String(callerId), callerName, 'generic', true);
    } else {
      RNCallKeep.displayIncomingCall(callUUID, String(callerId), callerName, 'generic', false);
    }

    // Also update our store so UI can navigate to CallScreen
    const state = useCallStore.getState();
    state.setIncomingCall({
      socketId: data.caller_socket_id || callerId,
      userId: callerId,
      userName: callerName,
      avatarUrl: data.caller_avatar_url,
      status: 'ringing',
      startTime: new Date(),
    });
  }

  getToken(): string | null {
    return this.fcmToken;
  }
}

export const pushService = new PushService();
