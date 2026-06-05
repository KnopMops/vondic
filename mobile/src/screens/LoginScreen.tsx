import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import {Config} from '@/constants/config';
import {generateOAuthState} from '@/hooks/useDeepLinks';

export default function LoginScreen() {
  const startOAuth = async () => {
    try {
      const state = generateOAuthState();
      const authParams = new URLSearchParams({
        client_id: Config.OAUTH_CLIENT_ID,
        redirect_uri: Config.getOAuthRedirectUrl(),
        response_type: 'code',
        state,
      });

      const url = `${Config.OAUTH_URL}/oauth/authorize?${authParams.toString()}`;

      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(url, {
          // iOS
          dismissButtonStyle: 'cancel',
          preferredBarTintColor: '#0f0f0f',
          preferredControlTintColor: '#6c5ce7',
          readerMode: false,
          animated: true,
          modalPresentationStyle: 'fullScreen',
          modalTransitionStyle: 'coverVertical',
          modalEnabled: true,
          enableBarCollapsing: false,
          // Android
          showTitle: true,
          toolbarColor: '#0f0f0f',
          secondaryToolbarColor: '#1a1a1a',
          navigationBarColor: '#0f0f0f',
          navigationBarDividerColor: '#1a1a1a',
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          forceCloseOnRedirection: true,
          animations: {
            startEnter: 'slide_in_right',
            startExit: 'slide_out_left',
            endEnter: 'slide_in_left',
            endExit: 'slide_out_right',
          },
        });
      } else {
        // Fallback to system browser
        await Linking.openURL(url);
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось начать авторизацию');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Вондик</Text>
      <Text style={styles.subtitle}>Безопасные сообщения для всех</Text>

      <TouchableOpacity style={styles.button} onPress={startOAuth}>
        <Text style={styles.buttonText}>Продолжить с Вондик</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Продолжая, вы соглашаетесь с Условиями использования и Политикой конфиденциальности
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
