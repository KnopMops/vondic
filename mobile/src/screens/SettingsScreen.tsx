import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [detailedLogging, setDetailedLogging] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const val = await AsyncStorage.getItem('detailed_logging');
      setDetailedLogging(val === 'true');
    } catch (err) {
      console.warn('[Settings] Load error:', err);
    }
  };

  const handleToggleLogging = async (value: boolean) => {
    setDetailedLogging(value);
    try {
      await AsyncStorage.setItem('detailed_logging', value ? 'true' : 'false');
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось сохранить настройки логирования');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Настройки</Text>
        <View style={{width: 40}} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowText}>Подробное логирование</Text>
            <Text style={styles.subtext}>Позволяет просматривать отладочные логи</Text>
          </View>
          <Switch
            value={detailedLogging}
            onValueChange={handleToggleLogging}
            trackColor={{false: '#333', true: '#6c5ce7'}}
            thumbColor={detailedLogging ? '#fff' : '#888'}
          />
        </View>

        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('NotificationsSettings')}>
          <Icon name="notifications-outline" size={22} color="#fff" />
          <Text style={styles.linkText}>Уведомления</Text>
          <Icon name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('PrivacySettings')}>
          <Icon name="shield-checkmark-outline" size={22} color="#fff" />
          <Text style={styles.linkText}>Конфиденциальность</Text>
          <Icon name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('QRScan')}>
          <Icon name="qr-code-outline" size={22} color="#fff" />
          <Text style={styles.linkText}>Войти по QR-коду на сайте</Text>
          <Icon name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>
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
  content: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  rowInfo: {
    flex: 1,
    marginRight: 12,
  },
  rowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  subtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  linkText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
});
