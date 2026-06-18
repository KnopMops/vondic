import NativeConfig from 'react-native-config';

export const Config = {
  BACKEND_URL: NativeConfig.BACKEND_URL || 'https://vondic.ru',
  WS_URL: NativeConfig.WS_URL || 'wss://vondic.ru',
  OAUTH_URL: NativeConfig.OAUTH_URL || 'https://vondic.ru',
  OAUTH_CLIENT_ID: NativeConfig.OAUTH_CLIENT_ID || 'mobile-app',
  OAUTH_CLIENT_SECRET: NativeConfig.OAUTH_CLIENT_SECRET || '',
  OAUTH_REDIRECT_URL: NativeConfig.OAUTH_REDIRECT_URL || 'vondic://oauth/callback',
  getOAuthRedirectUrl: () => NativeConfig.OAUTH_REDIRECT_URL || 'vondic://oauth/callback',
  INTERNAL_TURN_HOST: NativeConfig.INTERNAL_TURN_HOST || '192.168.120.248',
  TURN_URL: NativeConfig.TURN_URL || 'turn:95.165.96.208:3478?transport=udp',
  TURN_URLS:
    NativeConfig.TURN_URLS ||
    'turn:95.165.96.208:3478?transport=udp,turn:95.165.96.208:3478?transport=tcp',
  TURN_USERNAME: NativeConfig.TURN_USERNAME || 'vondic',
  TURN_PASSWORD: NativeConfig.TURN_PASSWORD || 'Dim4566212Len',
  FORCE_RELAY: NativeConfig.FORCE_RELAY === 'true',
};
