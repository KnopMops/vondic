import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {apiClient} from '@/api/client';
import Icon from 'react-native-vector-icons/Ionicons';

interface NotifSettings {
  notifAlerts: boolean;
  notifSounds: boolean;
  notifIncomingCall: boolean;
  ringtoneVolume: number;
  messageVolume: number;
  loginAlertEnabled: boolean;
}

const STORAGE_KEY = '@vondic_notif_settings';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function NotificationsSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [settings, setSettings] = useState<NotifSettings>({
    notifAlerts: true,
    notifSounds: true,
    notifIncomingCall: true,
    ringtoneVolume: 80,
    messageVolume: 70,
    loginAlertEnabled: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const local = raw ? JSON.parse(raw) : {};

      // Load login alert from server
      let loginAlert = false;
      try {
        const serverData = await apiClient.get<{login_alert_enabled?: boolean}>('/auth/login-alerts/status');
        loginAlert = serverData?.login_alert_enabled ?? false;
      } catch {
        // ignore
      }

      setSettings({
        notifAlerts: local.notifAlerts ?? true,
        notifSounds: local.notifSounds ?? true,
        notifIncomingCall: local.notifIncomingCall ?? true,
        ringtoneVolume: local.ringtoneVolume ?? 80,
        messageVolume: local.messageVolume ?? 70,
        loginAlertEnabled: loginAlert,
      });
    } catch (err) {
      console.error('[NotifSettings] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveLocal = async (next: NotifSettings) => {
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleLoginAlert = async (value: boolean) => {
    const next = {...settings, loginAlertEnabled: value};
    setSettings(next);
    try {
      await apiClient.post('/auth/login-alerts/toggle', {enable: value});
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось сохранить настройку');
      setSettings(settings);
    }
  };

  const VolumeBar = ({label, value, onChange}: {label: string; value: number; onChange: (v: number) => void}) => (
    <View style={styles.volumeRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.volumeBar}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
          const active = i < Math.ceil(value / 10);
          return (
            <TouchableOpacity
              key={i}
              style={[styles.volumeSegment, active && styles.volumeSegmentActive]}
              onPress={() => onChange((i + 1) * 10)}
            />
          );
        })}
      </View>
      <Text style={styles.volumeValue}>{value}%</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Уведомления</Text>
          <View style={{width: 40}} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Уведомления</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Общие</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Оповещения</Text>
          <Switch
            value={settings.notifAlerts}
            onValueChange={(v) => saveLocal({...settings, notifAlerts: v})}
            trackColor={{false: '#333', true: '#6c5ce7'}}
            thumbColor={settings.notifAlerts ? '#fff' : '#888'}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Звуки</Text>
          <Switch
            value={settings.notifSounds}
            onValueChange={(v) => saveLocal({...settings, notifSounds: v})}
            trackColor={{false: '#333', true: '#6c5ce7'}}
            thumbColor={settings.notifSounds ? '#fff' : '#888'}
          />
        </View>

        <Text style={[styles.sectionTitle, {marginTop: 24}]}>Громкость</Text>
        <VolumeBar
          label="Рингтон"
          value={settings.ringtoneVolume}
          onChange={(v) => saveLocal({...settings, ringtoneVolume: v})}
        />
        <VolumeBar
          label="Сообщения"
          value={settings.messageVolume}
          onChange={(v) => saveLocal({...settings, messageVolume: v})}
        />

        <Text style={[styles.sectionTitle, {marginTop: 24}]}>Звонки</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Оповещение о входящем</Text>
          <Switch
            value={settings.notifIncomingCall}
            onValueChange={(v) => saveLocal({...settings, notifIncomingCall: v})}
            trackColor={{false: '#333', true: '#6c5ce7'}}
            thumbColor={settings.notifIncomingCall ? '#fff' : '#888'}
          />
        </View>

        <Text style={[styles.sectionTitle, {marginTop: 24}]}>Безопасность</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Письмо при входе</Text>
          <Switch
            value={settings.loginAlertEnabled}
            onValueChange={toggleLoginAlert}
            trackColor={{false: '#333', true: '#6c5ce7'}}
            thumbColor={settings.loginAlertEnabled ? '#fff' : '#888'}
          />
        </View>
      </ScrollView>
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
    backgroundColor: '#0f0f0f',
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
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  rowLabel: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginRight: 12,
  },
  volumeRow: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  volumeBar: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
    alignItems: 'center',
  },
  volumeSegment: {
    flex: 1,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  volumeSegmentActive: {
    backgroundColor: '#6c5ce7',
  },
  volumeValue: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'right',
  },
});
