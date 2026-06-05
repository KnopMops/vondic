import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {apiClient} from '@/api/client';
import Icon from 'react-native-vector-icons/Ionicons';

interface PrivacySettings {
  show_email: boolean;
  show_online_status: boolean;
  show_last_seen: boolean;
  allow_friend_requests: boolean;
}

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function PrivacySettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>({
    show_email: false,
    show_online_status: true,
    show_last_seen: true,
    allow_friend_requests: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const user = await apiClient.get<any>('/users/me');
      const ps = user?.privacy_settings || {};
      setSettings({
        show_email: ps.show_email ?? false,
        show_online_status: ps.show_online_status ?? true,
        show_last_seen: ps.show_last_seen ?? true,
        allow_friend_requests: ps.allow_friend_requests ?? true,
      });
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: keyof PrivacySettings, value: boolean) => {
    const next = {...settings, [key]: value};
    setSettings(next);
    setSaving(true);
    try {
      await apiClient.put('/users/me', {privacy_settings: next});
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось сохранить настройку');
      setSettings(settings); // revert
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (label: string, key: keyof PrivacySettings) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={settings[key]}
        onValueChange={(v) => saveSetting(key, v)}
        trackColor={{false: '#333', true: '#6c5ce7'}}
        thumbColor={settings[key] ? '#fff' : '#888'}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#6c5ce7" style={{marginTop: 100}} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Конфиденциальность</Text>
        <View style={{width: 40}} />
      </View>

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#6c5ce7" />
          <Text style={styles.savingText}>Сохранение...</Text>
        </View>
      )}

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Кто видит мои данные</Text>
        {renderRow('Показывать email', 'show_email')}
        {renderRow('Статус в сети', 'show_online_status')}
        {renderRow('Последний раз в сети', 'show_last_seen')}

        <Text style={[styles.sectionTitle, {marginTop: 24}]}>Взаимодействия</Text>
        {renderRow('Разрешить запросы в друзья', 'allow_friend_requests')}
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
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  savingText: {
    color: '#888',
    fontSize: 12,
    marginLeft: 8,
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
});
