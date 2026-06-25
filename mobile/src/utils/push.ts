import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { Config } from '@/constants/config';
import { appLog } from './appLogger';

const API_URL = Config.BACKEND_URL || 'https://vondic.ru';

/**
 * Запросить разрешение на push-уведомления
 */
export async function requestPushPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().requestPermission();
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    appLog('Push', 'Результат запроса разрешений: ' + (granted ? 'ПРЕДОСТАВЛЕНО' : 'ОТКЛОНЕНО'), { authStatus });
    return granted;
  } catch (error) {
    appLog('Push', 'Ошибка запроса разрешений', error);
    return false;
  }
}

/**
 * Получить FCM токен
 */
export async function getPushToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    appLog('Push', 'FCM токен получен: ' + (token ? token.substring(0, 30) + '...' : 'null'), { token });
    return token;
  } catch (error) {
    appLog('Push', 'Ошибка получения FCM токена', error);
    return null;
  }
}

/**
 * Отправить токен на бэкенд для регистрации устройства
 */
export async function registerDeviceOnBackend(userId: string, pushToken: string): Promise<void> {
  try {
    appLog('Push', 'Запуск регистрации устройства на бэкенде...', { userId, token: pushToken.substring(0, 30) + '...' });
    
    // 1. Сначала пытаемся получить токен из AsyncStorage
    let accessToken = await AsyncStorage.getItem('access_token');
    
    // 2. Если его нет, пробуем получить из Keychain
    if (!accessToken) {
      try {
        const credentials = await Keychain.getGenericPassword({
          service: 'com.vondic.mobile.access_token',
        });
        if (credentials) {
          accessToken = credentials.password;
        }
      } catch (keychainError) {
        appLog('Push', 'Ошибка чтения access_token из Keychain', keychainError);
      }
    }

    // 3. Резервный вариант: парсим из объекта user, если токен лежит там
    if (!accessToken) {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          accessToken = user.access_token || '';
        } catch {}
      }
    }

    if (!accessToken) {
      appLog('Push', 'Не найден токен авторизации для регистрации устройства');
      return;
    }

    appLog('Push', 'Отправка POST запроса на регистрацию устройства...');
    const response = await fetch(`${API_URL}/api/v1/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token: pushToken,
        platform: Platform.OS, // 'ios' или 'android'
        device_type: 'mobile',
      }),
    });

    const data = await response.json();
    if (response.ok && (data.success || data.ok)) {
      appLog('Push', 'Устройство успешно зарегистрировано на бэкенде');
    } else {
      appLog('Push', 'Бэкенд вернул ошибку при регистрации устройства', data);
    }
  } catch (error) {
    appLog('Push', 'Исключение при отправке регистрации устройства на бэкенд', error);
  }
}

/**
 * Полная регистрация: разрешение + токен + отправка на бэкенд
 */
export async function registerForPush(userId: string): Promise<void> {
  try {
    appLog('Push', 'Начало полной регистрации пушей для пользователя ' + userId);
    const granted = await requestPushPermission();
    if (!granted) {
      appLog('Push', 'Полная регистрация прервана: разрешение не получено');
      return;
    }
    const pushToken = await getPushToken();
    if (!pushToken) {
      appLog('Push', 'Полная регистрация прервана: не удалось получить токен');
      return;
    }
    await registerDeviceOnBackend(userId, pushToken);
  } catch (error) {
    appLog('Push', 'Ошибка в процессе полной регистрации пушей', error);
  }
}
