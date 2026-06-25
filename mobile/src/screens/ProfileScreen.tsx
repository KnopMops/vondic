import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import {useAppSelector, useAppDispatch} from '@/store/hooks';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {logout, setUser} from '@/store/authSlice';
import {apiClient, clearTokens} from '@/api/client';
import {socketService} from '@/services/SocketService';
import {useCallStore} from '@/store/callStore';
import {pushService} from '@/services/PushService';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Config} from '@/constants/config';
import ScreenHeader from '@/components/ScreenHeader';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [description, setDescription] = useState(user?.description || '');
  const [stats, setStats] = useState({followers: 0, following: 0, posts: 0});
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStats = async () => {
    if (!user?.id) return;
    try {
      const [followersRes, followingRes, postsRes] = await Promise.all([
        apiClient.post('/subscriptions/followers', {user_id: user.id}).catch(() => ({items: []})),
        apiClient.post('/subscriptions/following', {user_id: user.id}).catch(() => ({items: []})),
        apiClient.get(`/posts?user_id=${user.id}&per_page=1`).catch(() => ({total: 0})),
      ]) as [{items?: any[]; count?: number}, {items?: any[]; count?: number}, {total?: number}];
      setStats({
        followers: Array.isArray(followersRes) ? followersRes.length : (followersRes.items?.length || followersRes.count || 0),
        following: Array.isArray(followingRes) ? followingRes.length : (followingRes.items?.length || followingRes.count || 0),
        posts: postsRes.total || 0,
      });
    } catch (err) {
      console.error('[Profile] Failed to load stats:', err);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user?.id]);

  const handleLogout = () => {
    Alert.alert('Выйти', 'Вы уверены, что хотите выйти?', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          socketService.disconnect();
          useCallStore.getState().cleanup();
          pushService.cleanup();
          await clearTokens();
          await AsyncStorage.multiRemove([
            'e2e_master_key',
            ...Array.from({length: 50}, (_, i) => `e2e_key_${i}`),
          ]);
          dispatch(logout());
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const updated = await apiClient.put<Record<string, any>>('/users/', {
        user_id: user.id,
        username: username.trim(),
        description: description.trim(),
      });
      dispatch(setUser({...user, ...updated}));
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось обновить профиль');
    } finally {
      setSaving(false);
    }
  };

  const avatarUrl = user?.avatar_url
    ? (user.avatar_url.startsWith('http') ? user.avatar_url : Config.BACKEND_URL + user.avatar_url)
    : null;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Профиль"
        rightElement={
          <TouchableOpacity
            style={{width: 40, height: 40, alignItems: 'center', justifyContent: 'center'}}
            onPress={() => navigation.navigate('Settings')}>
            <Icon name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        }
      />
      <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 40}}>
        <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{uri: avatarUrl}} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <Text style={styles.username}>{user?.username || 'Неизвестно'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.posts}</Text>
            <Text style={styles.statLabel}>Посты</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.followers}</Text>
            <Text style={styles.statLabel}>Подписчики</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.following}</Text>
            <Text style={styles.statLabel}>Подписки</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Аккаунт</Text>
        {editing ? (
          <>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Имя пользователя"
              placeholderTextColor="#666"
            />
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="О себе"
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Сохранить</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, {backgroundColor: '#333'}]} onPress={() => setEditing(false)}>
              <Text style={styles.buttonText}>Отмена</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.row} onPress={() => setEditing(true)}>
            <Icon name="create-outline" size={22} color="#fff" />
            <Text style={styles.rowText}>Редактировать профиль</Text>
            <Icon name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        )}

        {user?.description && !editing && (
          <View style={[styles.row, {flexDirection: 'column', alignItems: 'flex-start'}]}>
            <Text style={[styles.rowText, {color: '#888', fontSize: 13, marginBottom: 4}]}>О себе</Text>
            <Text style={{color: '#fff', fontSize: 14}}>{user.description}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('NotificationsSettings')}>
          <Icon name="notifications-outline" size={22} color="#fff" />
          <Text style={styles.rowText}>Уведомления</Text>
          <Icon name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('PrivacySettings')}>
          <Icon name="shield-checkmark-outline" size={22} color="#fff" />
          <Text style={styles.rowText}>Конфиденциальность</Text>
          <Icon name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Выйти</Text>
      </TouchableOpacity>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileCard: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  username: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  email: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    fontSize: 15,
  },
  button: {
    backgroundColor: '#6c5ce7',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#ff4444',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
