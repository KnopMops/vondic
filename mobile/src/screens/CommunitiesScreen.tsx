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
import Icon from 'react-native-vector-icons/Ionicons';
import {Config} from '@/constants/config';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface Community {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  invite_code?: string;
  members_count?: number;
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  community_id: string;
}

export default function CommunitiesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<'my' | 'join'>('my');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Community[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [expandedCommunityId, setExpandedCommunityId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Record<string, Channel[]>>({});
  const [channelsLoading, setChannelsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<Community[]>('/communities/my', {});
      setCommunities(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('[Communities] My load error:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить ваши сообщества');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await apiClient.post<{communities: Community[]}>('/communities/search', {
        query: searchQuery.trim(),
      });
      setSearchResults(res?.communities || []);
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось выполнить поиск');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Предупреждение', 'Пожалуйста, введите код приглашения');
      return;
    }
    setJoining(true);
    try {
      const community = await apiClient.post<Community>('/communities/join', {
        invite_code: inviteCode.trim(),
      });
      Alert.alert('Успех', `Вы успешно вступили в сообщество "${community.name}"`);
      setInviteCode('');
      loadCommunities();
      setActiveTab('my');
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось вступить в сообщество. Проверьте код.');
    } finally {
      setJoining(false);
    }
  };

  const toggleExpandCommunity = async (communityId: string) => {
    if (expandedCommunityId === communityId) {
      setExpandedCommunityId(null);
      return;
    }
    setExpandedCommunityId(communityId);
    if (channels[communityId]) return; // already loaded

    setChannelsLoading(prev => ({...prev, [communityId]: true}));
    try {
      const res = await apiClient.get<Channel[]>(`/communities/${communityId}/channels`);
      setChannels(prev => ({...prev, [communityId]: res || []}));
    } catch (err) {
      console.error('[Communities] Channels load error:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить каналы сообщества');
    } finally {
      setChannelsLoading(prev => ({...prev, [communityId]: false}));
    }
  };

  const getAvatarSource = (url?: string) => {
    if (!url) return null;
    return url.startsWith('http') ? {uri: url} : {uri: Config.BACKEND_URL + url};
  };

  const renderCommunityItem = ({item}: {item: Community}) => {
    const isExpanded = expandedCommunityId === item.id;
    const communityChannels = channels[item.id] || [];
    const isChanLoading = channelsLoading[item.id];

    return (
      <View style={styles.communityCard}>
        <TouchableOpacity style={styles.itemHeader} onPress={() => toggleExpandCommunity(item.id)}>
          {item.avatar_url ? (
            <Image source={getAvatarSource(item.avatar_url)!} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.infoContainer}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.subtext}>
              {item.description || 'Нет описания'} · {item.members_count || 1} участников
            </Text>
          </View>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#888"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.channelsSection}>
            <View style={styles.divider} />
            <Text style={styles.sectionHeader}>Каналы сообщества</Text>
            {isChanLoading ? (
              <ActivityIndicator color="#6c5ce7" size="small" style={{marginVertical: 12}} />
            ) : communityChannels.length > 0 ? (
              communityChannels.map(ch => (
                <TouchableOpacity
                  key={ch.id}
                  style={styles.channelRow}
                  onPress={() =>
                    navigation.navigate('Chat', {
                      type: 'channel',
                      id: ch.id,
                      name: `# ${ch.name}`,
                    })
                  }>
                  <Icon name="hash" size={18} color="#6c5ce7" style={{marginRight: 8}} />
                  <Text style={styles.channelName}>{ch.name}</Text>
                  <Icon name="chevron-forward" size={16} color="#444" />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noChannelsText}>В этом сообществе ещё нет каналов</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Сообщества</Text>
        <View style={{width: 40}} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}>
          <Text style={[styles.tabLabel, activeTab === 'my' && styles.activeTabLabel]}>
            Мои сообщества
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'join' && styles.activeTab]}
          onPress={() => setActiveTab('join')}>
          <Text style={[styles.tabLabel, activeTab === 'join' && styles.activeTabLabel]}>
            Поиск и вход
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'my' ? (
        loading ? (
          <ActivityIndicator color="#6c5ce7" size="large" style={{marginTop: 50}} />
        ) : (
          <FlatList
            data={communities}
            keyExtractor={item => item.id}
            renderItem={renderCommunityItem}
            contentContainerStyle={{paddingBottom: 20, paddingTop: 12}}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Вы ещё не состоите ни в одном сообществе</Text>
              </View>
            }
          />
        )
      ) : (
        <View style={styles.joinContainer}>
          <Text style={styles.sectionTitle}>Вступить по коду</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Код приглашения..."
              placeholderTextColor="#888"
              value={inviteCode}
              onChangeText={setInviteCode}
            />
            <TouchableOpacity style={styles.joinBtn} onPress={handleJoinByCode} disabled={joining}>
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.joinBtnText}>Войти</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 24}]}>Поиск публичных сообществ</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Название сообщества..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Icon name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#6c5ce7" size="small" style={{marginTop: 20}} />
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              renderItem={renderCommunityItem}
              style={{marginTop: 12}}
            />
          ) : searchQuery.trim() ? (
            <Text style={styles.noResultsText}>Ничего не найдено</Text>
          ) : null}
        </View>
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
  communityCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  subtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: '#262626',
    marginHorizontal: 12,
    marginVertical: 4,
  },
  channelsSection: {
    paddingBottom: 12,
  },
  sectionHeader: {
    color: '#6c5ce7',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  channelName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  noChannelsText: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 8,
  },
  joinContainer: {
    padding: 16,
    flex: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 15,
  },
  joinBtn: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  searchBtn: {
    width: 46,
    height: 46,
    backgroundColor: '#6c5ce7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 30,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});
