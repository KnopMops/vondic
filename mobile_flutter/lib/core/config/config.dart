class AppConfig {
  static const String backendUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: 'https://vondic.ru',
  );

  static const String wsUrl = String.fromEnvironment(
    'WS_URL',
    defaultValue: 'wss://vondic.ru',
  );

  static const String oauthUrl = String.fromEnvironment(
    'OAUTH_URL',
    defaultValue: 'https://vondic.ru',
  );

  static const String oauthClientId = String.fromEnvironment(
    'OAUTH_CLIENT_ID',
    defaultValue: '46b766ec-96c9-473f-ab7e-b75dfb75f38a',
  );

  static const String oauthClientSecret = String.fromEnvironment(
    'OAUTH_CLIENT_SECRET',
    defaultValue: '0741e349-b77c-47ac-878d-e9cfb47ea80ce6ab57139e4e46888d4d3ec9d57705d1',
  );

  static const String oauthRedirectUrl = String.fromEnvironment(
    'OAUTH_REDIRECT_URL',
    defaultValue: 'vondic://oauth/callback',
  );

  static const String internalTurnHost = String.fromEnvironment(
    'INTERNAL_TURN_HOST',
    defaultValue: '192.168.120.248',
  );

  static const String turnUrl = String.fromEnvironment(
    'TURN_URL',
    defaultValue: 'turn:95.165.96.208:3478?transport=udp',
  );

  static const String turnUrls = String.fromEnvironment(
    'TURN_URLS',
    defaultValue: 'turn:95.165.96.208:3478?transport=udp,turn:95.165.96.208:3478?transport=tcp',
  );

  static const String turnUsername = String.fromEnvironment(
    'TURN_USERNAME',
    defaultValue: 'vondic',
  );

  static const String turnPassword = String.fromEnvironment(
    'TURN_PASSWORD',
    defaultValue: 'Dim4566212Len',
  );

  static const bool forceRelay = bool.fromEnvironment(
    'FORCE_RELAY',
    defaultValue: false,
  );

  static const String nammaPushUrl = String.fromEnvironment(
    'NAMMA_PUSH_URL',
    defaultValue: 'https://vondic.ru/namma-push',
  );

  static const String nammaPushAuthToken = String.fromEnvironment(
    'NAMMA_PUSH_AUTH_TOKEN',
    defaultValue: 'fvKemYRl62lJ2aED8kk4g2wFuiQ06iIk',
  );

  static const String novuApiUrl = String.fromEnvironment(
    'NOVU_API_URL',
    defaultValue: 'https://vondic.ru/novu',
  );
}
