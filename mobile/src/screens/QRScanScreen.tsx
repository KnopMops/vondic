import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/MainStack';
import Icon from 'react-native-vector-icons/Ionicons';
import { apiClient } from '@/api/client';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function QRScanScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scannedRef = useRef(false);

  const handleQRScan = async (qrToken: string) => {
    if (scannedRef.current || loading) return;
    scannedRef.current = true;
    setLoading(true);

    try {
      console.log('[QRScan] Scanning token:', qrToken);
      // /api/v1/auth/qr/scan
      const data = await apiClient.post<{ success?: boolean; error?: string }>(
        '/auth/qr/scan',
        { qr_token: qrToken }
      );

      if (data && (data.success || (data as any).ok)) {
        Alert.alert('Успех', 'Вход на сайте выполнен!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось выполнить вход на сайте', [
          { text: 'OK', onPress: () => { scannedRef.current = false; } }
        ]);
      }
    } catch (err: any) {
      console.error('[QRScan] Scan request failed:', err);
      Alert.alert('Ошибка', err.message || 'Ошибка соединения с сервером', [
        { text: 'OK', onPress: () => { scannedRef.current = false; } }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const device = useCameraDevice('back');
  
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      const qrValue = codes[0]?.value;
      if (qrValue) {
        handleQRScan(qrValue);
      }
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Вход по QR-коду</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.cameraWrapper}>
        {hasPermission && device ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!scannedRef.current}
            codeScanner={codeScanner}
          />
        ) : (
          <View style={styles.fallbackView}>
            {!hasPermission ? (
              <View style={styles.permissionBlock}>
                <Icon name="camera-off-outline" size={48} color="#888" />
                <Text style={styles.fallbackText}>Нет доступа к камере</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>Разрешить доступ</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ActivityIndicator size="large" color="#6c5ce7" />
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Тестирование на симуляторе</Text>
        <Text style={styles.footerSubtitle}>
          Если камера недоступна, вы можете ввести токен вручную для проверки:
        </Text>
        <View style={styles.manualInputRow}>
          <TextInput
            style={styles.input}
            placeholder="Введи qr_token"
            placeholderTextColor="#666"
            value={qrInput}
            onChangeText={setQrInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !qrInput.trim() && styles.disabledBtn]}
            onPress={() => handleQRScan(qrInput.trim())}
            disabled={!qrInput.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraWrapper: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionBlock: {
    alignItems: 'center',
  },
  fallbackText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  permissionBtn: {
    marginTop: 20,
    backgroundColor: '#6c5ce7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  footerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSubtitle: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 12,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    fontSize: 14,
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#6c5ce7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    backgroundColor: '#444',
  },
});
