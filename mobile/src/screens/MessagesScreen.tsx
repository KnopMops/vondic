import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
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
import {appLog} from '@/utils/appLogger';
import {useCallStore} from '@/store/callStore';
import {socketService} from '@/services/SocketService';
import {useChannels} from '@/hooks/useChannels';
import {useGroups} from '@/hooks/useGroups';
import {useCommunities} from '@/hooks/useCommunities';
import {Config} from '@/constants/config';
import {tryDecryptE2EPreviewWithKeyIds} from '@/hooks/useChat';
import ScreenHeader from '@/components/ScreenHeader';
import SearchModal from '@/components/SearchModal';

interface ChatPreview {
  id: string;
  name: string;
  avatar_url?: string | null;
  type: 'dm' | 'group' | 'channel';
  last_message?: string;
  unread_count?: number;
  timestamp?: string;
  community_id?: string | null;
}

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function MessagesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAppSelector(state => state.auth);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [communitiesList, setCommunitiesList] = useState<any[]>([]);
  const [expandedCommunities, setExpandedCommunities] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'direct' | 'group' | 'channel' | 'community'>('direct');
  const [refreshing, setRefreshing] = useState(false);
  const [socketStatus, setSocketStatus] = useState<string>('неизвестно');
  const [decryptedPreviews, setDecryptedPreviews] = useState<Record<string, string>>({});
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const filteredChats = chats.filter(chat => {
    if (activeTab === 'direct') {
      return chat.type === 'dm';
    } else if (activeTab === 'group') {
      return chat.type === 'group';
    } else if (activeTab === 'channel') {
      return chat.type === 'channel' && !chat.community_id;
    }
    return false;
  });

  const {channels, fetchMyChannels} = useChannels();
  const {groups, fetchMyGroups} = useGroups();
  const {communities, fetchMyCommunities} = useCommunities();

  useEffect(() => {
    if (user?.id) {
      console.log('[MessagesScreen] Auto-connecting socket for user', user.id);
      socketService.connect().catch(err => console.error('[MessagesScreen] Socket connect error:', err));
    }
    const interval = setInterval(() => {
      const s = socketService.getSocket();
      let status = s?.connected
        ? socketService.isAuthenticated()
          ? '✅ онлайн'
          : '⏳ подключен, но не авторизован'
        : s
        ? '⏳ подключение...'
        : '❌ нет соединения';
      const err = socketService.getLastError();
      if (err) {
        status += ` (ошибка: ${err.slice(0, 60)})`;
      }
      setSocketStatus(status);
    }, 2000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const loadChats = async () => {
    try {
      appLog('MessagesScreen', 'Loading chats...');
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
        community_id: c.community_id,
      }));

      setCommunitiesList(Array.isArray(communitiesData) ? communitiesData : []);
      setChats([...dmChats, ...groupChats, ...channelChats]);

      // Decrypt E2EE DM previews asynchronously
      if (user?.id) {
        const decrypted: Record<string, string> = {};
        await Promise.all(
          dmChats.map(async chat => {
            const text = chat.last_message;
            if (!text || !text.startsWith('e2e:')) return;
            const keyIds = [
              [user.id, chat.id].sort().join(':'),
              `${user.id}:${chat.id}`,
              `${chat.id}:${user.id}`,
            ];
            const plain = await tryDecryptE2EPreviewWithKeyIds(text, keyIds);
            if (plain) decrypted[chat.id] = plain;
          }),
        );
        setDecryptedPreviews(decrypted);
      }
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

  const toggleCommunityExpand = (commId: string) => {
    setExpandedCommunities(prev => ({...prev, [commId]: !prev[commId]}));
  };

  const renderItem = ({item}: {item: ChatPreview}) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => {
        try {
          appLog('MessagesScreen', 'Navigating to Chat', {
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
          {decryptedPreviews[item.id] || item.last_message || 'Нет сообщений'}
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

  const renderCommunityItem = ({item}: {item: any}) => {
    const isExpanded = !!expandedCommunities[item.id];
    const commChannels = chats.filter(ch => ch.type === 'channel' && ch.community_id === item.id);

    return (
      <View style={styles.communityContainer}>
        <TouchableOpacity
          style={styles.communityHeader}
          onPress={() => toggleCommunityExpand(item.id)}>
          {item.avatar_url ? (
            <Image
              source={{uri: item.avatar_url.startsWith('http') ? item.avatar_url : Config.BACKEND_URL + item.avatar_url}}
              style={styles.communityAvatarImage}
            />
          ) : (
            <View style={styles.communityAvatar}>
              <Text style={styles.communityAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.communityInfo}>
            <Text style={styles.communityName}>{item.name}</Text>
            <Text style={styles.communityDesc} numberOfLines={1}>
              {item.description || 'Сообщество Вондик'}
            </Text>
          </View>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#888"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.communityChannelsList}>
            {commChannels.length > 0 ? (
              commChannels.map(channel => (
                <TouchableOpacity
                  key={channel.id}
                  style={styles.communityChannelItem}
                  onPress={() => {
                    navigation.navigate('Chat', {
                      type: 'channel',
                      id: channel.id,
                      name: channel.name,
                      avatar: channel.avatar_url,
                    });
                  }}>
                  <Icon name="megaphone-outline" size={18} color="#6c5ce7" />
                  <Text style={styles.communityChannelName}>{channel.name}</Text>
                  {channel.unread_count ? (
                    <View style={styles.channelBadge}>
                      <Text style={styles.channelBadgeText}>{channel.unread_count}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noChannelsText}>Нет доступных каналов</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Сообщения"
        showSearch
        onSearchPress={() => setSearchModalVisible(true)}
      />
      <View style={{paddingHorizontal: 16, paddingBottom: 8}}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Text style={{color: '#888', fontSize: 12}}>Socket: {socketStatus}</Text>
          <TouchableOpacity
            style={{marginLeft: 8, backgroundColor: '#1a1a1a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4}}
            onPress={() => socketService.connect().catch(() => {})}>
            <Text style={{color: '#6c5ce7', fontSize: 11}}>переподключить</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'direct' && styles.activeTabButton]}
          onPress={() => setActiveTab('direct')}>
          <Text style={[styles.tabText, activeTab === 'direct' && styles.activeTabText]}>
            Личные
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'group' && styles.activeTabButton]}
          onPress={() => setActiveTab('group')}>
          <Text style={[styles.tabText, activeTab === 'group' && styles.activeTabText]}>
            Группы
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'channel' && styles.activeTabButton]}
          onPress={() => setActiveTab('channel')}>
          <Text style={[styles.tabText, activeTab === 'channel' && styles.activeTabText]}>
            Каналы
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'community' && styles.activeTabButton]}
          onPress={() => setActiveTab('community')}>
          <Text style={[styles.tabText, activeTab === 'community' && styles.activeTabText]}>
            Сообщества
          </Text>
        </TouchableOpacity>
      </View>

      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        data={chats}
        placeholder="Поиск чатов..."
        searchKey={item => item.name}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={({item}) => renderItem({item})}
        emptyText="Чаты не найдены"
      />

      {activeTab === 'community' ? (
        <FlatList
          data={communitiesList}
          keyExtractor={item => `community-${item.id}`}
          renderItem={renderCommunityItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
          contentContainerStyle={{paddingBottom: 16, flexGrow: 1}}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="people-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>Нет доступных сообществ</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={item => `${item.type}-${item.id}`}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c5ce7" />}
          contentContainerStyle={{paddingBottom: 16, flexGrow: 1}}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon
                name={
                  activeTab === 'direct'
                    ? 'chatbubbles-outline'
                    : activeTab === 'group'
                    ? 'people-outline'
                    : 'megaphone-outline'
                }
                size={48}
                color="#333"
              />
              <Text style={styles.emptyText}>
                {activeTab === 'direct'
                  ? 'Нет диалогов'
                  : activeTab === 'group'
                  ? 'Нет групповых чатов'
                  : 'Нет доступных каналов'}
              </Text>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#16161a',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#222226',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#6c5ce7',
    shadowColor: '#6c5ce7',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  communityContainer: {
    backgroundColor: '#16161a',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222226',
    overflow: 'hidden',
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  communityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  communityAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  communityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  communityName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  communityDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  communityChannelsList: {
    paddingLeft: 20,
    paddingRight: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#222226',
  },
  communityChannelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222226',
  },
  communityChannelName: {
    color: '#ddd',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  noChannelsText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  channelBadge: {
    backgroundColor: '#6c5ce7',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  channelBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
