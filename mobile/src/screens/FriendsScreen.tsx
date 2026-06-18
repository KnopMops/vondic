import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {apiClient} from '@/api/client';
import {useAppSelector} from '@/store/hooks';
import {useCallStore} from '@/store/callStore';
import Icon from 'react-native-vector-icons/Ionicons';
import {Config} from '@/constants/config';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface Friend {
  id: string;
  username: string;
  avatar_url?: string;
  status?: string;
}

interface FriendRequest {
  id: string;
  username: string;
  avatar_url?: string;
  request_created_at: string;
}

export default function FriendsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAppSelector(state => state.auth);
  const [activeTab, setActiveTab] = useState<'my' | 'requests'>('my');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      if (activeTab === 'my') {
        const res = await apiClient.post<Friend[]>('/friends/list', {user_id: user.id});
        setFriends(Array.isArray(res) ? res : []);
      } else {
        const res = await apiClient.post<FriendRequest[]>('/friends/requests', {user_id: user.id});
        setRequests(Array.isArray(res) ? res : []);
      }
    } catch (err: any) {
      console.error('[Friends] Load error:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = (friendId: string) => {
    Alert.alert('Удалить друга', 'Вы уверены, что хотите удалить этого пользователя из друзей?', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(friendId);
          try {
            await apiClient.post('/friends/remove', {friend_id: friendId});
            setFriends(prev => prev.filter(f => f.id !== friendId));
          } catch (err) {
            Alert.alert('Ошибка', 'Не удалось удалить друга');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleAcceptRequest = async (requesterId: string) => {
    setActionLoading(requesterId);
    try {
      await apiClient.post('/friends/accept', {requester_id: requesterId});
      setRequests(prev => prev.filter(r => r.id !== requesterId));
      Alert.alert('Успех', 'Заявка в друзья принята');
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось принять заявку');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    setActionLoading(requesterId);
    try {
      await apiClient.post('/friends/reject', {requester_id: requesterId});
      setRequests(prev => prev.filter(r => r.id !== requesterId));
      Alert.alert('Успех', 'Заявка отклонена');
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось отклонить заявку');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartCall = async (friend: Friend) => {
    try {
      const initiateCall = useCallStore.getState().initiateCall;
      await initiateCall(friend.id, friend.username);
      navigation.navigate('Call', {
        targetUserId: friend.id,
        isIncoming: false,
      });
    } catch (err: any) {
      Alert.alert('Ошибка звонка', err.message || 'Не удалось начать звонок');
    }
  };

  const filteredFriends = friends.filter(
    f =>
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAvatarSource = (url?: string) => {
    if (!url) return null;
    return url.startsWith('http') ? {uri: url} : {uri: Config.BACKEND_URL + url};
  };

  const renderFriendItem = ({item}: {item: Friend}) => (
    <View style={styles.listItem}>
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={getAvatarSource(item.avatar_url)!} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View
          style={[
            styles.statusIndicator,
            {backgroundColor: item.status === 'online' ? '#2ecc71' : '#7f8c8d'},
          ]}
        />
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>@{item.username}</Text>
        <Text style={styles.subtext}>
          {item.status === 'online' ? 'В сети' : 'Не в сети'}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            navigation.navigate('Chat', {
              type: 'dm',
              id: item.id,
              name: item.username,
              avatar: item.avatar_url,
            })
          }>
          <Icon name="chatbubble-ellipses-outline" size={22} color="#6c5ce7" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleStartCall(item)}>
          <Icon name="call-outline" size={22} color="#2ecc71" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleRemoveFriend(item.id)}
          disabled={actionLoading === item.id}>
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color="#ff4757" />
          ) : (
            <Icon name="trash-outline" size={22} color="#ff4757" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRequestItem = ({item}: {item: FriendRequest}) => (
    <View style={styles.listItem}>
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={getAvatarSource(item.avatar_url)!} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>@{item.username}</Text>
        <Text style={styles.subtext}>
          Заявка от {new Date(item.request_created_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.acceptBtn]}
          onPress={() => handleAcceptRequest(item.id)}
          disabled={actionLoading === item.id}>
          <Text style={styles.btnText}>Принять</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.rejectBtn]}
          onPress={() => handleRejectRequest(item.id)}
          disabled={actionLoading === item.id}>
          <Text style={styles.btnText}>Отклонить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Друзья</Text>
        <View style={{width: 40}} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}>
          <Text style={[styles.tabLabel, activeTab === 'my' && styles.activeTabLabel]}>
            Мои друзья
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}>
          <Text style={[styles.tabLabel, activeTab === 'requests' && styles.activeTabLabel]}>
            Заявки
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'my' && (
        <View style={styles.searchContainer}>
          <Icon name="search-outline" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по имени пользователя..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#6c5ce7" size="large" style={{marginTop: 50}} />
      ) : activeTab === 'my' ? (
        <FlatList
          data={filteredFriends}
          keyExtractor={item => item.id}
          renderItem={renderFriendItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>У вас пока нет друзей</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderRequestItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Нет входящих заявок в друзья</Text>
            </View>
          }
        />
      )}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#6c5ce7',
  },
  tabLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 15,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subtext: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  acceptBtn: {
    backgroundColor: '#2ecc71',
  },
  rejectBtn: {
    backgroundColor: '#e74c3c',
  },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 55,
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
  },
});
