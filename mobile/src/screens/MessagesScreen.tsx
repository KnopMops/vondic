import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {useAppSelector} from '@/store/hooks';
import {apiClient} from '@/api/client';
import Icon from 'react-native-vector-icons/Ionicons';
import {crashLogger} from '@/utils/crashLogger';
import {useCallStore} from '@/store/callStore';
import {socketService} from '@/services/SocketService';
import {useChannels} from '@/hooks/useChannels';
import {useGroups} from '@/hooks/useGroups';
import {useCommunities} from '@/hooks/useCommunities';
import {Config} from '@/constants/config';

interface ChatPreview {
  id: string;
  name: string;
  avatar_url?: string | null;
  type: 'dm' | 'group' | 'channel';
  last_message?: string;
  unread_count?: number;
  timestamp?: string;
}

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function MessagesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAppSelector(state => state.auth);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [socketStatus, setSocketStatus] = useState<string>('неизвестно');
  const {channels, fetchMyChannels} = useChannels();
  const {groups, fetchMyGroups} = useGroups();
  const {communities, fetchMyCommunities} = useCommunities();

  useEffect(() => {
    const interval = setInterval(() => {
      const s = socketService.getSocket();
      const status = s?.connected ? '✅ онлайн' : (s ? '⏳ подключение...' : '❌ нет соединения');
      setSocketStatus(status);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadChats = async () => {
    try {
      crashLogger.logCrash({message: '[Messages] Loading chats...', name: 'Info'}, 'MessagesScreen', {});
      const recent = await apiClient.get<{items: any[]}>('/dm/recent');
      const dmChats: ChatPreview[] = (recent?.items || []).map((r: any) => ({
        id: r.id || r.target_id,
        name: r.username || r.name || 'Неизвестно',
        avatar_url: r.avatar_url,
        type: 'dm',
        last_message: r.last_message_text,
        unread_count: r.unread_count,
        timestamp: r.last_message_at,
      }));

      // Fetch directly to avoid React state batching issues
      const [groupsData, channelsData, communitiesData] = await Promise.all([
        apiClient.post<any[]>('/groups/my', {}).catch(() => []),
        apiClient.post<any[]>('/channels/my', {}).catch(() => []),
        apiClient.post<any[]>('/communities/my', {}).catch(() => []),
      ]);

      const groupChats: ChatPreview[] = (Array.isArray(groupsData) ? groupsData : []).map((g: any) => ({
        id: g.id,
        name: g.name,
        avatar_url: g.avatar_url,
        type: 'group',
      }));

      const channelChats: ChatPreview[] = (Array.isArray(channelsData) ? channelsData : []).map((c: any) => ({
        id: c.id,
        name: c.name,
        avatar_url: c.avatar_url,
        type: 'channel',
      }));

      const communityChats: ChatPreview[] = (Array.isArray(communitiesData) ? communitiesData : []).map((c: any) => ({
        id: c.id,
        name: c.name,
        avatar_url: c.avatar_url,
        type: 'group',
      }));

      setChats([...dmChats, ...groupChats, ...channelChats, ...communityChats]);
    } catch (error) {
      console.error('[Messages] Failed to load chats:', error);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderItem = ({item}: {item: ChatPreview}) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => {
        try {
          crashLogger.logCrash({message: '[Messages] Navigating to Chat', name: 'Info'}, 'MessagesScreen', {
            type: item.type, id: item.id, name: item.name,
          });
          navigation.navigate('Chat', {
            type: item.type,
            id: item.id,
            name: item.name,
            avatar: item.avatar_url,
          });
        } catch (navErr: any) {
          crashLogger.logCrash(navErr, 'MessagesScreen_navigate', {item});
          Alert.alert('Ошибка', 'Не удалось открыть чат: ' + (navErr?.message || 'Unknown'));
        }
      }
      }>
      {item.avatar_url ? (
        <Image
          source={{uri: item.avatar_url.startsWith('http') ? item.avatar_url : Config.BACKEND_URL + item.avatar_url}}
          style={styles.avatarImage}
        />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.name}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message || 'Нет сообщений'}
        </Text>
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
        {item.type === 'dm' && (
          <TouchableOpacity
            onPress={() => {
              try {
                useCallStore.getState().initiateCall(item.id, item.name);
                navigation.navigate('Call', {targetUserId: item.id});
              } catch (err: any) {
                crashLogger.logCrash(err, 'MessagesScreen_call', {item});
              }
            }}>
            <Icon name="call" size={20} color="#6c5ce7" />
          </TouchableOpacity>
        )}
        {item.unread_count ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unread_count}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Сообщения</Text>
        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
          <Text style={{color: '#888', fontSize: 12}}>Socket: {socketStatus}</Text>
          <TouchableOpacity
            style={{marginLeft: 8, backgroundColor: '#1a1a1a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4}}
            onPress={() => socketService.connect().catch(() => {})}>
            <Text style={{color: '#6c5ce7', fontSize: 11}}>переподключить</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.searchBar}>
        <Icon name="search" size={18} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск чатов..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <FlatList
        data={filteredChats}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
        contentContainerStyle={{paddingBottom: 16}}
      />
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
    backgroundColor: '#0f0f0f',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    marginLeft: 8,
    fontSize: 15,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#1a1a1a',
    borderBottomWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  lastMessage: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
