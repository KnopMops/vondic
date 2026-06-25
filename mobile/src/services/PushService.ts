/**
 * Push Notification Service
 *
 * Stack:
 * - @react-native-firebase/messaging (FCM)
 * - Novu self-hosted (subscribers & credentials API)
 * - react-native-callkeep (CallKit iOS / ConnectionService Android)
 * - react-native-incall-manager (audio routing)
 */

import {Platform, AppState} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import RNCallKeep from 'react-native-callkeep';
import {useCallStore} from '@/store/callStore';
import {handleOAuthCallback} from '@/hooks/useDeepLinks';
import {navigationRef} from '@/navigation/navigationRef';
import {appLog} from '@/utils/appLogger';
import {
  requestPushPermission,
  getPushToken,
  registerDeviceOnBackend,
  registerForPush,
} from '@/utils/push';

const CALL_CHANNEL_ID = 'vondic_calls';

class PushService {
  private pushToken: string | null = null;
  private callkeepConfigured = false;
  private initialized = false;
  private currentUserId: string | null = null;

  private tokenRefreshUnsubscribe: (() => void) | null = null;
  private messageUnsubscribe: (() => void) | null = null;
  private notificationOpenedUnsubscribe: (() => void) | null = null;

  async initialize(userId: string): Promise<void> {
    if (!userId) {
      appLog('PushService', 'Cannot initialize without userId');
      return;
    }

    if (this.initialized && this.currentUserId === userId) {
      if (this.pushToken) {
        await registerDeviceOnBackend(userId, this.pushToken);
      }
      return;
    }

    // Clean up if initializing with a different user
    if (this.initialized && this.currentUserId !== userId) {
      this.cleanup();
    }

    this.initialized = true;
    this.currentUserId = userId;

    const hasPermission = await requestPushPermission();
    appLog('PushService', 'Has notification permission: ' + hasPermission);

    // Настраиваем слушатели FCM в любом случае (в т.ч. для тихих data-only звонков)
    await this.setupFirebaseMessaging(userId);

    if (Platform.OS === 'ios') {
      await this.setupCallKeep();
    }
  }

  private async setupFirebaseMessaging(userId: string): Promise<void> {
    // 1. Get and register token
    try {
      const token = await getPushToken();
      if (token) {
        this.pushToken = token;
        await registerDeviceOnBackend(userId, token);
      }
    } catch (error) {
      appLog('PushService', 'Failed to get/register FCM token', error);
    }

    // 2. Listen for token refresh
    this.tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (newToken: string) => {
      appLog('PushService', 'Token refreshed');
      this.pushToken = newToken;
      await registerDeviceOnBackend(userId, newToken);
    });

    // 4. Foreground message listener
    this.messageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
      appLog('PushService', 'Notification received in foreground', remoteMessage);
      this.handleIncomingNotification(remoteMessage);
    });

    // 5. Notification opened listener (app in background/inactive)
    this.notificationOpenedUnsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
      appLog('PushService', 'Notification opened from background', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    // 6. Initial notification (app launched from closed state)
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        appLog('PushService', 'App opened from quit state via notification', remoteMessage);
        setTimeout(() => {
          this.handleNotificationOpen(remoteMessage);
        }, 1000);
      }
    });
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
        appLog('PushService', '[CallKeep] answerCall ' + callUUID);
        const state = useCallStore.getState();
        if (state.incomingCall) {
          state.acceptCall(state.incomingCall.socketId);
        }
        RNCallKeep.setCurrentCallActive(callUUID);
      });

      RNCallKeep.addEventListener('endCall', ({callUUID}) => {
        appLog('PushService', '[CallKeep] endCall ' + callUUID);
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
      appLog('PushService', '[CallKeep] Setup failed', error);
    }
  }

  private handleIncomingNotification(remoteMessage: any): void {
    const data = remoteMessage.data || {};
    const type = data.type as string;

    if (type === 'incoming_call') {
      this.showIncomingCallNotification(data);
    } else {
      appLog('PushService', 'Non-call notification received in foreground', remoteMessage);
    }
  }

  private handleNotificationOpen(remoteMessage: any): void {
    const data = remoteMessage.data || {};
    appLog('PushService', 'Notification opened with data', data);

    if (data.deeplink) {
      handleOAuthCallback(data.deeplink as string).catch(() => {});
      return;
    }

    // Handle incoming call notifications
    if (data.type === 'incoming_call') {
      const callerId = data.caller_user_id || data.caller_id;
      this.navigateWhenReady('Call', {
        targetUserId: data.group_id ? data.group_id : callerId,
        isIncoming: true,
        callerSocketId: data.caller_socket_id || callerId,
        isGroupCall: data.is_group === 'true' || !!data.group_id,
        callId: data.call_id,
        groupId: data.group_id,
      });
      return;
    }

    // Handle normal messages notifications
    const groupId = data.group_id;
    const channelId = data.channel_id;
    const senderId = data.sender_id || data.sender_user_id;

    if (groupId || channelId || senderId) {
      const type = groupId ? 'group' : channelId ? 'channel' : 'dm';
      const id = groupId || channelId || senderId;
      let name = remoteMessage.notification?.title || 'Чат';

      // Parse group name if title is like "Ivan (Group Name)"
      if (type === 'group' && name.includes('(') && name.endsWith(')')) {
        const idx = name.indexOf('(');
        name = name.slice(idx + 1, -1);
      }

      this.navigateWhenReady('Chat', {
        type,
        id,
        name,
      });
    }
  }

  private navigateWhenReady(screen: string, params: any) {
    if (navigationRef.isReady()) {
      navigationRef.navigate(screen as any, params);
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (navigationRef.isReady()) {
        clearInterval(interval);
        navigationRef.navigate(screen as any, params);
      } else if (attempts > 50) { // 5 seconds max
        clearInterval(interval);
        appLog('PushService', 'Navigation ref not ready after 5 seconds');
      }
    }, 100);
  }

  private showIncomingCallNotification(data: Record<string, any>): void {
    const callerId = data.caller_user_id || data.caller_id || 'unknown';
    const callerName = data.caller_username || data.caller_name || 'Unknown';

    if (Platform.OS === 'ios' && this.callkeepConfigured) {
      const callUUID = `vondic-call-${callerId}-${Date.now()}`;
      RNCallKeep.displayIncomingCall(callUUID, String(callerId), callerName, 'generic', true);
    }

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
    return this.pushToken;
  }

  cleanup(): void {
    appLog('PushService', 'Cleaning up listeners...');
    if (this.tokenRefreshUnsubscribe) {
      this.tokenRefreshUnsubscribe();
      this.tokenRefreshUnsubscribe = null;
    }
    if (this.messageUnsubscribe) {
      this.messageUnsubscribe();
      this.messageUnsubscribe = null;
    }
    if (this.notificationOpenedUnsubscribe) {
      this.notificationOpenedUnsubscribe();
      this.notificationOpenedUnsubscribe = null;
    }
    this.initialized = false;
    this.pushToken = null;
    this.currentUserId = null;
  }
}

export const pushService = new PushService();
