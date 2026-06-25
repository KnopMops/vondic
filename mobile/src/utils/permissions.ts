import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { appLog } from './appLogger';

/**
 * Запрашивает все необходимые разрешения для приложения (уведомления, микрофон, камера)
 */
export async function requestAllAppPermissions(): Promise<void> {
  appLog('Permissions', 'Запуск проверки и запроса системных разрешений...');

  // 1. Сначала запрашиваем разрешения Firebase Messaging (работает на обеих платформах)
  try {
    const authStatus = await messaging().requestPermission();
    const messagingGranted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    appLog('Permissions', 'Статус разрешений уведомлений Firebase: ' + (messagingGranted ? 'РАЗРЕШЕНО' : 'ЗАПРЕЩЕНО'));
  } catch (error) {
    appLog('Permissions', 'Ошибка запроса уведомлений Firebase', error);
  }

  // 2. Для Android запрашиваем системные разрешения (микрофон, камера, уведомления Android 13+)
  if (Platform.OS === 'android') {
    try {
      const permissionsToRequest = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ];

      // POST_NOTIFICATIONS требуется на Android 13+ (API 33+)
      const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
      if (apiLevel >= 33) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }

      appLog('Permissions', 'Запрос системных разрешений Android: ' + JSON.stringify(permissionsToRequest));
      const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
      appLog('Permissions', 'Результаты системных разрешений Android', results);
    } catch (err) {
      appLog('Permissions', 'Ошибка при запросе системных разрешений Android', err);
    }
  }
}
