import { setTokens } from '@/api/client';
import { Config } from '@/constants/config';
import { store } from '@/store';
import { setUser } from '@/store/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import * as Keychain from 'react-native-keychain';
import InAppBrowser from 'react-native-inappbrowser-reborn';

/**
 * Handles OAuth deeplink callbacks for Vondic OAuth 2.0:
 * vondic://oauth/callback?code=...&state=...
 *
 * Desktop uses the same flow: /oauth/authorize -> callback with code -> /oauth/token
 */

const OAUTH_STATE_KEY = 'oauth_state';

export function generateOAuthState(): string {
  const state = 'st_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  AsyncStorage.setItem(OAUTH_STATE_KEY, state).catch(() => {});
  return state;
}

async function getStoredState(): Promise<string | null> {
  return AsyncStorage.getItem(OAUTH_STATE_KEY);
}

// Hermes does not support URLSearchParams.get() — use manual helpers
function encodeFormData(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
}

function getQueryParam(url: string, key: string): string | null {
  const idx = url.indexOf('?');
  if (idx === -1) return null;
  const pairs = url.slice(idx + 1).split('&');
  for (const pair of pairs) {
    const [k, v] = pair.split('=');
    if (decodeURIComponent(k) === key) {
      return v ? decodeURIComponent(v) : '';
    }
  }
  return null;
}

async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token?: string;
  user?: any;
} | null> {
  try {
    const body = encodeFormData({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: Config.OAUTH_CLIENT_ID,
      client_secret: Config.OAUTH_CLIENT_SECRET,
    });

    const res = await fetch(`${Config.BACKEND_URL}/oauth/token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[OAuth] Token exchange failed:', err);
      Alert.alert('Ошибка авторизации', err.error || err.message || 'Сервер вернул ошибку');
      return null;
    }

    const data = await res.json();
    if (!data.access_token) {
      Alert.alert('Ошибка', 'Токен доступа не получен от сервера');
      return null;
    }

    // Fetch user info
    const userRes = await fetch(`${Config.BACKEND_URL}/oauth/userinfo`, {
      headers: {Authorization: `Bearer ${data.access_token}`},
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      data.user = userData;
    }

    return data;
  } catch (error) {
    console.error('[OAuth] Token exchange error:', error);
    return null;
  }
}

export async function handleOAuthCallback(url: string): Promise<boolean> {
  if (!url.startsWith(Config.getOAuthRedirectUrl())) return false;

  try {
    try {
      InAppBrowser.close();
    } catch (e) {
      console.warn('[OAuth] Failed to close InAppBrowser:', e);
    }

    const code = getQueryParam(url, 'code');
    const state = getQueryParam(url, 'state');
    const errorParam = getQueryParam(url, 'error');

    if (errorParam) {
      Alert.alert('Ошибка авторизации', errorParam);
      return false;
    }

    // Verify state to prevent CSRF
    const storedState = await getStoredState();
    if (state && storedState && state !== storedState) {
      Alert.alert('Ошибка', 'Несовпадение state-параметра. Попробуйте ещё раз.');
      return false;
    }
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);

    if (!code) {
      Alert.alert('Ошибка', 'Код авторизации не получен.');
      return false;
    }

    // Exchange code for token (same flow as desktop)
    const result = await exchangeCodeForToken(code, Config.getOAuthRedirectUrl());
    if (!result) {
      Alert.alert('Ошибка', 'Не удалось обменять код на токен.');
      return false;
    }

    // Save tokens securely
    await setTokens(result.access_token, result.refresh_token);
    await Keychain.setGenericPassword('vondic_access_token', result.access_token, {
      service: 'com.vondic.mobile.access_token',
    });
    if (result.refresh_token) {
      await Keychain.setGenericPassword('vondic_refresh_token', result.refresh_token, {
        service: 'com.vondic.mobile.refresh_token',
      });
    }

    // Set user in Redux
    if (result.user) {
      store.dispatch(setUser(result.user));
    } else {
      // Fallback: fetch user from /oauth/userinfo
      const userRes = await fetch(`${Config.OAUTH_URL}/oauth/userinfo`, {
        headers: {Authorization: `Bearer ${result.access_token}`},
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        store.dispatch(setUser(userData));
      } else {
        Alert.alert('Ошибка', 'Не удалось получить данные пользователя.');
        return false;
      }
    }

    return true;
  } catch (error: any) {
    console.error('[OAuth] Callback handling error:', error);
    Alert.alert('Ошибка', error.message || 'Неизвестная ошибка авторизации');
    return false;
  }
}

export function useDeepLinks() {
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    // Handle cold-start deeplink
    Linking.getInitialURL().then(url => {
      if (url && handledRef.current !== url) {
        handledRef.current = url;
        handleOAuthCallback(url).catch(() => {});
      }
    });

    // Handle foreground / warm-start deeplink
    const subscription = Linking.addEventListener('url', ({url}) => {
      if (handledRef.current !== url) {
        handledRef.current = url;
        handleOAuthCallback(url).catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
